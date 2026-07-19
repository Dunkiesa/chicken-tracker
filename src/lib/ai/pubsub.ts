export type StatusEventPayload = {
  imageId: number;
  chickenId: number;
  status: "processing" | "succeeded" | "failed" | "skipped";
  text?: string;
  bbox?: [number, number, number, number] | null;
  error?: string;
};

type StatusCallback = (payload: StatusEventPayload) => void;

const subscribers = new Map<string, Set<StatusCallback>>();

export function subscribeToStatusEvents(
  userEmail: string,
  callback: StatusCallback
): () => void {
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
  subscribers.clear();
}
