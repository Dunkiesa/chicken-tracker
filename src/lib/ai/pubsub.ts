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
  if (!set) return;
  for (const cb of set) {
    try {
      cb(payload);
    } catch {
      // swallow subscriber errors
    }
  }
}

export function _clearAllSubscribers(): void {
  subscribers.clear();
}
