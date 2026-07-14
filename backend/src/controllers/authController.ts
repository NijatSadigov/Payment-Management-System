import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../middleware/auth';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const authUser = {
    id: user.id,
    email: user.email,
    role: user.role as 'super_admin' | 'manager',
    firstName: user.firstName,
    lastName: user.lastName,
  };

  const token = signToken(authUser);
  return res.json({ token, user: authUser });
}

// With stateless JWTs, logout is handled client-side by clearing storage.
// This endpoint exists so the frontend has a symmetric call to make.
export async function logout(_req: Request, res: Response) {
  return res.json({ success: true });
}
