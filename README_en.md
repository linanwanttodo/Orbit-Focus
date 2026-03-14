<div align="center">
  <img src="assets/icon.png" alt="Orbit Focus Logo" width="128" height="128">
  <h1>Orbit Focus</h1>
  <p><strong>A cross-platform desktop Pomodoro timer built for geeks and developers</strong></p>

  <p>
    <a href="README.md">简体中文</a> |
    <a href="README_en.md">English</a> |
    <a href="README_ru.md">Русский</a>
  </p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/Electron-39.2.7-47848F?style=flat-square&logo=electron" alt="Electron">
    <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express" alt="Express">
    <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite" alt="SQLite">
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="MIT License">
  </p>
</div>

---

## Introduction

Orbit Focus is a full-stack cross-platform Pomodoro application built on modern web technologies (React + Electron). It not only provides core time management and task planning capabilities but also deeply integrates with developer workflows (such as code typing practice, WakaTime data synchronization) to deliver ultimate focus and productivity for programmers.

## Interface Preview

| ![Main Clock](assets/screenshots/01_main_clock.png) | ![Timer Mode](assets/screenshots/02_timer_mode.png) |
|:---:|:---:|
| Main Interface / Clock | Focus Timer |

| ![Code Time Dashboard](assets/screenshots/03_code_time_dashboard.png) | ![Typing Practice](assets/screenshots/04_code_typing_practice.png) |
|:---:|:---:|
| Coding Dashboard | Code Typing Speed Test |

| ![Statistics Heatmap](assets/screenshots/05_statistics_heatmap.png) | ![Settings Panel](assets/screenshots/06_settings_panel.png) |
|:---:|:---:|
| Focus Heatmap | Preferences |

| ![Focus Mode](assets/screenshots/07_timer_focus.png) |
|:---:|
| Task Management / Todo List |


## Core Features

- **Professional Time Management**: Supports standard Pomodoro technique (Focus, Short Break, Long Break) and stopwatch mode.
- **Lightweight Task Tracking**: Built-in to-do list with CRUD operations, ensuring a clear goal for every focus session.
- **In-depth Statistics**: Visualizes daily and weekly focus duration and distribution.
- **Internationalization**: Native support for English, Chinese, and Russian with seamless switching.
- **Local-first Architecture**: All data is securely stored locally via SQLite to protect your privacy.
- **Geek-exclusive Features**: Unique code typing speed test (CodeTypingView) to improve muscle memory.
- **Extensibility & Integration**: Provides local API and WebSocket services, laying the foundation for future IDE plugin integrations.

## Architecture

The project adopts a decoupled full-stack architecture design to ensure excellent maintainability and extensibility:

- **Client**: `React 18` + `Vite` + `Tailwind CSS` + `Framer Motion` for a silky-smooth modern UI.
- **Server**: `Node.js` + `Express` + `better-sqlite3` providing stable local data persistence and API support.
- **Desktop (Electron)**: Acts as the host environment, bundling and bridging system-level capabilities (like system tray, global shortcuts).

## Directory Structure

```text
orbit-focus-desktop/
├── client/                 # Frontend React source and build config
├── server/                 # Backend Node.js service and database config
├── electron/               # Electron main process and preload scripts
├── build/                  # Resources required for packaging (icons, etc.)
├── scripts/                # Build and development automation scripts
├── package.json            # Root configuration and Workspaces definition
└── README.md               # Project documentation
```

## Quick Start

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (included with Node.js)

### Installation

1. **Clone the project and install all dependencies** (Thanks to npm workspaces, this installs dependencies for the root, client, and server simultaneously):

```bash
npm run install:all
```

2. **Start the development environment** (This spins up both the frontend hot-reload server and the Electron process concurrently):

```bash
npm run dev
```

### Build & Package

To generate an executable application for your operating system, run the following commands:

```bash
# Build the full app and package it (auto-detects current OS)
npm run electron:build

# Platform-specific packaging
npm run electron:build:win    # Windows (.exe)
npm run electron:build:mac    # macOS (.dmg)
npm run electron:build:linux  # Linux (.deb, .pkg.tar.zst, AppImage)
```
*All output installers will be placed in the `dist-electron/` directory.*

- **Debian/Ubuntu**: `dist-electron/orbit-focus_1.0.0_amd64.deb` (Install with `sudo dpkg -i`)
- **Arch Linux**: `dist-electron/Orbit Focus-1.0.0.pkg.tar.zst` (Install with `sudo pacman -U`)
- **AppImage**: `dist-electron/Orbit Focus-1.0.0.AppImage` (Add execute permission and run)

### Windows

1. Download `Orbit-Focus-Setup-1.0.0.exe`.
2. Double-click to run the installer.
3. Once installation is complete, the application will launch automatically.

### macOS

1. Download `Orbit-Focus-1.0.0.dmg`.
2. Double-click the .dmg file to mount it.
3. Drag `Orbit Focus` to your `Applications` folder.
4. Launch Orbit Focus from your Applications or via Spotlight.
   *Note: You may need to allow the app in "System Settings > Privacy & Security" if it shows a developer verification warning.*


## API Reference (Built-in Service)

When Orbit Focus starts, it boots a local RESTful service (default port: `8080`) for frontend-backend communication or third-party integration:

- **Tasks**: `GET/POST/PUT/DELETE /api/tasks` 
- **Stats**: `GET/POST /api/sessions/stats`
- **Health**: `GET /api/health`

## Contributing Translations

If you would like to add support for more languages, feel free to fork this repository and submit a Pull Request. You can simply add the corresponding JSON translation files in the `client/src/locales/` directory.

## License

This project is licensed under the [MIT License](LICENSE). Contributions (Pull Requests / Issues) are always welcome.

## Disclaimer

**Note on Secondary Development**: This project is open-sourced under the MIT License for learning and exchange. If you intend to use this project for secondary development or redistribution, please credit the original source. Open source isn't easy, let's respect the hard work of every developer.

