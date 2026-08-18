import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const required = ["manifest_version", "name", "version", "background", "action", "permissions"];

for (const key of required) {
  if (!manifest[key]) throw new Error(`Missing manifest field: ${key}`);
}

if (manifest.manifest_version !== 3) {
  throw new Error("manifest_version must be 3");
}

if (JSON.stringify(manifest).includes(".svg")) {
  throw new Error("SVG icons are not supported by Chrome extension icon fields");
}

const files = [
  "service-worker.js",
  "content-script.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "options.html",
  "options.js",
  "options.css",
  "PRIVACY.md",
  "README.md"
];

for (const file of files) {
  if (!existsSync(file)) throw new Error(`Missing file: ${file}`);
}

console.log("Harmony Media Saver package is valid.");
