import { mkdir, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import {
  originalIcons,
  navigationIconNames,
  getIconSvg,
} from "../../src/presentation/icons/registry.ts";
const root = new URL("../../assets/icons/", import.meta.url);
await mkdir(new URL("originals/", root), { recursive: true });
await mkdir(new URL("navigation/", root), { recursive: true });
for (const name of Object.keys(originalIcons)) {
  await writeFile(new URL(`originals/${name}.svg`, root), getIconSvg(name));
}
for (const name of navigationIconNames) {
  for (const variant of ["inactive", "active"]) {
    const svg = getIconSvg(name, {
      ink: "#000000",
      wash: "#00000020",
      accent: "#00000088",
      variant,
    });
    for (const scale of [1, 2, 3]) {
      const filename = `${name}-${variant}${scale === 1 ? "" : `@${scale}x`}.png`;
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: 24 * scale },
      })
        .render()
        .asPng();
      await writeFile(new URL(`navigation/${filename}`, root), png);
    }
  }
}
console.log(
  `Exported ${Object.keys(originalIcons).length} original SVGs and 30 native tab PNGs.`,
);

const names = Object.keys(originalIcons);
const tiles = names
  .map((name, i) => {
    const x = 24 + (i % 7) * 140,
      y = 80 + Math.floor(i / 7) * 140;
    const inner = getIconSvg(name)
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");
    return `<g transform="translate(${x} ${y})"><rect width="124" height="124" rx="20" fill="white" stroke="#D9E1EC"/><g transform="translate(30 16) scale(2)">${inner}</g><text x="62" y="104" text-anchor="middle" fill="#081B58" font-family="Arial" font-size="11">${name}</text></g>`;
  })
  .join("");
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="520" viewBox="0 0 1020 520"><rect width="1020" height="520" fill="#FFFAF4"/><text x="24" y="40" fill="#081B58" font-size="24" font-family="Arial" font-weight="bold">Roam — original icon family</text>${tiles}</svg>`;
await writeFile(
  new URL("../../docs/design/icons/icon-family.svg", import.meta.url),
  sheet,
);
await writeFile(
  new URL("../../docs/design/icons/icon-family.png", import.meta.url),
  new Resvg(sheet).render().asPng(),
);
