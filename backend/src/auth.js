import jwt from 'jsonwebtoken'
import { env } from './env.js'

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' })
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' })

  try {
    req.user = jwt.verify(token, env.JWT_SECRET)
    return next()
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'FORBIDDEN' })
    return next()
  }
}

