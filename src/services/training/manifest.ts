import { ANALYSIS_SCHEMA_VERSION } from '@/contracts/analysis';
import type { LabelStats } from './coco';
import {
  CORRECTIONS_LAYER_VERSION,
  TRAINING_PACKAGE_FORMAT,
  TRAINING_PACKAGE_VERSION,
} from './format';

export interface PackageFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ManifestInput {
  exportedAt: string;
  app: { version: string; commit: string };
  scope: { kind: 'visit'; visitId: string } | { kind: 'all' };
  catalogueVersions: string[];
  methodVersions: string[];
  sources: ('mock' | 'live')[];
  visitIds: string[];
  stats: LabelStats;
  imagesSkipped: number;
  imagesReencoded: number;
  files: PackageFile[];
}

/** `manifest.json`: what the package contains and which versions produced it. */
export function buildManifest(input: ManifestInput) {
  const uniq = <T>(values: T[]) => [...new Set(values)].sort();
  return {
    format: TRAINING_PACKAGE_FORMAT,
    packageVersion: TRAINING_PACKAGE_VERSION,
    exportedAt: input.exportedAt,
    app: { name: 'shelfwise', ...input.app },
    versions: {
      analysisSchema: ANALYSIS_SCHEMA_VERSION,
      catalogue: uniq(input.catalogueVersions),
      method: uniq(input.methodVersions),
      coco: '1.0',
      corrections: CORRECTIONS_LAYER_VERSION,
    },
    scope: input.scope,
    /** `mock` labels are illustrative only and must never be used to train or evaluate. */
    labelSources: uniq(input.sources),
    counts: {
      visits: input.visitIds.length,
      images: input.stats.images,
      imagesSkipped: input.imagesSkipped,
      imagesReencoded: input.imagesReencoded,
      annotations: input.stats.annotations,
      observationsWithoutBox: input.stats.withoutBox,
      needsReview: input.stats.needsReview,
      corrections: input.stats.corrections,
    },
    privacy: {
      trainingConsentRequired: true,
      locationData: false,
      repIdentity: false,
      imageMetadataStripped: true,
      containsPeopleDefault: 'unknown',
    },
    files: input.files,
  };
}

export type TrainingManifest = ReturnType<typeof buildManifest>;
