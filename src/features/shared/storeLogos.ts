/**
 * Chain logo metadata for the demo stores (sources: docs/logo-sources.md).
 * `background` fills the round bubble in the brand colour; `fit: 'cover'` marks fill the
 * circle edge to edge, `contain` wordmarks sit inside it at `scale` of the diameter.
 */
export interface ChainLogo {
  file: string;
  background: string;
  fit: 'cover' | 'contain';
  scale?: number;
}

export const CHAIN_LOGOS: Record<string, ChainLogo> = {
  Netto: { file: 'netto.svg', background: '#fad85b', fit: 'cover' },
  Lidl: { file: 'lidl.svg', background: '#0050aa', fit: 'cover' },
  'Coop 365': { file: 'coop-365.png', background: '#00aa46', fit: 'cover' },
  Kvickly: { file: 'kvickly.png', background: '#c31414', fit: 'cover' },
  SuperBrugsen: { file: 'superbrugsen.png', background: '#c31414', fit: 'cover' },
  Bilka: { file: 'bilka.svg', background: '#004990', fit: 'contain', scale: 1.16 },
  Føtex: { file: 'fotex.svg', background: '#ffffff', fit: 'contain', scale: 0.88 },
  'Rema 1000': { file: 'rema-1000.svg', background: '#ffffff', fit: 'contain', scale: 0.88 },
  Meny: { file: 'meny.svg', background: '#ffffff', fit: 'contain', scale: 0.94 },
  Spar: { file: 'spar.svg', background: '#ffffff', fit: 'contain', scale: 0.96 },
};
