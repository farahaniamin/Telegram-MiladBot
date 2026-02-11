import { HttpsProxyAgent } from 'https-proxy-agent'
import { CONFIG } from '../config.js'
import { isLocalProxyEnabled, isApiWorkerEnabled } from '../storage/settings.repo.js'

export function getTelegramApiUrl(): string {
  if (isApiWorkerEnabled()) {
    return CONFIG.API_URL
  }
  return 'https://api.telegram.org'
}

export function getProxyAgent(): HttpsProxyAgent<string> | undefined {
  // Only use proxy when connecting directly to Telegram API
  // When using Worker, we don't need proxy as Worker is not blocked
  if (isLocalProxyEnabled() && !isApiWorkerEnabled() && CONFIG.PROXY_URL) {
    return new HttpsProxyAgent(CONFIG.PROXY_URL)
  }
  return undefined
}

export function getBotConfig() {
  const agent = getProxyAgent()
  const apiRoot = getTelegramApiUrl()
  
  const config: any = {}
  
  if (agent) {
    config.client = {
      baseFetchConfig: {
        agent: agent
      }
    }
  }
  
  if (apiRoot !== 'https://api.telegram.org') {
    config.apiRoot = apiRoot
  }
  
  return config
}
