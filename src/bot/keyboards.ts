import { InlineKeyboard } from 'grammy'
import { listInfirmaries } from '../storage/infirmary.repo.js'

const EMOJI_BY_ID: Record<number, string> = {
  20: "\ud83e\uddb4",
  21: "\ud83e\uddea",
  22: "\ud83d\udc76",
  23: "\ud83e\udde0",
  24: "\ud83e\uddec",
  25: "\ud83c\udf97\ufe0f",
  27: "\ud83e\uddf4",
  29: "\ud83e\ude7a",
  30: "\ud83e\uddb7",
  31: "\ud83e\udde0",
  33: "\ud83d\udc41\ufe0f",
  34: "\ud83e\udec1",
  35: "\ud83d\udca2",
  36: "\ud83c\udf38",
  39: "\ud83c\udfc3\u200d\u2642\ufe0f",
  43: "\ud83e\uddd2",
  44: "\ud83e\ude79",
  45: "\ud83e\uddd1\u200d\u2695\ufe0f",
  47: "\ud83d\udc41\ufe0f\u200d\ud83d\udde8\ufe0f",
  49: "\u2764\ufe0f",
  50: "\ud83d\udc42",
  51: "\ud83e\udde0",
  54: "\ud83e\uddb7",
  58: "\ud83e\ude78"
}

function labelFor(id: number, title: string) {
  const e = EMOJI_BY_ID[id] ?? '🏥'
  return `${e} ${title}`
}

export function infirmaryKeyboard() {
  const kb = new InlineKeyboard()
  const items = listInfirmaries()

  for (const it of items) {
    kb.text(labelFor(it.id, it.title), `inf:${it.id}`).row()
  }

  kb.text('🔍 جستجو', 'action:search').row()
  kb.text('🔔 خبرم کن', 'action:watch').row()
  kb.text('⛔️ توقف خبررسانی', 'action:unwatch').row()
  return kb
}
