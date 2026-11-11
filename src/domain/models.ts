import type { AnalysisResponse } from '@/contracts/analysis';

export type IsoDateTime = string;

export interface Rep {
  id: string;
  name: string;
  firstName: string;
  region: string;
}

export interface Address {
  /** Street name and number, e.g. "Vesterbrogade 12". */
  street: string;
  /** Floor/unit (etage), e.g. "1. sal" or "st. tv."; omitted when not relevant. */
  floor?: string;
  postcode: string;
  city: string;
}

/** Reserved for deferred execution KPIs (must-stock, price compliance); not evaluated in the POC. */
export interface TargetPrice {
  productId: string;
  amountOre: number;
}

export interface Store {
  id: string;
  chain: string;
  name: string;
  area: string;
  address: Address;
  customerNumber: string;
  timeZone: string;
  assignedRepIds: string[];
  mustStockProductIds: string[];
  targetPrices: TargetPrice[];
}

export type VisitStatus = 'draft' | 'submitted' | 'completed';

/**
 * Data-use terms recorded on a visit. Consent comes from the rep's setting (default off) and is
 * re-recorded at submission; it is never applied retroactively to submitted visits.
 */
export interface VisitDataUse {
  /** Photos and labels from this visit may be used to train recognition models. */
  trainingConsent: boolean;
  consentRecordedAt: IsoDateTime;
  /** After this, local originals may be purged and the visit is never exported. */
  retainUntil: IsoDateTime;
}

export interface Visit {
  id: string;
  storeId: string;
  repId: string;
  status: VisitStatus;
  /** Changes whenever the draft is (re)opened, so each submission maps to exactly one job. */
  idempotencyKey: string;
  jobId: string | null;
  resultId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  submittedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  /** Absent on visits created before data-use tracking: treated as no consent. */
  dataUse?: VisitDataUse;
}

export type CaptureSource = 'camera' | 'import' | 'demo';

/**
 * Where a camera photo sits in a left-to-right run along a shelf, recorded by the overlap
 * guide so analysis can reconcile overlapping photos. Guidance estimates, not measurements.
 */
export interface CapturePlacement {
  /** Run of photos taken left to right (new run after "new section" or a pause). */
  run: number;
  /** 1-based position within the run. */
  position: number;
  /** Estimated overlap with the previous photo in the run, 0–1 of the photo width. */
  overlap: number | null;
  /** 0–1 matching confidence for `overlap` (not a validated accuracy). */
  confidence: number | null;
  /** Sideways tilt of the phone at capture, in degrees; null without a motion sensor. */
  rollDeg: number | null;
}

/** Coarse device family only (no model, version or identifiers: no fingerprinting). */
export interface DeviceInfo {
  platform: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other';
  browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'other';
  mobile: boolean;
}

/** Camera track settings at capture time, where the browser reports them. */
export interface CameraSettings {
  facingMode: 'environment' | 'user' | null;
  zoom: number | null;
  torch: boolean | null;
  /** Stream resolution (the photo's own resolution is `Capture.width/height`). */
  trackWidth: number | null;
  trackHeight: number | null;
}

/** Whether people are visible; `unknown` until someone (or a later check) says otherwise. */
export type PeoplePresence = 'unknown' | 'yes' | 'no';

export interface Capture {
  id: string;
  visitId: string;
  /** 1-based order within the visit; kept stable on retake. */
  sequence: number;
  capturedAt: IsoDateTime;
  source: CaptureSource;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  blobId: string;
  thumbBlobId: string | null;
  /** Overlap-guide metadata for camera photos; absent for imports and older captures. */
  placement?: CapturePlacement | null;
  /** When the photo was saved on the device (`capturedAt` is file time for imports). */
  storedAt?: IsoDateTime;
  device?: DeviceInfo | null;
  camera?: CameraSettings | null;
  containsPeople?: PeoplePresence;
  /** Set when retention replaced the original with its thumbnail. */
  originalPurgedAt?: IsoDateTime | null;
}

export type JobStatus = 'queued' | 'preparing' | 'analysing' | 'completed' | 'failed' | 'cancelled';

export interface JobFailure {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AnalysisJob {
  id: string;
  visitId: string;
  idempotencyKey: string;
  providerId: string;
  status: JobStatus;
  attempts: number;
  progress: { done: number; total: number } | null;
  failure: JobFailure | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface StoredResult {
  id: string;
  visitId: string;
  jobId: string;
  storedAt: IsoDateTime;
  response: AnalysisResponse;
}

export function isJobActive(status: JobStatus): boolean {
  return status === 'queued' || status === 'preparing' || status === 'analysing';
}

export type VisitTag = 'campaign' | 'upsell' | 'display' | 'new-listing';

/** A store visit planned for a rep on a given (store-local) day, in route order. */
export interface PlannedVisit {
  id: string;
  repId: string;
  storeId: string;
  /** YYYY-MM-DD in the store's time zone. */
  date: string;
  order: number;
  tags: VisitTag[];
}
