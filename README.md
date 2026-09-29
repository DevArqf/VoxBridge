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
* **APIs:** DeepL (Translation) & Microsoft Edge TTS (Audio Synthesis)
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
3. **Configure the bot:** Copy `.env.example` to `.env` and set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEEPL_AUTH_KEY`, and `TARGET_VOICE_LANG`.
4. **Register slash commands and start the bot:**
```bash
npm run deploy-commands
npm start
```

Configure the server directly in Discord with `/settings`. No website, Discord OAuth2, browser session, or web dashboard is required. The small HTTP listener exists only for Stripe's signed webhook and listens on `WEBSITE_PORT` (default `9909`).

### Optional Stripe subscriptions

Create a recurring USD $4.99/month subscription Payment Link in Stripe. Add its URL and your API/webhook secrets to `.env`:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/your_payment_link
```

Create a Stripe webhook endpoint at `https://cadia.online/stripe/webhook` and subscribe it to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Set `PUBLIC_BASE_URL=https://cadia.online`; configure your reverse proxy to route only the webhook host/path to `WEBSITE_PORT`. `/upgrade` creates an ephemeral link button and appends the current Discord guild ID as Stripe's `client_reference_id`. Checkout completion links the Stripe subscription to that guild; later subscription events keep it in sync. Webhook signatures are verified against the raw request body and duplicate event IDs are ignored. Test with Stripe test-mode keys before switching to live mode.

Free servers have a hard monthly limit of 50,000 translated characters; Pro subscriptions raise it to 1,000,000. Pro audio chunks are prioritized ahead of pending free-tier chunks in the guild voice queue. Limits reset by UTC calendar month.

### Webhook port and legal pages

Set the Wispbyte allocation port to `9909` and `WEBSITE_PORT=9909`. Configure the reverse proxy to send Stripe POST requests for `/stripe/webhook` to that port. The Express process does not serve a landing page or dashboard. Update `[operator contact]` and governing-law placeholders in `Terms & Policy/TERMS_OF_SERVICE.md` and `Terms & Policy/PRIVACY_POLICY.md` before public launch.

## Discord-native commands

- `/settings` — administrator-only interactive menus and modals for proxy channels, default language, server TTS voice, custom slang, and muted users.
- `/usage` — private monthly character usage, tier, queue priority, and UTC reset date.
- `/upgrade` — administrator-only ephemeral Stripe Payment Link for the current guild.
- Existing `/proxy` and `/translate` commands remain available.

Free servers receive one channel notice when usage reaches 80%. At the cap, VoxBridge stops the over-limit translation and privately messages the sender with upgrade guidance (with a channel reply fallback if DMs are closed). Discord does not allow ephemeral responses to ordinary chat messages; slash-command responses remain ephemeral.
