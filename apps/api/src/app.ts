import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler, HttpError, wrap } from './lib/http';
import { prisma } from './lib/prisma';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { catalogRouter } from './routes/catalog';
import { kidsRouter } from './routes/kids';
import { ordersRouter, plansRouter, subscriptionsRouter } from './routes/subscriptions';

export function createApp() {
  const app = express();
  // Render (and most hosts) terminate TLS at a proxy; needed for correct client IPs in rate limiting.
  app.set('trust proxy', 1);
  // QR images and label sheets are loaded by the apps from another origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: corsOrigins() }));
  // Photo uploads arrive as base64 JSON; only that route gets the larger body limit.
  app.use(/^\/admin\/toys\/[^/]+\/photos$/, express.json({ limit: '5mb' }));
  app.use(express.json({ limit: '1mb' }));

  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
  app.use('/auth/login', authLimiter);
  app.use('/auth/signup', authLimiter);

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

  app.get(
    '/images/:id',
    wrap(async (req, res) => {
      const img = await prisma.toyImage.findUnique({ where: { id: req.params.id } });
      if (!img) throw new HttpError(404, 'Image not found');
      // Ids are never reused: a replaced photo gets a new id, so the bytes behind a URL never change.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.type(img.mimeType).send(Buffer.from(img.data));
    }),
  );

  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  app.use(errorHandler);
  return app;
}

/**
 * Native apps send no Origin header, so CORS only matters for browsers (the future website and the
 * Expo web builds). CORS_ORIGINS is a comma-separated allow-list; unset means allow all (local dev).
 */
function corsOrigins(): string[] | boolean {
  const list = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return list.length ? list : true;
}
