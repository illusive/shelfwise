import { describe, expect, it } from 'vitest';
import { extractJson, parsePhotoReply, type PhotoResult } from '@/contracts/agentPhoto';
import {
  ANALYSIS_SCHEMA_VERSION,
  analysisResponseSchema,
  type AnalysisRequest,
} from '@/contracts/analysis';
import { indexCatalogue } from '@/domain/catalogue';
import { reconcileFacings } from '@/domain/overlap';
import { seedCatalogue } from '../../seed/catalogue';
import { ProviderError } from '../provider';
import { buildResponse, resolveMatch, splitRegion, toRegion } from './buildResponse';
import { createCopilotStudioProvider, type AgentReply, type AgentTransport } from './provider';
import { classifyAgentError, pickReply } from './sdkTransport';
import example from '../../../../docs/copilot-studio/photo-result.example.json';

const catalogue = indexCatalogue(seedCatalogue);
const product = seedCatalogue.products[0];
const brand = catalogue.brandById.get(product.brandId)!;

function request(placements: (AnalysisRequest['images'][number]['placement'] | null)[]) {
  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    jobId: 'job-1',
    visitId: 'visit-1',
    idempotencyKey: 'idem-1',
    store: { storeId: 'st-1', chain: 'Netto', countryCode: 'DK' },
    catalogueVersion: catalogue.version,
    methodVersion: 'sos-visible-facings-v1',
    images: placements.map((placement, i) => ({
      imageId: `cap-${i + 1}`,
      sequence: i + 1,
      capturedAt: '2026-11-12T08:00:00.000Z',
      mimeType: 'image/jpeg',
      width: 4000,
      height: 3000,
      byteSize: 1,
      placement,
    })),
  } satisfies AnalysisRequest;
}

const empty: PhotoResult = {
  usable: true,
  locationType: 'shelf',
  issues: [],
  facings: [],
  priceLabels: [],
  promotions: [],
  displays: [],
};
const facing = (x: number, extra: Partial<PhotoResult['facings'][number]> = {}) => ({
  status: 'matched' as const,
  brandId: null,
  productId: product.id,
  category: null,
  score: 0.9,
  count: 1,
  box: [x, 0.2, 0.08, 0.3],
  ...extra,
});

describe('agent reply parsing', () => {
  it('finds JSON in a value, a fenced block or surrounding prose', () => {
    expect(extractJson({ value: { usable: true } })).toEqual({ usable: true });
    expect(extractJson({ text: 'Here you go:\n```json\n{"usable": false}\n```' })).toEqual({
      usable: false,
    });
    expect(extractJson({ text: 'Result: {"a": {"b": 1}} done' })).toEqual({ a: { b: 1 } });
    expect(extractJson({ text: 'Sorry, I cannot help with that.' })).toBeNull();
    expect(parsePhotoReply({ text: '[1,2]' })).toBeNull();
  });

  it('is lenient: bad fields become unknown/empty instead of failing the photo', () => {
    const result = parsePhotoReply({
      text: JSON.stringify({
        locationType: 'fridge',
        issues: ['glare', 'smudge'],
        facings: [{ status: 'sure', productId: 42, count: 0, box: [0.1, 0.1] }, 'not an object'],
        priceLabels: [{ priceDkk: -3, priceType: 'cheap' }],
      }),
    })!;
    expect(result.locationType).toBeNull();
    expect(result.issues).toEqual(['glare']);
    expect(result.facings).toEqual([
      {
        status: 'unknown',
        brandId: null,
        productId: null,
        category: null,
        score: null,
        count: 1,
        box: null,
      },
    ]);
    expect(result.priceLabels[0]).toMatchObject({
      priceDkk: null,
      priceType: 'unknown',
      status: 'unresolved',
    });
  });

  it('accepts the example reply in the agent handover doc', () => {
    const result = parsePhotoReply({ value: example });
    expect(result).not.toBeNull();
    const response = buildResponse({
      request: request([null]),
      photos: [{ imageId: 'cap-1', result }],
      catalogue,
      analysedAt: '2026-11-12T08:05:00.000Z',
      model: null,
    });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response.facings.length).toBeGreaterThan(0);
    expect(response.warnings.map((w) => w.code)).not.toContain('classification-uncertain');
  });
});

