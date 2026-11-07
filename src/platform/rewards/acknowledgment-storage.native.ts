import * as SecureStore from "expo-secure-store";
import { createSessionStorage } from "../auth/storage";
import { createRewardAcknowledgments } from "./acknowledgments";
// Chunking keeps acknowledgment histories within native SecureStore value limits.
export const rewardAcknowledgments = createRewardAcknowledgments(
  createSessionStorage({
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
  }),
);
