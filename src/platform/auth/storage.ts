type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Manifest = { version: string; count: number };
// 400 Unicode code points stay below 2 KB without splitting surrogate pairs.
// A new pointer is committed only after all chunks have been saved securely.
export function createSessionStorage(store: Store): Store {
  let sequence = 0;
  const read = async (key: string): Promise<Manifest | null> => {
    const value = await store.getItem(key);
    if (!value) return null;
    const manifest: Manifest = JSON.parse(value);
    if (
      !manifest.version ||
      !Number.isInteger(manifest.count) ||
      manifest.count < 0 ||
      manifest.count > 10000
    )
      throw new Error("Invalid secure session.");
    return manifest;
  };
  const chunkKey = (key: string, m: Manifest, index: number) =>
    `${key}.${m.version}.${index}`;
  const discard = async (key: string, m: Manifest) =>
    Promise.all(
      Array.from({ length: m.count }, (_, i) =>
        store.removeItem(chunkKey(key, m, i)),
      ),
    );
  return {
    async getItem(key) {
      const manifest = await read(key);
      if (!manifest) return null;
      const chunks = await Promise.all(
        Array.from({ length: manifest.count }, (_, i) =>
          store.getItem(chunkKey(key, manifest, i)),
        ),
      );
      if (chunks.some((chunk) => chunk === null))
        throw new Error("Secure session is incomplete.");
      return chunks.join("");
    },
    async setItem(key, value) {
      const previous = await read(key);
      const characters = Array.from(value);
      const next = {
        version: `${Date.now()}-${++sequence}`,
        count: Math.ceil(characters.length / 400),
      };
      try {
        const writes = await Promise.allSettled(
          Array.from({ length: next.count }, (_, i) =>
            store.setItem(
              chunkKey(key, next, i),
              characters.slice(i * 400, (i + 1) * 400).join(""),
            ),
          ),
        );
        const failure = writes.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
        await store.setItem(key, JSON.stringify(next));
      } catch (error) {
        await discard(key, next).catch(() => undefined);
        throw error;
      }
      // Old-chunk cleanup must not fail a successfully committed session update.
      if (previous) await discard(key, previous).catch(() => undefined);
    },
    async removeItem(key) {
      const manifest = await read(key);
      await store.removeItem(key);
      if (manifest) await discard(key, manifest);
    },
  };
}