describe('mapping to the contract', () => {
  it('clamps boxes and splits facing groups into columns', () => {
    expect(toRegion([-0.1, 0.5, 0.5, 0.9])).toEqual({ x: 0, y: 0.5, width: 0.5, height: 0.5 });
    expect(toRegion([0.99, 0, 0.5, 0.5])).toMatchObject({ x: 0.99 });
    expect(toRegion([1, 0, 0.5, 0.5])).toBeNull();
    const columns = splitRegion({ x: 0.2, y: 0, width: 0.3, height: 1 }, 3);
    expect(columns.map((r) => r && Math.round(r.x * 100))).toEqual([20, 30, 40]);
    expect(splitRegion(null, 2)).toEqual([null, null]);
  });

  it('trusts only catalogue ids', () => {
    expect(
      resolveMatch(catalogue, {
        status: 'matched',
        productId: product.id,
        brandId: 'wrong',
        category: null,
        score: 0.7,
      }),
    ).toEqual({
      match: {
        status: 'matched',
        productId: product.id,
        brandId: product.brandId,
        category: product.category,
        providerScore: 0.7,
      },
      downgraded: false,
    });
    const invented = resolveMatch(catalogue, {
      status: 'matched',
      productId: 'carlsberg-9000',
      brandId: null,
      category: 'beer',
      score: 0.9,
    });
    expect(invented).toEqual({
      match: {
        status: 'unknown',
        productId: null,
        brandId: null,
        category: 'beer',
        providerScore: null,
      },
      downgraded: true,
    });
    // An unknown product of a known brand keeps the brand but is flagged.
    expect(
      resolveMatch(catalogue, {
        status: 'candidate',
        productId: 'new-flavour',
        brandId: brand.id,
        category: null,
        score: null,
      }),
    ).toMatchObject({ match: { status: 'candidate', brandId: brand.id }, downgraded: true });
  });

  it('builds a valid response with øre prices, unusable photos and warnings', () => {
    const response = buildResponse({
      request: request([null, null]),
      photos: [
        {
          imageId: 'cap-1',
          result: {
            ...empty,
            facings: [facing(0.1, { count: 3, box: [0.1, 0.2, 0.3, 0.3] })],
            priceLabels: [
              {
                status: 'resolved',
                unresolvedReason: null,
                rawText: '2 stk. 30,-',
                brandId: null,
                productId: product.id,
                priceType: 'promotion',
                priceDkk: 17.95,
                deposit: { shown: true, dkk: 1.5, included: false },
                pack: { units: 1, volumeMl: 330 },
                multibuy: { quantity: 2, totalDkk: 30 },
                conditionText: null,
                box: [0.1, 0.8, 0.1, 0.05],
              },
            ],
          },
        },
        { imageId: 'cap-2', result: null },
      ],
      catalogue,
      analysedAt: '2026-11-12T08:05:00.000Z',
      model: null,
    });
    expect(analysisResponseSchema.safeParse(response).success).toBe(true);
    expect(response).toMatchObject({ status: 'partial', source: 'live' });
    expect(response.facings).toHaveLength(3);
    expect(response.priceLabels[0]).toMatchObject({
      amountOre: 1795,
      deposit: { amountOre: 150 },
      multibuy: { quantity: 2, totalOre: 3000 },
      match: { status: 'matched', productId: product.id },
    });
    expect(response.images[1]).toMatchObject({ usable: false, locationId: null });
    expect(response.warnings.map((w) => w.code)).toEqual(['unusable-image']);
  });
});

