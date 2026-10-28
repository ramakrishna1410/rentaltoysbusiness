import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isMain } from '../src/lib/is-main';

describe('isMain', () => {
  const file = path.resolve('prisma/seed.ts');

  it('matches the script Node was started with, including relative argv paths', () => {
    expect(isMain(pathToFileURL(file).href, file)).toBe(true);
    expect(isMain(pathToFileURL(file).href, 'prisma/seed.ts')).toBe(true);
  });

  it('does not match other scripts or a missing argv', () => {
    expect(isMain(pathToFileURL(path.resolve('prisma/seed-base.ts')).href, file)).toBe(false);
    expect(isMain(pathToFileURL(file).href, undefined)).toBe(false);
  });
});
