# Inception

A desktop chat application for [Inception Labs](https://inceptionlabs.ai) Mercury models, built with Electron.

![Inception Chat](assets/inception.png)

## Features

- Chat with Mercury AI models via the Inception Labs API
- Persistent conversation history stored locally with SQLite
- Recent chats sidebar for quick access to past conversations
- Reasoning mode toggle for Mercury 2
- Dark, light, and auto themes
- System tray support (macOS) — minimize to tray and stay running in the background
- Syntax highlighting for code blocks
- Cross-platform: macOS, Windows, Linux

## Models

| Model | Description |
|---|---|
| Mercury 2 | Latest general-purpose model (default) |
| Mercury | General-purpose model |
| Mercury Coder | Code-focused model |
| Mercury Coder Small | Lightweight code model |
| Mercury Coder Large | Full-size code model |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- An [Inception Labs API key](https://platform.inceptionlabs.ai/dashboard/api-keys)

### Installation

```bash
npm install
npm run rebuild  # rebuild native modules (better-sqlite3)
```

### Running

```bash
# Production mode
npm start

# Development mode (opens DevTools)
npm run dev
```

### Configuration

On first launch, open Settings (⚙️) and enter your Inception Labs API key. Settings are stored at:

- **API key**: `~/.inception/config.json`
- **Other settings**: Electron userData directory (`settings.json`)

## Building

```bash
# All platforms
npm run build

# macOS only
npm run build-mac

# Windows only
npm run build-win

# Linux only
npm run build-linux
```

Build output goes to `dist/`. Linux builds produce AppImage, .deb, and .rpm packages.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+N` | New chat |
| `Cmd+Q` / `Ctrl+Q` | Quit |

## License

MIT — © 2025 Tim Tully
