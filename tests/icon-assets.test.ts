import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  navigationIconNames,
  getIconSvg,
} from "../src/presentation/icons/registry";
it("ships distinct 1x/2x/3x native tab assets matching the 24pt contract", () => {
  for (const name of navigationIconNames) {
    for (const scale of [1, 2, 3]) {
      const suffix = scale === 1 ? "" : `@${scale}x`;
      const inactive = readFileSync(
        `assets/icons/navigation/${name}-inactive${suffix}.png`,
      );
      const active = readFileSync(
        `assets/icons/navigation/${name}-active${suffix}.png`,
      );
      expect(inactive.readUInt32BE(16)).toBe(24 * scale);
      expect(inactive.readUInt32BE(20)).toBe(24 * scale);
      expect(active.readUInt32BE(16)).toBe(24 * scale);
      expect(active.equals(inactive)).toBe(false);
    }
    expect(readFileSync(`assets/icons/originals/${name}.svg`, "utf8")).toBe(
      getIconSvg(name),
    );
  }
});