describe('overlapping photos', () => {
  const place = (position: number, overlap: number | null) => ({
    run: 1,
    position,
    overlap,
    confidence: overlap === null ? null : 0.8,
    rollDeg: null,
  });
  const build = (
    overlaps: (number | null)[],
    results: PhotoResult[],
  ): ReturnType<typeof buildResponse> =>
    buildResponse({
      request: request(overlaps.map((o, i) => place(i + 1, o))),
      photos: results.map((result, i) => ({ imageId: `cap-${i + 1}`, result })),
      catalogue,
      analysedAt: '2026-11-12T08:05:00.000Z',
      model: null,
    });

  it('pairs facings inside the estimated overlap and counts them once', () => {
    // Photo 1: facings at 0.1, 0.5, 0.8 (right edge). Photo 2 overlaps 25%: 0.05 is the same as 0.8.
    const response = build(
      [null, 0.25],
      [
        { ...empty, facings: [facing(0.06), facing(0.46), facing(0.76)] },
        { ...empty, facings: [facing(0.01), facing(0.5)] },
      ],
    );
    expect(response.locations).toHaveLength(1);
    expect(response.locations[0].imageIds).toEqual(['cap-1', 'cap-2']);
    const reconciled = reconcileFacings(response.facings, response.locations);
    expect(reconciled.facings).toHaveLength(4);
    expect(reconciled.duplicatesMerged).toBe(1);
    expect(reconciled.unreconciledLocationIds).toEqual([]);
    expect(response.warnings).toEqual([]);
  });

  it('leaves disagreeing or unknown overlaps unreconciled instead of guessing', () => {
    const disagree = build(
      [null, 0.25],
      [
        { ...empty, facings: [facing(0.76)] },
        { ...empty, facings: [facing(0.01), facing(0.12), facing(0.5)] },
      ],
    );
    expect(reconcileFacings(disagree.facings, disagree.locations).unreconciledLocationIds).toEqual([
      disagree.locations[0].locationId,
    ]);
    expect(disagree.warnings.map((w) => w.code)).toEqual(['overlap-unreconciled']);

    const unknown = build(
      [null, null],
      [
        { ...empty, facings: [facing(0.76)] },
        { ...empty, facings: [facing(0.5)] },
      ],
    );
    expect(unknown.facings[1].physicalPositionId).toBeNull();
    expect(unknown.warnings.map((w) => w.code)).toEqual(['overlap-unreconciled']);
  });

  it('starts a new location for a new run, another location type or an import', () => {
    const response = buildResponse({
      request: request([place(1, null), { ...place(1, null), run: 2 }, null, place(1, null)]),
      photos: [
        { imageId: 'cap-1', result: { ...empty } },
        { imageId: 'cap-2', result: { ...empty } },
        { imageId: 'cap-3', result: { ...empty } },
        { imageId: 'cap-4', result: { ...empty, locationType: 'cooler' } },
      ],
      catalogue,
      analysedAt: '2026-11-12T08:05:00.000Z',
      model: null,
    });
    expect(response.locations.map((l) => [l.label, l.imageIds])).toEqual([
      ['Shelf 1', ['cap-1']],
      ['Shelf 2', ['cap-2']],
      ['Shelf 3', ['cap-3']],
      ['Cooler 1', ['cap-4']],
    ]);
  });
});

describe('Copilot Studio provider', () => {
  const photo = (id: string) => ({ imageId: id, blob: new Blob(['x'], { type: 'image/jpeg' }) });
  const reply = (result: Partial<PhotoResult>): AgentReply => ({
    text: '```json\n' + JSON.stringify({ ...empty, ...result }) + '\n```',
    value: null,
  });
  function transport(script: (imageId: string, call: number) => AgentReply | Error) {
    const calls: string[] = [];
    const t: AgentTransport = {
      model: 'test',
      async analysePhoto({ imageId, instruction }) {
        calls.push(imageId);
        expect(instruction).toContain('shelfwise-photo-v1');
        const out = script(imageId, calls.filter((c) => c === imageId).length);
        if (out instanceof Error) throw out;
        return out;
      },
    };
    return { t, calls };
  }

  it('analyses every photo, reports progress and returns a valid response', async () => {
    const { t, calls } = transport(() => reply({ facings: [facing(0.4)] }));
    const progress: number[] = [];
    const provider = createCopilotStudioProvider({ transport: t, catalogue, retryDelayMs: 1 });
    const raw = await provider.analyse({
      request: request([null, null, null]),
      images: ['cap-1', 'cap-2', 'cap-3'].map(photo),
      onProgress: (done) => progress.push(done),
    });
    expect(calls.sort()).toEqual(['cap-1', 'cap-2', 'cap-3']);
    expect(progress).toEqual([1, 2, 3]);
    const parsed = analysisResponseSchema.parse(raw);
    expect(parsed.provider).toEqual({ name: 'copilot-studio', model: 'test' });
    expect(parsed.facings).toHaveLength(3);
  });

  it('retries throttled and unreadable replies, then gives up on that photo only', async () => {
    const { t, calls } = transport((id, call) => {
      if (id === 'cap-1' && call === 1) return new ProviderError('provider-throttled', 'busy');
      if (id === 'cap-2') return { text: 'I am not sure what this is.', value: null };
      return reply({});
    });
    const provider = createCopilotStudioProvider({ transport: t, catalogue, retryDelayMs: 1 });
    const raw = analysisResponseSchema.parse(
      await provider.analyse({
        request: request([null, null]),
        images: ['cap-1', 'cap-2'].map(photo),
      }),
    );
    expect(calls.filter((c) => c === 'cap-1')).toHaveLength(2);
    expect(calls.filter((c) => c === 'cap-2')).toHaveLength(3);
    expect(raw.status).toBe('partial');
    expect(raw.images.find((i) => i.imageId === 'cap-2')?.usable).toBe(false);
  });

  it('fails the job when signed out or when no reply was readable', async () => {
    const signedOut = transport(() => new ProviderError('sign-in-required', 'no'));
    await expect(
      createCopilotStudioProvider({ transport: signedOut.t, catalogue }).analyse({
        request: request([null]),
        images: [photo('cap-1')],
      }),
    ).rejects.toMatchObject({ code: 'sign-in-required' });
    expect(signedOut.calls).toHaveLength(1);

    const gibberish = transport(() => ({ text: 'hello', value: null }));
    await expect(
      createCopilotStudioProvider({ transport: gibberish.t, catalogue, retryDelayMs: 1 }).analyse({
        request: request([null]),
        images: [photo('cap-1')],
      }),
    ).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('times out a photo that never answers', async () => {
    const slow: AgentTransport = {
      model: null,
      analysePhoto: (_input, signal) =>
        new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('x')))),
    };
    await expect(
      createCopilotStudioProvider({
        transport: slow,
        catalogue,
        timeoutMs: 5,
        retries: 0,
      }).analyse({ request: request([null]), images: [photo('cap-1')] }),
    ).rejects.toMatchObject({ code: 'provider-unavailable' });
  });
});

