import { InlineKeyboard } from 'grammy'
import { listInfirmaries } from '../storage/infirmary.repo.js'
import { listActiveWatchesByUser } from '../storage/watch.repo.js'

const EMOJI_BY_ID: Record<number, string> = {
  20: "🦴",
  21: "🧪",
  22: "👶",
  23: "🧠",
  24: "🧬",
  25: "🎗️",
  27: "🧤",
  29: "🩺",
  30: "🦷",
  31: "🧠",
  33: "👁️",
  34: "🧁",
  35: "💢",
  36: "🌸",
  39: "🏃‍♂️",
  43: "🧒",
  44: "🩹",
  45: "🧑‍⚕️",
  47: "👁️‍🗨️",
  49: "❤️",
  50: "👂",
  51: "🧠",
  54: "🦷",
  58: "🩸"
}

function labelFor(id: number, title: string, isWatched: boolean = false) {
  const e = EMOJI_BY_ID[id] ?? '🏥'
  const shortTitle = title.length > 15 ? title.substring(0, 15) + '...' : title
  const watchIcon = isWatched ? '🔔 ' : ''
  return `${watchIcon}${e} ${shortTitle}`
}

export async function infirmaryKeyboard(userId?: number) {
  const kb = new InlineKeyboard()
  const allItems = await listInfirmaries()
  const items = allItems.filter(it => it.code)
  
  const userWatches = userId ? await listActiveWatchesByUser(userId) : []
  const watchedIds = new Set(userWatches.map(w => w.infirmaryId))

  for (let i = 0; i < items.length; i += 2) {
    const first = items[i]
    const second = items[i + 1]
    
    if (first && second) {
      kb.text(labelFor(first.id, first.title, watchedIds.has(first.id)), `inf:${first.id}`)
        .text(labelFor(second.id, second.title, watchedIds.has(second.id)), `inf:${second.id}`)
        .row()
    } else if (first) {
      kb.text(labelFor(first.id, first.title, watchedIds.has(first.id)), `inf:${first.id}`).row()
    }
  }

  kb.row()
  kb.text('🏠 منوی اصلی', 'action:main_menu')
  kb.row()
  kb.text('🔔 اعلان‌های من', 'action:my_watches')
  
  return kb
}

export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text('🏥 مشاهده درمانگاه‌ها', 'action:show_infirmaries').row()
    .text('🔔 اعلان‌های من', 'action:my_watches').row()
    .text('📋 راهنما', 'action:help').row()
}

export function navigationRow(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔙 بازگشت', 'action:back')
    .text('🏠 منوی اصلی', 'action:main_menu')
}

export function withNavigation(keyboard: InlineKeyboard): InlineKeyboard {
  keyboard.row()
  keyboard.text('🔙 بازگشت', 'action:back')
  keyboard.text('🏠 منوی اصلی', 'action:main_menu')
  return keyboard
}

export function confirmKeyboard(actionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ بله، انجام بده', `confirm:${actionId}`)
    .text('❌ خیر، انصراف', 'action:cancel_confirm')
    .row()
}

export function cancelWatchesKeyboard(watches: Array<{ watchId: number; infirmaryId: number; infirmaryTitle: string }>): InlineKeyboard {
  const kb = new InlineKeyboard()
  
  watches.forEach(watch => {
    kb.text(`❌ ${watch.infirmaryTitle.substring(0, 20)}`, `unwatch:${watch.infirmaryId}`).row()
  })
  
  kb.row()
  kb.text('🔙 بازگشت', 'action:back')
  kb.text('🏠 منوی اصلی', 'action:main_menu')
  
  return kb
}

export function intervalKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('۱ دقیقه', 'interval:1')
    .text('۵ دقیقه', 'interval:5')
    .text('۱۰ دقیقه', 'interval:10').row()
    .text('۱۵ دقیقه', 'interval:15')
    .text('۳۰ دقیقه', 'interval:30')
    .text('۶۰ دقیقه', 'interval:60').row()
    .text('🔙 بازگشت', 'action:back')
}

export function infirmaryDetailKeyboard(infirmaryId: number, isWatched: boolean): InlineKeyboard {
  const kb = new InlineKeyboard()
  
  kb.text('🔍 جستجوی نوبت', 'action:search').row()
  
  if (isWatched) {
    kb.text('❌ لغو اعلان', `unwatch:${infirmaryId}`).row()
  } else {
    kb.text('🔔 خبرم کن', 'action:check_then_watch').row()
  }
  
  kb.text('🔙 بازگشت', 'action:back')
  kb.text('🏠 منوی اصلی', 'action:main_menu')
  
  return kb
}

export function clinicActionKeyboard(infirmaryId: number, isWatched: boolean = false): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('🔍 جستجوی نوبت', 'action:search')
    .row()
  
  if (isWatched) {
    kb.text('❌ لغو اعلان', `action:cancel_watch:${infirmaryId}`)
  } else {
    kb.text('🔔 خبرم کن', 'action:check_then_watch')
  }
  
  kb.row()
    .text('🔙 بازگشت', 'action:back')
    .text('🏠 منوی اصلی', 'action:main_menu')
  
  return kb
}

export function noAppointmentsKeyboard(infirmaryId: number, isWatched: boolean = false): InlineKeyboard {
  const kb = new InlineKeyboard()
  
  if (isWatched) {
    kb.text('❌ لغو اعلان', `action:cancel_watch:${infirmaryId}`)
  } else {
    kb.text('🔔 فعال کردن اعلان', `action:confirm_watch:${infirmaryId}`)
  }
  
  kb.row()
    .text('🔙 بازگشت', 'action:back')
    .text('🏠 منوی اصلی', 'action:main_menu')
  
  return kb
}
