/** Environment-derived configuration. Components read config from here, never import.meta.env. */
export interface AppConfig {
  analysisProvider: 'mock' | 'live';
  mockLatencyMs: number;
  mockFailFirstAttempt: boolean;
  /** Target overlap between consecutive shelf photos (fraction of the photo width). */
  overlapTarget: number;
  /** Days a visit's photos are kept on the device before originals may be purged. */
  retentionDays: number;
  /** Shows developer tools (training export) in the user drawer. */
  devTools: boolean;
}

function readNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function readConfig(
  env: Record<string, string | boolean | undefined> = import.meta.env,
): AppConfig {
  const provider = env.VITE_ANALYSIS_PROVIDER === 'live' ? 'live' : 'mock';
  return {
    analysisProvider: provider,
    mockLatencyMs: readNumber(env.VITE_MOCK_LATENCY_MS as string | undefined, 2500),
    mockFailFirstAttempt: env.VITE_MOCK_FAIL_FIRST_ATTEMPT === 'true',
    overlapTarget: Math.min(
      0.5,
      Math.max(0.1, readNumber(env.VITE_OVERLAP_TARGET as string | undefined, 0.25)),
    ),
    retentionDays: Math.max(
      1,
      Math.round(readNumber(env.VITE_RETENTION_DAYS as string | undefined, 365)),
    ),
    devTools: env.VITE_DEV_TOOLS === 'true',
  };
}
