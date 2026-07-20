import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChicken } from "@/lib/chickens";
import { subscribeToStatusEvents, type StatusEventPayload } from "@/lib/ai/pubsub";
import { aiLog, aiError } from "@/lib/ai/logger";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: rawId } = await params;
  const chickenId = parseInt(rawId, 10);
  if (isNaN(chickenId)) {
    return new Response("Invalid chicken id", { status: 400 });
  }

  const chicken = await getChicken(chickenId);
  if (!chicken) {
    return new Response("Chicken not found", { status: 404 });
  }

  const userEmail = session.user.email;
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  aiLog(`[AI] SSE connection opened for user=${userEmail}, chickenId=${chickenId}`);

  const unsubscribe = subscribeToStatusEvents(
    userEmail,
    (payload: StatusEventPayload) => {
      if (payload.chickenId !== chickenId) return;
      const data = JSON.stringify({
        imageId: payload.imageId,
        status: payload.status,
        ...(payload.text !== undefined ? { text: payload.text } : {}),
        ...(payload.bbox !== undefined ? { bbox: payload.bbox } : {}),
        ...(payload.error !== undefined ? { error: payload.error } : {}),
      });
      aiLog(`[AI] SSE writing event: ${data}`);
      writer.write(encoder.encode(`data: ${data}\n\n`)).catch((err) => {
        aiError(`[AI] SSE write error:`, err);
      });
    }
  );

  const cleanup = () => {
    aiLog(`[AI] SSE connection closed for user=${userEmail}, chickenId=${chickenId}`);
    unsubscribe();
    writer.close().catch(() => {});
  };

  request.signal.addEventListener("abort", cleanup);

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
