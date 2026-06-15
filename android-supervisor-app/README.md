# Flex HRM Supervisor — Android App

Lightweight native Android shell for the **Flex HRM Field Team** supervisor portal. The app wraps the existing supervisor web app in a WebView and adds native capabilities required for field work.

## Features (same as supervisor web login)

| Feature | How it works |
|---------|----------------|
| Login (phone + password) | Loads `/supervisor/login` |
| Device registration & OTP | Native Android device ID via `FlexHrmAndroid.getDeviceId()` |
| Schools dashboard | Web UI at `/supervisor` |
| Log visits (GPS + camera photos) | WebView camera + geolocation permissions |
| Calendar & commitments | Web UI at `/supervisor/calendar` |
| Visit history | Web UI at `/supervisor/history` |
| Requests & notifications | Web UI at `/supervisor/requests` |
| Profile & language (EN/HI) | Web UI at `/supervisor/profile` |

The Android app does **not** duplicate business logic — it hosts the production PWA and provides the native bridge the web app already expects.

## Requirements

- Android Studio Ladybug (2024.2+) or JDK 17 + Android SDK 35
- `ANDROID_HOME` set (or install SDK via Android Studio)

## Build APK

```bash
cd frontend/android-supervisor-app

# Generate wrapper (first time only, if gradlew is missing)
gradle wrapper

# Debug APK (~5 MB)
./gradlew assembleDebug

# Release APK (unsigned)
./gradlew assembleRelease
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

Install on a device:

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Open in Android Studio

1. **File → Open** → select `frontend/android-supervisor-app`
2. Let Gradle sync
3. Run on a device or emulator

## Configuration

Change the loaded URL in `app/build.gradle`:

```gradle
buildConfigField 'String', 'SUPERVISOR_URL',
    '"https://your-frontend-host.com/supervisor/login"'
```

For local development against `npm run dev`:

```gradle
buildConfigField 'String', 'SUPERVISOR_URL',
    '"http://10.0.2.2:3000/supervisor/login"'  // emulator → host machine
```

Also update `SUPERVISOR_HOST` in `MainActivity.java` if you use a custom domain (keeps navigation inside the WebView).

## Native bridge (`window.FlexHrmAndroid`)

| Method | Purpose |
|--------|---------|
| `getDeviceId()` | Stable Android ID for device binding |
| `getBuildNumber()` | Device build string for display name |

## Permissions

- **Internet** — load supervisor portal
- **Camera** — visit photos & profile photo
- **Location** — GPS-stamped visits

## Architecture

```
┌─────────────────────────────┐
│  Android WebView Shell      │
│  MainActivity + Bridge      │
└──────────────┬──────────────┘
               │ loads
               ▼
┌─────────────────────────────┐
│  Supervisor PWA (React)     │
│  /supervisor/* routes       │
└──────────────┬──────────────┘
               │ API calls
               ▼
┌─────────────────────────────┐
│  NestJS Backend             │
│  /api/auth/supervisor/*     │
└─────────────────────────────┘
```

## Notes

- APK size is small because UI lives on the server (online-only).
- Clearing app data resets WebView `localStorage` but device ID comes from Android ID when using this app.
- For Play Store distribution, sign the release APK and review `QUERY_ALL_PACKAGES` policy (may need justification for enterprise/internal use).
