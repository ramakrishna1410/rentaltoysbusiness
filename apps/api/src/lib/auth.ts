import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@rentaltoys/shared';
import { HttpError } from './http';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
};

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: '30d' });
}

function readUser(req: Request): AuthUser | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    const payload = jwt.verify(header.slice(7), secret()) as jwt.JwtPayload;
    return { id: String(payload.sub), role: payload.role as Role };
  } catch {
    return undefined;
  }
}

/** Attaches req.user when a valid token is present, without requiring one. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req);
  next();
}

export function requireAuth(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = readUser(req);
    if (!user) return next(new HttpError(401, 'Login required'));
    if (roles.length && !roles.includes(user.role)) return next(new HttpError(403, 'Not allowed'));
    req.user = user;
    next();
  };
}

export const requireStaff = requireAuth('ADMIN', 'STAFF');
export const requireAdmin = requireAuth('ADMIN');
