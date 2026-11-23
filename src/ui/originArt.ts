// Painted portraits for the origin heroes (D6, Nov 23). Made by the owner with Google Gemini;
// see assets/CREDITS.md. Custom heroes keep the layered SVG portrait.
import type { OriginId } from '../data/schemas/origin';
import corin from '../assets/portraits/corin.webp';
import harl from '../assets/portraits/harl.webp';
import nessa from '../assets/portraits/nessa.webp';
import vorna from '../assets/portraits/vorna.webp';

export const ORIGIN_ART: Record<OriginId, string> = { corin, harl, nessa, vorna };

/** The painting for a hero, or undefined for a custom hero. */
export const originArt = (origin: 'custom' | OriginId): string | undefined =>
  origin === 'custom' ? undefined : ORIGIN_ART[origin];
