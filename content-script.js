const MEDIA_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv|avi|mp3|m4a|aac|wav|ogg|flac)(?:$|[?#])/i;
const PLAYLIST_EXT = /\.(m3u8|mpd)(?:$|[?#])/i;

function collect() {
  const found = [];
  const seen = new Set();

  const add = (rawUrl, contentType = "") => {
    if (!rawUrl) return;
    try {
      const parsed = new URL(rawUrl, location.href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
      if (seen.has(parsed.href)) return;
      seen.add(parsed.href);

      const filename = decodeURIComponent(parsed.pathname.split("/").pop() || "media-download");
      const kind = PLAYLIST_EXT.test(parsed.href)
        ? "playlist"
        : MEDIA_EXT.test(parsed.href)
          ? undefined
          : "video";

      found.push({
        url: parsed.href,
        filename,
        contentType,
        kind
      });
    } catch {
      /* ignore invalid URLs */
    }
  };

  document.querySelectorAll("video, audio").forEach((element) => {
    const hint = element.tagName === "AUDIO" ? "audio/*" : "video/*";
    add(element.currentSrc || element.src, hint);
    element.querySelectorAll("source[src]").forEach((source) => {
      add(source.src, source.type || hint);
    });
  });

  return found;
}

let timer = 0;
function report() {
  const candidates = collect();
  if (!candidates.length) return;
  chrome.runtime.sendMessage({ type: "PAGE_CANDIDATES", candidates }).catch(() => {});
}

function scheduleReport() {
  clearTimeout(timer);
  timer = setTimeout(report, 400);
}

report();
const observer = new MutationObserver(scheduleReport);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src"]
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SCAN_PAGE") {
    sendResponse({ candidates: collect() });
  }
});
