import { InlineKeyboard } from 'grammy'
import { listInfirmaries } from '../storage/infirmary.repo.js'

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

function labelFor(id: number, title: string) {
  const e = EMOJI_BY_ID[id] ?? '🏥'
  // Truncate long names
  const shortTitle = title.length > 15 ? title.substring(0, 15) + '...' : title
  return `${e} ${shortTitle}`
}

export function infirmaryKeyboard() {
  const kb = new InlineKeyboard()
  const items = listInfirmaries().filter(it => it.code) // Only show configured infirmaries

  // Show in 2 columns
  for (let i = 0; i < items.length; i += 2) {
    const first = items[i]
    const second = items[i + 1]
    
    if (first && second) {
      kb.text(labelFor(first.id, first.title), `inf:${first.id}`)
        .text(labelFor(second.id, second.title), `inf:${second.id}`)
        .row()
    } else if (first) {
      kb.text(labelFor(first.id, first.title), `inf:${first.id}`).row()
    }
  }

  kb.row()
  kb.text('🔍 جستجوی نوبت', 'action:search')
  kb.text('🔔 خبرم کن', 'action:watch').row()
  kb.text('❌ لغو اطلاع‌رسانی', 'action:unwatch').row()
  return kb
}

export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text('🏥 مشاهده درمانگاه‌ها', 'action:show_infirmaries').row()
    .text('📋 راهنما', 'action:help').row()
}
