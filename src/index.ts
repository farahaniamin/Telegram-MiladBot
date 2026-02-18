import { initializeConfig, CONFIG } from './config.js'
import { createBot } from './bot/bot.js'
import { validatePatient } from './services/hospital.client.js'
import { runSchedulerTick } from './core/scheduler.js'
import { seedInfirmaries } from './storage/infirmary.repo.js'
import { INFIRMARY_SEED } from './data/infirmaries.seed.js'
import { formatTimingMessage } from './core/format.js'
import { setDatabase, initializeDatabase } from './storage/db.js'
import { InlineKeyboard } from 'grammy'
import type { D1Database } from '@cloudflare/workers-types'
import type { Update } from 'grammy/types'

// Environment type definition
export interface Env {
  DB: D1Database
  BOT_TOKEN: string
  ADMIN_IDS: string
  SYSTEM_NATIONAL_CODE: string
  DEFAULT_INTERVAL_MIN?: string
  JITTER_SEC?: string
}

let bot: ReturnType<typeof createBot> | null = null
let isInitialized = false

async function initialize(env: Env) {
  if (isInitialized) return
  
  try {
    console.log('🚀 Starting initialization...')
    
    // Initialize config from environment
    console.log('⚙️ Initializing config...')
    initializeConfig({
      BOT_TOKEN: env.BOT_TOKEN,
      ADMIN_IDS: env.ADMIN_IDS,
      SYSTEM_NATIONAL_CODE: env.SYSTEM_NATIONAL_CODE,
      DEFAULT_INTERVAL_MIN: env.DEFAULT_INTERVAL_MIN ?? undefined,
      JITTER_SEC: env.JITTER_SEC ?? undefined
    })
    console.log('✅ Config initialized')
    
    // Set up database
    console.log('🗄️ Setting up database...')
    setDatabase(env.DB)
    await initializeDatabase(env.DB)
    console.log('✅ Database initialized')
    
    // Seed infirmaries
    console.log('🌱 Seeding infirmaries...')
    await seedInfirmaries(INFIRMARY_SEED)
    console.log('✅ Infirmaries seeded')
    
    // Validate system national code
    console.log('🔍 Validating system national code...')
    try {
      const p = await validatePatient(CONFIG.SYSTEM_NATIONAL_CODE)
      console.log(`  - Patient: ${p.fullName}, allowToSetTimming: ${p.allowToSetTimming}`)
      if (!p.allowToSetTimming) {
        throw new Error('SYSTEM_NATIONAL_CODE is not allowed')
      }
    } catch (e) {
      console.error('❌ Failed to validate system national code:', e)
      throw e
    }
    
    // Create bot instance
    console.log('🤖 Creating bot instance...')
    bot = createBot()
    console.log('✅ Bot instance created')
    
    isInitialized = true
    console.log('✅ Initialization complete')
  } catch (error) {
    console.error('❌ Initialization failed:', error)
    console.error('Error stack:', (error as Error).stack)
    throw error
  }
}

// Main fetch handler for HTTP requests (webhook)
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      await initialize(env)
      
      if (!bot) {
        return new Response('Bot not initialized', { status: 500 })
      }
      
      const url = new URL(request.url)
      
      // Handle webhook from Telegram
      if (url.pathname === '/webhook' && request.method === 'POST') {
        const update = await request.json() as Update
        await bot.handleUpdate(update)
        return new Response('OK', { status: 200 })
      }
      
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response('OK', { status: 200 })
      }
      
      // Default response
      return new Response('Milad Appointment Bot - Cloudflare Workers', { status: 200 })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : 'No stack trace'
      console.error('Error in fetch handler:', errorMessage)
      console.error('Stack:', errorStack)
      return new Response(`Internal Server Error: ${errorMessage}`, { status: 500 })
    }
  },
  
  // Cron trigger handler - runs every 2 minutes
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      await initialize(env)
      
      if (!bot) {
        console.error('Bot not initialized')
        return
      }
      
      console.log('⏰ Running scheduled task...')
      
      // Run the scheduler tick
      await runSchedulerTick(async (userId: number, infirmaryTitle: string, results: any[], watchId: number) => {
        const msg = formatTimingMessage(infirmaryTitle, results)
        
        try {
          await bot!.api.sendMessage(
            userId,
            msg + '\n\n' +
            '⬇️ *ادامه اعلان‌دهی؟*',
            {
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard()
                .text('✅ ادامه اعلان‌دهی', `smart_watch:keep:${infirmaryTitle}`).row()
                .text('❌ غیرفعال کردن', `smart_watch:deactivate:${infirmaryTitle}`)
            }
          )
        } catch (err) {
          console.error(`Failed to notify user ${userId}:`, err)
        }
      })
      
      console.log('✅ Scheduled task completed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : 'No stack trace'
      console.error('Error in scheduled handler:', errorMessage)
      console.error('Stack:', errorStack)
    }
  }
}
