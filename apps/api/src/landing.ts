import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Folder holding the landing videos; served at /media. */
export const MEDIA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../media');

/**
 * The five landing-page slides. Drop a clip named `<file>.mp4` (and optionally a `<file>.jpg`
 * still) into apps/api/media/landing/ and it plays automatically; until then the app shows a
 * coloured panel with the caption. See media/landing/README.md for suggested free clips.
 */
export const LANDING_SLIDES = [
  { file: '01-kids-playing', title: 'Play that never gets old', caption: 'New toys every month, chosen for your child.', color: '#E8875F' },
  { file: '02-warehouse', title: 'Every toy has its place', caption: 'A spotless warehouse where every toy is labelled and shelved.', color: '#4F7FB8' },
  { file: '03-quality-check', title: 'Checked piece by piece', caption: 'Gloved staff scan and inspect every toy before it leaves.', color: '#5F8F6A' },
  { file: '04-sanitation', title: 'Sanitised after every swap', caption: 'Cleaned, dried and sealed after every single return.', color: '#2F9C9C' },
  { file: '05-delivery', title: 'Delivered with a smile', caption: 'Our team hands over the fun right at your door.', color: '#B5617E' },
] as const;

export function landingSlides(base: string) {
  const exists = (name: string) => fs.existsSync(path.join(MEDIA_DIR, 'landing', name));
  return LANDING_SLIDES.map((s) => ({
    title: s.title,
    caption: s.caption,
    color: s.color,
    videoUrl: exists(`${s.file}.mp4`) ? `${base}/media/landing/${s.file}.mp4` : null,
    posterUrl: exists(`${s.file}.jpg`) ? `${base}/media/landing/${s.file}.jpg` : null,
  }));
}
