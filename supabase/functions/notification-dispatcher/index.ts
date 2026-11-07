import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { dispatch, type Worker } from "./dispatcher.ts";
import { verifyWorkerRequest } from "./auth.ts";
const secret = Deno.env.get("NOTIFICATION_WORKER_SECRET");
Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!(await verifyWorkerRequest(request, secret)))
    return new Response("Unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    return new Response("Worker not configured", { status: 503 });
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const worker: Worker = async <T>(
    action: string,
    data: Record<string, unknown> = {},
  ) => {
    const response = await db.rpc("notification_worker", {
      p_action: action,
      p_data: data,
    });
    if (response.error) throw new Error("Worker operation failed");
    return response.data as T;
  };
  try {
    return Response.json(
      await dispatch(worker, fetch, Deno.env.get("EXPO_ACCESS_TOKEN")),
    );
  } catch {
    return new Response("Worker failed; inspect database delivery status", {
      status: 500,
    });
  }
});
