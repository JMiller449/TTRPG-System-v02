(function () {
  const BACKEND_WS_URL = "ws://127.0.0.1:6767/ws/chat";
  const SERVICE_AUTH_CODE = "change-me-service-code";
  const CHAT_INPUT_SELECTOR = 'textarea[title="Text Chat Input"]';
  const SEND_BUTTON_SELECTOR = "#chatSendBtn";
  const RECONNECT_DELAY_MS = 3000;

  let socket = null;
  let reconnectTimer = null;
  let isAuthenticated = false;

  function log(message, extra) {
    if (extra === undefined) {
      console.log(`[ttrpg-roll20-bridge] ${message}`);
      return;
    }
    console.log(`[ttrpg-roll20-bridge] ${message}`, extra);
  }

  function findChatInput() {
    return document.querySelector(CHAT_INPUT_SELECTOR);
  }

  function findSendButton() {
    return document.querySelector(SEND_BUTTON_SELECTOR);
  }

  async function waitForElement(getter, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const element = getter();
      if (element) {
        return element;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return null;
  }

  async function sendChatMessage(message) {
    const chatInput = await waitForElement(findChatInput);
    const sendButton = await waitForElement(findSendButton);

    if (!chatInput || !sendButton) {
      throw new Error("Roll20 chat input or send button was not found.");
    }

    chatInput.focus();
    chatInput.value = message;
    chatInput.dispatchEvent(new Event("input", { bubbles: true }));
    chatInput.dispatchEvent(new Event("change", { bubbles: true }));
    sendButton.click();
  }

  function scheduleReconnect() {
    if (reconnectTimer !== null) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, RECONNECT_DELAY_MS);
  }

  function handleMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      log("Received non-JSON payload", event.data);
      return;
    }

    if (payload.type === "authenticate_response") {
      if (payload.authenticated === true) {
        isAuthenticated = true;
        log(`Authenticated as ${payload.role}`);
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "hello",
            source: "roll20_firefox_extension",
            page_url: window.location.href
          }));
        }
        return;
      }

      log("Backend rejected bridge authentication", payload);
      if (socket) {
        socket.close();
      }
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    if (!payload || payload.type !== "chat_message" || typeof payload.message !== "string") {
      return;
    }

    sendChatMessage(payload.message)
      .then(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "chat_delivery",
            message_id: payload.message_id,
            success: true
          }));
        }
      })
      .catch((error) => {
        log("Failed to send chat message", error);
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "chat_delivery",
            message_id: payload.message_id,
            success: false,
            error: String(error)
          }));
        }
      });
  }

  function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    isAuthenticated = false;
    log(`Connecting to backend at ${BACKEND_WS_URL}`);
    socket = new WebSocket(BACKEND_WS_URL);

    socket.addEventListener("open", () => {
      log("Connected to backend chat socket");
      socket.send(JSON.stringify({
        type: "authenticate",
        token: SERVICE_AUTH_CODE
      }));
    });

    socket.addEventListener("message", handleMessage);

    socket.addEventListener("close", () => {
      log("Backend chat socket closed, scheduling reconnect");
      scheduleReconnect();
    });

    socket.addEventListener("error", (error) => {
      log("Backend chat socket error", error);
      if (socket) {
        socket.close();
      }
    });
  }

  connect();
})();
