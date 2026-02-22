import type { Context } from 'grammy'
import { CONFIG } from '../config.js'
import { isLocalProxyEnabled, isApiWorkerEnabled, setLocalProxyEnabled, setApiWorkerEnabled } from '../storage/settings.repo.js'

export function isAdmin(ctx: Context): boolean {
  const id = ctx.from?.id
  return !!id && CONFIG.ADMIN_IDS.has(id)
}

export async function getProxyStatus(): Promise<string> {
  const proxy = await isLocalProxyEnabled() ? '✅ On' : '❌ Off'
  const worker = await isApiWorkerEnabled() ? '✅ On' : '❌ Off'
  return `🌐 Connection Settings:\n- Local Proxy: ${proxy}\n- API Worker: ${worker}`
}

export { isLocalProxyEnabled, isApiWorkerEnabled, setLocalProxyEnabled, setApiWorkerEnabled }
