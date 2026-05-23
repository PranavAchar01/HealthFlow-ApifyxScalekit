import { NextRequest } from "next/server";
import { getAllEncounters, subscribe, getActiveSelection } from "@/lib/store";
import { corsHeaders, corsResponse } from "@/lib/cors";

// SSE works best on Node runtime with a long execution budget. On Vercel hobby
// the function will be capped at ~10s and the client will auto-reconnect via
// the native EventSource — that's fine, browsers handle this transparently.
// On Pro/Enterprise this can run up to 300s for a truly long-lived stream.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req.headers.get("origin"));
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Tell clients to reconnect after 2s if the stream drops
      controller.enqueue(encoder.encode(`retry: 2000\n\n`));

      // Initial snapshot so a freshly-connected client paints immediately.
      // selectedId lets a late-joining tab focus the patient already in play.
      try {
        const initial = await getAllEncounters();
        send("snapshot", { encounters: initial, selectedId: getActiveSelection() });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "snapshot failed" });
      }

      // Live updates
      const unsubscribe = subscribe((event) => {
        if (event.type === "upsert") send("upsert", event.encounter);
        else send(event.type, { id: event.id });
      });

      // Heartbeat keeps proxies & load balancers from killing idle connections.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 15000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch {}
      };

      // Client went away
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
