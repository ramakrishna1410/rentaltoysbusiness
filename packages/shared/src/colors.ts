// Toy colour is stored as a type plus a base colour, so filters stay meaningful:
//   SINGLE: one dominant base colour (a red car with yellow stickers is RED)
//   DUAL:   exactly two colours (black & white, red & yellow)
//   MULTI:  many colours, no dominant one
// Keep in sync with the ToyColor / ColorType enums in apps/api/prisma/schema.prisma.

export const TOY_COLORS = [
  'RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'PINK', 'BROWN', 'NATURAL_WOOD', 'BLACK', 'WHITE', 'GREY',
] as const;
export type ToyColor = (typeof TOY_COLORS)[number];

export const COLOR_TYPES = ['SINGLE', 'DUAL', 'MULTI'] as const;
export type ColorType = (typeof COLOR_TYPES)[number];

export const COLOR_LABELS: Record<ToyColor, string> = {
  RED: 'Red', ORANGE: 'Orange', YELLOW: 'Yellow', GREEN: 'Green', BLUE: 'Blue', PURPLE: 'Purple', PINK: 'Pink',
  BROWN: 'Brown', NATURAL_WOOD: 'Natural wood', BLACK: 'Black', WHITE: 'White', GREY: 'Grey',
};

export const COLOR_SWATCHES: Record<ToyColor, string> = {
  RED: '#E53935', ORANGE: '#FB8C00', YELLOW: '#FDD835', GREEN: '#43A047', BLUE: '#1E88E5', PURPLE: '#8E24AA', PINK: '#EC407A',
  BROWN: '#795548', NATURAL_WOOD: '#D7B98E', BLACK: '#212121', WHITE: '#FFFFFF', GREY: '#9E9E9E',
};

export const COLOR_TYPE_LABELS: Record<ColorType, string> = { SINGLE: 'Single / base colour', DUAL: 'Dual colour', MULTI: 'Multicolour' };

/** A colour filter is either one palette colour or a colour type ('DUAL' / 'MULTI'). */
export const COLOR_FILTERS = [...TOY_COLORS, 'DUAL', 'MULTI'] as const;
export type ColorFilter = (typeof COLOR_FILTERS)[number];

export interface ToyColorInfo {
  colorType: ColorType;
  primaryColor: ToyColor | null;
  secondaryColor: ToyColor | null;
}

/** Display text stored in Toy.color: "Red", "Black & White", "Multicolour". */
export function colorLabel(c: ToyColorInfo): string {
  if (c.colorType === 'MULTI') return 'Multicolour';
  if (c.colorType === 'DUAL' && c.primaryColor && c.secondaryColor) return `${COLOR_LABELS[c.primaryColor]} & ${COLOR_LABELS[c.secondaryColor]}`;
  return c.primaryColor ? COLOR_LABELS[c.primaryColor] : '—';
}

/** Returns why the colour fields are inconsistent, or null when they're valid. */
export function colorError(c: ToyColorInfo): string | null {
  if (c.colorType === 'SINGLE') {
    if (!c.primaryColor) return 'Pick the base colour';
    if (c.secondaryColor) return 'A single-colour toy has no second colour';
  }
  if (c.colorType === 'DUAL') {
    if (!c.primaryColor || !c.secondaryColor) return 'Pick both colours';
    if (c.primaryColor === c.secondaryColor) return 'The two colours must be different';
  }
  if (c.colorType === 'MULTI' && (c.primaryColor || c.secondaryColor)) return 'Multicolour toys have no base colour';
  return null;
}

/** Red matches red-based toys and dual toys that include red; DUAL / MULTI match the colour type. */
export function matchesColor(c: ToyColorInfo, filter: ColorFilter): boolean {
  if (filter === 'DUAL' || filter === 'MULTI') return c.colorType === filter;
  return c.primaryColor === filter || (c.colorType === 'DUAL' && c.secondaryColor === filter);
}
