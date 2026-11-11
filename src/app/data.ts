import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { isJobActive } from '@/domain/models';
import { loadVisitDetail, loadVisitSummaries } from '@/services/visitSummaries';
import { useServices } from './services-context';

/**
 * Query hooks over the repositories. Components never call repositories directly for reads;
 * mutations go through services and then call `useInvalidate()`.
 */
export const queryKeys = {
  currentRep: ['current-rep'] as const,
  reps: ['reps'] as const,
  stores: ['stores'] as const,
  store: (id: string) => ['store', id] as const,
  visitDetail: (id: string) => ['visit-detail', id] as const,
  summaries: (filter: { repId?: string; storeId?: string }) => ['summaries', filter] as const,
};

export function useInvalidate() {
  const client = useQueryClient();
  // Blob queries are immutable; refetching them would flicker images.
  return useCallback(
    () => client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'blob' }),
    [client],
  );
}

export function useCurrentRep() {
  const { repos } = useServices();
  return useQuery({
    queryKey: queryKeys.currentRep,
    queryFn: async () => {
      const id = await repos.session.getCurrentRepId();
      return id ? ((await repos.reps.get(id)) ?? null) : null;
    },
  });
}

export function useReps() {
  const { repos } = useServices();
  return useQuery({ queryKey: queryKeys.reps, queryFn: () => repos.reps.list() });
}

export function useStores() {
  const { repos } = useServices();
  return useQuery({ queryKey: queryKeys.stores, queryFn: () => repos.stores.list() });
}

export function useStore(id: string) {
  const { repos } = useServices();
  return useQuery({ queryKey: queryKeys.store(id), queryFn: async () => (await repos.stores.get(id)) ?? null });
}

export function useVisitDetail(visitId: string) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.visitDetail(visitId),
    queryFn: () => loadVisitDetail(services, visitId),
    // Poll while an analysis job runs; job state lives in IndexedDB.
    refetchInterval: (query) => {
      const job = query.state.data?.job;
      return job && isJobActive(job.status) ? 400 : false;
    },
  });
}

export function useVisitSummaries(filter: { repId?: string; storeId?: string }) {
  const services = useServices();
  return useQuery({
    queryKey: queryKeys.summaries(filter),
    queryFn: () => loadVisitSummaries(services, filter),
    refetchInterval: (query) =>
      query.state.data?.some((s) => s.job && isJobActive(s.job.status)) ? 1000 : false,
  });
}
