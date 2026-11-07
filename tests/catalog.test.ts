import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCatalog } from "../src/platform/games/service";
import { secretSanta } from "../src/games/secret-santa";
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
}));
vi.mock("../src/platform/supabase", () => ({
  requireSupabase: () => ({ from: mock.from }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mock.from.mockReturnValue({ select: mock.select });
  mock.select.mockReturnValue({ order: mock.order });
});
describe("catalog service", () => {
  it("displays only registered games and honors registered module availability", async () => {
    mock.order.mockResolvedValue({
      data: [
        {
          id: "secret_santa",
          ...secretSanta.metadata,
          availability_status: "available",
        },
        { id: "unregistered" },
      ],
      error: null,
    });
    const games = await loadCatalog();
    expect(games).toHaveLength(1);
    expect(games[0].metadata.availability_status).toBe("available");
  });
  it("honors backend unavailability", async () => {
    mock.order.mockResolvedValue({
      data: [
        {
          id: "secret_santa",
          ...secretSanta.metadata,
          availability_status: "unavailable",
        },
      ],
      error: null,
    });
    expect((await loadCatalog())[0].metadata.availability_status).toBe(
      "unavailable",
    );
  });
  it("reports backend failures", async () => {
    mock.order.mockResolvedValue({
      data: null,
      error: { message: "internal" },
    });
    await expect(loadCatalog()).rejects.toThrow("Unable to load games");
  });
});
