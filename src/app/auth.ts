import { useSyncExternalStore } from 'react';
import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser';
import { agentScopeFor } from '@/services/analysis/copilotStudio/connection';
import { ProviderError } from '@/services/analysis/provider';
import { copilotStudioReady, readConfig, type CopilotStudioConfig } from './config';

/**
 * Microsoft (Entra ID) sign-in for live analysis through Copilot Studio. The agent acts on
 * behalf of the signed-in tester with their own delegated token: no secret in the app.
 * MSAL and the agent SDK are loaded only when Copilot Studio is configured.
 */
export type AuthStatus = 'disabled' | 'loading' | 'signed-out' | 'signed-in' | 'error';

export interface AuthState {
  status: AuthStatus;
  account: { name: string; username: string } | null;
  error: string | null;
}

let state: AuthState = { status: 'disabled', account: null, error: null };
const listeners = new Set<() => void>();
let msal: IPublicClientApplication | null = null;
let scope: string | null = null;

function set(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

const toAccount = (a: AccountInfo | null) =>
  a ? { name: a.name ?? a.username, username: a.username } : null;

export function liveConfig(): CopilotStudioConfig | null {
  const config = readConfig();
  return config.analysisProvider === 'copilot-studio' && copilotStudioReady(config.copilotStudio)
    ? config.copilotStudio
    : null;
}

/** Token audience for the agent, derived by the SDK from the agent settings. */
export async function agentScope(cs: CopilotStudioConfig): Promise<string> {
  scope ??= await agentScopeFor(cs);
  return scope;
}

/** Call before rendering: completes a sign-in redirect and restores the cached account. */
export async function initAuth(): Promise<void> {
  const cs = liveConfig();
  if (!cs) return;
  set({ status: 'loading' });
  try {
    const { createStandardPublicClientApplication, BrowserCacheLocation } =
      await import('@azure/msal-browser');
    const redirectUri = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    msal = await createStandardPublicClientApplication({
      auth: {
        clientId: cs.clientId!,
        authority: `https://login.microsoftonline.com/${cs.tenantId}`,
        redirectUri,
        postLogoutRedirectUri: redirectUri,
      },
      // Installed PWAs keep the sign-in between launches.
      cache: { cacheLocation: BrowserCacheLocation.LocalStorage },
    });
    const result = await msal.handleRedirectPromise();
    const account = result?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
    if (account) msal.setActiveAccount(account);
    set({ status: account ? 'signed-in' : 'signed-out', account: toAccount(account), error: null });
  } catch (error) {
    set({
      status: 'error',
      account: null,
      error: error instanceof Error ? error.message : 'Sign-in failed',
    });
  }
}

export async function signIn() {
  const cs = liveConfig();
  if (!msal || !cs) return;
  await msal.loginRedirect({ scopes: [await agentScope(cs)], prompt: 'select_account' });
}

export async function signOut() {
  if (!msal) return;
  await msal.logoutRedirect({ account: msal.getActiveAccount() ?? undefined });
}

export class SignInRequiredError extends ProviderError {
  constructor(message: string) {
    super('sign-in-required', message);
  }
}

/**
 * Token for the agent. Never starts an interactive sign-in by itself (that would navigate away
 * mid-analysis): throws SignInRequiredError so the job fails with a clear, retryable message.
 */
export async function getAgentToken(): Promise<string> {
  const cs = liveConfig();
  const account = msal?.getActiveAccount();
  if (!msal || !cs || !account) throw new SignInRequiredError('Not signed in');
  try {
    const result = await msal.acquireTokenSilent({ scopes: [await agentScope(cs)], account });
    return result.accessToken;
  } catch (error) {
    const { InteractionRequiredAuthError } = await import('@azure/msal-browser');
    if (error instanceof InteractionRequiredAuthError) {
      set({ status: 'signed-out' });
      throw new SignInRequiredError('Sign-in expired');
    }
    throw error;
  }
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
