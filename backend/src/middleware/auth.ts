import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthUser {
  id: number;
  email: string;
  role: 'super_admin' | 'manager';
  firstName: string;
  lastName: string;
}

// Augment Express Request with the authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

// Verifies the Bearer token and attaches the user to the request
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Restricts a route to specific roles
export function requireRole(...roles: Array<'super_admin' | 'manager'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}
