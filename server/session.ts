import { randomBytes } from 'crypto';

export interface Session {
  sessionId: string;
  createdAt: Date;
  lastAccessedAt: Date;
  ip?: string;
}

class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private readonly sessionDuration = 30 * 60 * 1000; // 30 minutes

  generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  createSession(ip?: string): Session {
    const sessionId = this.generateSessionId();
    const session: Session = {
      sessionId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      ip,
    };
    this.sessions.set(sessionId, session);
    this.cleanupExpiredSessions();
    return session;
  }

  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (this.isSessionExpired(session)) {
      this.sessions.delete(sessionId);
      return null;
    }

    session.lastAccessedAt = new Date();
    return session;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  private isSessionExpired(session: Session): boolean {
    const now = new Date().getTime();
    const lastAccessed = session.lastAccessedAt.getTime();
    return now - lastAccessed > this.sessionDuration;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date().getTime();
    const entries = Array.from(this.sessions.entries());
    for (const [sessionId, session] of entries) {
      const lastAccessed = session.lastAccessedAt.getTime();
      if (now - lastAccessed > this.sessionDuration) {
        this.sessions.delete(sessionId);
      }
    }
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
}

export const sessionStore = new SessionStore();
