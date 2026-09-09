const enabledEl = document.getElementById("enabled");
const warnEl = document.getElementById("warn");
const openOptionsEl = document.getElementById("openOptions");

async function load() {
  const s = await chrome.storage.local.get(["enabled", "apiKey"]);
  enabledEl.checked = s.enabled !== false;
  warnEl.style.display = s.apiKey ? "none" : "block";
}

enabledEl.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: enabledEl.checked });
});

openOptionsEl.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

load();
