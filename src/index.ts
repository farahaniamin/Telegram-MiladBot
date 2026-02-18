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
    console.log('Step 1: Initializing config...')
    initializeConfig({
      BOT_TOKEN: env.BOT_TOKEN,
      ADMIN_IDS: env.ADMIN_IDS,
      SYSTEM_NATIONAL_CODE: env.SYSTEM_NATIONAL_CODE,
      DEFAULT_INTERVAL_MIN: env.DEFAULT_INTERVAL_MIN ?? undefined,
      JITTER_SEC: env.JITTER_SEC ?? undefined
    })
    console.log('✅ Step 1 complete')
    
    console.log('Step 2: Setting up database...')
    setDatabase(env.DB)
    console.log('✅ Step 2 complete - database set')
    
    console.log('Step 3: Initializing database schema...')
    await initializeDatabase(env.DB)
    console.log('✅ Step 3 complete - schema created')
    
    console.log('Step 4: Seeding infirmaries...')
    await seedInfirmaries(INFIRMARY_SEED)
    console.log('✅ Step 4 complete - infirmaries seeded')
    
    console.log('Step 5: Validating system national code...')
    try {
      const p = await validatePatient(CONFIG.SYSTEM_NATIONAL_CODE)
      console.log(`✅ Step 5 complete - Patient: ${p.fullName}, allowToSetTimming: ${p.allowToSetTimming}`)
      if (!p.allowToSetTimming) {
        throw new Error('SYSTEM_NATIONAL_CODE is not allowed')
      }
    } catch (e) {
      console.error('❌ Step 5 failed:', e)
      throw e
    }
    
    console.log('Step 6: Creating bot instance...')
    bot = createBot()
    console.log('✅ Step 6 complete - bot created')
    
    isInitialized = true
    console.log('✅ All initialization complete!')
  } catch (error) {
    console.error('❌ Initialization failed at step:', error)
    throw error
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url)
      
      if (url.pathname === '/health') {
        return new Response('OK', { status: 200 })
      }
      
      await initialize(env)
      
      if (!bot) {
        return new Response('Bot not initialized', { status: 500 })
      }
      
      if (url.pathname === '/webhook' && request.method === 'POST') {
        const update = await request.json() as Update
        await bot.handleUpdate(update)
        return new Response('OK', { status: 200 })
      }
      
      return new Response('Milad Appointment Bot', { status: 200 })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : ''
      console.error('Fetch handler error:', errorMessage)
      return new Response(`Error: ${errorMessage}\nStack: ${errorStack}`, { status: 500 })
    }
  },
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      await initialize(env)
      
      if (!bot) {
        console.error('Bot not initialized')
        return
      }
      
      await runSchedulerTick(async (userId, infirmaryTitle, results, watchId) => {
        const msg = formatTimingMessage(infirmaryTitle, results)
        try {
          await bot!.api.sendMessage(userId, msg + '\n\n⬇️ *ادامه اعلان‌دهی؟*', {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('✅ ادامه', `smart_watch:keep:${infirmaryTitle}`).row()
              .text('❌ غیرفعال', `smart_watch:deactivate:${infirmaryTitle}`)
          })
        } catch (err) {
          console.error(`Failed to notify user ${userId}:`, err)
        }
      })
    } catch (error) {
      console.error('Scheduled handler error:', error)
    }
  }
}
