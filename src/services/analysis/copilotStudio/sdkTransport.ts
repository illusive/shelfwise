import type { CopilotStudioConfig } from '@/app/config';
import { ProviderError } from '../provider';
import { connectionSettings } from './connection';
import type { AgentReply, AgentTransport } from './provider';

/** Long edge sent to the agent: vision models downscale anyway; this keeps uploads ~1 MB. */
export const AGENT_IMAGE_MAX_EDGE = 2560;

/** Maps an SDK/HTTP failure to a job failure code (status codes are in the SDK's message). */
export function classifyAgentError(error: unknown): unknown {
  if (error instanceof ProviderError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const status = /\b(4\d\d|5\d\d)\b/.exec(message)?.[1];
  if (status === '401')
    return new ProviderError('sign-in-required', 'The Microsoft sign-in was not accepted.');
  if (status === '403')
    return new ProviderError(
      'sign-in-required',
      'This account has no access to the analysis agent.',
      false,
    );
  if (status === '429')
    return new ProviderError('provider-throttled', 'The analysis agent is busy (rate limit).');
  if (status?.startsWith('5') || /failed to fetch|network/i.test(message))
    return new ProviderError('provider-unavailable', 'The analysis agent could not be reached.');
  return error;
}

/** The agent's answer: the last message from the agent carrying text or a structured value. */
export function pickReply(
  activities: { type?: string; text?: string; value?: unknown; from?: { role?: string } }[],
): AgentReply {
  const replies = activities.filter(
    (a) => (a.type === 'message' || a.type === 'event') && a.from?.role !== 'user',
  );
  for (let i = replies.length - 1; i >= 0; i--) {
    const { text, value } = replies[i];
    if ((text && text.trim()) || (value && typeof value === 'object')) {
      return { text: text ?? null, value: value ?? null };
    }
  }
  return { text: null, value: null };
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Downscales a photo for the agent (JPEG); returns the original if it is already small. */
export async function downscaleForAgent(blob: Blob, maxEdge = AGENT_IMAGE_MAX_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && blob.type === 'image/jpeg') return blob;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    canvas.width = 0;
    canvas.height = 0;
    return out ?? blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Talks to the agent with the Microsoft 365 Agents SDK, using the signed-in tester's token.
 * Each photo gets its own conversation; the image goes as a `data:` URL attachment, the same
 * way Microsoft's web chat sends uploads to Copilot Studio.
 */
export function createSdkTransport(options: {
  config: CopilotStudioConfig;
  getToken: () => Promise<string>;
  prepareImage?: (blob: Blob) => Promise<Blob>;
}): AgentTransport {
  const prepare = options.prepareImage ?? downscaleForAgent;
  return {
    model: null,
    async analysePhoto({ image, instruction, imageId }, signal) {
      try {
        const token = await options.getToken();
        const [{ sdk, settings }, { Activity }] = await Promise.all([
          connectionSettings(options.config),
          import('@microsoft/agents-activity'),
        ]);
        const client = new sdk.CopilotStudioClient(settings, token);
        signal?.throwIfAborted();
        // No greeting: the photo is the first and only turn.
        const start = await client.startConversationWithResponse(false);
        const photo = await prepare(image);
        signal?.throwIfAborted();
        const activity = Activity.fromObject({
          type: 'message',
          text: instruction,
          attachments: [
            {
              contentType: photo.type || 'image/jpeg',
              contentUrl: await toDataUrl(photo),
              name: `${imageId}.jpg`,
            },
          ],
        });
        const response = await client.executeWithResponse(activity, start.conversationId);
        signal?.throwIfAborted();
        return pickReply(response.activities);
      } catch (error) {
        throw classifyAgentError(error);
      }
    },
  };
}
