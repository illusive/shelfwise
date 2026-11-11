import type { Category } from './categories';

/** `owned` and `licensed` brands both belong to the client; only `competitor` does not. */
export type BrandRelation = 'owned' | 'licensed' | 'competitor';

export type Container = 'can' | 'glass-bottle' | 'plastic-bottle' | 'carton';

export interface PackSize {
  units: number;
  volumeMl: number;
  container: Container;
}

export interface Brand {
  id: string;
  name: string;
  company: string;
  relation: BrandRelation;
  category: Category;
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  category: Category;
  pack: PackSize;
}

export interface Catalogue {
  version: string;
  client: { id: string; name: string };
  brands: Brand[];
  products: Product[];
}

export interface CatalogueIndex extends Catalogue {
  brandById: ReadonlyMap<string, Brand>;
  productById: ReadonlyMap<string, Product>;
}

export function indexCatalogue(catalogue: Catalogue): CatalogueIndex {
  return {
    ...catalogue,
    brandById: new Map(catalogue.brands.map((b) => [b.id, b])),
    productById: new Map(catalogue.products.map((p) => [p.id, p])),
  };
}

export function isClientRelation(relation: BrandRelation): boolean {
  return relation !== 'competitor';
}

/** Resolves the brand of a match, preferring the product's brand when a SKU is known. */
export function resolveBrand(
  catalogue: CatalogueIndex,
  productId: string | null,
  brandId: string | null,
): Brand | undefined {
  const product = productId ? catalogue.productById.get(productId) : undefined;
  const id = product?.brandId ?? brandId;
  return id ? catalogue.brandById.get(id) : undefined;
}
