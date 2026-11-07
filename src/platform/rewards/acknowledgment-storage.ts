import { createRewardAcknowledgments } from "./acknowledgments";
// Web stores only acknowledgment watermarks/IDs, never secrets or reward content.
export const rewardAcknowledgments = createRewardAcknowledgments({
  async getItem(key) {
    return typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(key);
  },
  async setItem(key, value) {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  },
});
