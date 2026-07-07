# Daybreak for iOS

A native SwiftUI shell around the deployed web app
(https://daybreak-crmorrison.vercel.app). The web app provides all UI,
data, and sync; this wrapper adds a real home-screen app, offline
support, and native niceties.

## How it works

- `WebView.swift` hosts a `WKWebView` with
  `limitsNavigationsToAppBoundDomains` enabled and the app's domain
  listed under `WKAppBoundDomains` in Info.plist. That combination is
  what unlocks **service workers** inside a WKWebView — so the web
  app's offline cache works here exactly as it does in Safari, and your
  data (localStorage) persists inside the app's own container.
- Links that leave the app's domain open in the system browser.
- Pull down to refresh. If the very first load has no network, a native
  retry screen appears (after the first successful load, the app opens
  offline).
- Web content is debuggable from Safari → Develop menu
  (`isInspectable` is enabled).

## Run it on your iPhone

1. Open `ios/Daybreak.xcodeproj` in Xcode.
2. Target **Daybreak** → **Signing & Capabilities** → set **Team** to
   your Apple ID (add it under Xcode → Settings → Accounts if missing).
   A free personal team works.
3. Plug in your iPhone (enable Developer Mode on the phone if prompted:
   Settings → Privacy & Security → Developer Mode).
4. Select your iPhone as the run destination and press **Run**.
5. First launch only: on the phone, trust the developer certificate
   under Settings → General → VPN & Device Management.
6. In the app, link your data: **Set up sync** → paste your pairing
   code.

Free-account signing expires after 7 days — just press Run again to
re-install. A paid developer account ($99/yr) removes that limit and
enables TestFlight.

## Simulator

```bash
cd ios
xcodebuild -project Daybreak.xcodeproj -target Daybreak \
  -sdk iphonesimulator -configuration Debug build \
  SYMROOT=build CODE_SIGNING_ALLOWED=NO
xcrun simctl boot "iPhone 16 Pro"
xcrun simctl install booted build/Debug-iphonesimulator/Daybreak.app
xcrun simctl launch booted com.caseyrmorrison.daybreak
```

## If the web app moves

The URL lives in two places: `appURL` in `ContentView.swift` and
`WKAppBoundDomains` in `Info.plist`. Change both.
