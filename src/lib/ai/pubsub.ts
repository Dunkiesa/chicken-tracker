export type StatusEventPayload = {
  imageId: number;
  chickenId: number;
  status: "processing" | "succeeded" | "failed" | "skipped";
  text?: string;
  bbox?: [number, number, number, number] | null;
  error?: string;
};

type StatusCallback = (payload: StatusEventPayload) => void;

const GLOBAL_KEY = "__chicken_ai_subscribers__";

function getSubscribers(): Map<string, Set<StatusCallback>> {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, Set<StatusCallback>>();
  }
  return g[GLOBAL_KEY] as Map<string, Set<StatusCallback>>;
}

export function subscribeToStatusEvents(
  userEmail: string,
  callback: StatusCallback
): () => void {
  const subscribers = getSubscribers();
  if (!subscribers.has(userEmail)) {
    subscribers.set(userEmail, new Set());
  }
  subscribers.get(userEmail)!.add(callback);

  return () => {
    const set = subscribers.get(userEmail);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        subscribers.delete(userEmail);
      }
    }
  };
}

export function emitStatusEvent(
  userEmail: string,
  payload: StatusEventPayload
): void {
  const subscribers = getSubscribers();
  const set = subscribers.get(userEmail);
  if (!set) {
    console.log(`[AI] emitStatusEvent: no subscribers for user ${userEmail} (event: imageId=${payload.imageId}, status=${payload.status})`);
    return;
  }
  console.log(`[AI] emitStatusEvent: delivering to ${set.size} subscriber(s) for ${userEmail} (imageId=${payload.imageId}, status=${payload.status})`);
  for (const cb of set) {
    try {
      cb(payload);
    } catch (err) {
      console.error(`[AI] Subscriber callback error:`, err);
    }
  }
}

export function _clearAllSubscribers(): void {
  getSubscribers().clear();
}
