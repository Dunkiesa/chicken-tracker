"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CropRegion } from "@/components/NoteImageManager";

export type ImageAIStatus = {
  status: "pending" | "processing" | "succeeded" | "failed" | "skipped";
  text?: string;
  bbox?: [number, number, number, number] | null;
  error?: string;
};

type SSEEvent = {
  imageId: number;
  status: string;
  text?: string;
  bbox?: [number, number, number, number] | null;
  error?: string;
};

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;

export function useNoteImageSSE(
  chickenId: number,
  trackedImageIds: number[]
) {
  const [statuses, setStatuses] = useState<Record<number, ImageAIStatus>>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const trackedIdsRef = useRef(trackedImageIds);
  trackedIdsRef.current = trackedImageIds;

  const reconcileImage = useCallback(async (imageId: number) => {
    try {
      const res = await fetch(
        `/api/chickens/${chickenId}/notes/images/${imageId}`
      );
      if (!res.ok) return;
      const image = await res.json();
      if (!mountedRef.current) return;
      setStatuses((prev) => ({
        ...prev,
        [imageId]: {
          status: image.status,
          text: image.ai_suggestion ?? undefined,
          bbox: undefined,
          error: image.ai_error ?? undefined,
        },
      }));
    } catch {
      // swallow reconcile errors
    }
  }, [chickenId]);

  const reconcileAll = useCallback(async () => {
    const ids = trackedIdsRef.current;
    await Promise.all(ids.map((id) => reconcileImage(id)));
  }, [reconcileImage]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(
      `/api/chickens/${chickenId}/notes/images/events`
    );
    eventSourceRef.current = es;

    es.onopen = () => {
      reconnectAttemptRef.current = 0;
      reconcileAll();
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        if (!mountedRef.current) return;
        setStatuses((prev) => ({
          ...prev,
          [data.imageId]: {
            status: data.status as ImageAIStatus["status"],
            ...(data.text !== undefined ? { text: data.text } : {}),
            ...(data.bbox !== undefined ? { bbox: data.bbox } : {}),
            ...(data.error !== undefined ? { error: data.error } : {}),
          },
        }));
      } catch {
        // swallow parse errors
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      if (!mountedRef.current) return;
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, attempt),
        RECONNECT_MAX_MS
      );
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, [chickenId, reconcileAll]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect]);

  const patchImage = useCallback(
    async (imageId: number, body: Record<string, unknown>) => {
      const res = await fetch(
        `/api/chickens/${chickenId}/notes/images/${imageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) return null;
      return await res.json();
    },
    [chickenId]
  );

  const retryImage = useCallback(
    async (imageId: number) => {
      const image = await patchImage(imageId, { action: "retry" });
      if (!image) return;
      setStatuses((prev) => ({
        ...prev,
        [imageId]: {
          status: image.status,
          error: image.ai_error ?? undefined,
        },
      }));
    },
    [patchImage]
  );

  const resendImage = useCallback(
    async (imageId: number, crop: CropRegion) => {
      const image = await patchImage(imageId, { action: "resend", crop });
      if (!image) return null;
      setStatuses((prev) => ({
        ...prev,
        [imageId]: {
          status: image.status,
          error: image.ai_error ?? undefined,
        },
      }));
      return image;
    },
    [patchImage]
  );

  const isAnyProcessing = Object.values(statuses).some(
    (s) => s.status === "processing"
  );

  return { statuses, retryImage, resendImage, isAnyProcessing };
}
