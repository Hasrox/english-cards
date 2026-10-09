# English Cards

Offline English vocabulary app for a child. It runs as a web app and as an Android WebView app. The deck, pictures, and progress stay on the device.

App id `me.englishcards.app`. Version 0.66.

## Features

- Word groups with pictures
- Learn: see a new word, match it, spell it, then type it before it enters review
- Scheduled review
- Games: Match, Letters, and Connect
- Island map
- Picture search inside the app, and photos from the phone
- Sounds and speech

## Build

Needs Node.js.

```bash
npm install
npm run dev
```

Dev server: http://localhost:8080

```bash
npm run build
npm test
```

## Android APK

Needs JDK 17 and Android SDK 35.

```bash
npm run build
npm run preview
node scripts/sync-android.mjs
node scripts/build-apk.mjs
```

`build-apk.mjs` writes `English-Cards.apk` in the project root. That file is not in git.

`android/local.properties` and `android/app/debug.keystore` stay on this machine. The keystore is the signing key, so the next installer updates the same app and keeps the saved deck.
