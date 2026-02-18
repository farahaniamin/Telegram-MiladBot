import type { Context } from 'grammy'
import { CONFIG } from '../config.js'

export function isAdmin(ctx: Context): boolean {
  const id = ctx.from?.id
  return !!id && CONFIG.ADMIN_IDS.has(id)
}

// Proxy-related functions removed - not supported in Cloudflare Workers
// All requests go directly without proxy
