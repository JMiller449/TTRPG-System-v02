(function () {
  const DEFAULT_BACKEND_WS_URL = "ws://127.0.0.1:6767/ws/chat";
  const form = document.querySelector("#bridge-settings");
  const backendUrlInput = document.querySelector("#backend-ws-url");
  const serviceCodeInput = document.querySelector("#service-auth-code");
  const saveStatus = document.querySelector("#save-status");

  async function restoreSettings() {
    const settings = await browser.storage.local.get({
      backendWsUrl: DEFAULT_BACKEND_WS_URL,
      serviceAuthCode: "",
    });
    backendUrlInput.value = settings.backendWsUrl;
    serviceCodeInput.value = settings.serviceAuthCode;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await browser.storage.local.set({
      backendWsUrl: backendUrlInput.value.trim(),
      serviceAuthCode: serviceCodeInput.value.trim(),
    });
    saveStatus.textContent = "Saved. Reload the Roll20 tab to reconnect.";
  });

  void restoreSettings();
})();
