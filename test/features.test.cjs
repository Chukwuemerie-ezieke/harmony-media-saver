const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const shared = require("../shared.js");
const i18n = require("../i18n.js");

const date = new Date(2026, 10, 9);
const info = {
  filename: "Week 3 Lecture.mp4",
  pageUrl: "https://www.learn.school.edu.ng/course/view.php?id=12",
  pageTitle: "Biology: SS2 / Term 1",
  kind: "video"
};

test("default template keeps today's behaviour", () => {
  assert.equal(shared.buildRelativePath("{filename}", info, date), "Week 3 Lecture.mp4");
});

test("templates build safe subfolders", () => {
  assert.equal(
    shared.buildRelativePath("{site}/{title}/{date} {name}", info, date),
    "learn.school.edu.ng/Biology_ SS2 - Term 1/2026-11-09 Week 3 Lecture.mp4"
  );
  assert.equal(shared.buildRelativePath("{kind}/{filename}", info, date), "video/Week 3 Lecture.mp4");
});

test("templates cannot escape the download folder", () => {
  assert.equal(shared.buildRelativePath("../../{filename}", info, date), "Week 3 Lecture.mp4");
  assert.equal(shared.buildRelativePath("/abs/./{filename}", info, date), "abs/Week 3 Lecture.mp4");
  assert.equal(
    shared.buildRelativePath("{title}", { ...info, pageTitle: "../../etc" }, date),
    "-..-etc.mp4"
  );
});

test("templates keep the extension and limit depth", () => {
  assert.equal(shared.buildRelativePath("{site}", info, date), "learn.school.edu.ng.mp4");
  assert.equal(shared.buildRelativePath("a/b/c/d/e/f/{filename}", info, date), "a/b/c/d/Week 3 Lecture.mp4");
  assert.equal(shared.buildRelativePath("{unknown}/{filename}", info, date), "{unknown}/Week 3 Lecture.mp4");
  assert.equal(shared.buildRelativePath("", info, date), "Week 3 Lecture.mp4");
  assert.equal(
    shared.buildRelativePath("{title}/{filename}", { filename: "a.mp3" }, date),
    "untitled/a.mp3"
  );
});

test("managed policy overrides settings and adds blocked hosts", () => {
  const { settings, managedKeys } = shared.mergeManaged(
    { folderName: "Mine", blockedHosts: ["mine.example"], saveAs: true },
    { folderName: "School", saveAs: false, blockedHosts: ["policy.example"], unknownKey: 1 }
  );
  assert.deepEqual(managedKeys.sort(), ["blockedHosts", "folderName", "saveAs"]);
  assert.equal(settings.folderName, "School");
  assert.equal(settings.saveAs, false);
  assert.deepEqual(settings.blockedHosts, ["policy.example", "mine.example"]);
  assert.deepEqual(shared.mergeManaged({}, undefined).managedKeys, []);
});

test("managed policy is validated like user settings", () => {
  const { settings } = shared.mergeManaged({}, { maxCandidates: 9999, language: "xx" });
  assert.equal(settings.maxCandidates, 100);
  assert.equal(settings.language, "auto");
});

test("settings round-trip through export and import", () => {
  const original = shared.normalizeSettings({
    folderName: "Lessons",
    filenameTemplate: "{site}/{filename}",
    language: "yo",
    allowlistHosts: ["learn.school.edu.ng"]
  });
  const file = JSON.stringify(shared.exportSettings(original, "1.2.0"));
  assert.deepEqual(shared.parseImportedSettings(file), original);
  // A bare settings object is accepted too, and unknown keys are dropped.
  const bare = shared.parseImportedSettings('{"saveAs": false, "evil": "x"}');
  assert.equal(bare.saveAs, false);
  assert.equal("evil" in bare, false);
});

test("bad import files are rejected", () => {
  assert.throws(() => shared.parseImportedSettings("not json"), /not valid JSON/);
  assert.throws(() => shared.parseImportedSettings("[1,2]"), /does not contain settings/);
  assert.throws(() => shared.parseImportedSettings('{"hello": 1}'), /Harmony Media Saver settings/);
});

test("every translation key exists in English and keeps its placeholders", () => {
  const en = i18n.STRINGS.en;
  const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join();
  for (const [lang, table] of Object.entries(i18n.STRINGS)) {
    for (const [key, text] of Object.entries(table)) {
      assert.ok(key in en, `${lang}.${key} has no English source`);
      assert.equal(placeholders(text), placeholders(en[key]), `${lang}.${key} placeholders differ`);
    }
  }
  for (const { code } of i18n.LANGUAGES) assert.ok(i18n.STRINGS[code], `${code} has no table`);
  assert.deepEqual(
    shared.LANGUAGE_CODES.filter((code) => code !== "auto").sort(),
    i18n.LANGUAGES.map((l) => l.code).sort()
  );
});

test("every data-i18n key used in the pages exists in English", () => {
  for (const page of ["popup.html", "options.html", "welcome.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", page), "utf8");
    for (const [, key] of html.matchAll(/data-i18n(?:-title|-aria-label)?="([^"]+)"/g)) {
      assert.ok(key in i18n.STRINGS.en, `${page} uses missing key ${key}`);
    }
  }
});

test("translator falls back to English and fills placeholders", () => {
  const t = i18n.translator("ha");
  assert.equal(t("foundMany", { count: 3 }), "An sami fayiloli 3 da za a iya saukewa.");
  assert.equal(i18n.translator("xx")("scan"), i18n.STRINGS.en.scan);
  assert.equal(t("noSuchKey"), "noSuchKey");
  assert.equal(i18n.resolveLanguage("auto", "yo-NG"), "yo");
  assert.equal(i18n.resolveLanguage("auto", "fr-FR"), "en");
  assert.equal(i18n.resolveLanguage("pcm", "en-US"), "pcm");
});

test("managed schema covers every setting", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "managed_schema.json"), "utf8"));
  assert.deepEqual(Object.keys(schema.properties).sort(), [...shared.SETTING_KEYS].sort());
});

test("every language translates every key", () => {
  const keys = Object.keys(i18n.STRINGS.en);
  for (const [lang, table] of Object.entries(i18n.STRINGS)) {
    const missing = keys.filter((key) => !(key in table));
    assert.deepEqual(missing, [], `${lang} is missing ${missing.join(", ")}`);
  }
});

test("large-file limit is clamped and can be turned off", () => {
  assert.equal(shared.normalizeSettings({}).largeFileWarningMB, 500);
  assert.equal(shared.normalizeSettings({ largeFileWarningMB: -5 }).largeFileWarningMB, 0);
  assert.equal(shared.normalizeSettings({ largeFileWarningMB: "abc" }).largeFileWarningMB, 500);
  assert.equal(shared.normalizeSettings({ largeFileWarningMB: 1e9 }).largeFileWarningMB, 100000);
  assert.equal(shared.largeFileLimit({ largeFileWarningMB: 500 }), 500 * 1024 * 1024);
  assert.equal(shared.largeFileLimit({ largeFileWarningMB: 0 }), 0);
});

test("formatBytes", () => {
  assert.equal(shared.formatBytes(0), "");
  assert.equal(shared.formatBytes(512), "512 B");
  assert.equal(shared.formatBytes(1536), "1.5 KB");
  assert.equal(shared.formatBytes(1610612736), "1.5 GB");
});
