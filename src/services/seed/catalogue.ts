import type { Brand, Catalogue, Container, Product } from '@/domain/catalogue';
import type { Category } from '@/domain/categories';

/**
 * Seed catalogue for the POC. Client brands follow Royal Unibrew's Danish portfolio
 * (royalunibrew.dk/brands/alle-brands): `owned` brands and `licensed`/distributed brands.
 * SKUs and pack sizes are representative, not an official listing (no EANs yet).
 */
export const CATALOGUE_VERSION = 'dk-seed-2026.11';

const RU = 'Royal Unibrew';

const brand = (
  id: string,
  name: string,
  company: string,
  relation: Brand['relation'],
  category: Category,
): Brand => ({ id, name, company, relation, category });

export const brands: Brand[] = [
  // Royal Unibrew owned
  brand('faxe', 'Faxe', RU, 'owned', 'beer'),
  brand('royal', 'Royal', RU, 'owned', 'beer'),
  brand('albani', 'Albani', RU, 'owned', 'beer'),
  brand('ceres', 'Ceres', RU, 'owned', 'beer'),
  brand('thor', 'Thor', RU, 'owned', 'beer'),
  brand('anarkist', 'Anarkist', RU, 'owned', 'beer'),
  brand('schiotz', 'Schiøtz', RU, 'owned', 'beer'),
  brand('heancock', 'Heancock', RU, 'owned', 'beer'),
  brand('faxe-kondi', 'Faxe Kondi', RU, 'owned', 'soft-drinks'),
  brand('nikoline', 'Nikoline', RU, 'owned', 'soft-drinks'),
  brand('tango', 'Tango', RU, 'owned', 'soft-drinks'),
  brand('lemonsoda', 'Lemonsoda', RU, 'owned', 'soft-drinks'),
  brand('egekilde', 'Egekilde', RU, 'owned', 'water'),
  brand('cult', 'Cult', RU, 'owned', 'energy-functional'),
  brand('faxe-kondi-booster', 'Faxe Kondi Booster', RU, 'owned', 'energy-functional'),
  brand('crabbies', "Crabbie's", RU, 'owned', 'rtd-cider'),
  brand('long-drink', 'The Original Long Drink', RU, 'owned', 'rtd-cider'),
  // Licensed / distributed by Royal Unibrew in Denmark
  brand('pepsi', 'Pepsi', 'PepsiCo (RU licence)', 'licensed', 'soft-drinks'),
  brand('7up', '7UP', 'PepsiCo (RU licence)', 'licensed', 'soft-drinks'),
  brand('mirinda', 'Mirinda', 'PepsiCo (RU licence)', 'licensed', 'soft-drinks'),
  brand('mountain-dew', 'Mountain Dew', 'PepsiCo (RU licence)', 'licensed', 'soft-drinks'),
  brand('lipton', 'Lipton Ice Tea', 'PepsiCo (RU licence)', 'licensed', 'soft-drinks'),
  brand('heineken', 'Heineken', 'Heineken (RU licence)', 'licensed', 'beer'),
  brand('birra-moretti', 'Birra Moretti', 'Heineken (RU licence)', 'licensed', 'beer'),
  brand('sol', 'Sol', 'Heineken (RU licence)', 'licensed', 'beer'),
  brand('desperados', 'Desperados', 'Heineken (RU licence)', 'licensed', 'beer'),
  brand('lagunitas', 'Lagunitas', 'Heineken (RU licence)', 'licensed', 'beer'),
  // Competitors
  brand('carlsberg', 'Carlsberg', 'Carlsberg', 'competitor', 'beer'),
  brand('tuborg', 'Tuborg', 'Carlsberg', 'competitor', 'beer'),
  brand('jacobsen', 'Jacobsen', 'Carlsberg', 'competitor', 'beer'),
  brand('grimbergen', 'Grimbergen', 'Carlsberg', 'competitor', 'beer'),
  brand('somersby', 'Somersby', 'Carlsberg', 'competitor', 'rtd-cider'),
  brand('tuborg-squash', 'Tuborg Squash', 'Carlsberg', 'competitor', 'soft-drinks'),
  brand('aqua-dor', "Aqua d'Or", 'Carlsberg', 'competitor', 'water'),
  brand('coca-cola', 'Coca-Cola', 'Coca-Cola', 'competitor', 'soft-drinks'),
  brand('fanta', 'Fanta', 'Coca-Cola', 'competitor', 'soft-drinks'),
  brand('sprite', 'Sprite', 'Coca-Cola', 'competitor', 'soft-drinks'),
  brand('kildevaeld', 'Kildevæld', 'Coca-Cola', 'competitor', 'water'),
  brand('monster', 'Monster Energy', 'Coca-Cola', 'competitor', 'energy-functional'),
  brand('harboe', 'Harboe', 'Harboe', 'competitor', 'beer'),
  brand('bear-beer', 'Bear Beer', 'Harboe', 'competitor', 'beer'),
  brand('red-bull', 'Red Bull', 'Red Bull', 'competitor', 'energy-functional'),
  brand('mikkeller', 'Mikkeller', 'Mikkeller', 'competitor', 'beer'),
  brand('pl-cola', 'Private label cola', 'Private label', 'competitor', 'soft-drinks'),
  brand('pl-water', 'Private label water', 'Private label', 'competitor', 'water'),
  brand('pl-pilsner', 'Private label pilsner', 'Private label', 'competitor', 'beer'),
];

