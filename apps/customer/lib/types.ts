import type { Interest, Material, PieceType, PowerType, SizeClass } from '@rentaltoys/shared';

export interface ToyCard {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  images: string[];
  color: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  material: Material;
  powerType: PowerType;
  pieceType: PieceType;
  pieceCount: number;
  interestTags: Interest[];
  sizeClass: SizeClass;
  creditCost: number;
  mrp: number;
  availableUnits: number;
  avgRating: number | null;
  score?: number;
  reasons?: string[];
}

export interface ToyDetail extends ToyCard {
  description: string;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  weightKg: number;
  batteryType: string | null;
  batteryCount: number | null;
  tags: string[];
}
