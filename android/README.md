# Daybreak for Android

A native Kotlin shell around the deployed web app
(https://daybreak-crmorrison.vercel.app), mirroring the iOS app. The web
app provides all UI, data, and sync; this wrapper adds a real launcher
app, back-button handling, pull-to-refresh, and offline support.

## How it works

- `MainActivity.kt` hosts a `WebView` with JavaScript and DOM storage
  enabled. Android's WebView is Chromium, so **service workers work on
  https out of the box** — the web app's offline cache behaves exactly
  as in Chrome, and your data (localStorage) persists inside the app's
  own storage.
- Links leaving the app's domain open in the system browser.
- The system back gesture/button walks WebView history before exiting.
- Pull down to refresh. If the very first load has no network, a native
  retry screen appears (after the first successful load, the app opens
  offline).
- Edge-to-edge (targetSdk 35) with window-inset padding, so content
  never hides under the status bar and the bar area matches the app
  background.

## Run it

**Android Studio (recommended):** open the `android/` folder, let
Gradle sync, pick a device or emulator, press Run. First open may
prompt to use the Gradle wrapper — accept (it uses Gradle 8.14.3).

**Command line:**

```bash
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  gradle :app:assembleDebug        # or ./gradlew after Studio generates it
adb install app/build/outputs/apk/debug/app-debug.apk
```

**On your phone:** enable Developer options → USB debugging, plug in,
and it appears as a Run target in Studio. Debug builds install directly;
no signing setup needed until you want Play Store distribution.

In the app, link your data: **Set up sync** → paste your pairing code.

## If the web app moves

The URL lives in `MainActivity.kt` (`APP_URL` / `APP_HOST`). Change both
constants — and the equivalents in the iOS shell.
