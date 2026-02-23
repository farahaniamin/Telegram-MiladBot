import http from 'http'
import { CONFIG } from './config.js'
import { createBot } from './bot/bot.js'
import { validatePatient } from './services/hospital.client.js'
import { startScheduler } from './core/scheduler.js'
import { seedInfirmaries } from './storage/infirmary.repo.js'
import { INFIRMARY_SEED } from './data/infirmaries.seed.js'
import { formatTimingMessage } from './core/format.js'
import { isLocalProxyEnabled, isApiWorkerEnabled } from './storage/settings.repo.js'
import { InlineKeyboard } from 'grammy'

const PORT = process.env.PORT || 3000
const healthServer = http.createServer((req, res) => {
  console.log(`🏥 Health check: ${req.method} ${req.url}`)
  if (req.url === '/health') {
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    })
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }))
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'not_found', path: req.url }))
  }
})

healthServer.listen(PORT, () => {
  console.log(`🏥 Health server listening on port ${PORT}`)
})

async function bootstrap() {
  if (!CONFIG.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is missing. Set it in .env')
  }

  // Log admin configuration for debugging
  const adminIds = Array.from(CONFIG.ADMIN_IDS)
  console.log('👨‍💼 Admin configuration:')
  console.log(`  - ADMIN_IDS count: ${adminIds.length}`)
  console.log(`  - ADMIN_IDS values: ${adminIds.join(', ') || '(none)'}`)

  // Seed infirmaries (static list extracted from your HTML)
  await seedInfirmaries(INFIRMARY_SEED)

  // Log proxy configuration
  const useProxy = await isLocalProxyEnabled()
  const useWorker = await isApiWorkerEnabled()
  console.log('📡 Connection settings:')
  console.log(`  - Local Proxy: ${useProxy ? 'ON' : 'OFF'} (${CONFIG.PROXY_URL})`)
  console.log(`  - API Worker: ${useWorker ? 'ON' : 'OFF'} (${CONFIG.API_URL})`)
  console.log(`  - API Root: ${useWorker ? CONFIG.API_URL : 'https://api.telegram.org'}`)

  try {
    // Validate system national code once at startup (so watcher is reliable)
    console.log('🔍 Validating system national code...')
    const p = await validatePatient(CONFIG.SYSTEM_NATIONAL_CODE)
    console.log(`  - Patient: ${p.fullName}, allowToSetTimming: ${p.allowToSetTimming}`)
    if (!p.allowToSetTimming) {
      throw new Error('SYSTEM_NATIONAL_CODE is not allowed (allowToSetTimming=false). Change SYSTEM_NATIONAL_CODE.')
    }
  } catch (e) {
    console.error('❌ Failed to validate system national code:', e)
    throw e
  }

  // Create bot instance with configuration
  const bot = await createBot()

  // Simplified Smart Re-watch: Send notification with buttons immediately
  startScheduler(async (userId: number, infirmaryTitle: string, results: any[], watchId: number) => {
    const msg = formatTimingMessage(infirmaryTitle, results)
    
    try {
      // Send notification with inline buttons for immediate user choice
      await bot.api.sendMessage(
        userId,
        msg + '\n\n' +
        '⬇️ *ادامه اعلان‌دهی؟*',
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .url('🔗 ورود به صفحه نوبت دهی', 'https://miladhospital.com/onlineReception').row()
            .text('✅ ادامه اعلان‌دهی', `smart_watch:keep:${infirmaryTitle}`).row()
            .text('❌ غیرفعال کردن', `smart_watch:deactivate:${infirmaryTitle}`)
        }
      )
    } catch (err) {
      console.error(`Failed to notify user ${userId}:`, err)
    }
  })

  // Add error handler for bot
  bot.catch((err) => {
    console.error('❌ Bot error:', err)
  })

  // Test bot connection before starting
  console.log('🧪 Testing bot connection...')
  try {
    const botInfo = await bot.api.getMe()
    console.log(`✅ Bot connected: @${botInfo.username}`)
  } catch (testError) {
    console.error('❌ Failed to connect to Telegram:', testError)
    throw testError
  }

  // Start bot (long polling; simplest, reliable). Can be switched to webhook later.
  console.log('🚀 Starting bot polling...')
  try {
    await bot.start({
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
      onStart: (botInfo) => {
        console.log(`✅ Bot @${botInfo.username} started successfully`)
        console.log(`🤖 Bot ID: ${botInfo.id}`)
      }
    })
  } catch (startError) {
    console.error('❌ Failed to start bot:', startError)
    throw startError
  }
}

bootstrap().catch((e) => {
  console.error('❌ Fatal error:', e)
  process.exit(1)
})
