# Physical.DeformZ for Android (APK)

The game is one HTML file (`../Physical.DeformZ.html`) with everything inside it: three.js, the car
models and the textures. Nothing is fetched at run time except the menu fonts, and the app build bundles
those too, so the APK works offline.

This folder wraps that file in a [Capacitor](https://capacitorjs.com) app: an Android WebView (the same
Chrome engine as the browser) that is full screen, landscape and keeps the screen on.

## Ways to get the APK

### 1. GitHub Actions (nothing to install)

`.github/workflows/apk.yml` builds the APK on GitHub's servers every time the game or this folder
changes, or by hand: **Actions → Android APK → Run workflow**. When the run finishes, download
**Physical.DeformZ-apk** from the run's Artifacts. It contains `app-debug.apk`; copy it to the phone and
open it (allow installing from this source when Android asks).

### 2. On your computer

Needs Node.js 20+, JDK 21 and the Android SDK (Android Studio installs the SDK).

```sh
cd apk
npm install
npm run android:add   # once: creates android/ and sets landscape, full screen, screen on
npm run apk:debug     # → android/app/build/outputs/apk/debug/app-debug.apk
```

After changing the game, run `npm run apk:debug` again (it copies the new HTML in).
`npx cap open android` opens the project in Android Studio, for a signed release build
(**Build → Generate Signed App Bundle / APK**) or to run it on a connected phone.

### 3. Any other HTML-to-APK tool

The page works in any Android WebView wrapper. Turn on JavaScript, DOM storage (saves the settings and
garage), hardware acceleration and full screen; set the orientation to landscape. The Android back
button works in every wrapper: it closes the open menu or pauses the drive, and from the main menu a
second press leaves the game.

## What the app adds over the browser

- Full screen with the system bars hidden (swipe from the edge to show them for a moment).
- Landscape, either way up.
- The screen stays on while you drive.
- Back button: closes menus, pauses the drive; a second press in the main menu exits.
- Offline: the fonts are copied into the app.

The frame rate inside the app is about the same as in Chrome, because the app runs the same engine. The
app helps by using the whole screen with no browser bars. The game itself does the rest: it lowers the
3D resolution when the phone can't keep up and upscales the image sharply.
