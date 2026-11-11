import type { Correction } from '@/domain/corrections';
import { computeVisitMetrics, type VisitMetrics } from '@/domain/metrics';
import type { AnalysisJob, Capture, Store, StoredResult, Visit } from '@/domain/models';
import type { Services } from './index';

export interface VisitSummary {
  visit: Visit;
  store: Store;
  captureCount: number;
  cover: Capture | null;
  job: AnalysisJob | null;
  metrics: VisitMetrics | null;
}

export interface VisitDetail extends VisitSummary {
  captures: Capture[];
  result: StoredResult | null;
  corrections: Correction[];
  previous: VisitSummary | null;
}

async function metricsFor(services: Services, visit: Visit) {
  if (!visit.resultId) return { result: null, corrections: [] as Correction[], metrics: null };
  const result = (await services.repos.results.get(visit.resultId)) ?? null;
  if (!result) return { result: null, corrections: [] as Correction[], metrics: null };
  const corrections = await services.repos.corrections.listByResult(result.id);
  return { result, corrections, metrics: computeVisitMetrics(result.response, corrections, services.catalogue) };
}

async function summarise(services: Services, visit: Visit, store: Store): Promise<VisitSummary> {
  const captures = await services.repos.captures.listByVisit(visit.id);
  const job = visit.jobId ? ((await services.repos.jobs.get(visit.jobId)) ?? null) : null;
  const { metrics } = await metricsFor(services, visit);
  return { visit, store, captureCount: captures.length, cover: captures[0] ?? null, job, metrics };
}

export async function loadVisitSummaries(
  services: Services,
  filter: { repId?: string; storeId?: string } = {},
): Promise<VisitSummary[]> {
  const [visits, stores] = await Promise.all([services.repos.visits.list(filter), services.repos.stores.list()]);
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const summaries = await Promise.all(
    visits.flatMap((v) => {
      const store = storeById.get(v.storeId);
      return store ? [summarise(services, v, store)] : [];
    }),
  );
  return summaries;
}

/** The latest completed visit to the same store before this one, for comparisons. */
export async function findPreviousCompleted(services: Services, visit: Visit): Promise<Visit | undefined> {
  if (!visit.completedAt) return undefined;
  const visits = await services.repos.visits.list({ storeId: visit.storeId });
  return visits
    .filter((v) => v.id !== visit.id && v.status === 'completed' && v.completedAt && v.completedAt < visit.completedAt!)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0];
}

export async function loadVisitDetail(services: Services, visitId: string): Promise<VisitDetail | null> {
  const visit = await services.repos.visits.get(visitId);
  if (!visit) return null;
  const store = await services.repos.stores.get(visit.storeId);
  if (!store) return null;
  const captures = await services.repos.captures.listByVisit(visit.id);
  const job = visit.jobId ? ((await services.repos.jobs.get(visit.jobId)) ?? null) : null;
  const { result, corrections, metrics } = await metricsFor(services, visit);
  const previousVisit = await findPreviousCompleted(services, visit);
  const previous = previousVisit ? await summarise(services, previousVisit, store) : null;
  return {
    visit,
    store,
    captures,
    captureCount: captures.length,
    cover: captures[0] ?? null,
    job,
    result,
    corrections,
    metrics,
    previous,
  };
}
