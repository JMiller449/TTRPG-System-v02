// ==UserScript==
// @name        TTRPG Roll20 Chat Bridge
// @namespace   https://bossadapt.org/ttrpg
// @version     1.1.0
// @description Delivers TTRPG backend messages into Roll20 chat.
// @match       https://bossadapt.org/ttrpg/*
// @match       https://app.roll20.net/editor
// @match       https://app.roll20.net/editor/*
// @include     http://127.0.0.1:5173/*
// @include     http://localhost:5173/*
// @run-at      document-idle
// @inject-into content
// @noframes
// @grant       GM_getValues
// @grant       GM_setValues
// @grant       GM_addValueChangeListener
// @downloadURL https://bossadapt.org/ttrpg/roll20-bridge.user.js
// ==/UserScript==

(function () {
  "use strict";

  const SCRIPT_VERSION = "1.1.0";
  const CHANNEL = "ttrpg-roll20-bridge";
  const REQUEST_EVENT = `${CHANNEL}:request`;
  const RESPONSE_EVENT = `${CHANNEL}:response`;
  const CONFIG_KEY = "bridgeConfig";
  const CHAT_INPUT_SELECTOR = 'textarea[title="Text Chat Input"]';
  const SEND_BUTTON_SELECTOR = "#chatSendBtn";
  const RECONNECT_DELAY_MS = 3000;
  const AUTH_REJECTED_CLOSE_CODE = 1008;
  const BRIDGE_REPLACED_CLOSE_CODE = 4001;

  function log(message) {
    console.log(`[ttrpg-roll20-bridge] ${message}`);
  }

  function isFrontendPage(location) {
    if (
      location.protocol === "https:" &&
      location.hostname === "bossadapt.org" &&
      (location.pathname === "/ttrpg" ||
        location.pathname.startsWith("/ttrpg/"))
    ) {
      return true;
    }

    return (
      location.protocol === "http:" &&
      (location.hostname === "127.0.0.1" ||
        location.hostname === "localhost") &&
      location.port === "5173"
    );
  }

  function isRoll20Page(location) {
    return (
      location.protocol === "https:" &&
      location.hostname === "app.roll20.net" &&
      (location.pathname === "/editor" ||
        location.pathname.startsWith("/editor/"))
    );
  }

  function parseBridgeEndpoint(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("missing_endpoint");
    }

    const endpoint = new URL(value.trim());
    const isLoopback =
      endpoint.hostname === "127.0.0.1" || endpoint.hostname === "localhost";
    if (
      endpoint.protocol !== "wss:" &&
      !(endpoint.protocol === "ws:" && isLoopback)
    ) {
      throw new Error("insecure_endpoint");
    }
    if (
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      !endpoint.pathname.endsWith("/ws/chat")
    ) {
      throw new Error("invalid_endpoint");
    }

    return {
      endpoint: endpoint.toString(),
      environment: isLoopback ? "development" : "production",
    };
  }

  function normalizeConfig(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    let parsed;
    try {
      parsed = parseBridgeEndpoint(value.endpoint);
    } catch (_error) {
      return null;
    }
    const authToken =
      typeof value.authToken === "string"
        ? value.authToken.trim()
        : typeof value.serviceAuthCode === "string"
          ? value.serviceAuthCode.trim()
          : "";
    const bindingKey =
      typeof value.bindingKey === "string" && value.bindingKey.trim()
        ? value.bindingKey.trim()
        : value.serviceAuthCode
          ? "dm"
          : "";
    const bindingLabel =
      typeof value.bindingLabel === "string" && value.bindingLabel.trim()
        ? value.bindingLabel.trim()
        : bindingKey === "dm"
          ? "DM"
          : "";
    if (!authToken || !bindingKey || !bindingLabel) {
      return null;
    }

    return {
      endpoint: parsed.endpoint,
      environment: parsed.environment,
      authToken,
      bindingKey,
      bindingLabel,
    };
  }

  async function readConfig() {
    const values = await GM_getValues({ [CONFIG_KEY]: null });
    return normalizeConfig(values[CONFIG_KEY]);
  }

  function postToPage(payload) {
    const message = { channel: CHANNEL, ...payload };
    document.dispatchEvent(
      new CustomEvent(RESPONSE_EVENT, {
        detail: JSON.stringify(message),
      }),
    );
    // Keep postMessage for compatibility with frontend version 1.0.0.
    window.postMessage(message, window.location.origin);
  }

  async function startFrontendSync() {
    let activeNonce = null;
    const handledRequests = new Set();

    async function handleRequest(payload) {
      if (
        !payload ||
        payload.channel !== CHANNEL ||
        typeof payload.nonce !== "string"
      ) {
        return;
      }
      const requestKey = `${payload.type}:${payload.nonce}`;
      if (handledRequests.has(requestKey)) {
        return;
      }
      handledRequests.add(requestKey);

      if (payload.type === "discover") {
        activeNonce = payload.nonce;
        const config = await readConfig();
        postToPage({
          type: "discovered",
          nonce: payload.nonce,
          version: SCRIPT_VERSION,
          synchronized: config !== null,
          environment: config ? config.environment : null,
          endpoint: config ? config.endpoint : null,
          bindingKey: config ? config.bindingKey : null,
          bindingLabel: config ? config.bindingLabel : null,
        });
        return;
      }

      if (payload.type !== "sync" || payload.nonce !== activeNonce) {
        return;
      }

      try {
        const parsed = parseBridgeEndpoint(payload.endpoint);
        if (
          payload.environment !== parsed.environment ||
          typeof payload.bridgeAuthToken !== "string" ||
          !payload.bridgeAuthToken.trim() ||
          typeof payload.bindingKey !== "string" ||
          !payload.bindingKey.trim() ||
          typeof payload.bindingLabel !== "string" ||
          !payload.bindingLabel.trim()
        ) {
          throw new Error("invalid_sync_payload");
        }

        const config = {
          endpoint: parsed.endpoint,
          environment: parsed.environment,
          authToken: payload.bridgeAuthToken.trim(),
          bindingKey: payload.bindingKey.trim(),
          bindingLabel: payload.bindingLabel.trim(),
        };
        await GM_setValues({ [CONFIG_KEY]: config });
        activeNonce = null;
        postToPage({
          type: "synced",
          nonce: payload.nonce,
          version: SCRIPT_VERSION,
          synchronized: true,
          environment: config.environment,
          endpoint: config.endpoint,
          bindingKey: config.bindingKey,
          bindingLabel: config.bindingLabel,
        });
      } catch (_error) {
        activeNonce = null;
        postToPage({
          type: "sync_failed",
          nonce: payload.nonce,
          reason: "invalid_configuration",
        });
      }
    }

    document.addEventListener(REQUEST_EVENT, (event) => {
      if (typeof event.detail !== "string") {
        return;
      }
      try {
        void handleRequest(JSON.parse(event.detail));
      } catch (_error) {
        // Ignore malformed same-page bridge events.
      }
    });

    window.addEventListener("message", (event) => {
      if (
        event.origin !== window.location.origin ||
        (event.source !== window && event.source !== null)
      ) {
        return;
      }
      void handleRequest(event.data);
    });
  }

  function bridgeFailure(reason) {
    const error = new Error(reason);
    error.bridgeReason = reason;
    return error;
  }

  async function waitForElement(selector, timeoutMs = 10000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return null;
  }

  async function sendChatMessage(message, isCurrent = () => true) {
    const chatInput = await waitForElement(CHAT_INPUT_SELECTOR);
    const sendButton = await waitForElement(SEND_BUTTON_SELECTOR);
    if (!chatInput || !sendButton) {
      throw bridgeFailure("chat_ui_not_found");
    }
    if (!isCurrent()) {
      return false;
    }

    try {
      chatInput.focus();
      chatInput.value = message;
      chatInput.dispatchEvent(new Event("input", { bubbles: true }));
      chatInput.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_error) {
      throw bridgeFailure("chat_input_failed");
    }

    try {
      if (!isCurrent()) {
        return false;
      }
      sendButton.click();
    } catch (_error) {
      throw bridgeFailure("chat_submit_failed");
    }
    return true;
  }

  async function startRoll20Bridge() {
    let config = await readConfig();
    let socket = null;
    let reconnectTimer = null;
    let authenticated = false;
    let terminalUntilConfigChange = false;
    let socketGeneration = 0;
    let deliveryQueue = Promise.resolve();

    function clearReconnectTimer() {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function scheduleReconnect() {
      if (reconnectTimer !== null || terminalUntilConfigChange || !config) {
        return;
      }
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, RECONNECT_DELAY_MS);
    }

    function sendDelivery(targetSocket, payload, success, reason) {
      if (targetSocket.readyState !== WebSocket.OPEN) {
        return;
      }
      targetSocket.send(
        JSON.stringify({
          type: "chat_delivery",
          message_id: payload.message_id,
          success,
          ...(reason ? { reason } : {}),
        }),
      );
    }

    function queueDelivery(targetSocket, payload, generation) {
      deliveryQueue = deliveryQueue.then(async () => {
        const isCurrent = () =>
          generation === socketGeneration &&
          targetSocket === socket &&
          authenticated;
        if (!isCurrent()) {
          return;
        }
        try {
          const delivered = await sendChatMessage(payload.message, isCurrent);
          if (!delivered || !isCurrent()) {
            return;
          }
          sendDelivery(targetSocket, payload, true);
        } catch (error) {
          const reason =
            error && typeof error.bridgeReason === "string"
              ? error.bridgeReason
              : "unknown";
          log(`Failed to send Roll20 chat message (${reason})`);
          sendDelivery(targetSocket, payload, false, reason);
        }
      });
    }

    function connect() {
      if (!config || terminalUntilConfigChange) {
        return;
      }
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      authenticated = false;
      const generation = ++socketGeneration;
      let nextSocket;
      try {
        nextSocket = new WebSocket(config.endpoint);
      } catch (_error) {
        terminalUntilConfigChange = true;
        log(
          "Bridge configuration could not create a WebSocket; run Sync Bridge again",
        );
        return;
      }
      socket = nextSocket;
      log(`Connecting to ${config.environment} Roll20 bridge endpoint`);

      nextSocket.addEventListener("open", () => {
        if (generation !== socketGeneration) {
          return;
        }
        nextSocket.send(
          JSON.stringify({
            type: "authenticate",
            token: config.authToken,
          }),
        );
      });

      nextSocket.addEventListener("message", (event) => {
        if (generation !== socketGeneration) {
          return;
        }
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch (_error) {
          return;
        }

        if (payload.type === "authenticate_response") {
          if (payload.authenticated !== true) {
            terminalUntilConfigChange = true;
            log("Bridge authentication was rejected; run Sync Bridge again");
            nextSocket.close();
            return;
          }
          authenticated = true;
          nextSocket.send(
            JSON.stringify({
              type: "hello",
              source: "roll20_violentmonkey_userscript",
            }),
          );
          return;
        }

        if (
          authenticated &&
          payload.type === "chat_message" &&
          typeof payload.message === "string" &&
          typeof payload.message_id === "string"
        ) {
          queueDelivery(nextSocket, payload, generation);
        }
      });

      nextSocket.addEventListener("close", (event) => {
        if (generation !== socketGeneration) {
          return;
        }
        socket = null;
        authenticated = false;
        if (
          event.code === AUTH_REJECTED_CLOSE_CODE ||
          event.code === BRIDGE_REPLACED_CLOSE_CODE ||
          event.reason === "bridge_replaced"
        ) {
          terminalUntilConfigChange = true;
          log(
            "Bridge connection stopped; run Sync Bridge to activate this tab again",
          );
          return;
        }
        scheduleReconnect();
      });

      nextSocket.addEventListener("error", () => {
        if (
          generation === socketGeneration &&
          nextSocket.readyState !== WebSocket.CLOSED
        ) {
          nextSocket.close();
        }
      });
    }

    async function applyConfig(value) {
      const nextConfig = normalizeConfig(value);
      clearReconnectTimer();
      terminalUntilConfigChange = false;
      config = nextConfig;
      socketGeneration += 1;
      const previousSocket = socket;
      socket = null;
      authenticated = false;
      if (previousSocket && previousSocket.readyState < WebSocket.CLOSING) {
        previousSocket.close();
      }
      if (config) {
        connect();
      } else {
        log("Bridge is not synchronized; use your Extension page");
      }
    }

    GM_addValueChangeListener(CONFIG_KEY, (_name, _oldValue, newValue) => {
      void applyConfig(newValue);
    });

    if (config) {
      connect();
    } else {
      log("Bridge is not synchronized; use your Extension page");
    }
  }

  if (isFrontendPage(window.location)) {
    void startFrontendSync();
  } else if (isRoll20Page(window.location)) {
    void startRoll20Bridge();
  }
})();
