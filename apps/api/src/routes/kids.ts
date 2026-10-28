import { Router } from 'express';
import { requireAuth } from '../lib/auth';
import { HttpError, parse, wrap } from '../lib/http';
import { prisma } from '../lib/prisma';
import { kidSchema } from './auth';

export const kidsRouter = Router();
kidsRouter.use(requireAuth());

async function ownKid(userId: string, kidId: string) {
  const kid = await prisma.kidProfile.findFirst({ where: { id: kidId, userId } });
  if (!kid) throw new HttpError(404, 'Kid profile not found');
  return kid;
}

kidsRouter.get(
  '/',
  wrap(async (req, res) => {
    res.json(await prisma.kidProfile.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'asc' } }));
  }),
);

kidsRouter.post(
  '/',
  wrap(async (req, res) => {
    const body = parse(kidSchema, req.body);
    res.status(201).json(await prisma.kidProfile.create({ data: { ...body, userId: req.user!.id } }));
  }),
);

kidsRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    await ownKid(req.user!.id, req.params.id);
    const body = parse(kidSchema.partial(), req.body);
    res.json(await prisma.kidProfile.update({ where: { id: req.params.id }, data: body }));
  }),
);

kidsRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    await ownKid(req.user!.id, req.params.id);
    await prisma.kidProfile.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
