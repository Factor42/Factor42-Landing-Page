/**
 * Blog card/hero color themes. Editors pick a theme name in the CMS; the site
 * derives the gradients and pill colors from it — so no one hand-enters rgba().
 *
 * Migrated posts still carry explicit color fields (heroGradient/cardGradient/
 * tagColor/tagBg); the resolvers below prefer those when present, so existing
 * posts render exactly as before. New posts rely on `theme` alone.
 */
export interface Theme {
  hero: string;
  card: string;
  tagColor: string;
  tagBg: string;
}

export const THEMES: Record<string, Theme> = {
  blue: { hero: 'linear-gradient(135deg,#1e3a5f,#0066FF 55%,#0066FF)', card: 'linear-gradient(135deg,#1e3a5f,#0066FF)', tagColor: '#0066FF', tagBg: 'rgba(0,102,255,.1)' },
  red: { hero: 'linear-gradient(135deg,#450a0a,#dc2626 55%,#0066FF)', card: 'linear-gradient(135deg,#450a0a,#dc2626)', tagColor: '#b91c1c', tagBg: 'rgba(239,68,68,.1)' },
  purple: { hero: 'linear-gradient(135deg,#4c1d95,#7c3aed 55%,#0066FF)', card: 'linear-gradient(135deg,#4c1d95,#7c3aed)', tagColor: '#7c3aed', tagBg: 'rgba(124,58,237,.1)' },
  sky: { hero: 'linear-gradient(135deg,#0c4a6e,#0284c7 55%,#0066FF)', card: 'linear-gradient(135deg,#0c4a6e,#0284c7)', tagColor: '#0284c7', tagBg: 'rgba(2,132,199,.1)' },
  indigo: { hero: 'linear-gradient(135deg,#1e1b4b,#4338ca 55%,#0066FF)', card: 'linear-gradient(135deg,#1e1b4b,#4338ca)', tagColor: '#4338ca', tagBg: 'rgba(67,56,202,.1)' },
  teal: { hero: 'linear-gradient(135deg,#134e4a,#0d9488 55%,#0066FF)', card: 'linear-gradient(135deg,#134e4a,#0d9488)', tagColor: '#0f766e', tagBg: 'rgba(13,148,136,.1)' },
  orange: { hero: 'linear-gradient(135deg,#7c2d12,#ea580c 55%,#0066FF)', card: 'linear-gradient(135deg,#7c2d12,#ea580c)', tagColor: '#ea580c', tagBg: 'rgba(249,115,22,.1)' },
};

const DEFAULT = THEMES.blue;

interface CardData {
  theme?: string;
  heroGradient?: string;
  cardGradient?: string;
  tagColor?: string;
  tagBg?: string;
}

const pick = (data: CardData): Theme => (data.theme && THEMES[data.theme]) || DEFAULT;

export const heroGradient = (d: CardData) => d.heroGradient ?? pick(d).hero;
export const cardGradient = (d: CardData) => d.cardGradient ?? pick(d).card;
export const tagColor = (d: CardData) => d.tagColor ?? pick(d).tagColor;
export const tagBg = (d: CardData) => d.tagBg ?? pick(d).tagBg;
