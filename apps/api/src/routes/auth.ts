import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { INTERESTS } from '@rentaltoys/shared';
import { requireAuth, signToken } from '../lib/auth';
import { HttpError, parse, wrap } from '../lib/http';
import { prisma } from '../lib/prisma';

export const kidSchema = z.object({
  name: z.string().min(1),
  dateOfBirth: z.coerce.date().refine((d) => d <= new Date(), 'Date of birth is in the future'),
  gender: z.string().optional(),
  interests: z.array(z.enum(INTERESTS)).default([]),
});

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().toLowerCase(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number'),
  password: z.string().min(8),
  addressLine: z.string().optional(),
  area: z.string().optional(),
  pincode: z.string().regex(/^6\d{5}$/, 'We deliver in Chennai and Tamil Nadu pincodes (6xxxxx)').optional(),
  kids: z.array(kidSchema).min(1, 'Tell us about at least one kid'),
});

const loginSchema = z.object({ login: z.string().min(3), password: z.string().min(1) });

const publicUser = { id: true, name: true, email: true, phone: true, role: true, addressLine: true, area: true, pincode: true } as const;

export const authRouter = Router();

authRouter.post(
  '/signup',
  wrap(async (req, res) => {
    const body = parse(signupSchema, req.body);
    const clash = await prisma.user.findFirst({ where: { OR: [{ email: body.email }, { phone: body.phone }] } });
    if (clash) throw new HttpError(409, 'An account with this email or phone already exists');
    const { kids, password, ...rest } = body;
    const user = await prisma.user.create({
      data: { ...rest, passwordHash: await bcrypt.hash(password, 10), kids: { create: kids } },
      select: { ...publicUser, kids: true },
    });
    res.status(201).json({ token: signToken(user), user });
  }),
);

authRouter.post(
  '/login',
  wrap(async (req, res) => {
    const { login, password } = parse(loginSchema, req.body);
    const user = await prisma.user.findFirst({ where: { OR: [{ email: login.toLowerCase() }, { phone: login }] } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Wrong login or password');
    res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  }),
);

authRouter.get(
  '/me',
  requireAuth(),
  wrap(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { ...publicUser, kids: true } });
    if (!user) throw new HttpError(404, 'User not found');
    res.json(user);
  }),
);
