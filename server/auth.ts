import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { db } from './db.ts'

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, Date.now())
  return token
}

export function userFromToken(token: string | undefined): number | null {
  if (!token) return null
  const row = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: number } | undefined
  return row?.user_id ?? null
}

export interface AuthedRequest extends Request {
  userId: number
  token: string
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  const userId = userFromToken(token)
  if (!userId || !token) return res.status(401).json({ error: 'Não autenticado' })
  ;(req as AuthedRequest).userId = userId
  ;(req as AuthedRequest).token = token
  next()
}

/** Limite simples de tentativas por IP (em memória). */
const attempts = new Map<string, { n: number; reset: number }>()
export function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`
    const now = Date.now()
    const cur = attempts.get(key)
    if (!cur || cur.reset < now) {
      attempts.set(key, { n: 1, reset: now + windowMs })
      return next()
    }
    if (++cur.n > max) return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' })
    next()
  }
}
