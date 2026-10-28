import { describe, expect, it } from 'vitest';
import { colorError, colorLabel, matchesColor } from '../src';

const red = { colorType: 'SINGLE', primaryColor: 'RED', secondaryColor: null } as const;
const redYellow = { colorType: 'DUAL', primaryColor: 'RED', secondaryColor: 'YELLOW' } as const;
const multi = { colorType: 'MULTI', primaryColor: null, secondaryColor: null } as const;

describe('toy colours', () => {
  it('labels single, dual and multicolour toys', () => {
    expect(colorLabel(red)).toBe('Red');
    expect(colorLabel(redYellow)).toBe('Red & Yellow');
    expect(colorLabel(multi)).toBe('Multicolour');
  });

  it('validates the colour combination', () => {
    expect(colorError(red)).toBeNull();
    expect(colorError({ ...red, primaryColor: null })).toMatch(/base colour/);
    expect(colorError({ ...redYellow, secondaryColor: 'RED' })).toMatch(/different/);
    expect(colorError({ ...multi, primaryColor: 'RED' })).toMatch(/no base colour/);
  });

  it('matches a colour filter on the base colour or either dual colour', () => {
    expect(matchesColor(red, 'RED')).toBe(true);
    expect(matchesColor(redYellow, 'YELLOW')).toBe(true);
    expect(matchesColor(redYellow, 'DUAL')).toBe(true);
    expect(matchesColor(red, 'YELLOW')).toBe(false);
    expect(matchesColor(multi, 'RED')).toBe(false);
    expect(matchesColor(multi, 'MULTI')).toBe(true);
  });
});
