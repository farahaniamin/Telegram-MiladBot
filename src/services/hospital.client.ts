import { request, Agent } from 'undici'
import { CONFIG } from '../config.js'

const agent = new Agent({
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 60_000,
  connections: 1
})

function ua() {
  // Minimal, stable UA. Avoids looking like a bot library.
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

export type PatientResponse = {
  allowToSetTimming: boolean
  fullName?: string
  nationalCode?: string
  id?: number
}

export async function validatePatient(nationalCode: string): Promise<PatientResponse> {
  const { statusCode, body } = await request(
    `${CONFIG.BASE_URL}/api/patient/patient/GetOnlineReceptionPatientByNationalCode?nationalCode=${encodeURIComponent(nationalCode)}`,
    {
      dispatcher: agent,
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': ua(),
        pragma: 'no-cache',
        'cache-control': 'no-cache'
      }
    }
  )

  if (statusCode !== 200) {
    throw new Error(`validatePatient_failed_status_${statusCode}`)
  }

  return body.json() as any
}

export type TimingResult = {
  date: string
  pDate: string
  doctor: { fullName: string; id: number }
  infirmaryTimingShiftTimeResults: Array<{
    start: string
    end: string
    timingShiftType: { title: string; id: number; code: string | null }
  }>
}

export async function searchInfirmaryTiming(
  infirmary: { id: number; code: string; title: string },
  nationalCode: string
): Promise<TimingResult[]> {
  const { statusCode, body } = await request(
    `${CONFIG.BASE_URL}/api/Timing/InfirmaryTiming/PostSearchInfirmaryTimingResult`,
    {
      method: 'POST',
      dispatcher: agent,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        accept: 'application/json, text/plain, */*',
        'user-agent': ua(),
        pragma: 'no-cache',
        'cache-control': 'no-cache',
        // Referer helps look like normal SPA usage
        referer: `${CONFIG.BASE_URL}/onlineReception`
      },
      body: JSON.stringify({
        doctors: [],
        infirmary,
        nationalCode
      })
    }
  )

  if (statusCode !== 200) {
    throw new Error(`searchInfirmaryTiming_failed_status_${statusCode}`)
  }

  const json = (await body.json()) as any
  return Array.isArray(json) ? (json as TimingResult[]) : []
}
