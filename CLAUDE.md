# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sift is an AI-powered Chrome extension for managing Chromium browser bookmarks. It provides health analysis, duplicate detection, stale bookmark cleanup, and AI-assisted categorization using Claude Haiku 4.5.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Production build to dist/
npm run dev          # Watch mode for development
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
```

## Loading the Extension

1. Run `npm run build`
2. Open Chrome → `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" → select the `dist/` folder

## Architecture

**Chrome Extension (Manifest V3)** with three entry points:
- **Popup** (`src/popup/`) - Main UI with health dashboard, search, and actions
- **Options** (`src/options/`) - Settings page for API key and preferences
- **Background** (`src/background/`) - Service worker handling all Chrome API calls and AI requests

**Key Design Decisions:**
- All Chrome API calls go through the background service worker via message passing
- Claude API key stored in `chrome.storage.local` (device-only, not synced)
- AI requests proxied through background script to keep API key secure from content scripts
- Health metrics calculated on-demand; dead link checking is optional due to performance cost

**Services** (`src/services/`):
- `bookmarks.ts` - Chrome bookmarks API wrapper
- `history.ts` - Visit history for stale detection
- `health.ts` - Health score calculation (1-100)
- `linkChecker.ts` - Dead link detection with rate limiting
- `ai.ts` - Claude Haiku integration for categorization/renaming
- `storage.ts` - Settings persistence

**Message Protocol:** Popup/options communicate with background via `chrome.runtime.sendMessage()`. See `MessageType` in `src/utils/types.ts` for all supported messages.

## Tech Stack

- TypeScript
- Preact (lightweight React alternative)
- Vite (bundler)
- Claude Haiku 4.5 (AI features)
- Chrome Extensions Manifest V3
