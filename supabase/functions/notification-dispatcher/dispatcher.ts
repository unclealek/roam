/** No client imports. Expo acceptance/receipt success never claims device delivery. */
export type Claim = { id: string; lease_id: string; ticket?: string };
export type Worker = <T>(
  action: string,
  data?: Record<string, unknown>,
) => Promise<T>;
type Ticket = {
  status: "ok" | "error";
  id?: string;
  details?: { error?: string };
};
export async function dispatch(
  worker: Worker,
  request: typeof fetch,
  accessToken?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const stats = { sent: 0, receipts: 0, failures: 0 };
  const receipts = await worker<Claim[]>("receipts");
  if (receipts.length) {
    try {
      const response = await request(
        "https://exp.host/--/api/v2/push/getReceipts",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ ids: receipts.map((x) => x.ticket) }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          data?: Record<string, Ticket>;
        };
        for (const item of receipts) {
          const receipt = body.data?.[item.ticket!];
          await worker("receipt", {
            ...item,
            status: receipt?.status ?? "missing",
            error: receipt?.details?.error,
          });
          stats.receipts++;
        }
      }
    } catch {
      stats.failures++;
    } // DB polling lease retries receipt lookup, never the send.
  }
  const claims = await worker<Claim[]>("claim");
  const sendOne = async (item: Claim) => {
    try {
      const payload = await worker<Record<string, unknown> | null>(
        "begin_send",
        item,
      );
      if (!payload) return;
      let response: Response;
      try {
        response = await request("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        await worker("sent", { ...item, error: "ambiguous" });
        stats.failures++;
        return;
      }
      if (!response.ok) {
        // Only explicit non-acceptance is retryable. A timeout cannot prove non-delivery.
        await worker("sent", {
          ...item,
          error:
            response.status === 429
              ? "HTTP_429"
              : response.status === 503
                ? "HTTP_503"
                : `HTTP_${response.status}`,
        });
        return;
      }
      const json = (await response.json()) as { data?: Ticket | Ticket[] };
      const ticket = Array.isArray(json.data) ? json.data[0] : json.data;
      await worker("sent", {
        ...item,
        ticket: ticket?.status === "ok" ? ticket.id : undefined,
        error:
          ticket?.status === "error"
            ? (ticket.details?.error ?? "ProviderRejected")
            : ticket?.id
              ? undefined
              : "ambiguous",
      });
      stats.sent++;
    } catch {
      stats.failures++;
    } // Lost responses reconcile through the DB lease; no blind resend.
  };
  for (let offset = 0; offset < claims.length; offset += 5) {
    await Promise.allSettled(claims.slice(offset, offset + 5).map(sendOne));
  }
  return stats;
}