const brandById = new Map(brands.map((b) => [b.id, b]));

const sku = (
  id: string,
  brandId: string,
  name: string,
  units: number,
  volumeMl: number,
  container: Container,
): Product => ({
  id,
  brandId,
  name,
  category: brandById.get(brandId)!.category,
  pack: { units, volumeMl, container },
});

export const products: Product[] = [
  sku('faxe-premium-500', 'faxe', 'Faxe Premium', 1, 500, 'can'),
  sku('faxe-premium-6x330', 'faxe', 'Faxe Premium', 6, 330, 'can'),
  sku('royal-pilsner-6x330', 'royal', 'Royal Pilsner', 6, 330, 'can'),
  sku('royal-classic-6x330', 'royal', 'Royal Classic', 6, 330, 'can'),
  sku('royal-okologisk-330', 'royal', 'Royal Økologisk Pilsner', 1, 330, 'glass-bottle'),
  sku('albani-odense-6x330', 'albani', 'Albani Odense Pilsner', 6, 330, 'can'),
  sku('albani-giraf-500', 'albani', 'Albani Giraf Strong', 1, 500, 'can'),
  sku('ceres-top-6x330', 'ceres', 'Ceres Top', 6, 330, 'can'),
  sku('thor-pilsner-6x330', 'thor', 'Thor Pilsner', 6, 330, 'can'),
  sku('anarkist-neipa-330', 'anarkist', 'Anarkist New England IPA', 1, 330, 'can'),
  sku('schiotz-mork-500', 'schiotz', 'Schiøtz Mørk Mumme', 1, 500, 'glass-bottle'),
  sku('heancock-6x330', 'heancock', 'Heancock Pilsner', 6, 330, 'can'),
  sku('faxe-kondi-330', 'faxe-kondi', 'Faxe Kondi', 1, 330, 'can'),
  sku('faxe-kondi-1500', 'faxe-kondi', 'Faxe Kondi', 1, 1500, 'plastic-bottle'),
  sku('faxe-kondi-free-330', 'faxe-kondi', 'Faxe Kondi Free', 1, 330, 'can'),
  sku('nikoline-appelsin-330', 'nikoline', 'Nikoline Appelsin', 1, 330, 'can'),
  sku('tango-appelsin-1500', 'tango', 'Tango Appelsin', 1, 1500, 'plastic-bottle'),
  sku('lemonsoda-330', 'lemonsoda', 'Lemonsoda', 1, 330, 'can'),
  sku('egekilde-500', 'egekilde', 'Egekilde Kildevand', 1, 500, 'plastic-bottle'),
  sku('egekilde-citrus-500', 'egekilde', 'Egekilde Brus Citrus', 1, 500, 'plastic-bottle'),
  sku('cult-energy-250', 'cult', 'Cult Energy', 1, 250, 'can'),
  sku('booster-500', 'faxe-kondi-booster', 'Faxe Kondi Booster', 1, 500, 'can'),
  sku('crabbies-500', 'crabbies', "Crabbie's Original Ginger Beer", 1, 500, 'glass-bottle'),
  sku('long-drink-330', 'long-drink', 'The Original Long Drink', 1, 330, 'can'),
  sku('pepsi-330', 'pepsi', 'Pepsi', 1, 330, 'can'),
  sku('pepsi-max-330', 'pepsi', 'Pepsi Max', 1, 330, 'can'),
  sku('pepsi-max-1500', 'pepsi', 'Pepsi Max', 1, 1500, 'plastic-bottle'),
  sku('7up-330', '7up', '7UP', 1, 330, 'can'),
  sku('7up-free-1500', '7up', '7UP Free', 1, 1500, 'plastic-bottle'),
  sku('mirinda-330', 'mirinda', 'Mirinda Orange', 1, 330, 'can'),
  sku('mountain-dew-330', 'mountain-dew', 'Mountain Dew', 1, 330, 'can'),
  sku('lipton-peach-500', 'lipton', 'Lipton Ice Tea Peach', 1, 500, 'plastic-bottle'),
  sku('heineken-6x330', 'heineken', 'Heineken', 6, 330, 'can'),
  sku('heineken-330', 'heineken', 'Heineken', 1, 330, 'glass-bottle'),
  sku('moretti-330', 'birra-moretti', 'Birra Moretti', 1, 330, 'glass-bottle'),
  sku('sol-330', 'sol', 'Sol', 1, 330, 'glass-bottle'),
  sku('desperados-330', 'desperados', 'Desperados', 1, 330, 'glass-bottle'),
  sku('lagunitas-ipa-355', 'lagunitas', 'Lagunitas IPA', 1, 355, 'can'),
  sku('carlsberg-pilsner-6x330', 'carlsberg', 'Carlsberg Pilsner', 6, 330, 'can'),
  sku('carlsberg-pilsner-500', 'carlsberg', 'Carlsberg Pilsner', 1, 500, 'can'),
  sku('tuborg-gron-6x330', 'tuborg', 'Tuborg Grøn', 6, 330, 'can'),
  sku('tuborg-classic-6x330', 'tuborg', 'Tuborg Classic', 6, 330, 'can'),
  sku('jacobsen-brown-330', 'jacobsen', 'Jacobsen Brown Ale', 1, 330, 'glass-bottle'),
  sku('grimbergen-blonde-330', 'grimbergen', 'Grimbergen Blonde', 1, 330, 'glass-bottle'),
  sku('somersby-apple-330', 'somersby', 'Somersby Apple', 1, 330, 'can'),
  sku('tuborg-squash-330', 'tuborg-squash', 'Tuborg Squash', 1, 330, 'can'),
  sku('aqua-dor-500', 'aqua-dor', "Aqua d'Or", 1, 500, 'plastic-bottle'),
  sku('coca-cola-330', 'coca-cola', 'Coca-Cola', 1, 330, 'can'),
  sku('coca-cola-zero-330', 'coca-cola', 'Coca-Cola Zero Sugar', 1, 330, 'can'),
  sku('coca-cola-1500', 'coca-cola', 'Coca-Cola', 1, 1500, 'plastic-bottle'),
  sku('fanta-orange-330', 'fanta', 'Fanta Orange', 1, 330, 'can'),
  sku('sprite-500', 'sprite', 'Sprite', 1, 500, 'plastic-bottle'),
  sku('kildevaeld-500', 'kildevaeld', 'Kildevæld', 1, 500, 'plastic-bottle'),
  sku('monster-500', 'monster', 'Monster Energy', 1, 500, 'can'),
  sku('harboe-pilsner-6x330', 'harboe', 'Harboe Pilsner', 6, 330, 'can'),
  sku('bear-beer-500', 'bear-beer', 'Bear Beer Strong', 1, 500, 'can'),
  sku('red-bull-250', 'red-bull', 'Red Bull', 1, 250, 'can'),
  sku('mikkeller-peter-330', 'mikkeller', 'Mikkeller Peter, Pale and Mary', 1, 330, 'can'),
  sku('pl-cola-1500', 'pl-cola', 'Private label cola', 1, 1500, 'plastic-bottle'),
  sku('pl-water-1500', 'pl-water', 'Private label water', 1, 1500, 'plastic-bottle'),
  sku('pl-pilsner-6x330', 'pl-pilsner', 'Private label pilsner', 6, 330, 'can'),
];

export const seedCatalogue: Catalogue = {
  version: CATALOGUE_VERSION,
  client: { id: 'royal-unibrew', name: RU },
  brands,
  products,
};
