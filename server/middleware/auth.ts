import { Request, Response, NextFunction } from "express";
import { sessionStore } from "../session";

export interface RequestWithSession extends Request {
  sessionId?: string;
}

export function adminAuthMiddleware(req: RequestWithSession, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.admin_session;
  
  if (!sessionId) {
    return res.status(401).json({ message: 'Unauthorized: No session found' });
  }

  const session = sessionStore.getSession(sessionId);
  
  if (!session) {
    res.clearCookie('admin_session');
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired session' });
  }

  req.sessionId = sessionId;
  next();
}

export function validateAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD || 'wedding-admin';
  return password === adminPassword;
}
