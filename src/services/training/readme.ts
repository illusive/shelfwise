import { TRAINING_PACKAGE_VERSION } from './format';

/** README.md placed inside every export package. */
export function packageReadme(exportedAt: string): string {
  return `# Shelfwise training package (format ${TRAINING_PACKAGE_VERSION})

Exported ${exportedAt}. Only analysed visits whose rep had **training consent** on at
submission, and whose retention date has not passed, are included.

## Files

| Path | Contents |
| --- | --- |
| \`manifest.json\` | Package/app/schema/catalogue versions, scope, counts, SHA-256 of every file. |
| \`images/<visitId>/<seq>-<imageId>.jpg\` | Original photos. Metadata (EXIF/XMP, incl. any GPS) removed; imports with metadata are re-encoded. |
| \`metadata/visits.json\` | Store id/chain, timestamps, data-use terms, analysis provenance. No rep identity. |
| \`metadata/images.json\` | Per image: resolution, capture time, source, coarse device, camera settings, overlap placement, \`containsPeople\`. |
| \`labels/draft.coco.json\` | COCO detection labels drafted from the analysis: categories \`facing\`, \`price_label\`, \`promotion\`, \`display\`; product/brand/location details in \`attributes\`; provider score in \`provider_score\`. |
| \`labels/corrections.json\` | Rep corrections as a separate layer, linked by \`annotationIds\`/\`observationIds\`; newest per target has \`latest: true\`. |

## Rules

- Draft labels are **not ground truth**. \`attributes.source: "mock"\` labels are illustrative and
  must never be used for training or evaluation.
- \`provider_score\` is the provider's own score, not a measured accuracy.
- Boxes are pixels \`[x, y, width, height]\` from the top-left of the image file.
- Observations without a box are counted in \`manifest.counts.observationsWithoutBox\` only.
- Handle under the data agreement: internal use, no redistribution, delete by \`retainUntil\`,
  check \`containsPeople\` before labelling. See docs/model-training.md in the app repository.
`;
}
