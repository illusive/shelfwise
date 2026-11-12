import type { CopilotStudioConfig } from '@/app/config';

/** SDK connection settings for the agent (lazy-loads the SDK). */
export async function connectionSettings(cs: CopilotStudioConfig) {
  const sdk = await import('@microsoft/agents-copilotstudio-client');
  const cloud =
    sdk.PowerPlatformCloud[cs.cloud as keyof typeof sdk.PowerPlatformCloud] ??
    sdk.PowerPlatformCloud.Prod;
  const settings = Object.assign(new sdk.ConnectionSettings(), {
    directConnectUrl: cs.directConnectUrl ?? undefined,
    environmentId: cs.environmentId ?? undefined,
    schemaName: cs.schemaName ?? undefined,
    cloud,
  });
  return { sdk, settings };
}

/** OAuth scope (token audience) for the agent, e.g. `https://api.powerplatform.com/.default`. */
export async function agentScopeFor(cs: CopilotStudioConfig): Promise<string> {
  const { sdk, settings } = await connectionSettings(cs);
  return sdk.ScopeHelper.getScopeFromSettings(settings);
}
