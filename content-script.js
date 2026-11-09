// Runs in every frame and reports the media URLs that page players expose.
(() => {
  function collect() {
    const found = [];
    const seen = new Set();

    const add = (rawUrl, contentType, fallbackKind) => {
      if (!rawUrl) return;
      try {
        const parsed = new URL(rawUrl, location.href);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
        if (seen.has(parsed.href)) return;
        seen.add(parsed.href);

        let filename = parsed.pathname.split("/").pop() || "";
        try {
          filename = decodeURIComponent(filename);
        } catch {
          /* keep the raw name */
        }

        found.push({
          url: parsed.href,
          filename: filename || "media-download",
          contentType,
          // Used only when neither the type attribute nor the URL extension
          // tells the service worker what the file is.
          kind: fallbackKind
        });
      } catch {
        /* ignore invalid URLs */
      }
    };

    document.querySelectorAll("video, audio").forEach((element) => {
      const kind = element.tagName === "AUDIO" ? "audio" : "video";
      add(element.currentSrc || element.src, "", kind);
      element.querySelectorAll("source[src]").forEach((source) => {
        add(source.src, source.type || "", kind);
      });
    });

    return found;
  }

  function report() {
    const candidates = collect();
    if (!candidates.length) return Promise.resolve();
    return chrome.runtime.sendMessage({ type: "PAGE_CANDIDATES", candidates }).catch(() => {});
  }

  let timer = 0;
  function scheduleReport() {
    clearTimeout(timer);
    timer = setTimeout(report, 400);
  }

  report();
  new MutationObserver(scheduleReport).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"]
  });

  // Players often set the source only when playback starts.
  document.addEventListener("loadedmetadata", scheduleReport, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "SCAN_PAGE") return false;
    report().then(() => sendResponse({ ok: true }));
    return true;
  });
})();
