## TTRPG Roll20 Chat Bridge

Temporary Firefox extension that runs on `https://app.roll20.net/editor/*`, opens a
WebSocket to the local backend, and forwards incoming chat jobs into the Roll20 chat UI.

### Load Temporarily In Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on`
3. Select [manifest.json](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/firefox_extension/manifest.json)

### Backend Socket

The content script connects to:

`ws://127.0.0.1:6767/ws/chat`

If you change the backend host or port, update
[roll20-chat-bridge.js](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/firefox_extension/content/roll20-chat-bridge.js).
