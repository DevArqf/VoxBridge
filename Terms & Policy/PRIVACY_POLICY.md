# VoxBridge Privacy Policy

**Effective date:** September 28, 2026  
**Last updated:** September 28, 2026

This policy describes how a VoxBridge-operated bot instance handles information when it is used in Discord. It should be read with the [Terms of Service](TERMS_OF_SERVICE.md). VoxBridge is an independent project, not operated by Discord or DeepL. The operator must provide contact details before publishing this policy: **Malik Johnson**.

## 1. Scope and operator responsibility

VoxBridge is also self-hostable. If another person or organization hosts a copy, that instance's operator controls its database, logs, backups, configuration, and deletion practices and is responsible for giving users the applicable privacy information. This policy describes the current project implementation; operators should verify it against their deployment, hosting, logging, and provider settings.

## 2. Information processed

Depending on how a server uses VoxBridge, the bot processes:

- **Discord identifiers and server configuration:** guild, text-channel, voice-channel, user, and moderator IDs; selected language and voice settings.
- **Preferences:** a user's selected native/target language and text-to-speech voice, and server default voice settings.
- **Server-provided configuration:** custom slang terms and replacements, plus the IDs of users muted from triggering proxy audio.
- **Usage totals:** monthly translated-character counts associated with a server. The database stores aggregate counts, not a transcript of every translation.
- **Proxy message content:** text posted in the configured proxy channel is read while the bot handles it, translated, and used to generate speech. The current bot does not save a message transcript to its own SQLite database. Discord itself may retain the original Discord message under Discord's own policies and server settings.
- **Operational logs:** the bot may log technical events, identifiers, lengths, errors, and diagnostic information needed to operate and debug it. Operators should configure log access and retention carefully and must not publish logs containing credentials or personal data.

The developer-only proxy-history export command fetches recent messages directly from the configured Discord channel when invoked by the authorized developer. It displays those messages in a private Discord response; it does not create a persistent transcript in the VoxBridge SQLite database. Discord permissions and its own data handling still apply.

## 3. Why information is used

Information is used only as needed to:

- connect the configured Discord text and voice channels;
- translate proxy messages and generate requested speech;
- apply server slang replacements and personal/server voice and language preferences;
- enforce mute settings and provide usage diagnostics;
- secure, troubleshoot, and maintain the bot; and
- respond to valid support, security, or legal requests.

## 4. Sharing and service providers

To deliver its features, message text may be sent to DeepL for translation and to the configured speech service (currently Edge TTS/Microsoft) for synthesis. Discord processes messages, interactions, and voice delivery as part of its platform. The bot operator's hosting provider may store the SQLite database, logs, and backups. These providers process information under their own terms and policies; review their documents before using VoxBridge. The operator does not sell message content or use it for advertising.

## 5. Storage and retention

Configuration, profile preferences, custom slang, muted-user records, and usage aggregates are stored in the instance's SQLite database. They remain until changed or deleted by the instance operator; database backups may retain deleted data for a limited period according to the operator's backup practices. Operational logs may also persist according to local configuration. VoxBridge does not retain translated message transcripts in its SQLite database in the current implementation.

Server administrators can unbind the server using the bot's command, which removes its active channel binding. Unbinding alone should not be treated as deletion of every related record: custom slang, mute records, monthly usage totals, and user preferences may remain in the database. Contact the instance operator to request deletion of associated records. Self-host operators can delete or purge these records directly from their database, after accounting for backups and legal obligations.

## 6. Security

Operators should protect bot/API credentials, restrict database and log access, keep dependencies updated, and use secure backups. No storage or transmission method is perfectly secure. If you believe information was accessed improperly, contact the instance operator using **[add operator contact]**.

## 7. Your choices and requests

Users can avoid sending a message to translation by not posting it in a configured proxy channel. They can change available voice/language preferences through VoxBridge commands. To ask about, correct, or request deletion of information, contact the instance operator at **[add operator contact]** and identify the Discord server and relevant user ID; do not send passwords or bot/API tokens. The operator may need to verify the request and may retain limited information where legally required.

## 8. Children and sensitive information

VoxBridge is not intended to collect sensitive personal information. Do not use a proxy channel for passwords, payment details, health information, or other content that should not be shared with Discord or the translation/speech providers. Operators and users must follow Discord's age requirements and applicable law.

## 9. International processing and policy changes

Discord, translation, speech, and hosting providers may process information in countries different from yours. Their terms describe their applicable safeguards. This policy may be updated as the bot or its providers change; the operator should publish a revised effective date and notify users when required.

## 10. Provider policies

- [Discord Privacy Policy](https://discord.com/privacy)
- [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)
- [Discord Developer Terms of Service](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service)
- [DeepL Privacy Policy](https://www.deepl.com/privacy)
