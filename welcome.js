const { resolveLanguage, translator, applyTranslations } = globalThis.HarmonyI18n;

document.querySelector("#settingsButton").addEventListener("click", () => chrome.runtime.openOptionsPage());

(async () => {
  let setting = "auto";
  try {
    const result = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    setting = result?.settings?.language || "auto";
  } catch {
    /* English */
  }
  const language = resolveLanguage(setting, navigator.language);
  document.documentElement.lang = language;
  const t = translator(language);
  applyTranslations(document, t);
  document.title = t("welcomeTitle");
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
})();
