import type { CatalogueIndex } from '@/domain/catalogue';
import type { NormalisedPrice } from '@/domain/pricing';
import { formatPack } from '@/i18n/format';
import { t } from '@/i18n/strings';

export function productName(
  catalogue: CatalogueIndex,
  productId: string | null,
  brandId: string | null,
): string {
  const product = productId ? catalogue.productById.get(productId) : undefined;
  if (product) return product.name;
  const brand = brandId ? catalogue.brandById.get(brandId) : undefined;
  return brand ? brand.name : t.results.unknown;
}

export function productPack(catalogue: CatalogueIndex, productId: string | null): string | null {
  const product = productId ? catalogue.productById.get(productId) : undefined;
  return product ? formatPack(product.pack) : null;
}

export function priceLabelName(catalogue: CatalogueIndex, price: NormalisedPrice): string {
  if (price.productId || price.brandId)
    return productName(catalogue, price.productId, price.brandId);
  return price.rawText ?? t.report.unresolved;
}

/** Client prices first, then competitors, then unmatched; resolved before unresolved. */
export function sortPrices(prices: readonly NormalisedPrice[]): NormalisedPrice[] {
  const rank = (p: NormalisedPrice) =>
    (p.classification === 'client' ? 0 : p.classification === 'competitor' ? 1 : 2) * 2 +
    (p.status === 'resolved' ? 0 : 1);
  return [...prices].sort((a, b) => rank(a) - rank(b));
}
