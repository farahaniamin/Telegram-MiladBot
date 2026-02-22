import { Bot, InlineKeyboard } from 'grammy'
import { CONFIG } from '../config.js'
import { getSession, setSession } from './session.js'
import { 
  infirmaryKeyboard, 
  mainMenuKeyboard, 
  confirmKeyboard, 
  cancelWatchesKeyboard,
  intervalKeyboard,
  clinicActionKeyboard,
  noAppointmentsKeyboard
} from './keyboards.js'
import { getUserNationalCode, upsertUserNationalCode } from '../storage/user.repo.js'
import { validatePatient, searchInfirmaryTiming } from '../services/hospital.client.js'
import { 
  addWatch, 
  deactivateWatch, 
  listActiveWatchesByUser,
  listActiveWatchesWithDetails
} from '../storage/watch.repo.js'
import { getInfirmaryById, listInfirmaries, setInfirmaryCode } from '../storage/infirmary.repo.js'
import { isAdmin, getProxyStatus, setLocalProxyEnabled, setApiWorkerEnabled } from './admin.js'
import { formatTimingMessage } from '../core/format.js'
import { getIntervalMinutes, isPaused, setIntervalMinutes, setPaused } from '../storage/settings.repo.js'
import { getBotConfig } from '../core/proxy.js'
import { db } from '../storage/db.js'

function isValidNationalCode(input: string) {
  return /^\d{10}$/.test(input)
}

const selectedInfirmary = new Map<number, number>()

async function handleError(ctx: any, error: any, action: string) {
  console.error(`Error during ${action}:`, error)
  
  const isNetworkError = error.message?.includes('network') || 
                         error.message?.includes('timeout') ||
                         error.message?.includes('ECONNREFUSED') ||
                         error.message?.includes('ECONNRESET')
  
  if (isNetworkError) {
    await ctx.reply(
      '❌ *خطا در ارتباط با بیمارستان*\n\n' +
      '🔍 علت: مشکل در شبکه یا سرور بیمارستان\n' +
      '⏱️ لطفاً چند لحظه دیگر دوباره تلاش کنید.\n\n' +
      'اگر مشکل ادامه داشت، لطفاً بعداً مراجعه کنید.',
      { 
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔄 تلاش مجدد', `retry:${action}`)
          .text('🏠 منوی اصلی', 'action:main_menu')
      }
    )
  } else {
    await ctx.reply(
      '❌ *خطای غیرمنتظره*\n\n' +
      'مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
      { 
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🏠 منوی اصلی', 'action:main_menu')
      }
    )
  }
}

