const test = require("node:test");
const assert = require("node:assert/strict");
const shared = require("../shared.js");

const settings = (overrides = {}) => shared.normalizeSettings(overrides);

test("classify uses content type before extension", () => {
  assert.equal(shared.classify("https://x.test/a.mp4", ""), "video");
  assert.equal(shared.classify("https://x.test/a.mp3?sig=1", ""), "audio");
  assert.equal(shared.classify("https://x.test/stream?id=4", "audio/mpeg"), "audio");
  assert.equal(shared.classify("https://x.test/stream?id=4", "video/mp4; codecs=avc1"), "video");
  assert.equal(shared.classify("https://x.test/master.m3u8", ""), "playlist");
  assert.equal(shared.classify("https://x.test/x", "application/vnd.apple.mpegurl"), "playlist");
  assert.equal(shared.classify("https://x.test/page.html", "text/html"), "unknown");
});

test("blocklist is checked against the page and initiator, not just the media host", () => {
  const s = settings();
  // YouTube media comes from googlevideo.com.
  assert.equal(shared.isAllowed(["https://rr1.googlevideo.com/videoplayback?x"], s), false);
  // Media on a neutral CDN, but the tab is youtube.com.
  assert.equal(
    shared.isAllowed(["https://cdn.example.net/a.mp4", "https://www.youtube.com/watch?v=1"], s),
    false
  );
  // Embedded YouTube player on a school page (initiator is the embed).
  assert.equal(
    shared.isAllowed(
      ["https://cdn.example.net/a.mp4", "https://www.youtube-nocookie.com", "https://lms.school.edu.ng/course"],
      s
    ),
    false
  );
  assert.equal(shared.isAllowed(["https://lms.school.edu.ng/a.mp4"], s), true);
});

test("allowlist needs one matching host and still honours the blocklist", () => {
  const s = settings({ allowlistHosts: ["https://learn.school.edu.ng/"] });
  assert.equal(
    shared.isAllowed(["https://cdn.example.net/a.mp4", "https://learn.school.edu.ng/course/1"], s),
    true
  );
  assert.equal(shared.isAllowed(["https://other.org/a.mp4"], s), false);
  assert.equal(
    shared.isAllowed(["https://learn.school.edu.ng/a.mp4", "https://www.youtube.com"], s),
    false
  );
});

test("hostMatches covers subdomains but not lookalikes", () => {
  assert.equal(shared.hostMatches("m.youtube.com", "youtube.com"), true);
  assert.equal(shared.hostMatches("youtube.com", "*.youtube.com"), true);
  assert.equal(shared.hostMatches("notyoutube.com", "youtube.com"), false);
});

test("totalSizeFromHeaders prefers the Content-Range total", () => {
  assert.equal(shared.totalSizeFromHeaders("bytes 0-1023/419430400", "1024", 206), 419430400);
  assert.equal(shared.totalSizeFromHeaders("bytes 0-1023/*", "1024", 206), 0);
  assert.equal(shared.totalSizeFromHeaders("", "5000", 200), 5000);
  assert.equal(shared.totalSizeFromHeaders("", "", 200), 0);
});

test("filenames get an extension from the content type", () => {
  assert.equal(shared.filenameFromUrl("https://x.test/stream?id=42", "video/mp4"), "stream.mp4");
  assert.equal(shared.filenameFromUrl("https://x.test/", "audio/mpeg"), "media-download.mp3");
  assert.equal(shared.filenameFromUrl("https://x.test/Week%201%20Lecture.mp4", ""), "Week 1 Lecture.mp4");
  assert.equal(shared.withExtension("lecture", "video/webm"), "lecture.webm");
  assert.equal(shared.withExtension("lecture.mp4", "video/webm"), "lecture.mp4");
});

test("Content-Disposition filenames are parsed", () => {
  assert.equal(shared.filenameFromContentDisposition('attachment; filename="Lecture 3.mp4"'), "Lecture 3.mp4");
  assert.equal(
    shared.filenameFromContentDisposition("attachment; filename*=UTF-8''Le%C3%A7on%201.mp3"),
    "Leçon 1.mp3"
  );
  assert.equal(shared.filenameFromContentDisposition("inline"), "");
});

test("sanitizeFilename blocks traversal and reserved names", () => {
  assert.equal(shared.sanitizeFilename("../../etc/passwd"), "passwd");
  assert.equal(shared.sanitizeFilename("a<b>:c?.mp4"), "a_b__c_.mp4");
  assert.equal(shared.sanitizeFilename("..."), "media-download");
  assert.equal(shared.sanitizeFilename("CON.mp4"), "_CON.mp4");
  assert.equal(shared.sanitizeFilename("clip.mp4. "), "clip.mp4");
});

test("normalizeSettings clamps and cleans input", () => {
  const s = shared.normalizeSettings({
    maxCandidates: 5000,
    folderName: "  ",
    blockedHosts: ["https://Example.com/path", "example.com", "", "*.foo.org"],
    allowlistHosts: "not-an-array",
    saveAs: "yes"
  });
  assert.equal(s.maxCandidates, 100);
  assert.equal(s.folderName, "HarmonyMedia");
  assert.deepEqual(s.blockedHosts, ["example.com", "foo.org"]);
  assert.deepEqual(s.allowlistHosts, []);
  assert.equal(s.saveAs, true);
  assert.equal(shared.normalizeSettings({ maxCandidates: 1 }).maxCandidates, 5);
});

test("context menu link patterns only target media files", () => {
  const patterns = shared.mediaLinkPatterns();
  assert.ok(patterns.includes("*://*/*.mp4*"));
  assert.ok(patterns.every((pattern) => !pattern.includes(".html")));
});

test("escapeHtml escapes markup", () => {
  assert.equal(shared.escapeHtml(`<img src=x onerror='a'>&"`), "&lt;img src=x onerror=&#39;a&#39;&gt;&amp;&quot;");
});
