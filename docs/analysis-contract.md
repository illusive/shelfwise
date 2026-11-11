# Analysis contract

Source of truth: `src/contracts/analysis.ts` (Zod). Schema version **`1.0.0`**. Provider
output is validated with `analysisResponseSchema` before storage; metrics are calculated in
`src/domain` (`SOS_METHOD_VERSION = sos-visible-facings-v1`).

## Request (`AnalysisRequest`)

```jsonc
{
  "schemaVersion": "1.0.0",
  "jobId": "job-…", // one job per submission
  "visitId": "visit-…",
  "idempotencyKey": "idem-…", // same key ⇒ same job; servers must dedupe on it
  "store": { "storeId": "st-…", "chain": "Netto", "countryCode": "DK" },
  "catalogueVersion": "dk-seed-2026.11",
  "methodVersion": "sos-visible-facings-v1",
  "images": [
    {
      "imageId": "cap-…",
      "sequence": 1,
      "capturedAt": "2026-11-10T13:24:00.000Z",
      "mimeType": "image/jpeg",
      "width": 3840,
      "height": 2160,
      "byteSize": 2400000,
    },
  ],
}
```

Images are sent alongside (multipart/blob), at original resolution.

## Response (`AnalysisResponse`)

| Field                                             | Notes                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`, `jobId`, `visitId`               | Must match the request.                                                                                                                                                                                                                                            |
| `status`                                          | `completed`, `partial` (some photos unusable) or `failed` (requires `failure`).                                                                                                                                                                                    |
| `source`                                          | `mock` or `live`. Always shown in the UI.                                                                                                                                                                                                                          |
| `provider`                                        | `{ name, model }`.                                                                                                                                                                                                                                                 |
| `methodVersion`, `catalogueVersion`, `analysedAt` | Provenance.                                                                                                                                                                                                                                                        |
| `images[]`                                        | `{ imageId, usable, locationType: shelf/cooler/display/null, locationId, issues[] }`. Issues: blurry, glare, reflection, too-dark, obstructed, low-resolution, not-a-shelf.                                                                                        |
| `locations[]`                                     | `{ locationId, type, label, imageIds[] }`. Classification comes from analysis; reps never tag.                                                                                                                                                                     |
| `facings[]`                                       | One per visible position per image: `{ facingId, imageId, locationId, physicalPositionId, region, match }`.                                                                                                                                                        |
| `priceLabels[]`                                   | `{ labelId, imageId, locationId, physicalLabelId, region, rawText, status, unresolvedReason, match, priceType, amountOre, currency: "DKK", deposit{shown, amountOre, included}, pack{units, volumeMl}, multibuy{quantity,totalOre}, conditionText, promotionId }`. |
| `promotions[]`                                    | `{ promotionId, imageId, region, mechanic: multibuy/price-cut/member-price/bundle/other, headline, conditionText, productIds[], brandIds[] }`.                                                                                                                     |
| `displays[]`                                      | `{ displayId, imageId, locationId, region, brandIds[], description }`.                                                                                                                                                                                             |
| `warnings[]`                                      | `{ code, message, imageIds[] }`: overlap-unreconciled, reflection, low-coverage, unusable-image, classification-uncertain, label-unreadable.                                                                                                                       |
| `failure`                                         | `{ code, message, retryable }` or `null`.                                                                                                                                                                                                                          |
| `narrative`                                       | Optional prose. Never used for metrics.                                                                                                                                                                                                                            |

`match` = `{ status: matched | candidate | unknown, productId, brandId, category, providerScore }`.
`providerScore` is the provider's own score (0–1), **not** validated accuracy; the UI does not
show it as confidence. `matched`/`candidate` require a product or brand id.

Regions are normalised (0–1, top-left origin) and must lie inside the image. Referential
integrity (image/location ids) is enforced by the schema.

## Metric definitions

**Share of Shelf (visible facings)**

```
SoS(scope) = client facings ÷ eligible facings × 100
eligible   = client + competitor + unknown   (displays and "not a beverage" excluded)
overall    = (shelf client + cooler client) ÷ (shelf eligible + cooler eligible)
```

- Client = brands with relation `owned` or `licensed`. Only `matched` observations (or rep
  corrections) count as client or competitor; `candidate` and `unknown` count as **unknown**,
  which stays in the denominator.
- **Unavailable** when the scope was not captured, has no usable photos, or no facings.
- **Qualified** when unknowns exceed 25 % of eligible facings, or overlap could not be
  reconciled. Per-category shares are qualified when some facings have no category.
- Across visits (Home stat), shares are aggregated from counts, never averaged.

**Overlap reconciliation.** Observations with the same `locationId` + `physicalPositionId` are
one facing. A clear identification beats an unclear view; conflicting identifications become
an unknown conflict. Observations without a `physicalPositionId` in multi-photo locations are
counted individually and the scope is qualified (`overlap-unreconciled`). The same rule
applies to price labels via `physicalLabelId` (the readable view is kept).

**Prices.** Displayed price is kept as shown (øre). Pant: `included=false` ⇒ price is
ex-pant; `included=true` with amount ⇒ ex-pant = price − pant; otherwise the basis is
`incl-deposit`/`as-displayed` and is never mixed with ex-pant prices. Multibuy keeps the
condition (`3 for 30,00 kr.`) and adds a derived per-item price. Price per litre only with a
known pack (label first, then matched SKU). Prices compare only within the same
product + pack + basis + price type (`comparableKey`). Labels are tied to products only on a
`matched` match.

**Comparison.** Same scope, same `methodVersion`, both measures available ⇒ change in pp.
Qualified if either measure is qualified, the number of locations differs, usable photos
differ by more than 1.5×, or mock is compared with live. Otherwise "first visit" or "not
comparable".

**Rep corrections.** Stored separately (`corrections` table) with target, value, rep and time;
latest per target wins. Facing values: product, brand, unknown (confirmed), not-beverage.
Price values: price + type, unreadable. Metrics report how many values came from reps.

## Example (abridged mock response)

```json
{
  "schemaVersion": "1.0.0",
  "jobId": "job-1",
  "visitId": "visit-1",
  "status": "completed",
  "source": "mock",
  "provider": { "name": "shelfwise-mock", "model": null },
  "methodVersion": "mock-planogram-v1",
  "catalogueVersion": "dk-seed-2026.11",
  "analysedAt": "2026-11-10T13:38:00.000Z",
  "images": [
    {
      "imageId": "cap-1",
      "usable": true,
      "locationType": "shelf",
      "locationId": "loc-shelf-1",
      "issues": []
    }
  ],
  "locations": [
    { "locationId": "loc-shelf-1", "type": "shelf", "label": "Shelf 1", "imageIds": ["cap-1"] }
  ],
  "facings": [
    {
      "facingId": "f1",
      "imageId": "cap-1",
      "locationId": "loc-shelf-1",
      "physicalPositionId": "loc-shelf-1-r0-c0",
      "region": { "x": 0.02, "y": 0.04, "width": 0.1, "height": 0.13 },
      "match": {
        "status": "matched",
        "productId": "royal-pilsner-6x330",
        "brandId": "royal",
        "category": "beer",
        "providerScore": 0.91
      }
    }
  ],
  "priceLabels": [
    {
      "labelId": "l1",
      "imageId": "cap-1",
      "locationId": "loc-shelf-1",
      "physicalLabelId": "pl1",
      "region": null,
      "rawText": "ROYAL PILSNER 64,95 + PANT 6,00",
      "status": "resolved",
      "unresolvedReason": null,
      "match": {
        "status": "matched",
        "productId": "royal-pilsner-6x330",
        "brandId": "royal",
        "category": "beer",
        "providerScore": 0.9
      },
      "priceType": "regular",
      "amountOre": 6495,
      "currency": "DKK",
      "deposit": { "shown": true, "amountOre": 600, "included": false },
      "pack": { "units": 6, "volumeMl": 330 },
      "multibuy": null,
      "conditionText": null,
      "promotionId": null
    }
  ],
  "promotions": [],
  "displays": [],
  "warnings": [],
  "failure": null,
  "narrative": null
}
```

## Live provider requirements (pending)

A live adapter must: run server-side; dedupe on `idempotencyKey`; return explicit `null`s and
`unresolved` statuses rather than plausible guesses; assign `physicalPositionId`/
`physicalLabelId` across overlapping photos (or omit them so results are qualified);
classify each image as shelf/cooler/display; and set `source: "live"`.
