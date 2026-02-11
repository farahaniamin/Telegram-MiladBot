import { CONFIG } from './config.js'
import { bot } from './bot/bot.js'
import { validatePatient } from './services/hospital.client.js'
import { startScheduler } from './core/scheduler.js'
import { seedInfirmaries } from './storage/infirmary.repo.js'
import { INFIRMARY_SEED } from './data/infirmaries.seed.js'
import { formatTimingMessage } from './core/format.js'

async function bootstrap() {
  if (!CONFIG.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is missing. Set it in .env')
  }

  // Seed infirmaries (static list extracted from your HTML)
  seedInfirmaries(INFIRMARY_SEED)

  // Validate system national code once at startup (so watcher is reliable)
  const p = await validatePatient(CONFIG.SYSTEM_NATIONAL_CODE)
  if (!p.allowToSetTimming) {
    throw new Error('SYSTEM_NATIONAL_CODE is not allowed (allowToSetTimming=false). Change SYSTEM_NATIONAL_CODE.')
  }

  // Scheduler notifies via telegram
  startScheduler(async (userIds, infirmaryTitle, results) => {
    const msg = formatTimingMessage(infirmaryTitle, results)
    for (const uid of userIds) {
      try {
        await bot.api.sendMessage(uid, msg)
      } catch {
        // ignore per-user errors to avoid blocking
      }
    }
  })

  // Start bot (long polling; simplest, reliable). Can be switched to webhook later.
  bot.start({
    allowed_updates: ['message', 'callback_query']
  })

  // eslint-disable-next-line no-console
  console.log('✅ bot started')
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Fatal:', e)
  process.exit(1)
})
