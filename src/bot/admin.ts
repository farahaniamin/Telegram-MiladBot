import type { Context } from 'grammy'
import { CONFIG } from '../config.js'
import { isLocalProxyEnabled, isApiWorkerEnabled, setLocalProxyEnabled, setApiWorkerEnabled } from '../storage/settings.repo.js'

export function isAdmin(ctx: Context): boolean {
  const id = ctx.from?.id
  if (!id) return false
  
  // Convert to string for reliable comparison (handles large IDs)
  const idStr = String(id)
  const adminIdsStr = Array.from(CONFIG.ADMIN_IDS).map(String)
  
  console.log(`🔍 isAdmin check: userId=${idStr}, adminIds=[${adminIdsStr.join(', ')}]`)
  
  return adminIdsStr.includes(idStr)
}

export async function getProxyStatus(): Promise<string> {
  const proxy = await isLocalProxyEnabled() ? '✅ On' : '❌ Off'
  const worker = await isApiWorkerEnabled() ? '✅ On' : '❌ Off'
  return `🌐 Connection Settings:\n- Local Proxy: ${proxy}\n- API Worker: ${worker}`
}

export { isLocalProxyEnabled, isApiWorkerEnabled, setLocalProxyEnabled, setApiWorkerEnabled }
