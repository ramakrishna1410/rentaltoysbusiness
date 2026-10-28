import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * True when the module with this `import.meta.url` is the script Node was started with.
 * Builds the URL with pathToFileURL so it matches on Windows too (file:///C:/... vs C:\...).
 */
export function isMain(metaUrl: string, argv1: string | undefined = process.argv[1]): boolean {
  return !!argv1 && metaUrl === pathToFileURL(path.resolve(argv1)).href;
}
