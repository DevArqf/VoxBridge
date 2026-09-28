# VoxBridge

<div align="center">

<img src="Images/VoxBridge%20Banner%20680x240.png" width="680">

<br>

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![Node.js Version](https://img.shields.io/badge/node-22%20%7C%2024%20%7C%2026-blue.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](Dockerfile)

**Break language barriers in gaming communities with real-time text-to-speech translation.**

</div>

## Overview

**VoxBridge** is a high-performance, professional-grade Discord bot designed to bridge communication gaps in international and multi-language gaming communities. When users type in a designated text channel, VoxBridge instantly translates the message and streams synthesized voice audio directly into a linked voice channel, complete with custom gaming slang optimization and personalized voice profiles.

## License

VoxBridge is available under the [MIT License](LICENSE). You may use, modify, and redistribute the code, including in commercial projects, provided you retain the copyright and license notice in copies or substantial portions of the software. This provides credit through preservation of the author notice; it does not require a separate promotional attribution.

## Core Features

- **Real-Time TTS Translation**
>Seamlessly translates text messages from a bound text channel and speaks them aloud in a connected voice channel using reliable translation and audio pipelines.
* **Gaming Slang Interceptor**
> Built-in preprocessing dictionary to ensure gaming acronyms, loanwords, and Spanglish terms are translated naturally without breaking context.
* **Persistent Configuration**
> Powered by SQLite with automated migrations, ensuring all channel bindings, user preferences, and server settings persist safely across bot restarts.
* **Per-User Voice Customization**
> Allows individual members to select and save their preferred text-to-speech voice profile.
* **Diagnostic & Utility Tools**
> Includes quick on-demand translation, server usage status checks, and moderator controls.

## Tech Stack

* **Runtime:** Node.js
* **Framework:** Discord.js
* **Database:** SQLite  with custom migration management
* **APIs:** DeepL (Translation) & Google TTS (Audio Synthesis)
* **Containerization:** Docker & Docker Compose

## Getting Started

### Prerequisites

* Node.js 22.12+, 24, or 26
* A Discord Bot Token
* A [DeepL](https://www.deepl.com/) API Key

### Installation

1. **Clone the repository:**
```bash

   git clone https://github.com/DevArqf/VoxBridge
   cd VoxBridge
```
2. **Install dependencies:**
```bash
   npm ci
```
3. **Configure environment variables:**
Create a `.env` file in the root directory based on `.env.example`:
```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
DEEPL_API_KEY=your_deepl_api_key
```
4. **Run the bot:**
```bash
npm start
```

### Windows dependency install troubleshooting

If `npm install discord.js` fails while rebuilding `better-sqlite3`, the failure is from the native SQLite module, not Discord.js. Run `npm ci` from the project directory to install the complete, lockfile-pinned dependency set. Avoid installing a single dependency into this project; `discord.js` is already declared in `package.json`. If you must build native modules from source instead of using the published prebuilt binary, install Visual Studio Build Tools with the **Desktop development with C++** workload and Python supported by `node-gyp`.
