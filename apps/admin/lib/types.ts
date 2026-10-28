import type { Interest, Material, PieceType, PowerType, SizeClass, ToyStage, ZoneType } from '@rentaltoys/shared';

export interface Toy {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  description: string;
  images: string[];
  color: string;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  weightKg: number;
  manufacturingDate: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  material: Material;
  powerType: PowerType;
  batteryType: string | null;
  batteryCount: number | null;
  pieceType: PieceType;
  pieceCount: number;
  interestTags: Interest[];
  tags: string[];
  sizeClass: SizeClass;
  mrp: number;
  rentalCount: number;
  unitsByStage?: Partial<Record<ToyStage, number>>;
}

export interface BinRef {
  id: string;
  code: string;
  shelf?: { level: number; rack: { code: string; zone: { code: string; type: ZoneType } } };
}

export interface Piece {
  id: string;
  pieceNo: number;
  label: string;
  qrPayload: string;
  qrImageId: string | null;
  status: 'PRESENT' | 'MISSING' | 'DAMAGED';
}

export interface Movement {
  id: string;
  fromStage: ToyStage | null;
  toStage: ToyStage;
  scannedAt: string;
  reason: string | null;
  orderId: string | null;
  scannedBy: { name: string };
  pieceScan: { scanned: number[]; missing: number[]; total: number } | null;
}

export interface Unit {
  id: string;
  toyId: string;
  stage: ToyStage;
  condition: string;
  vendor: string | null;
  procurementDate: string;
  cost: number;
  qrPayload: string;
  qrImageId: string | null;
  reservedForOrderId: string | null;
  bin: BinRef | null;
  toy: Toy;
  pieces: Piece[];
  movements?: Movement[];
}

export interface NextStage {
  stage: ToyStage;
  needsAllPieces: boolean;
  needsBin: boolean;
  needsOrder: boolean;
  needsReason: boolean;
}

export interface ScanResult {
  kind: 'UNIT' | 'PIECE' | 'BIN';
  pieceNo?: number;
  unit?: Unit;
  currentStage?: ToyStage;
  nextStages?: NextStage[];
  movements?: Movement[];
  bin?: BinRef & { units: (Unit & { toy: Toy })[] };
}

export interface SlotSuggestion {
  binId: string;
  binCode: string;
  score: number;
  reasons: string[];
  breakdown: { space: number; velocity: number; ergonomics: number; affinity: number };
}
