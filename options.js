const form = document.querySelector("#settingsForm");
const saveStatus = document.querySelector("#saveStatus");
const historyList = document.querySelector("#historyList");
let defaults = null;

function lines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fillForm(settings) {
  form.folderName.value = settings.folderName;
  form.saveAs.checked = Boolean(settings.saveAs);
  form.showPlaylists.checked = Boolean(settings.showPlaylists);
  form.maxCandidates.value = settings.maxCandidates;
  form.blockedHosts.value = (settings.blockedHosts || []).join("\n");
  form.allowlistHosts.value = (settings.allowlistHosts || []).join("\n");
}

async function loadSettings() {
  const result = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  defaults = result.defaults;
  fillForm(result.settings);
}

async function loadHistory() {
  const result = await chrome.runtime.sendMessage({ type: "GET_HISTORY" });
  const history = result.history || [];
  historyList.innerHTML = history.length
    ? history
        .map((item) => {
          const when = new Date(item.downloadedAt).toLocaleString();
          return `<li><strong>${item.filename}</strong> · ${when}<br />${item.url}</li>`;
        })
        .join("")
    : "<li>No local history yet.</li>";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    settings: {
      folderName: form.folderName.value,
      saveAs: form.saveAs.checked,
      showPlaylists: form.showPlaylists.checked,
      maxCandidates: Number(form.maxCandidates.value || 50),
      blockedHosts: lines(form.blockedHosts.value),
      allowlistHosts: lines(form.allowlistHosts.value)
    }
  });
  if (result?.ok) {
    fillForm(result.settings);
    saveStatus.textContent = "Settings saved on this device.";
  } else {
    saveStatus.textContent = result?.error || "Could not save settings.";
  }
});

document.querySelector("#resetButton").addEventListener("click", () => {
  if (defaults) fillForm(defaults);
});

document.querySelector("#clearHistoryButton").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" });
  await loadHistory();
});

loadSettings();
loadHistory();
