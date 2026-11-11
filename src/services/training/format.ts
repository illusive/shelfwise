/**
 * Training export package format (see docs/model-training.md and docs/analysis-contract.md).
 * Bump `TRAINING_PACKAGE_VERSION` on any breaking change to the files below.
 */
export const TRAINING_PACKAGE_FORMAT = 'shelfwise-training';
export const TRAINING_PACKAGE_VERSION = '1.0.0';
export const CORRECTIONS_LAYER_VERSION = '1.0.0';

export const PACKAGE_FILES = {
  readme: 'README.md',
  manifest: 'manifest.json',
  visits: 'metadata/visits.json',
  images: 'metadata/images.json',
  draftLabels: 'labels/draft.coco.json',
  corrections: 'labels/corrections.json',
} as const;

/**
 * Class-agnostic to start with: every product is a "facing"; brand/product live in attributes
 * so brand groups can become classes later without relabelling boxes.
 */
export const COCO_CATEGORIES = [
  { id: 1, name: 'facing', supercategory: 'product' },
  { id: 2, name: 'price_label', supercategory: 'label' },
  { id: 3, name: 'promotion', supercategory: 'marketing' },
  { id: 4, name: 'display', supercategory: 'fixture' },
] as const;

export type CocoCategoryName = (typeof COCO_CATEGORIES)[number]['name'];

export const categoryId = (name: CocoCategoryName) =>
  COCO_CATEGORIES.find((c) => c.name === name)!.id;
