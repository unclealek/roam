/** Internal API. Instantiate only inside a trusted game handler AFTER game-rule authorization.
 * Never expose these operations as arbitrary client commands. */
export type ActivityInput = {
  sessionId: string;
  activityType: string;
  targetUserId?: string;
  unlockAt: string | null;
  expiresAt?: string;
  idempotencyKey: string;
  payload?: { template_key?: string };
};
export type ActivityRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
export function activityService(rpc: ActivityRpc) {
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await rpc(name, args);
    if (result.error) throw new Error("Activity operation failed");
    return result.data;
  };
  const scheduleActivity = async (input: ActivityInput) =>
    call("schedule_activity", {
      p_session: input.sessionId,
      p_type: input.activityType,
      p_target: input.targetUserId ?? null,
      p_unlock: input.unlockAt,
      p_expires: input.expiresAt ?? null,
      p_key: input.idempotencyKey,
      p_payload: input.payload ?? {},
    }) as Promise<string>;
  return {
    scheduleActivity,
    // Null unlock time uses database now(); replays keep the original event timestamp.
    createTriggeredActivity: (input: Omit<ActivityInput, "unlockAt">) =>
      scheduleActivity({ ...input, unlockAt: null }),
    completeActivity: (id: string) =>
      call("transition_activity", { p_id: id, p_status: "completed" }),
    cancelActivity: (id: string) =>
      call("transition_activity", { p_id: id, p_status: "cancelled" }),
  };
}
