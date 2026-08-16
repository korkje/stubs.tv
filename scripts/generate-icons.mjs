// Regenerates every derived favicon/app-icon asset from the canonical brand mark,
// assets/brand/stubs-mark-favicon.svg. Run from the repo root after
// `npm install` (sharp ships with Next.js):
//
//   node scripts/generate-icons.mjs
//
// Outputs:
//   apps/web/src/app/apple-icon.png        180×180, full-bleed (iOS applies
//                                          its own corner mask; transparent
//                                          corners would render black)
//   apps/web/public/icon-192.png           manifest icon, purpose "any"
//   apps/web/public/icon-512.png           manifest icon, purpose "any"
//   apps/web/public/icon-maskable-192.png  manifest icon, purpose "maskable"
//   apps/web/public/icon-maskable-512.png  (full-bleed, star inside the 80%
//                                          safe zone so any platform mask
//                                          shape leaves it intact)
//   apps/web/public/bimi.svg               BIMI logo for email (SVG Tiny 1.2
//                                          Portable/Secure profile; inboxes
//                                          crop it to a circle, so full-bleed
//                                          with the same safe-zone padding)
//
// apps/web/src/app/favicon.ico and icon.svg are maintained by hand; this
// script does not touch them.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = await readFile(
  join(root, "assets/brand/stubs-mark-favicon.svg"),
  "utf8"
);

// Single-source the star shape and colors from the canonical SVG so a brand
// tweak there propagates here.
const starPath = canonical.match(/<path d="([^"]+)"/)?.[1];
const background = canonical.match(/<rect [^>]*fill="([^"]+)"/)?.[1];
const foreground = canonical.match(/<use [^>]*color="([^"]+)"/)?.[1];
if (!starPath || !background || !foreground) {
  throw new Error("Could not extract mark geometry from the canonical SVG");
}

// Full-bleed variant of the mark on a 32-unit canvas. `starWidth` sets how
// much breathing room the star gets; the small vertical offset mirrors the
// optical centering of the canonical mark (star at y 4.5, not 4).
function fullBleedSvg(starWidth) {
  const x = (32 - starWidth) / 2;
  const y = x + (0.5 * starWidth) / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <symbol id="star" viewBox="0 0 15 15">
      <path d="${starPath}" fill="currentColor"></path>
    </symbol>
  </defs>
  <rect width="32" height="32" fill="${background}"></rect>
  <use href="#star" x="${x}" y="${y}" width="${starWidth}" height="${starWidth}" color="${foreground}"></use>
</svg>`;
}

async function render(svg, size, outPath) {
  await mkdir(join(root, dirname(outPath)), { recursive: true });
  const png = await sharp(Buffer.from(svg), { density: (72 * size) / 32 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(join(root, outPath), png);
  console.log(`${outPath} (${size}×${size}, ${png.length} bytes)`);
}

// BIMI requires the SVG Tiny 1.2 Portable/Secure profile: version and
// baseProfile pinned, a <title>, and only a restricted element set — no
// <symbol>/<use> indirection, so the star path is inlined with a transform.
// Same geometry as the full-bleed mark above.
function bimiSvg(starWidth) {
  const round = (n) => String(Math.round(n * 1000) / 1000);
  const x = round((32 - starWidth) / 2);
  const y = round((32 - starWidth) / 2 + (0.5 * starWidth) / 24);
  const scale = round(starWidth / 15);
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="0 0 32 32">
  <title>stubs.tv</title>
  <rect width="32" height="32" fill="${background}"/>
  <path transform="translate(${x} ${y}) scale(${scale})" d="${starPath}" fill="${foreground}"/>
</svg>`;
}

// Home-screen icons read better with a bit more padding than the browser-tab
// mark; 20/32 keeps the star clear of the maskable safe zone (a centered
// circle of radius 12.8 units — the star's points reach ~9.4 at this width).
const fullBleed = fullBleedSvg(20);

await render(fullBleed, 180, "apps/web/src/app/apple-icon.png");
await render(canonical, 192, "apps/web/public/icon-192.png");
await render(canonical, 512, "apps/web/public/icon-512.png");
await render(fullBleed, 192, "apps/web/public/icon-maskable-192.png");
await render(fullBleed, 512, "apps/web/public/icon-maskable-512.png");

await writeFile(join(root, "apps/web/public/bimi.svg"), bimiSvg(20));
console.log("apps/web/public/bimi.svg");
