# Flex HRM Observer Admin — Android App

Lightweight native Android shell for the **Flex HRM Observer Admin** mobile portal. The app wraps the observer web UI in a WebView and adds native PDF sharing for reports.

## Features

| Feature | How it works |
|---------|----------------|
| Observer login | Loads `/observer/login` |
| Admin portal access | Web UI at `/observer/*` routes |
| Field Team views | Schools, visits, map (permission-based) |
| PDF reports | Native download, open, and share via `FlexHrmAndroid` bridge |

The Android app does **not** duplicate business logic — it hosts the production web bundle and provides native helpers the web app expects.

Unlike the Field Team APK, the Observer app does **not** include blocked-app scanning, location gates, or GPS/camera bridges.

## Requirements

- Android Studio Ladybug (2024.2+) or JDK 17 + Android SDK 35
- `ANDROID_HOME` set (or install SDK via Android Studio)

## Build APK

From the frontend root (recommended — bundles the latest web UI into the APK):

```bash
cd frontend
npm run build:android-observer-apk
```

Output APK is copied to `frontend/FlexHRM-ObserverAdmin-v<version>.apk` (version read from `app/build.gradle`).

Gradle-only build (uses whatever is already in `app/src/main/assets/www/`):

```bash
cd frontend/android-observer-app
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

Install on a device:

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Open in Android Studio

1. **File → Open** → select `frontend/android-observer-app`
2. Let Gradle sync
3. Run on a device or emulator

## Configuration

Entry URL and API hosts are set in `app/build.gradle`:

```gradle
buildConfigField 'String', 'OBSERVER_URL',
    '"https://appassets.androidplatform.net/observer/login"'
buildConfigField 'String', 'API_BASE',
    '"https://your-api-host.com/api"'
```

The production web bundle is copied into `app/src/main/assets/www/` by `npm run build:android-observer-apk` — do not edit those assets by hand.

## Native: Field Team APK

For the supervisor Field Team app, see [android-supervisor-app/README.md](../android-supervisor-app/README.md) and `npm run build:android-apk`.

## Native bridge (`window.FlexHrmAndroid`)

| Method | Purpose |
|--------|---------|
| `getApiBase()` | Returns configured API base URL |
| `downloadAndSharePdf(url, fileName)` | Download PDF and open Android share sheet |
| `openPdf(filePath)` | Open a downloaded PDF with a viewer app |

## Permissions

- **Internet** — load observer portal
- **Storage** — save PDFs for sharing

## Architecture

```
┌─────────────────────────────┐
│  Android WebView Shell      │
│  MainActivity + Bridge      │
└──────────────┬──────────────┘
               │ loads
               ▼
┌─────────────────────────────┐
│  Observer PWA (React)       │
│  /observer/* routes         │
└──────────────┬──────────────┘
               │ API calls
               ▼
┌─────────────────────────────┐
│  NestJS Backend             │
│  /api/* (session auth)      │
└─────────────────────────────┘
```

## Notes

- The APK bundles the production web UI for offline shell loading; API calls still require internet.
- `app/src/main/assets/www/` is regenerated on each `npm run build:android-observer-apk` and is gitignored.
- Version strings are synced from `app/build.gradle` into the web bundle at build time via `src/lib/native-app-version.ts`.
