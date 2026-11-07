import { describe, expect, it } from "vitest";
import {
  gameRegistry,
  createGameRegistry,
} from "../src/platform/games/registry";
import { validateConfiguration } from "../src/platform/games/configuration";
import { fixtureGame } from "./fixtures/game";
describe("typed game registry", () => {
  it("registers Secret Santa first with lobby creation and no draw", () => {
    const game = gameRegistry.require("secret_santa");
    expect(game.metadata.name).toBe("Secret Santa");
    expect(game.metadata.availability_status).toBe("available");
    expect(game.operations).toContain("create");
    expect(game.operations).not.toContain("start");
    expect(game.metadata.min_players).toBe(3);
    expect(gameRegistry.all()).toHaveLength(1);
  });
  it("rejects unknown games and prototype property names", () => {
    for (const id of ["unknown", "toString", "__proto__"]) {
      expect(gameRegistry.get(id)).toBeUndefined();
      expect(() => gameRegistry.require(id)).toThrow("Unknown game");
    }
  });
  it("rejects duplicate registrations", () =>
    expect(() => createGameRegistry([fixtureGame, fixtureGame])).toThrow(
      "Duplicate",
    ));
  it("accepts an independent second module without changing core services", () => {
    const registry = createGameRegistry([...gameRegistry.all(), fixtureGame]);
    expect(
      registry.require("engine_fixture").validateConfiguration({ rounds: 3 }),
    ).toEqual({ rounds: 3 });
    expect(gameRegistry.get("engine_fixture")).toBeUndefined();
  });
});
describe("configuration contracts", () => {
  it("accepts only the empty reserved Secret Santa configuration", () => {
    expect(
      gameRegistry.require("secret_santa").validateConfiguration({}),
    ).toEqual({});
    expect(() =>
      gameRegistry
        .require("secret_santa")
        .validateConfiguration({ budget: 20 }),
    ).toThrow();
  });
  it.each([
    null,
    [],
    { rounds: 0 },
    { rounds: 6 },
    { rounds: 1.5 },
    { rounds: "3" },
    { rounds: 2, extra: true },
    {},
  ])("rejects invalid fixture config %j", (value) =>
    expect(() => fixtureGame.validateConfiguration(value)).toThrow(),
  );
  it("supports bounded text and booleans without coercing values", () => {
    const schema = {
      type: "object",
      properties: {
        label: { type: "string", minLength: 1, maxLength: 5 },
        enabled: { type: "boolean" },
      },
      required: ["label"],
      additionalProperties: false,
    } as const;
    expect(
      validateConfiguration(schema, { label: "Hey", enabled: false }),
    ).toEqual({ label: "Hey", enabled: false });
    for (const v of [
      { label: "" },
      { label: "longgg" },
      { label: true },
      { label: "Hey", enabled: 1 },
    ])
      expect(() => validateConfiguration(schema, v)).toThrow();
  });
});
