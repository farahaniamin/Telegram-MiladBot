import { HttpsProxyAgent } from 'https-proxy-agent'
import { CONFIG } from '../config.js'
import { isLocalProxyEnabled, isApiWorkerEnabled } from '../storage/settings.repo.js'

export async function getTelegramApiUrl(): Promise<string> {
  if (await isApiWorkerEnabled()) {
    return CONFIG.API_URL
  }
  return 'https://api.telegram.org'
}

export async function getProxyAgent(): Promise<HttpsProxyAgent<string> | undefined> {
  const useProxy = await isLocalProxyEnabled()
  const useWorker = await isApiWorkerEnabled()
  if (useProxy && !useWorker && CONFIG.PROXY_URL) {
    return new HttpsProxyAgent(CONFIG.PROXY_URL)
  }
  return undefined
}

export async function getBotConfig() {
  const agent = await getProxyAgent()
  const apiRoot = await getTelegramApiUrl()
  
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