export async function createBot() {
  console.log('🔧 Creating bot with configuration...')
  const botConfig = await getBotConfig()
  console.log('  - Bot config:', JSON.stringify(botConfig, null, 2))
  
  const bot = new Bot(CONFIG.BOT_TOKEN, botConfig)

  bot.command('start', async (ctx) => {
    console.log(`📩 /start received from user ${ctx.from?.id}`)
    const uid = ctx.from?.id
    if (!uid) return
    
    const userName = ctx.from?.first_name || 'کاربر'
    const nc = await getUserNationalCode(uid)
    
    const welcomeMessage = 
      `👋 سلام ${userName} عزیز!\n\n` +
      `🏥 *به ربات نوبت‌دهی بیمارستان میلاد خوش آمدید.*\n\n` +
      `📌 *چه کارهایی می‌توانید انجام دهید:*\n` +
      `• 🔍 جستجوی نوبت فوری در درمانگاه‌ها\n` +
      `• 🔔 دریافت اعلان زمانی که نوبت باز شد\n` +
      `• 📱 پیگیری وضعیت نوبت‌ها\n\n` +
      `⚠️ *نکته مهم:*\n` +
      `برای استفاده از ربات، نیاز به *کد ملی* دارید. ` +
      `این کد برای بررسی صلاحیت شما در سامانه بیمارستان استفاده می‌شود.\n\n` +
      `🔒 *حریم خصوصی:* کد ملی شما فقط نزد ما می‌ماند.`
    
    if (!nc) {
      setSession(uid, { step: 'await_national_code' })
      await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' })
      await ctx.reply(
        '✏️ *لطفاً کد ملی ۱۰ رقمی خود را وارد کنید:*',
        { parse_mode: 'Markdown' }
      )
      return
    }

    const kb = mainMenuKeyboard()
    await ctx.reply(
      welcomeMessage + '\n\n✅ *کد ملی شما:* `' + nc + '`\n\nیکی از گزینه‌ها را انتخاب کنید:',
      { parse_mode: 'Markdown', reply_markup: kb }
    )
  })

  bot.command('help', async (ctx) => {
    const uid = ctx.from?.id
    const nc = uid ? await getUserNationalCode(uid) : null
    
    let helpText = 
      '📋 *راهنمای استفاده از ربات*\n\n' +
      '*دستورات اصلی:*\n' +
      '`/start` - شروع مجدد ربات\n' +
      '`/help` - نمایش این راهنما\n'
    
    if (nc) {
      helpText += '`/mywatches` - مشاهده اعلان‌های فعال\n\n'
    } else {
      helpText += '\n'
    }
    
    helpText +=
      '*راهنمای استفاده:*\n' +
      '۱. ثبت کد ملی خود را وارد کنید\n' +
      '۲. درمانگاه را انتخاب کنید\n' +
      '۳. برای نوبت جستجو کنید یا اعلان بگذارید\n' +
      '۴. منتظر اطلاع‌رسانی بمانید'
    
    await ctx.reply(helpText, { 
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard()
    })
  })

  bot.command('mywatches', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    
    const watches = await listActiveWatchesWithDetails(uid)
    
    if (watches.length === 0) {
      await ctx.reply(
        '🔔 *شما هیچ اعلان فعالی ندارید.*\n\n' +
        'برای تنظیم اعلان، یک درمانگاه انتخاب کنید و «🔔 خبرم کن» را بزنید.',
        { 
          parse_mode: 'Markdown',
          reply_markup: mainMenuKeyboard()
        }
      )
      return
    }
    
    const kb = cancelWatchesKeyboard(watches)
    const watchesList = watches.map(w => `• ${w.infirmaryTitle}`).join('\n')
    
    await ctx.reply(
      `🔔 *اعلان‌های فعال شما:*\n\n` +
      `${watchesList}\n\n` +
      `برای لغو هر اعلان، روی دکمه مربوطه کلیک کنید:`,
      { parse_mode: 'Markdown', reply_markup: kb }
    )
  })

  bot.on('message:text', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return

    const sess = getSession(uid)
    const text = (ctx.message.text ?? '').trim()

    console.log(`📨 Message from ${uid}: ${text}`)

    if (text.startsWith('/')) return

    if (sess.step === 'await_national_code') {
      if (!isValidNationalCode(text)) {
        await ctx.reply(
          '❌ *کد ملی نامعتبر است*\n\n' +
          '✏️ لطفاً یک عدد ۱۰ رقمی وارد کنید:\n' +
          'مثال: `0310751942`',
          { parse_mode: 'Markdown' }
        )
        return
      }
      
      const loadingMsg = await ctx.reply('⏳ در حال بررسی کد ملی در سامانه بیمارستان...')
      
      try {
        const p = await validatePatient(text)
        
        await ctx.api.deleteMessage(uid, loadingMsg.message_id).catch(() => {})
        
        if (!p.allowToSetTimming) {
          await ctx.reply(
            '❌ *امکان دریافت نوبت وجود ندارد*\n\n' +
            'برای این کد ملی در حال حاضر امکان گرفتن نوبت وجود ندارد.\n' +
            'ممکن است:\n' +
            '• قبلاً نوبت فعال داشته باشید\n' +
            '• کد ملی در سامانه ثبت نشده باشد\n\n' +
            'لطفاً با پذیرش بیمارستان تماس بگیرید.',
            { parse_mode: 'Markdown' }
          )
          return
        }
        
        await upsertUserNationalCode(uid, text)
        setSession(uid, { step: 'idle' })
        
        const kb = await infirmaryKeyboard(uid)
        await ctx.reply(
          `✅ *کد ملی با موفقیت ثبت شد*\n\n` +
          `👤 نام: ${p.fullName || 'نامشخص'}\n` +
          `🆔 کد ملی: \`${text}\`\n\n` +
          `حالا می‌توانید درمانگاه مورد نظر را انتخاب کنید:`,
          { parse_mode: 'Markdown', reply_markup: kb }
        )
      } catch (err) {
        await ctx.api.deleteMessage(uid, loadingMsg.message_id).catch(() => {})
        await handleError(ctx, err, 'national_code_validation')
      }
    }
  })

  bot.callbackQuery(/^inf:(\d+)$/, async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    const infirmaryId = Number(ctx.match[1])
    const inf = await getInfirmaryById(infirmaryId)
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

    const userWatches = await listActiveWatchesByUser(uid)
    const isWatched = userWatches.some(w => w.infirmaryId === infirmaryId)

    await ctx.answerCallbackQuery({ text: `انتخاب شد: ${inf.title}` })
    await ctx.editMessageText(
      `✅ *درمانگاه انتخاب شد*\n\n` +
      `🏥 ${inf.title}\n\n` +
      `چه کاری می‌خواهید انجام دهید؟`,
      { 
        parse_mode: 'Markdown', 
        reply_markup: clinicActionKeyboard(infirmaryId, isWatched)
      }
    )
  })

  bot.callbackQuery('action:search', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    const infirmaryId = selectedInfirmary.get(uid)
    if (!infirmaryId) {
      await ctx.answerCallbackQuery({ text: 'اول درمانگاه را انتخاب کن' })
      return
    }
    const inf = await getInfirmaryById(infirmaryId)
    if (!inf?.code) {
      await ctx.answerCallbackQuery({ text: 'این درمانگاه هنوز کد ندارد' })
      return
    }

    await ctx.answerCallbackQuery({ text: 'در حال بررسی...' })
    const userNC = await getUserNationalCode(uid)
    if (!userNC) {
      setSession(uid, { step: 'await_national_code' })
      await ctx.reply('کد ملی ثبت نشده. لطفاً کد ملی را وارد کنید:')
      return
    }

    try {
      const res = await searchInfirmaryTiming({ id: inf.id, code: inf.code, title: inf.title }, userNC)
      if (res.length === 0) {
        await ctx.reply(
          `❌ *در حال حاضر نوبتی پیدا نشد*\n\n` +
          `برای درمانگاه "${inf.title}" نوبتی موجود نیست.\n\n` +
          `می‌توانید اعلان فعال کنید تا به محض باز شدن نوبت خبرتان کنیم:`,
          { 
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
              .text('🔔 خبرم کن', 'action:watch')
              .text('🔙 بازگشت', 'action:back')
              .row()
              .text('🏠 منوی اصلی', 'action:main_menu')
          }
        )
      } else {
        await ctx.reply(formatTimingMessage(inf.title, res))
      }
    } catch (err) {
      await handleError(ctx, err, 'search')
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
    const inf = await getInfirmaryById(infirmaryId)
    if (!inf?.code) {
      await ctx.answerCallbackQuery({ text: 'این درمانگاه هنوز کد ندارد' })
      return
    }

    await addWatch(uid, infirmaryId)
    await ctx.answerCallbackQuery({ text: 'فعال شد' })
    await ctx.reply(
      `🔔 *اعلان فعال شد*\n\n` +
      `به محض باز شدن نوبت برای "${inf.title}" به شما اطلاع‌رسانی خواهیم کرد.\n\n` +
      `📌 *نکته:* هر اعلان فقط یک بار ارسال می‌شود و سپس غیرفعال می‌گردد.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔔 اعلان‌های من', 'action:my_watches')
          .text('🏠 منوی اصلی', 'action:main_menu')
      }
    )
  })

  bot.callbackQuery('action:check_then_watch', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    const infirmaryId = selectedInfirmary.get(uid)
    if (!infirmaryId) {
      await ctx.answerCallbackQuery({ text: 'اول درمانگاه را انتخاب کن' })
      return
    }
    const inf = await getInfirmaryById(infirmaryId)
    if (!inf?.code) {
      await ctx.answerCallbackQuery({ text: 'این درمانگاه هنوز کد ندارد' })
      return
    }

    const userWatches = await listActiveWatchesByUser(uid)
    const isWatched = userWatches.some(w => w.infirmaryId === infirmaryId)
    
    if (isWatched) {
      await ctx.answerCallbackQuery({ text: '⚠️ اعلان از قبل فعال است' })
      await ctx.editMessageText(
        `⚠️ *اعلان از قبل فعال است*\n\n` +
        `برای "${inf.title}" قبلاً اعلان تنظیم شده است.\n\n` +
        `🔔 به محض باز شدن نوبت به شما اطلاع می‌دهیم.`,
        { 
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('❌ لغو اعلان', `action:cancel_watch:${infirmaryId}`)
            .row()
            .text('🔙 بازگشت', 'action:back')
            .text('🏠 منوی اصلی', 'action:main_menu')
        }
      )
      return
    }

    await ctx.answerCallbackQuery({ text: 'در حال بررسی...' })
    const userNC = await getUserNationalCode(uid)
    if (!userNC) {
      setSession(uid, { step: 'await_national_code' })
      await ctx.reply('کد ملی ثبت نشده. لطفاً کد ملی را وارد کنید:')
      return
    }

    try {
      const res = await searchInfirmaryTiming({ id: inf.id, code: inf.code, title: inf.title }, userNC)
      if (res.length === 0) {
        await ctx.editMessageText(
          `❌ *در حال حاضر نوبتی پیدا نشد*\n\n` +
          `برای درمانگاه "${inf.title}" نوبتی موجود نیست.\n\n` +
          `می‌توانید اعلان فعال کنید تا به محض باز شدن نوبت خبرتان کنیم:`,
          { 
            parse_mode: 'Markdown',
            reply_markup: noAppointmentsKeyboard(infirmaryId)
          }
        )
      } else {
        await ctx.reply(
          formatTimingMessage(inf.title, res),
          {
            reply_markup: new InlineKeyboard()
              .text('🔙 بازگشت', 'action:back')
              .text('🏠 منوی اصلی', 'action:main_menu')
          }
        )
      }
    } catch (err) {
      await handleError(ctx, err, 'search')
    }
  })

  bot.callbackQuery(/^action:confirm_watch:(\d+)$/, async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    
    const infirmaryId = Number(ctx.match[1])
    const inf = await getInfirmaryById(infirmaryId)
    
    if (!inf?.code) {
      await ctx.answerCallbackQuery({ text: 'این درمانگاه هنوز کد ندارد' })
      return
    }

    const userWatches = await listActiveWatchesByUser(uid)
    const isWatched = userWatches.some(w => w.infirmaryId === infirmaryId)
    
    if (isWatched) {
      await ctx.answerCallbackQuery({ text: '⚠️ اعلان از قبل فعال است' })
      await ctx.editMessageText(
        `⚠️ *اعلان از قبل فعال است*\n\n` +
        `برای "${inf.title}" قبلاً اعلان تنظیم شده است.\n\n` +
        `🔔 به محض باز شدن نوبت به شما اطلاع می‌دهیم.`,
        { 
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('❌ لغو اعلان', `action:cancel_watch:${infirmaryId}`)
            .row()
            .text('🔙 بازگشت', 'action:back')
            .text('🏠 منوی اصلی', 'action:main_menu')
        }
      )
      return
    }

    await addWatch(uid, infirmaryId)
    await ctx.answerCallbackQuery({ text: '✅ اعلان فعال شد' })
    await ctx.editMessageText(
      `✅ *اعلان فعال شد*\n\n` +
      `برای "${inf.title}"\n\n` +
      `🔔 به محض باز شدن نوبت به شما اطلاع می‌دهیم.`,
      { parse_mode: 'Markdown' }
    )
  })

  bot.callbackQuery('action:unwatch', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    const infirmaryId = selectedInfirmary.get(uid)
    if (!infirmaryId) {
      await ctx.answerCallbackQuery({ text: 'اول درمانگاه را انتخاب کن' })
      return
    }
    await deactivateWatch(uid, infirmaryId)
    await ctx.answerCallbackQuery({ text: 'غیرفعال شد' })
    await ctx.reply('✅ خبررسانی برای این درمانگاه غیرفعال شد.')
  })

  bot.callbackQuery(/^unwatch:(\d+)$/, async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    
    const infirmaryId = Number(ctx.match[1])
    const inf = await getInfirmaryById(infirmaryId)
    
    await deactivateWatch(uid, infirmaryId)
    await ctx.answerCallbackQuery({ text: '✅ لغو شد' })
    
    await ctx.editMessageText(
      `✅ اعلان برای "${inf?.title || 'درمانگاه'}" لغو شد.`,
      { reply_markup: mainMenuKeyboard() }
    )
  })

  bot.callbackQuery(/^action:cancel_watch:(\d+)$/, async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    
    const infirmaryId = Number(ctx.match[1])
    const inf = await getInfirmaryById(infirmaryId)
    
    await deactivateWatch(uid, infirmaryId)
    await ctx.answerCallbackQuery({ text: '✅ اعلان لغو شد' })
    
    await ctx.editMessageText(
      `✅ *اعلان لغو شد*\n\n` +
      `برای "${inf?.title || 'درمانگاه'}" لغو شد.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('🔔 خبرم کن', 'action:check_then_watch')
          .row()
          .text('🔙 بازگشت', 'action:back')
          .text('🏠 منوی اصلی', 'action:main_menu')
      }
    )
  })

  bot.callbackQuery('action:show_infirmaries', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    await ctx.answerCallbackQuery({ text: 'درمانگاه‌ها' })
    const kb = await infirmaryKeyboard(uid)
    await ctx.editMessageText(
      '🏥 *لیست درمانگاه‌های موجود:*\n\nدرمانگاه مورد نظر خود را انتخاب کنید:', 
      { 
        parse_mode: 'Markdown',
        reply_markup: kb 
      }
    )
  })

  bot.callbackQuery('action:show_cancel', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    
    const watches = await listActiveWatchesWithDetails(uid)
    if (watches.length === 0) {
      await ctx.answerCallbackQuery({ text: 'شما اعلان فعالی ندارید' })
      return
    }
    
    const kb = cancelWatchesKeyboard(watches)
    
    await ctx.answerCallbackQuery()
    await ctx.editMessageText(
      '🔔 *کدام اعلان را می‌خواهید لغو کنید؟*',
      { parse_mode: 'Markdown', reply_markup: kb }
    )
  })

  bot.callbackQuery('action:my_watches', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    
    const watches = await listActiveWatchesWithDetails(uid)
    
    if (watches.length === 0) {
      await ctx.answerCallbackQuery({ text: 'شما اعلانی ندارید' })
      await ctx.editMessageText(
        '🔔 *شما هیچ اعلان فعالی ندارید.*\n\n' +
        'برای تنظیم اعلان، یک درمانگاه انتخاب کنید.',
        { 
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard()
            .text('🏥 مشاهده درمانگاه‌ها', 'action:show_infirmaries')
            .row()
            .text('🏠 منوی اصلی', 'action:main_menu')
        }
      )
      return
    }
    
    await ctx.answerCallbackQuery()
    
    const kb = cancelWatchesKeyboard(watches)
    const watchesList = watches.map(w => `• ${w.infirmaryTitle}`).join('\n')
    
    await ctx.editMessageText(
      `🔔 *اعلان‌های فعال شما:*\n\n` +
      `${watchesList}\n\n` +
      `برای لغو روی دکمه کلیک کنید:`,
      { parse_mode: 'Markdown', reply_markup: kb }
    )
  })

  bot.callbackQuery(/^smart_watch:(keep|deactivate):(.+)$/, async (ctx) => {
    const action = ctx.match[1] as 'keep' | 'deactivate'
    const infirmaryTitle = ctx.match[2]
    const uid = ctx.from?.id
    if (!uid) return
    
    const watches = await listActiveWatchesWithDetails(uid)
    const watch = watches.find(w => w.infirmaryTitle === infirmaryTitle)
    
    if (!watch) {
      await ctx.answerCallbackQuery({ text: '❌ اعلان یافت نشد یا قبلاً لغو شده' })
      return
    }

    switch(action) {
      case 'keep':
        await ctx.answerCallbackQuery({ text: '✅ ادامه اعلان‌دهی' })
        await ctx.editMessageText(
          `✅ *ادامه اعلان‌دهی*\n\n` +
          `برای "${infirmaryTitle}"\n\n` +
          `🔔 به محض باز شدن نوبت بعدی، دوباره به شما اطلاع می‌دهیم.`,
          { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() }
        )
        break
        
      case 'deactivate':
        await ctx.answerCallbackQuery({ text: '❌ اعلان غیرفعال شد' })
        await ctx.editMessageText(
          `❌ *اعلان غیرفعال شد*\n\n` +
          `برای "${infirmaryTitle}"\n\n` +
          `دیگر اعلانی برای این درمانگاه دریافت نخواهید کرد.`,
          { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() }
        )
        await deactivateWatch(uid, watch.infirmaryId)
        break
    }
  })

  bot.callbackQuery('action:help', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'راهنما' })
    
    const uid = ctx.from?.id
    const nc = uid ? await getUserNationalCode(uid) : null
    
    let helpText = 
      '📋 *راهنمای استفاده از ربات*\n\n' +
      '*دستورات:*\n' +
      '`/start` - شروع مجدد\n' +
      '`/help` - راهنما\n'
    
    if (nc) {
      helpText += '`/mywatches` - اعلان‌های من\n\n'
    } else {
      helpText += '\n'
    }
    
    helpText +=
      '*راهنما:*\n' +
      '۱. کد ملی خود را وارد کنید\n' +
      '۲. درمانگاه را انتخاب کنید\n' +
      '۳. برای نوبت جستجو کنید یا اعلان بگذارید\n' +
      '۴. منتظر اطلاع‌رسانی بمانید'
    
    await ctx.editMessageText(
      helpText,
      { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() }
    )
  })

  bot.callbackQuery('action:main_menu', async (ctx) => {
    const uid = ctx.from?.id
    const nc = uid ? await getUserNationalCode(uid) : null
    
    await ctx.answerCallbackQuery()
    
    if (!nc) {
      await ctx.editMessageText(
        '👋 *به ربات نوبت‌دهی بیمارستان میلاد خوش آمدید!*\n\n' +
        '✏️ لطفاً کد ملی ۱۰ رقمی خود را وارد کنید:',
        { parse_mode: 'Markdown' }
      )
      return
    }
    
    await ctx.editMessageText(
      '👋 *به منوی اصلی خوش آمدید!*\n\n' +
      `✅ کد ملی شما: \`${nc}\`\n\n` +
      'یکی از گزینه‌ها را انتخاب کنید:',
      { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() }
    )
  })

  bot.callbackQuery('action:back', async (ctx) => {
    const uid = ctx.from?.id
    if (!uid) return
    
    const sess = getSession(uid)
    
    if (sess.step === 'await_national_code') {
      setSession(uid, { step: 'idle' })
      await ctx.answerCallbackQuery()
      await ctx.editMessageText(
        '👋 *به ربات نوبت‌دهی بیمارستان میلاد خوش آمدید!*\n\n' +
        '✏️ لطفاً کد ملی ۱۰ رقمی خود را وارد کنید:',
        { parse_mode: 'Markdown' }
      )
    } else {
      await ctx.answerCallbackQuery()
      const kb = await infirmaryKeyboard(uid)
      await ctx.editMessageText(
        '🏥 *درمانگاه مورد نظر را انتخاب کنید:*',
        { parse_mode: 'Markdown', reply_markup: kb }
      )
    }
  })

  bot.callbackQuery('action:cancel_confirm', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '❌ عملیات لغو شد' })
    await ctx.editMessageText(
      '❌ عملیات لغو شد.',
      { reply_markup: mainMenuKeyboard() }
    )
  })

  bot.callbackQuery(/^retry:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'در حال تلاش مجدد...' })
    await ctx.editMessageText(
      '🔄 لطفاً دوباره تلاش کنید.',
      { reply_markup: mainMenuKeyboard() }
    )
  })

  bot.command('admin_help', async (ctx) => {
    if (!isAdmin(ctx)) return
    
    await ctx.reply(
      '👨‍💼 *راهنمای دستورات ادمین:*\n\n' +
      '*تنظیمات سیستم:*\n' +
      '`/status` - وضعیت کلی ربات\n' +
      '`/stats` - آمار و گزارش‌ها\n' +
      '`/interval` - تنظیم فاصله بررسی\n' +
      '`/pause` / `/resume` - توقف/ادامه\n' +
      '`/netstatus` - وضعیت شبکه\n\n' +
      '*مدیریت درمانگاه‌ها:*\n' +
      '`/seed` - لیست درمانگاه‌ها\n' +
      '`/setcode <id> <code>` - تنظیم کد\n\n' +
      '*شبکه:*\n' +
      '`/proxy <on|off>` - تغییر وضعیت پروکسی\n' +
      '`/worker <on|off>` - تغییر وضعیت worker',
      { parse_mode: 'Markdown' }
    )
  })

  bot.command('status', async (ctx) => {
    console.log(`📊 /status received from admin ${ctx.from?.id}`)
    if (!isAdmin(ctx)) {
      console.log('  - Not authorized')
      return
    }
    const interval = await getIntervalMinutes()
    const paused = await isPaused()
    const infs = await listInfirmaries()
    const configured = infs.filter(i => !!i.code).length
    const proxyStatus = getProxyStatus()
    
    await ctx.reply(
      '🛠 *وضعیت ربات*\n\n' +
      '```\n' +
      '┌─────────────────┬──────────┐\n' +
      `│ ⏱️ فاصله بررسی  │ ${String(interval).padStart(4)} دقیقه │\n` +
      '├─────────────────┼──────────┤\n' +
      `│ 🔄 وضعیت        │ ${paused ? '⏸️ توقف ' : '▶️ فعال  '} │\n` +
      '├─────────────────┼──────────┤\n' +
      `│ 🏥 درمانگاه‌ها  │ ${String(configured).padStart(2)}/${String(infs.length).padStart(2)} فعال │\n` +
      '└─────────────────┴──────────┘\n' +
      '```\n\n' +
      proxyStatus,
      { parse_mode: 'Markdown' }
    )
  })

  bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx)) return
    
    const userRow = await db.get('SELECT COUNT(*) as count FROM users')
    const watchRow = await db.get('SELECT COUNT(*) as count FROM watches WHERE active = 1')
    const todayRow = await db.get(`
      SELECT COUNT(*) as count FROM watches 
      WHERE active = 0 AND created_at > strftime('%s','now','-1 day')
    `)
    
    const userCount = userRow?.count ?? 0
    const watchCount = watchRow?.count ?? 0
    const todayNotifications = todayRow?.count ?? 0
    const interval = await getIntervalMinutes()
    const paused = await isPaused()
    
    await ctx.reply(
      '📊 *آمار ربات*\n\n' +
      '```\n' +
      '┌─────────────────┬──────────┐\n' +
      `│ 👥 کاربران      │ ${String(userCount).padStart(8)} │\n` +
      '├─────────────────┼──────────┤\n' +
      `│ 🔔 اعلانات فعال │ ${String(watchCount).padStart(8)} │\n` +
      '├─────────────────┼──────────┤\n' +
      `│ ✅ اعلانات امروز│ ${String(todayNotifications).padStart(8)} │\n` +
      '├─────────────────┼──────────┤\n' +
      `│ ⏱️ فاصله بررسی  │ ${String(interval).padStart(6)} دقیقه │\n` +
      '├─────────────────┼──────────┤\n' +
      `│ 🔄 وضعیت        │ ${paused ? '⏸️ متوقف ' : '▶️ فعال  '} │\n` +
      '└─────────────────┴──────────┘\n' +
      '```',
      { parse_mode: 'Markdown' }
    )
  })

  bot.command('interval', async (ctx) => {
    if (!isAdmin(ctx)) return
    
    await ctx.reply(
      '⏱️ *تنظیم فاصله زمانی بررسی*\n\n' +
      'فاصله زمانی بررسی نوبت‌ها را انتخاب کنید:',
      { 
        parse_mode: 'Markdown',
        reply_markup: intervalKeyboard()
      }
    )
  })

  bot.callbackQuery(/^interval:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCallbackQuery({ text: '⛔️ دسترسی ندارید' })
      return
    }
    
    const minutes = Number(ctx.match[1])
    await setIntervalMinutes(minutes)
    await ctx.answerCallbackQuery({ text: `✅ تنظیم شد: ${minutes} دقیقه` })
    await ctx.editMessageText(
      `✅ *فاصله بررسی تنظیم شد*\n\n` +
      `⏱️ فاصله جدید: ${minutes} دقیقه`,
      { parse_mode: 'Markdown' }
    )
  })

  bot.command('pause', async (ctx) => {
    if (!isAdmin(ctx)) return
    
    await ctx.reply(
      '⚠️ *آیا مطمئن هستید؟*\n\n' +
      'با توقف بررسی:\n' +
      '• هیچ نوبت جدیدی بررسی نخواهد شد\n' +
      '• هیچ اعلانی ارسال نخواهد شد\n\n' +
      'می‌توانید بعداً با `/resume` دوباره فعال کنید.',
      { 
        parse_mode: 'Markdown',
        reply_markup: confirmKeyboard('pause')
      }
    )
  })

  bot.callbackQuery('confirm:pause', async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCallbackQuery({ text: '⛔️ دسترسی ندارید' })
      return
    }
    
    await setPaused(true)
    await ctx.answerCallbackQuery({ text: '⏸️ متوقف شد' })
    await ctx.editMessageText(
      '⏸️ *بررسی نوبت‌ها متوقف شد*\n\n' +
      'برای ادامه: `/resume`',
      { parse_mode: 'Markdown' }
    )
  })

  bot.command('resume', async (ctx) => {
    if (!isAdmin(ctx)) return
    await setPaused(false)
    await ctx.reply(
      '▶️ *بررسی نوبت‌ها فعال شد*\n\n' +
      'ربات دوباره در حال بررسی نوبت‌ها است.',
      { parse_mode: 'Markdown' }
    )
  })

  bot.command('seed', async (ctx) => {
    if (!isAdmin(ctx)) return
    const infs = await listInfirmaries()
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
    await setInfirmaryCode(id, code)
    await ctx.reply(`✅ code برای درمانگاه id=${id} تنظیم شد: ${code}`)
  })

  bot.command('proxy', async (ctx) => {
    if (!isAdmin(ctx)) return
    const parts = ctx.message?.text?.trim().split(/\s+/) ?? []
    const state = parts[1]?.toLowerCase()
    
    if (state === 'on') {
      await setLocalProxyEnabled(true)
      await ctx.reply(
        '✅ *Local Proxy فعال شد*\n\n' +
        '⚠️ برای اعمال تغییرات، ربات را ری‌استارت کنید.',
        { parse_mode: 'Markdown' }
      )
    } else if (state === 'off') {
      await setLocalProxyEnabled(false)
      await ctx.reply(
        '✅ *Local Proxy غیرفعال شد*\n\n' +
        '⚠️ برای اعمال تغییرات، ربات را ری‌استارت کنید.',
        { parse_mode: 'Markdown' }
      )
    } else {
      await ctx.reply('استفاده: /proxy <on|off>\nمثال: /proxy on')
    }
  })

  bot.command('worker', async (ctx) => {
    if (!isAdmin(ctx)) return
    const parts = ctx.message?.text?.trim().split(/\s+/) ?? []
    const state = parts[1]?.toLowerCase()
    
    if (state === 'on') {
      await setApiWorkerEnabled(true)
      await ctx.reply(
        '✅ *API Worker فعال شد*\n\n' +
        '⚠️ برای اعمال تغییرات، ربات را ری‌استارت کنید.',
        { parse_mode: 'Markdown' }
      )
    } else if (state === 'off') {
      await setApiWorkerEnabled(false)
      await ctx.reply(
        '✅ *API Worker غیرفعال شد*\n\n' +
        '⚠️ برای اعمال تغییرات، ربات را ری‌استارت کنید.',
        { parse_mode: 'Markdown' }
      )
    } else {
      await ctx.reply('استفاده: /worker <on|off>\nمثال: /worker on')
    }
  })

  bot.command('netstatus', async (ctx) => {
    if (!isAdmin(ctx)) return
    const status = await getProxyStatus()
    await ctx.reply(status)
  })

  console.log('✅ Bot instance created with all handlers registered')
  return bot
}
