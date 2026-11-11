import {
  ANALYSIS_SCHEMA_VERSION,
  type AnalysisRequest,
  type AnalysisResponse,
  type AnalysisWarning,
  type DisplayObservation,
  type FacingObservation,
  type ImageIssue,
  type LocationType,
  type PriceLabelObservation,
  type ProductMatch,
  type PromotionObservation,
} from '@/contracts/analysis';
import type { Catalogue, Product } from '@/domain/catalogue';
import type { AnalysisProvider } from './provider';

export const MOCK_PROVIDER_ID = 'shelfwise-mock';
export const MOCK_METHOD_VERSION = 'mock-planogram-v1';

/** Images below this pixel count are reported as unusable. */
const MIN_PIXELS = 300_000;
const COLS_PER_IMAGE = 8;
const OVERLAP_COLS = 2;

export interface MockProviderOptions {
  catalogue: Catalogue;
  latencyMs: number;
  /** Fail the first attempt of every job (retryable) to demonstrate recovery. */
  failFirstAttempt: boolean;
}

export function createMockProvider(options: MockProviderOptions): AnalysisProvider {
  const attempts = new Map<string, number>();
  return {
    id: MOCK_PROVIDER_ID,
    source: 'mock',
    async analyse({ request }, signal) {
      await delay(options.latencyMs, signal);
      const attempt = (attempts.get(request.jobId) ?? 0) + 1;
      attempts.set(request.jobId, attempt);
      if (options.failFirstAttempt && attempt === 1) {
        return failedResponse(request, options.catalogue.version);
      }
      return generateMockAnalysis(request, options.catalogue);
    },
  };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function base(request: AnalysisRequest, catalogueVersion: string, analysedAt: string) {
  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    jobId: request.jobId,
    visitId: request.visitId,
    source: 'mock' as const,
    provider: { name: MOCK_PROVIDER_ID, model: null },
    methodVersion: MOCK_METHOD_VERSION,
    catalogueVersion,
    analysedAt,
  };
}

function failedResponse(request: AnalysisRequest, catalogueVersion: string): AnalysisResponse {
  return {
    ...base(request, catalogueVersion, new Date().toISOString()),
    status: 'failed',
    images: [],
    locations: [],
    facings: [],
    priceLabels: [],
    promotions: [],
    displays: [],
    warnings: [],
    failure: {
      code: 'provider-unavailable',
      message: 'The analysis service did not respond in time (simulated).',
      retryable: true,
    },
    narrative: null,
  };
}

