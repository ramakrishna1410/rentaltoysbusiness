// QR payloads are short opaque references. The label never encodes state (stage, bin, owner),
// so a printed label stays valid for the whole life of the toy.

export type QrRef =
  | { kind: 'UNIT'; unitId: string }
  | { kind: 'PIECE'; unitId: string; pieceNo: number; total: number }
  | { kind: 'BIN'; binCode: string };

export const unitQr = (unitId: string) => `RT:U:${unitId}`;
export const pieceQr = (unitId: string, pieceNo: number, total: number) => `RT:P:${unitId}:${pieceNo}/${total}`;
export const binQr = (binCode: string) => `RT:B:${binCode}`;

export function parseQr(payload: string): QrRef | null {
  const parts = payload.trim().split(':');
  if (parts[0] !== 'RT') return null;
  if (parts[1] === 'U' && parts.length === 3 && parts[2]) return { kind: 'UNIT', unitId: parts[2] };
  if (parts[1] === 'B' && parts.length === 3 && parts[2]) return { kind: 'BIN', binCode: parts[2] };
  if (parts[1] === 'P' && parts.length === 4) {
    const m = /^(\d+)\/(\d+)$/.exec(parts[3]);
    if (!m || !parts[2]) return null;
    const pieceNo = Number(m[1]);
    const total = Number(m[2]);
    if (pieceNo < 1 || pieceNo > total) return null;
    return { kind: 'PIECE', unitId: parts[2], pieceNo, total };
  }
  return null;
}
