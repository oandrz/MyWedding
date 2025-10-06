import { Request, Response, NextFunction } from "express";
import { randomBytes } from 'crypto';

export interface RequestWithCSRF extends Request {
  csrfToken?: string;
}

const csrfTokens = new Map<string, string>();

export function generateCSRFToken(sessionId: string): string {
  const token = randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, token);
  return token;
}

export function getCSRFToken(sessionId: string): string | undefined {
  return csrfTokens.get(sessionId);
}

export function deleteCSRFToken(sessionId: string): void {
  csrfTokens.delete(sessionId);
}

export function csrfProtection(req: RequestWithCSRF, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionId = req.cookies?.admin_session;
  if (!sessionId) {
    return res.status(403).json({ message: 'No session found' });
  }

  const expectedToken = csrfTokens.get(sessionId);
  if (!expectedToken) {
    return res.status(403).json({ message: 'CSRF token not found' });
  }

  const providedToken = req.headers['x-csrf-token'] as string;
  if (!providedToken || providedToken !== expectedToken) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  next();
}
