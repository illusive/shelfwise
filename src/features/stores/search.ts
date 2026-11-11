import type { Store } from '@/domain/models';

/** Every search word must appear in the store's name, chain, address or customer number. */
export function matchesStore(store: Store, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('da-DK');
  if (!q) return true;
  const haystack = [
    store.name,
    store.chain,
    store.area,
    store.address.street,
    store.address.postcode,
    store.address.city,
    store.customerNumber,
  ]
    .join(' ')
    .toLocaleLowerCase('da-DK');
  return q.split(/\s+/).every((part) => haystack.includes(part));
}
