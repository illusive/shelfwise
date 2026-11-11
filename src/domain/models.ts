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
}

export type CaptureSource = 'camera' | 'import' | 'demo';

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
