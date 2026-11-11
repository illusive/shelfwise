export const CATEGORIES = [
  'beer',
  'soft-drinks',
  'water',
  'energy-functional',
  'rtd-cider',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];
