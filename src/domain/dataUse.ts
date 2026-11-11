import type { Visit, VisitDataUse } from './models';

const DAY_MS = 86_400_000;

export function retainUntilFor(createdAt: string, retentionDays: number): string {
  return new Date(Date.parse(createdAt) + retentionDays * DAY_MS).toISOString();
}

/** Data-use terms for a visit at `at`, keeping its original retention date if it has one. */
export function recordDataUse(
  visit: Pick<Visit, 'createdAt' | 'dataUse'>,
  trainingConsent: boolean,
  at: string,
  retentionDays: number,
): VisitDataUse {
  return {
    trainingConsent,
    consentRecordedAt: at,
    retainUntil: visit.dataUse?.retainUntil ?? retainUntilFor(visit.createdAt, retentionDays),
  };
}

export function isRetentionExpired(visit: Pick<Visit, 'dataUse'>, now: Date): boolean {
  const until = visit.dataUse?.retainUntil;
  return until !== undefined && Date.parse(until) <= now.getTime();
}

/**
 * Only analysed visits whose recorded consent is on and whose retention has not passed may be
 * exported for training. Visits without recorded terms never qualify.
 */
export function isTrainingExportable(
  visit: Pick<Visit, 'status' | 'dataUse' | 'resultId'>,
  now: Date,
): boolean {
  return (
    visit.status === 'completed' &&
    visit.resultId !== null &&
    visit.dataUse?.trainingConsent === true &&
    !isRetentionExpired(visit, now)
  );
}
