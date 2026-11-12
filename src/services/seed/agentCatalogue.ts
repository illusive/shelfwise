import type { Catalogue } from '@/domain/catalogue';

const cell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Catalogue as CSV for the Copilot Studio agent's knowledge (docs/copilot-studio/catalogue.csv),
 * so it answers with our brand/product ids. Regenerate with `npm run agent:catalogue`.
 */
export function agentCatalogueCsv(catalogue: Catalogue): string {
  const brandById = new Map(catalogue.brands.map((b) => [b.id, b]));
  const header = [
    'productId',
    'productName',
    'brandId',
    'brandName',
    'relation',
    'category',
    'units',
    'volumeMl',
    'container',
  ];
  const rows = catalogue.products.map((p) => {
    const b = brandById.get(p.brandId)!;
    return [
      p.id,
      p.name,
      b.id,
      b.name,
      b.relation,
      p.category,
      p.pack.units,
      p.pack.volumeMl,
      p.pack.container,
    ];
  });
  // Brands without listed products still need an id for brand-level matches.
  const listed = new Set(catalogue.products.map((p) => p.brandId));
  for (const b of catalogue.brands) {
    if (!listed.has(b.id)) rows.push(['', '', b.id, b.name, b.relation, b.category, '', '', '']);
  }
  return `# ${catalogue.version}\n${[header, ...rows].map((r) => r.map(cell).join(',')).join('\n')}\n`;
}