/** Deterministic PRNG so the same visit always yields the same mock result. */
function rng(seedText: string) {
  let seed = 0;
  for (const ch of seedText) seed = (Math.imul(31, seed) + ch.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = ReturnType<typeof rng>;
const pick = <T>(random: Random, items: readonly T[]): T => items[Math.floor(random() * items.length)];

export function planLocationTypes(count: number): LocationType[] {
  if (count === 1) return ['shelf'];
  if (count === 2) return ['shelf', 'cooler'];
  const displays = count >= 5 ? 1 : 0;
  const coolers = Math.max(1, Math.round((count - displays) * 0.4));
  const shelves = count - displays - coolers;
  return [
    ...Array<LocationType>(shelves).fill('shelf'),
    ...Array<LocationType>(coolers).fill('cooler'),
    ...Array<LocationType>(displays).fill('display'),
  ];
}

function poolFor(type: LocationType, catalogue: Catalogue): Product[] {
  const multi = (p: Product) => p.pack.units > 1 || p.pack.volumeMl >= 1000;
  if (type === 'shelf') return catalogue.products.filter((p) => multi(p) || p.category === 'water');
  return catalogue.products.filter((p) => !multi(p));
}

function priceFor(product: Product): { amountOre: number; depositOre: number } {
  const { units, volumeMl } = product.pack;
  const deposit = volumeMl >= 1000 ? 300 : 100;
  if (units > 1) return { amountOre: product.category === 'beer' ? 6495 : 4995, depositOre: deposit * units };
  if (volumeMl >= 1000) return { amountOre: 2195, depositOre: deposit };
  if (product.category === 'energy-functional') return { amountOre: volumeMl >= 500 ? 1895 : 1595, depositOre: deposit };
  if (product.category === 'beer') return { amountOre: volumeMl >= 500 ? 1295 : 1495, depositOre: deposit };
  if (product.category === 'water') return { amountOre: 1095, depositOre: deposit };
  return { amountOre: 895, depositOre: deposit };
}

const ore = (n: number) => (n / 100).toFixed(2).replace('.', ',');

interface Block {
  row: number;
  startCol: number;
  endCol: number;
  product: Product;
}

/** Fills a location's shelf rows with brand blocks of 2–4 facings, weighted toward the client. */
function planogram(random: Random, pool: Product[], rows: number, cols: number, clientWeight: number, catalogue: Catalogue): Block[] {
  const clientBrands = new Set(catalogue.brands.filter((b) => b.relation !== 'competitor').map((b) => b.id));
  const client = pool.filter((p) => clientBrands.has(p.brandId));
  const competitor = pool.filter((p) => !clientBrands.has(p.brandId));
  const blocks: Block[] = [];
  for (let row = 0; row < rows; row++) {
    let col = 0;
    while (col < cols) {
      const width = Math.min(cols - col, 2 + Math.floor(random() * 3));
      const source = random() < clientWeight && client.length ? client : competitor;
      blocks.push({ row, startCol: col, endCol: col + width - 1, product: pick(random, source) });
      col += width;
    }
  }
  return blocks;
}

/**
 * Generates a plausible, contract-valid analysis for the submitted images. Boxes do not
 * correspond to real photo content; results are always badged as mock in the UI.
 */
export function generateMockAnalysis(
  request: AnalysisRequest,
  catalogue: Catalogue,
  analysedAt: string = new Date().toISOString(),
): AnalysisResponse {
  const random = rng(request.visitId);
  const images = [...request.images].sort((a, b) => a.sequence - b.sequence);
  const usable = images.filter((i) => i.width * i.height >= MIN_PIXELS);
  const types = planLocationTypes(Math.max(usable.length, 1));
  const imageResults: AnalysisResponse['images'] = [];
  const locations: AnalysisResponse['locations'] = [];
  const facings: FacingObservation[] = [];
  const priceLabels: PriceLabelObservation[] = [];
  const promotions: PromotionObservation[] = [];
  const displays: DisplayObservation[] = [];
  const warnings: AnalysisWarning[] = [];
  const counters: Record<LocationType, number> = { shelf: 0, cooler: 0, display: 0 };

  // Group consecutive usable images of the same type into one location.
  const groups: { type: LocationType; imageIds: string[] }[] = [];
  usable.forEach((img, i) => {
    const type = types[i];
    const last = groups.at(-1);
    if (last && last.type === type) last.imageIds.push(img.imageId);
    else groups.push({ type, imageIds: [img.imageId] });
  });

  const issuesByImage = new Map<string, ImageIssue[]>();
  const locationByImage = new Map<string, { id: string; type: LocationType }>();
  let reflectionDone = false;
  let multibuyDone = false;
  let memberDone = false;
  let ambiguousDone = false;

  for (const group of groups) {
    counters[group.type] += 1;
    const locationId = `loc-${group.type}-${counters[group.type]}`;
    const label = `${group.type[0].toUpperCase()}${group.type.slice(1)} ${counters[group.type]}`;
    locations.push({ locationId, type: group.type, label, imageIds: group.imageIds });
    group.imageIds.forEach((id) => locationByImage.set(id, { id: locationId, type: group.type }));

    const rows = group.type === 'display' ? 3 : 5;
    const step = COLS_PER_IMAGE - OVERLAP_COLS;
    const totalCols = COLS_PER_IMAGE + (group.imageIds.length - 1) * step;
    const pool = group.type === 'display' ? poolFor('shelf', catalogue) : poolFor(group.type, catalogue);
    const clientWeight = group.type === 'cooler' ? 0.45 : 0.38;
    let blocks = planogram(random, pool, rows, totalCols, clientWeight, catalogue);

    if (group.type === 'display') {
      const clientBrands = new Set(catalogue.brands.filter((b) => b.relation !== 'competitor').map((b) => b.id));
      const featured = pool.find((p) => clientBrands.has(p.brandId) && p.category === 'beer') ?? pool[0];
      blocks = blocks.map((b) => ({ ...b, product: featured }));
      displays.push({
        displayId: `${locationId}-display`,
        imageId: group.imageIds[0],
        locationId,
        region: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
        brandIds: [featured.brandId],
        description: `Floor display · ${featured.name}`,
      });
    }

    // Decide per physical position whether it is unclear; reused across overlapping images.
    const positionState = new Map<string, 'clear' | 'unknown' | 'candidate'>();
    for (const b of blocks) {
      for (let c = b.startCol; c <= b.endCol; c++) {
        const r = random();
        positionState.set(`${b.row}:${c}`, r < 0.03 ? 'unknown' : r < 0.07 ? 'candidate' : 'clear');
      }
    }

    group.imageIds.forEach((imageId, index) => {
      const startCol = index * step;
      const endCol = startCol + COLS_PER_IMAGE - 1;
      const colWidth = 0.96 / COLS_PER_IMAGE;
      const rowHeight = 0.92 / rows;
      const issues: ImageIssue[] = [];
      const glare = group.type === 'cooler' && !reflectionDone;
      if (glare) {
        reflectionDone = true;
        issues.push('reflection');
        warnings.push({
          code: 'reflection',
          message: 'Reflections on the cooler door hide some products.',
          imageIds: [imageId],
        });
      }
      issuesByImage.set(imageId, issues);

      for (const b of blocks) {
        for (let c = Math.max(b.startCol, startCol); c <= Math.min(b.endCol, endCol); c++) {
          const local = c - startCol;
          const state = positionState.get(`${b.row}:${c}`) ?? 'clear';
          const inGlare = glare && local >= 2 && local <= 3 && b.row <= 1;
          let match: ProductMatch;
          if (inGlare || state === 'unknown') {
            match = { status: 'unknown', productId: null, brandId: null, category: random() < 0.5 ? b.product.category : null, providerScore: null };
          } else if (state === 'candidate') {
            match = { status: 'candidate', productId: b.product.id, brandId: b.product.brandId, category: b.product.category, providerScore: 0.4 + random() * 0.2 };
          } else {
            match = { status: 'matched', productId: b.product.id, brandId: b.product.brandId, category: b.product.category, providerScore: 0.8 + random() * 0.19 };
          }
          facings.push({
            facingId: `${imageId}-f-${b.row}-${c}`,
            imageId,
            locationId,
            physicalPositionId: `${locationId}-r${b.row}-c${c}`,
            region: {
              x: 0.02 + local * colWidth,
              y: 0.04 + b.row * rowHeight,
              width: colWidth * 0.86,
              height: rowHeight * 0.7,
            },
            match,
          });
        }

        // One label per block, at the shelf edge under its first facing.
        if (group.type === 'display' || b.startCol < startCol || b.startCol > endCol) continue;
        const physicalLabelId = `${locationId}-label-${b.row}-${b.startCol}`;
        const { amountOre, depositOre } = priceFor(b.product);
        const local = b.startCol - startCol;
        const region = { x: 0.02 + local * colWidth, y: 0.04 + b.row * rowHeight + rowHeight * 0.74, width: colWidth * 0.9, height: rowHeight * 0.16 };
        const isClient = catalogue.brands.find((br) => br.id === b.product.brandId)?.relation !== 'competitor';
        const base: PriceLabelObservation = {
          labelId: `${imageId}-${physicalLabelId}`,
          imageId,
          locationId,
          physicalLabelId,
          region,
          rawText: `${b.product.name.toUpperCase()} ${ore(amountOre)} + PANT ${ore(depositOre)}`,
          status: 'resolved',
          unresolvedReason: null,
          match: { status: 'matched', productId: b.product.id, brandId: b.product.brandId, category: b.product.category, providerScore: 0.9 },
          priceType: 'regular',
          amountOre,
          currency: 'DKK',
          deposit: { shown: true, amountOre: depositOre, included: false },
          pack: { units: b.product.pack.units, volumeMl: b.product.pack.volumeMl },
          multibuy: null,
          conditionText: null,
          promotionId: null,
        };
        const roll = rng(physicalLabelId)();
        if (!multibuyDone && isClient && b.product.pack.units === 1 && b.product.pack.volumeMl < 1000) {
          multibuyDone = true;
          const promotionId = `promo-${physicalLabelId}`;
          promotions.push({
            promotionId,
            imageId,
            region,
            mechanic: 'multibuy',
            headline: `3 for 30,00 kr. · ${b.product.name}`,
            conditionText: 'Buy 3. Pant added per unit.',
            productIds: [b.product.id],
            brandIds: [b.product.brandId],
          });
          priceLabels.push({
            ...base,
            rawText: `3 FOR 30,- ${b.product.name.toUpperCase()} STK. ${ore(amountOre)} + PANT`,
            priceType: 'promotion',
            multibuy: { quantity: 3, totalOre: 3000 },
            promotionId,
          });
        } else if (!memberDone && !isClient && b.product.pack.units > 1) {
          memberDone = true;
          const promotionId = `promo-${physicalLabelId}`;
          const memberOre = amountOre - 1000;
          promotions.push({
            promotionId,
            imageId,
            region,
            mechanic: 'member-price',
            headline: `Member price ${ore(memberOre)} kr. · ${b.product.name}`,
            conditionText: 'Requires the store loyalty app. Max 2 per customer.',
            productIds: [b.product.id],
            brandIds: [b.product.brandId],
          });
          priceLabels.push({ ...base, priceType: 'member', amountOre: memberOre, conditionText: 'Loyalty members only, max 2', promotionId });
        } else if (!ambiguousDone && roll < 0.2) {
          ambiguousDone = true;
          priceLabels.push({
            ...base,
            status: 'unresolved',
            unresolvedReason: 'ambiguous-product',
            match: { ...base.match, status: 'candidate', providerScore: 0.45 },
          });
        } else if (roll < 0.12) {
          priceLabels.push({
            ...base,
            rawText: null,
            status: 'unresolved',
            unresolvedReason: 'unreadable',
            match: { status: 'unknown', productId: null, brandId: null, category: null, providerScore: null },
            amountOre: null,
            deposit: { shown: false, amountOre: null, included: null },
            pack: { units: null, volumeMl: null },
          });
        } else {
          priceLabels.push(base);
        }
      }
    });
  }

  for (const img of images) {
    const loc = locationByImage.get(img.imageId);
    const tooSmall = img.width * img.height < MIN_PIXELS;
    imageResults.push({
      imageId: img.imageId,
      usable: !tooSmall,
      locationType: loc?.type ?? null,
      locationId: loc?.id ?? null,
      issues: tooSmall ? ['low-resolution'] : (issuesByImage.get(img.imageId) ?? []),
    });
  }

  const unusable = imageResults.filter((i) => !i.usable).map((i) => i.imageId);
  if (unusable.length) {
    warnings.push({ code: 'unusable-image', message: `${unusable.length} photo(s) could not be analysed.`, imageIds: unusable });
  }
  const unreadable = priceLabels.filter((p) => p.unresolvedReason === 'unreadable');
  if (unreadable.length) {
    warnings.push({ code: 'label-unreadable', message: `${unreadable.length} price label(s) were unreadable.`, imageIds: [...new Set(unreadable.map((p) => p.imageId))] });
  }
  if (usable.length < 3) {
    warnings.push({ code: 'low-coverage', message: 'Few photos: results describe only the captured area.', imageIds: [] });
  }

  const status: AnalysisResponse['status'] = usable.length === 0 ? 'partial' : unusable.length ? 'partial' : 'completed';
  return {
    ...base(request, catalogue.version, analysedAt),
    status,
    images: imageResults,
    locations,
    facings,
    priceLabels,
    promotions,
    displays,
    warnings,
    failure: null,
    narrative: `Mock analysis of ${images.length} photo(s): ${locations.length} location(s) detected.`,
  };
}
