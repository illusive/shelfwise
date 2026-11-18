import type { CatalogueIndex, Product } from './catalogue';

/**
 * Deterministic name → catalogue matching for analysis providers that recognise products by
 * name but don't always return our ids (e.g. "Pepsi Max 33 cl" → pepsi / pepsi-max-330).
 * Conservative: a brand matches only on whole words; a product only when brand, pack and the
 * distinguishing words leave exactly one candidate.
 */

/** Extra names packs and labels use for a brand (by brand id). */
const BRAND_ALIASES: Record<string, string[]> = {
  monster: ['monster'],
  lipton: ['lipton'],
  'long-drink': ['long drink', 'original long drink'],
  '7up': ['7 up', 'seven up'],
  'aqua-dor': ['aqua d or', 'aquador'],
  'birra-moretti': ['moretti'],
};

export function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/å/g, 'aa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

const containsWords = (haystack: string, needle: string) =>
  needle.trim() !== '' && haystack.includes(` ${needle.trim()} `);

/** Pack volume in ml from text such as "33 cl", "0,5 l", "500ml", "1.5 L". */
export function parseVolumeMl(text: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(ml|cl|ltr|liter|l)\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const unit = m[2].toLowerCase();
  const ml = unit === 'ml' ? n : unit === 'cl' ? n * 10 : n * 1000;
  return Number.isFinite(ml) && ml > 0 ? Math.round(ml) : null;
}

/** Units per pack from text such as "6-pak", "6 x 33 cl", "4 stk". */
export function parseUnits(text: string): number | null {
  const m = /(\d+)\s*(?:x|-?\s*pak|-?\s*pack|stk)\b/i.exec(text);
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n >= 2 && n <= 48 ? n : null;
}

export interface NameMatch {
  brandId: string | null;
  productId: string | null;
}

export function createNameMatcher(catalogue: CatalogueIndex) {
  const brandNames = catalogue.brands
    .flatMap((b) =>
      [b.name, b.id.replace(/-/g, ' '), ...(BRAND_ALIASES[b.id] ?? [])].map((n) => ({
        id: b.id,
        name: normalise(n).trim(),
      })),
    )
    // Longest first: "faxe kondi booster" before "faxe kondi" before "faxe".
    .sort((a, b) => b.name.length - a.name.length);
  const productsByBrand = new Map<string, Product[]>();
  for (const p of catalogue.products) {
    productsByBrand.set(p.brandId, [...(productsByBrand.get(p.brandId) ?? []), p]);
  }

  function brandFor(text: string): string | null {
    const n = normalise(text);
    return brandNames.find((b) => containsWords(n, b.name))?.id ?? null;
  }

  /** Product of the brand matching the text's pack and distinguishing words, if unique. */
  function productFor(
    brandId: string,
    text: string,
    pack: { volumeMl?: number | null; units?: number | null } = {},
  ): string | null {
    const brand = catalogue.brandById.get(brandId);
    const n = normalise(text);
    const volume = pack.volumeMl ?? parseVolumeMl(text);
    if (!volume || !brand) return null;
    const units = pack.units ?? parseUnits(text) ?? 1;
    let candidates = (productsByBrand.get(brandId) ?? []).filter(
      (p) => p.pack.volumeMl === volume && p.pack.units === units,
    );
    if (candidates.length > 1) {
      // Keep products whose extra words (e.g. "max", "free") all appear in the text, and drop
      // plain variants when the text names a variant that one candidate has.
      const brandWords = new Set(normalise(brand.name).trim().split(' '));
      const extra = (p: Product) =>
        normalise(p.name)
          .trim()
          .split(' ')
          .filter((w) => !brandWords.has(w));
      const scored = candidates
        .filter((p) => extra(p).every((w) => containsWords(n, w)))
        .map((p) => ({ p, words: extra(p).length }));
      const best = Math.max(-1, ...scored.map((s) => s.words));
      candidates = scored.filter((s) => s.words === best).map((s) => s.p);
    }
    return candidates.length === 1 ? candidates[0].id : null;
  }

  return {
    brandFor,
    productFor,
    /** Brand and (if unique) product for a pack name or label text. */
    match(
      text: string | null | undefined,
      pack?: { volumeMl?: number | null; units?: number | null },
    ): NameMatch {
      if (!text?.trim()) return { brandId: null, productId: null };
      const brandId = brandFor(text);
      return { brandId, productId: brandId ? productFor(brandId, text, pack) : null };
    },
  };
}

export type NameMatcher = ReturnType<typeof createNameMatcher>;
