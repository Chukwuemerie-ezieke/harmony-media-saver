// Builds dist/harmony-media-saver-<version>.zip for the Chrome Web Store.
// Only files the extension loads at runtime are included; docs, tests and
// examples stay out of the package.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const files = new Set(["manifest.json"]);
const add = (file) => file && files.add(file);

add(manifest.background?.service_worker);
add(manifest.action?.default_popup);
add(manifest.options_ui?.page);
add(manifest.storage?.managed_schema);
Object.values(manifest.icons || {}).forEach(add);
Object.values(manifest.action?.default_icon || {}).forEach(add);
for (const entry of manifest.content_scripts || []) [...(entry.js || []), ...(entry.css || [])].forEach(add);

// Scripts and styles the pages and the service worker load.
for (const page of [manifest.action?.default_popup, manifest.options_ui?.page].filter(Boolean)) {
  const html = readFileSync(page, "utf8");
  for (const [, ref] of html.matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"]+)"/g)) add(ref);
}
for (const [, ref] of readFileSync(manifest.background.service_worker, "utf8").matchAll(/importScripts\("([^"]+)"\)/g)) {
  add(ref);
}

const missing = [...files].filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`Missing files: ${missing.join(", ")}`);
  process.exit(1);
}

mkdirSync("dist", { recursive: true });
const out = resolve("dist", `harmony-media-saver-${manifest.version}.zip`);
rmSync(out, { force: true });
execFileSync("zip", ["-X", "-q", out, ...[...files].sort()], { stdio: "inherit" });

console.log(`Packaged ${files.size} files into ${out}`);
for (const file of [...files].sort()) console.log(`  ${file}`);