describe('agent connection', () => {
  it('derives the token scope for environment-specific direct-connect hosts', async () => {
    const { agentScopeFor } = await import('./connection');
    const scope = await agentScopeFor({
      directConnectUrl:
        'https://0123456789abcdef0123456789abcd.ef.environment.api.powerplatform.com/copilotstudio/agenticruntime/3p/dataverse-backed/authenticated/bots/test_agent/conversations?api-version=2022-03-01-preview',
      environmentId: null,
      schemaName: null,
      tenantId: 't',
      clientId: 'c',
      cloud: 'Prod',
    });
    expect(scope).toBe('https://api.powerplatform.com/.default');
  });
});

describe('SDK transport helpers', () => {
  it('classifies HTTP failures from the SDK', () => {
    const err = (status: string) => new Error(`Copilot Studio request failed: ${status}`);
    expect(classifyAgentError(err('401 Unauthorized'))).toMatchObject({ code: 'sign-in-required' });
    expect(classifyAgentError(err('403 Forbidden'))).toMatchObject({
      code: 'sign-in-required',
      retryable: false,
    });
    expect(classifyAgentError(err('429 Too Many Requests'))).toMatchObject({
      code: 'provider-throttled',
    });
    expect(classifyAgentError(err('503'))).toMatchObject({ code: 'provider-unavailable' });
    expect(classifyAgentError(new TypeError('Failed to fetch'))).toMatchObject({
      code: 'provider-unavailable',
    });
    const other = new Error('boom');
    expect(classifyAgentError(other)).toBe(other);
  });

  it('picks the agent’s last message with content', () => {
    expect(
      pickReply([
        { type: 'typing', from: { role: 'bot' } },
        { type: 'message', text: 'Analysing…', from: { role: 'bot' } },
        { type: 'message', text: '{"usable":true}', from: { role: 'bot' } },
        { type: 'event', from: { role: 'bot' } },
      ]),
    ).toEqual({ text: '{"usable":true}', value: null });
    expect(pickReply([{ type: 'message', text: 'me', from: { role: 'user' } }])).toEqual({
      text: null,
      value: null,
    });
  });
});

describe('agent catalogue file', () => {
  it('matches the seed catalogue (run `npm run agent:catalogue` after catalogue changes)', async () => {
    const { readFileSync } = await import('node:fs');
    const { agentCatalogueCsv } = await import('../../seed/agentCatalogue');
    // jsdom's import.meta.url isn't a file: URL; tests run from the repository root.
    const file = readFileSync('docs/copilot-studio/catalogue.csv', 'utf8');
    expect(file).toBe(agentCatalogueCsv(seedCatalogue));
  });
});
