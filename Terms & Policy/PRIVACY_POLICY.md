# VoxBridge Privacy Policy

**Effective:** September 28, 2026

This policy explains how VoxBridge handles information to provide Discord translation and voice features. VoxBridge is an independent project, not operated by Discord, DeepL, Microsoft, or Stripe. The operator must publish a real contact channel before launch: **[add operator name and support email/URL]**.

## Who operates an instance

VoxBridge can be self-hosted. The person or organization running an instance controls its database, logs, backups, security, and deletion practices. This document describes the current project code; each operator should verify the policy against its own deployment and provider settings.

## Data processed

Depending on use, VoxBridge processes:

- Discord server, channel, user, and moderator IDs needed to configure and operate the bot;
- server channel bindings, target languages, selected server voice, and custom slang terms/replacements;
- member voice and language preferences, and member IDs muted from triggering proxy playback;
- aggregate translated-character totals by server and month;
- messages posted in configured proxy channels while they are translated and spoken; and
- operational diagnostics such as IDs, event types, message lengths, errors, and timestamps.

The current bot does not write a transcript of every proxy message into its SQLite database. Discord retains the original messages under Discord's own service and server settings. A developer-only history-export command can fetch recent channel messages from Discord when the authorized developer invokes it; the export is returned privately in Discord and is not saved as a VoxBridge transcript database.

## Purposes and service providers

Data is used only to configure the bot, translate user-requested proxy messages, generate audio, apply language/voice/slang preferences, honor moderator mute settings, count usage, and secure or troubleshoot the service. Proxy message text is sent to DeepL for translation and to Microsoft's Edge TTS service for audio synthesis. Discord processes bot interactions, messages, and voice delivery. A hosting provider may store the SQLite database, backups, and logs. These providers have separate terms and privacy policies. VoxBridge does not sell message content or use it for advertising.

If Stripe billing is enabled, Stripe handles checkout and subscription management. VoxBridge stores Stripe customer/subscription identifiers, status, price identifier, renewal period, and webhook event IDs to apply server entitlements; it does not store full payment-card numbers.

## Storage and retention

SQLite stores server settings, user profiles, custom slang, muted-user records, subscription state if billing is enabled, and monthly usage totals. The operator retains these records until they are changed or deleted, or retention is required by law. Backups and logs can persist for the duration set by the individual operator. No fixed deletion deadline is promised by this codebase.

Unbinding a server removes its active channel binding, but does not necessarily delete all associated slang, mute, usage, profile, billing, or backup data. Contact the instance operator to request deletion. A self-hosting operator can remove the relevant records from their database and backups, subject to applicable legal obligations.

## Security and user choices

Operators should protect bot, API, OAuth, and payment-provider secrets; limit database and log access; maintain secure backups; and keep software updated. No system is perfectly secure. Users can avoid processing by not posting in a configured proxy channel and can change available voice/language preferences through bot commands. To ask about, correct, or request deletion of data, contact **[add operator contact]**; the operator may verify the request and may need to retain some information where law requires it.

Do not use VoxBridge for passwords, financial account details, health information, or other sensitive information. Users and operators must follow Discord's minimum-age requirements and applicable law.

## International transfers and changes

Discord, translation, speech, payment, and hosting providers may process data in countries different from yours. Consult their policies for their processing and safeguards. This policy may change when the software or its providers change; the operator should publish an updated date and provide notice where required.

## Provider policies

- [Discord Privacy Policy](https://discord.com/privacy)
- [Discord Developer Terms](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service)
- [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)
- [DeepL Privacy Policy](https://www.deepl.com/en/privacy)
- [Stripe Privacy Policy](https://stripe.com/privacy)
