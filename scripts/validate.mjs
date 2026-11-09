import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
};

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

for (const key of ["manifest_version", "name", "version", "background", "action", "permissions", "icons"]) {
  if (!manifest[key]) fail(`Missing manifest field: ${key}`);
}
if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
if (JSON.stringify(manifest).includes(".svg")) {
  fail("SVG icons are not supported by Chrome extension icon fields");
}
if (pkg.version !== manifest.version) {
  fail(`package.json version ${pkg.version} does not match manifest version ${manifest.version}`);
}

// Every file the manifest points to must exist; icons must be real PNGs.
const PNG_SIGNATURE = "89504e470d0a1a0a";
const iconPaths = [
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {})
];
for (const icon of new Set(iconPaths)) {
  if (!existsSync(icon)) fail(`Missing icon: ${icon}`);
  else if (readFileSync(icon).subarray(0, 8).toString("hex") !== PNG_SIGNATURE) fail(`Icon is not a PNG: ${icon}`);
}
if (!manifest.icons?.["128"]) fail("A 128px icon is required for the Chrome Web Store");

const referenced = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  manifest.storage?.managed_schema,
  ...(manifest.content_scripts || []).flatMap((entry) => [...(entry.js || []), ...(entry.css || [])])
].filter(Boolean);

const files = [
  ...referenced,
  "shared.js",
  "i18n.js",
  "popup.js",
  "popup.css",
  "options.js",
  "options.css",
  "PRIVACY.md",
  "README.md"
];
for (const file of new Set(files)) {
  if (!existsSync(file)) fail(`Missing file: ${file}`);
}

// The managed-policy schema must be valid JSON describing an object.
if (manifest.storage?.managed_schema && existsSync(manifest.storage.managed_schema)) {
  try {
    const schema = JSON.parse(readFileSync(manifest.storage.managed_schema, "utf8"));
    if (schema.type !== "object" || !schema.properties) fail("managed_schema.json must describe an object");
  } catch (error) {
    fail(`managed_schema.json is not valid JSON: ${error.message}`);
  }
}

// Scripts the HTML pages and the service worker load must exist too.
for (const page of ["popup.html", "options.html"]) {
  for (const [, src] of readFileSync(page, "utf8").matchAll(/<script[^>]+src="([^"]+)"/g)) {
    if (!existsSync(src)) fail(`${page} loads missing script ${src}`);
  }
}
for (const [, src] of readFileSync("service-worker.js", "utf8").matchAll(/importScripts\("([^"]+)"\)/g)) {
  if (!existsSync(src)) fail(`service-worker.js imports missing script ${src}`);
}

// Syntax-check every script.
for (const file of ["shared.js", "i18n.js", "service-worker.js", "content-script.js", "popup.js", "options.js"]) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    fail(`Syntax error in ${file}:\n${error.stderr}`);
  }
}

if (process.exitCode) process.exit();
console.log("Harmony Media Saver package is valid.");
