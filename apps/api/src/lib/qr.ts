import QRCode from 'qrcode';
import type { Tx } from './prisma';

/** Renders the QR once and keeps it in the backend so labels can be reprinted any time. */
export async function storeQr(tx: Tx, payload: string): Promise<string> {
  const existing = await tx.qrImage.findUnique({ where: { payload }, select: { id: true } });
  if (existing) return existing.id;
  const [png, svg] = await Promise.all([
    QRCode.toBuffer(payload, { type: 'png', errorCorrectionLevel: 'M', margin: 1, width: 300 }),
    QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }),
  ]);
  const img = await tx.qrImage.create({ data: { payload, png: new Uint8Array(png), svg }, select: { id: true } });
  return img.id;
}
