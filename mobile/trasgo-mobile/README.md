# Trasgo Mobile

Minimal Expo wrapper for Trasgo on `iOS` and `Android`.

## What it does

- Exposes `Home / Quickstart`, `Demos`, `Tokens`, `Machines`, and `Status` tabs.
- Talks to a configurable local HTTP bridge.
- Falls back to preview data when the bridge is offline, so the app still launches cleanly.

## Run

```bash
cd mobile/trasgo-mobile
npm install
npm run start
```

Platform targets:

- `npm run android`
- `npm run ios`

## Bridge URL

Set the bridge in the app's `Status` tab or with `EXPO_PUBLIC_TRASGO_BRIDGE_URL`.

Useful defaults:

- iOS simulator: `http://127.0.0.1:8787`
- Android emulator: `http://10.0.2.2:8787`
- Physical device: your machine's LAN IP

## Expected bridge endpoints

- `GET /status`
- `GET /demos`
- `GET /machines`
- `POST /tokens`
- `POST /optimize`
- `POST /demo/run`
- `POST /machine/run`
