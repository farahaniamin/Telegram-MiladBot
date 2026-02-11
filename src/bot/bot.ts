import { Bot } from 'grammy'
import { CONFIG } from '../config.js'
import { getSession, setSession } from './session.js'
import { infirmaryKeyboard } from './keyboards.js'
import { getUserNationalCode, upsertUserNationalCode } from '../storage/user.repo.js'
import { validatePatient, searchInfirmaryTiming } from '../services/hospital.client.js'
import { addWatch, deactivateWatch, listActiveWatchesByUser } from '../storage/watch.repo.js'
import { getInfirmaryById, listInfirmaries, setInfirmaryCode } from '../storage/infirmary.repo.js'
import { isAdmin, getProxyStatus, setLocalProxyEnabled, setApiWorkerEnabled } from './admin.js'
import { formatTimingMessage } from '../core/format.js'
import { getIntervalMinutes, isPaused, setIntervalMinutes, setPaused } from '../storage/settings.repo.js'
import { getBotConfig } from '../core/proxy.js'

function isValidNationalCode(input: string) {
  return /^\d{10}$/.test(input)
}

// Store selected infirmary in per-user memory (simple map)
const selectedInfirmary = new Map<number, number>()

export function createBot() {
  console.log('🔧 Creating bot with configuration...')
  const botConfig = getBotConfig()
  console.log('  - Bot config:', JSON.stringify(botConfig, null, 2))
  
  const bot = new Bot(CONFIG.BOT_TOKEN, botConfig)

  bot.command('start', async (ctx) => {
    console.log(`📩 /start received from user ${ctx.from?.id}`)
    const uid = ctx.from?.id
    if (!uid) return

    const nc = getUserNationalCode(uid)
    if (!nc) {
      setSession(uid, { step: 'await_national_code' })
      await ctx.reply('کد ملی ۱۰ رقمی را وارد کنید:')
      return
    }

    await ctx.reply('درمانگاه را انتخاب کنید:', { reply_markup: infirmaryKeyboard() })
  })

  bot.on('message:text', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return

    const sess = getSession(uid)
    const text = (ctx.message.text ?? '').trim()

    console.log(`📨 Message from ${uid}: ${text}`)

    // Admin command fallback in text
    if (text.startsWith('/')) return

    if (sess.step === 'await_national_code') {
      if (!isValidNationalCode(text)) {
        await ctx.reply('❌ کد ملی نامعتبر است. لطفاً یک عدد ۱۰ رقمی وارد کنید.')
        return
      }
      try {
        const p = await validatePatient(text)
        if (!p.allowToSetTimming) {
          await ctx.reply('❌ در حال حاضر امکان دریافت نوبت برای این کد ملی وجود ندارد. (allowToSetTimming=false)')
          return
        }
        upsertUserNationalCode(uid, text)
        setSession(uid, { step: 'idle' })
        await ctx.reply('✅ ثبت شد. حالا درمانگاه را انتخاب کنید:', { reply_markup: infirmaryKeyboard() })
      } catch {
        await ctx.reply('❌ خطا در بررسی کد ملی. دوباره تلاش کنید.')
      }
    }
  })

  bot.callbackQuery(/^inf:(\d+)$/, async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    const infirmaryId = Number(ctx.match[1])
    const inf = getInfirmaryById(infirmaryId)
    if (!inf) {
      await ctx.answerCallbackQuery({ text: 'درمانگاه پیدا نشد' })
      return
    }
    selectedInfirmary.set(uid, infirmaryId)

    if (!inf.code) {
      await ctx.answerCallbackQuery({ text: 'این درمانگاه هنوز کد ندارد (ادمین باید تکمیل کند).' })
      await ctx.reply(`این درمانگاه هنوز تنظیم نشده: ${inf.title}\n\nاگر ادمین هستی از /setcode استفاده کن.`)
      return
    }

    await ctx.answerCallbackQuery({ text: `انتخاب شد: ${inf.title}` })
    await ctx.reply(`✅ انتخاب شد: ${inf.title}\nحالا می‌تونی "🔍 جستجو" یا "🔔 خبرم کن" رو بزنی.`, { reply_markup: infirmaryKeyboard() })
  })

  bot.callbackQuery('action:search', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    const infirmaryId = selectedInfirmary.get(uid)
    if (!infirmaryId) {
      await ctx.answerCallbackQuery({ text: 'اول درمانگاه را انتخاب کن' })
      return
    }
    const inf = getInfirmaryById(infirmaryId)
    if (!inf?.code) {
      await ctx.answerCallbackQuery({ text: 'این درمانگاه هنوز کد ندارد' })
      return
    }

    await ctx.answerCallbackQuery({ text: 'در حال بررسی...' })
    const userNC = getUserNationalCode(uid)
    if (!userNC) {
      setSession(uid, { step: 'await_national_code' })
      await ctx.reply('کد ملی ثبت نشده. لطفاً کد ملی را وارد کنید:')
      return
    }

    try {
      const res = await searchInfirmaryTiming({ id: inf.id, code: inf.code, title: inf.title }, userNC)
      if (res.length === 0) {
        await ctx.reply('❌ در حال حاضر نوبتی پیدا نشد. اگر دوست داری "🔔 خبرم کن" رو بزن.')
      } else {
        await ctx.reply(formatTimingMessage(inf.title, res))
      }
    } catch {
      await ctx.reply('❌ خطا در ارتباط با سامانه. دوباره تلاش کن.')
    }
  })

  bot.callbackQuery('action:watch', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    const infirmaryId = selectedInfirmary.get(uid)
    if (!infirmaryId) {
      await ctx.answerCallbackQuery({ text: 'اول درمانگاه را انتخاب کن' })
      return
    }
    const inf = getInfirmaryById(infirmaryId)
    if (!inf?.code) {
      await ctx.answerCallbackQuery({ text: 'این درمانگاه هنوز کد ندارد' })
      return
    }

    addWatch(uid, infirmaryId)
    await ctx.answerCallbackQuery({ text: 'فعال شد' })
    await ctx.reply(`🔔 باشه! به محض باز شدن نوبت برای "${inf.title}" خبرت می‌کنم.`)
  })

  bot.callbackQuery('action:unwatch', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    const infirmaryId = selectedInfirmary.get(uid)
    if (!infirmaryId) {
      await ctx.answerCallbackQuery({ text: 'اول درمانگاه را انتخاب کن' })
      return
    }
    deactivateWatch(uid, infirmaryId)
    await ctx.answerCallbackQuery({ text: 'غیرفعال شد' })
    await ctx.reply('✅ خبررسانی برای این درمانگاه غیرفعال شد.')
  })

  // ---------------- Admin commands ----------------
  bot.command('status', async (ctx) => {
    console.log(`📊 /status received from admin ${ctx.from?.id}`)
    if (!isAdmin(ctx)) {
      console.log('  - Not authorized')
      return
    }
    const interval = getIntervalMinutes()
    const paused = isPaused()
    const infs = listInfirmaries()
    const configured = infs.filter(i => !!i.code).length
    const proxyStatus = getProxyStatus()
    await ctx.reply(
      `🛠 وضعیت:\n` +
      `- interval: ${interval} دقیقه\n` +
      `- paused: ${paused ? 'بله' : 'خیر'}\n` +
      `- درمانگاه‌ها: ${configured}/${infs.length} کددار\n\n` +
      proxyStatus
    )
  })

  bot.command('interval', async (ctx) => {
    if (!isAdmin(ctx)) return
    const parts = ctx.message?.text?.trim().split(/\s+/) ?? []
    const n = Number(parts[1])
    if (!Number.isFinite(n) || n < 1 || n > 60) {
      await ctx.reply('استفاده: /interval <minutes>\nمثال: /interval 5')
      return
    }
    setIntervalMinutes(Math.floor(n))
    await ctx.reply(`✅ interval تنظیم شد روی ${Math.floor(n)} دقیقه.`)
  })

  bot.command('pause', async (ctx) => {
    if (!isAdmin(ctx)) return
    setPaused(true)
    await ctx.reply('⛔️ چک‌کردن سایت متوقف شد.')
  })

  bot.command('resume', async (ctx) => {
    if (!isAdmin(ctx)) return
    setPaused(false)
    await ctx.reply('▶️ چک‌کردن سایت فعال شد.')
  })

  bot.command('seed', async (ctx) => {
    if (!isAdmin(ctx)) return
    const infs = listInfirmaries()
    const lines = infs.map(i => `- ${i.title} | id=${i.id} | code=${i.code ?? 'NULL'}`)
    await ctx.reply(`📋 درمانگاه‌ها:\n${lines.join('\n')}`)
  })

  bot.command('setcode', async (ctx) => {
    if (!isAdmin(ctx)) return
    const parts = ctx.message?.text?.trim().split(/\s+/) ?? []
    const id = Number(parts[1])
    const code = parts[2]
    if (!Number.isFinite(id) || !code) {
      await ctx.reply('استفاده: /setcode <infirmaryId> <code>\nمثال: /setcode 1000 242')
      return
    }
    setInfirmaryCode(id, code)
    await ctx.reply(`✅ code برای درمانگاه id=${id} تنظیم شد: ${code}`)
  })

  bot.command('proxy', async (ctx) => {
    if (!isAdmin(ctx)) return
    const parts = ctx.message?.text?.trim().split(/\s+/) ?? []
    const state = parts[1]?.toLowerCase()
    
    if (state === 'on') {
      setLocalProxyEnabled(true)
      await ctx.reply('✅ Local Proxy فعال شد.\n⚠️ ری‌استارت نیاز است: /restart')
    } else if (state === 'off') {
      setLocalProxyEnabled(false)
      await ctx.reply('✅ Local Proxy غیرفعال شد.\n⚠️ ری‌استارت نیاز است: /restart')
    } else {
      await ctx.reply('استفاده: /proxy <on|off>\nمثال: /proxy on')
    }
  })

  bot.command('worker', async (ctx) => {
    if (!isAdmin(ctx)) return
    const parts = ctx.message?.text?.trim().split(/\s+/) ?? []
    const state = parts[1]?.toLowerCase()
    
    if (state === 'on') {
      setApiWorkerEnabled(true)
      await ctx.reply('✅ API Worker فعال شد.\n⚠️ ری‌استارت نیاز است: /restart')
    } else if (state === 'off') {
      setApiWorkerEnabled(false)
      await ctx.reply('✅ API Worker غیرفعال شد.\n⚠️ ری‌استارت نیاز است: /restart')
    } else {
      await ctx.reply('استفاده: /worker <on|off>\nمثال: /worker on')
    }
  })

  bot.command('netstatus', async (ctx) => {
    if (!isAdmin(ctx)) return
    const status = getProxyStatus()
    await ctx.reply(status)
  })

  console.log('✅ Bot instance created with all handlers registered')
  return bot
}
