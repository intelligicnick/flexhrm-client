# Flex HRM Desktop Agent

Windows-first Electron agent for employee activity monitoring (Flex HRM Connect).

## Features

- Monitor Key + Device Hash authentication
- Activity, idle, application, and website tracking
- Periodic screenshots (plan-dependent)
- Keyboard/mouse metrics (counts only — no key content)
- Offline queue with automatic sync
- Background operation after initial setup

## Setup

```bash
cd desktop-agent
npm install
npm run dev
```

## Registration Flow

1. Install and launch the agent
2. Enter **Server URL**, **Monitor Key**, and **Monitor Hash** (from Monitor → Employee Agents in FlexHRM admin)
3. Optionally set a device name
4. Accept consent
5. Agent registers and starts monitoring in the background

## Build Windows Installer

Native modules (`active-win`, `uiohook-napi`) ship prebuilt Windows binaries. On macOS, `npm run pack` downloads the Windows `active-win` binary automatically and skips cross-compilation.

**On macOS or Windows:**

```bash
npm ci
npm run pack
```

**Alternatively (CI):** push your changes and run the [Desktop Agent (Windows)](../.github/workflows/desktop-agent.yml) GitHub Action (`workflow_dispatch`), then download the `.exe` from the workflow artifacts.

Output: `release/FlexHRM-Connect-Setup-<version>.exe` (64-bit Windows)

## Install on another PC

1. Copy `FlexHRM-Connect-Setup-<version>.exe` to the Windows machine
2. Run the installer (if SmartScreen warns: **More info → Run anyway**)
3. Complete setup with Server URL, Monitor Key, and Monitor Hash

## Uninstall

Use **Settings → Apps → Flex HRM Connect → Uninstall**, or run the uninstaller from the Start Menu.
The installer automatically stops any running agent before install/uninstall, then opens setup when you click **Finish**.

## API Endpoints

- `POST /api/monitor/agent/register` — Public registration
- `POST /api/monitor/agent/heartbeat` — Device auth required
- `POST /api/monitor/agent/ingest` — Batch activity data
- `POST /api/monitor/agent/screenshot` — Screenshot upload

## Security

- Device auth via Bearer token + X-Device-Hash header
- Company key stored hashed on server (scrypt)
- No keystroke content captured or transmitted
- Screenshots compressed as JPEG

## Distribution

Installer builds are uploaded as GitHub Actions artifacts. For production rollout, download the latest `.exe` from the Desktop Agent workflow or a GitHub Release.
