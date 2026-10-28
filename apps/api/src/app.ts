import cors from 'cors';
import express from 'express';
import { errorHandler, HttpError, wrap } from './lib/http';
import { prisma } from './lib/prisma';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { catalogRouter } from './routes/catalog';
import { kidsRouter } from './routes/kids';
import { ordersRouter, plansRouter, subscriptionsRouter } from './routes/subscriptions';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/auth', authRouter);
  app.use('/kids', kidsRouter);
  app.use('/catalog', catalogRouter);
  app.use('/plans', plansRouter);
  app.use('/subscriptions', subscriptionsRouter);
  app.use('/orders', ordersRouter);
  app.use('/admin', adminRouter);

  // QR images live in the backend; ids are unguessable cuids, so labels can load them without auth.
  app.get(
    '/qr/:id.:format(png|svg)',
    wrap(async (req, res) => {
      const img = await prisma.qrImage.findUnique({ where: { id: req.params.id } });
      if (!img) throw new HttpError(404, 'QR not found');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (req.params.format === 'svg') res.type('image/svg+xml').send(img.svg);
      else res.type('image/png').send(Buffer.from(img.png));
    }),
  );

  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  app.use(errorHandler);
  return app;
}
