// Single source of truth for the scan-driven toy lifecycle. Every stage change is a QR scan
// that records the stage before and after; the API rejects anything not allowed here.

export const TOY_STAGES = [
  'PROCUREMENT',
  'STORAGE',
  'IN_TRANSIT',
  'WITH_CUSTOMER',
  'SANITATION',
  'DAMAGE',
  'SCRAP',
] as const;
export type ToyStage = (typeof TOY_STAGES)[number];

export const STAGE_LABELS: Record<ToyStage, string> = {
  PROCUREMENT: 'Procurement',
  STORAGE: 'Storage (available)',
  IN_TRANSIT: 'In transit',
  WITH_CUSTOMER: 'With customer',
  SANITATION: 'Sanitation',
  DAMAGE: 'Damage',
  SCRAP: 'Scrap',
};

export const STAGE_TRANSITIONS: Record<ToyStage, readonly ToyStage[]> = {
  PROCUREMENT: ['SANITATION', 'STORAGE', 'DAMAGE'],
  SANITATION: ['STORAGE', 'DAMAGE'],
  STORAGE: ['IN_TRANSIT', 'SANITATION', 'DAMAGE'],
  IN_TRANSIT: ['WITH_CUSTOMER', 'SANITATION', 'DAMAGE'],
  WITH_CUSTOMER: ['IN_TRANSIT'],
  DAMAGE: ['SANITATION', 'SCRAP'],
  SCRAP: [],
};

export function allowedNextStages(from: ToyStage): readonly ToyStage[] {
  return STAGE_TRANSITIONS[from];
}

export function canTransition(from: ToyStage, to: ToyStage): boolean {
  return STAGE_TRANSITIONS[from].includes(to);
}

/** Leaving the warehouse or coming back into it: every piece of a multi-piece toy must be scanned. */
export function requiresFullPieceScan(from: ToyStage, to: ToyStage): boolean {
  return (from === 'STORAGE' && to === 'IN_TRANSIT') || (from === 'IN_TRANSIT' && (to === 'SANITATION' || to === 'DAMAGE'));
}

export interface MoveRequest {
  currentStage: ToyStage;
  expectedFromStage: ToyStage;
  toStage: ToyStage;
  pieceCount: number;
  scannedPieceNos: readonly number[];
  toBinId?: string | null;
  orderId?: string | null;
  reservedForOrderId?: string | null;
  reason?: string | null;
}

export interface MoveCheck {
  ok: boolean;
  errors: string[];
  missingPieceNos: number[];
}

export function missingPieces(pieceCount: number, scannedPieceNos: readonly number[]): number[] {
  const seen = new Set(scannedPieceNos);
  const missing: number[] = [];
  for (let n = 1; n <= pieceCount; n++) if (!seen.has(n)) missing.push(n);
  return missing;
}

export function checkMove(req: MoveRequest): MoveCheck {
  const errors: string[] = [];
  if (req.currentStage !== req.expectedFromStage) {
    errors.push(`Toy is in ${req.currentStage}, not ${req.expectedFromStage}. Rescan to refresh.`);
  }
  if (!canTransition(req.currentStage, req.toStage)) {
    errors.push(`Cannot move from ${req.currentStage} to ${req.toStage}.`);
  }

  const missing = requiresFullPieceScan(req.currentStage, req.toStage)
    ? missingPieces(req.pieceCount, req.scannedPieceNos)
    : [];
  if (missing.length > 0 && req.toStage !== 'DAMAGE') {
    errors.push(`Pieces not scanned: ${missing.join(', ')}. Scan all pieces or move to DAMAGE.`);
  }

  if (req.toStage === 'STORAGE' && !req.toBinId) errors.push('Scan a bin to store this toy.');
  if (req.currentStage === 'STORAGE' && req.toStage === 'IN_TRANSIT') {
    if (!req.orderId) errors.push('Dispatch needs an order.');
    else if (req.reservedForOrderId !== req.orderId) errors.push('This toy is not reserved for that order.');
  }
  if ((req.toStage === 'DAMAGE' || req.toStage === 'SCRAP') && !req.reason?.trim()) {
    errors.push('Give a reason for damage or scrap.');
  }
  return { ok: errors.length === 0, errors, missingPieceNos: missing };
}
