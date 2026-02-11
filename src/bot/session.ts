export type UserSession = {
  step: 'idle' | 'await_national_code'
}

const sessions = new Map<number, UserSession>()

export function getSession(userId: number): UserSession {
  return sessions.get(userId) ?? { step: 'idle' }
}

export function setSession(userId: number, sess: UserSession) {
  sessions.set(userId, sess)
}
