import { CONFIG } from '../config.js'

function ua() {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

export type PatientResponse = {
  allowToSetTimming: boolean
  fullName?: string
  nationalCode?: string
  id?: number
}

export async function validatePatient(nationalCode: string): Promise<PatientResponse> {
  const response = await fetch(
    `${CONFIG.BASE_URL}/api/patient/patient/GetOnlineReceptionPatientByNationalCode?nationalCode=${encodeURIComponent(nationalCode)}`,
    {
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': ua(),
        pragma: 'no-cache',
        'cache-control': 'no-cache'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`validatePatient_failed_status_${response.status}`)
  }

  return response.json() as Promise<PatientResponse>
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
  const response = await fetch(
    `${CONFIG.BASE_URL}/api/Timing/InfirmaryTiming/PostSearchInfirmaryTimingResult`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        accept: 'application/json, text/plain, */*',
        'user-agent': ua(),
        pragma: 'no-cache',
        'cache-control': 'no-cache',
        referer: `${CONFIG.BASE_URL}/onlineReception`
      },
      body: JSON.stringify({
        doctors: [],
        infirmary,
        nationalCode
      })
    }
  )

  if (!response.ok) {
    throw new Error(`searchInfirmaryTiming_failed_status_${response.status}`)
  }

  const json = await response.json()
  return Array.isArray(json) ? (json as TimingResult[]) : []
}
