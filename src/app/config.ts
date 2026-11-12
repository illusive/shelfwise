/** Environment-derived configuration. Components read config from here, never import.meta.env. */
export interface AppConfig {
  /** `copilot-studio` is the live provider for the POC (`live` is accepted as an alias). */
  analysisProvider: 'mock' | 'copilot-studio';
  /** Public ids for the Copilot Studio agent and Entra app (no secrets). */
  copilotStudio: CopilotStudioConfig;
  mockLatencyMs: number;
  mockFailFirstAttempt: boolean;
  /** Target overlap between consecutive shelf photos (fraction of the photo width). */
  overlapTarget: number;
  /** Days a visit's photos are kept on the device before originals may be purged. */
  retentionDays: number;
  /** Shows developer tools (training export) in the user drawer. */
  devTools: boolean;
}

export interface CopilotStudioConfig {
  /** The agent's direct-connect URL (Copilot Studio → Channels → Web app / Native app). */
  directConnectUrl: string | null;
  /** Alternative to the URL: environment id + agent schema name. */
  environmentId: string | null;
  schemaName: string | null;
  tenantId: string | null;
  /** Entra app registration (single-page application) used to sign testers in. */
  clientId: string | null;
  /**
   * Power Platform cloud (SDK `PowerPlatformCloud` name). Must be explicit: the SDK can't infer
   * it from environment-specific direct-connect hosts. `Prod` = public cloud.
   */
  cloud: string;
}

/** True when enough is configured to sign in and reach the agent. */
export function copilotStudioReady(cs: CopilotStudioConfig): boolean {
  return Boolean(
    cs.tenantId && cs.clientId && (cs.directConnectUrl || (cs.environmentId && cs.schemaName)),
  );
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function readNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function readConfig(
  env: Record<string, string | boolean | undefined> = import.meta.env,
): AppConfig {
  const requested = env.VITE_ANALYSIS_PROVIDER;
  const provider =
    requested === 'copilot-studio' || requested === 'live' ? 'copilot-studio' : 'mock';
  return {
    analysisProvider: provider,
    copilotStudio: {
      directConnectUrl: text(env.VITE_CS_DIRECT_CONNECT_URL),
      environmentId: text(env.VITE_CS_ENVIRONMENT_ID),
      schemaName: text(env.VITE_CS_SCHEMA_NAME),
      tenantId: text(env.VITE_CS_TENANT_ID),
      clientId: text(env.VITE_CS_CLIENT_ID),
      cloud: text(env.VITE_CS_CLOUD) ?? 'Prod',
    },
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
