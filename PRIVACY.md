# Privacy Policy — MeetFlow

_Last updated: 2026-05-02_

MeetFlow is a **privacy-first** desktop application. Your meetings, audio, and
transcripts stay on your device. We never collect, store, or transmit your data
to our servers — because we don't operate any.

## What data MeetFlow processes

| Data | Where it lives | When it leaves your device |
|---|---|---|
| Audio recordings (WAV) | `%APPDATA%\MeetFlow\recordings\` | Never, unless you click Export |
| Transcripts | Local SQLite (`%APPDATA%\MeetFlow\meetflow.db`) | Never, unless you click Export |
| Notes & summaries | Same SQLite database | Never, unless you click Export |
| Whisper models | `%APPDATA%\MeetFlow\models\` | N/A (downloaded from HuggingFace) |
| OAuth tokens | OS-encrypted store (Tauri `plugin-store` + Windows DPAPI) | Only sent to the OAuth provider you connected |
| API keys (Claude, OpenAI…) | Encrypted at rest (AES-256-GCM) in the local config | Only sent to the LLM provider you configured |

## Optional cloud features (opt-in only)

If you choose to configure a cloud LLM provider for summaries (Anthropic Claude,
OpenAI, Groq, OpenRouter, etc.), MeetFlow will send the **transcript and
summary prompt** to that provider when you generate a summary. The data is
governed by the privacy policy of that provider:

- Anthropic: https://www.anthropic.com/legal/privacy
- OpenAI: https://openai.com/policies/privacy-policy
- Groq: https://groq.com/privacy-policy
- OpenRouter: https://openrouter.ai/privacy

You can avoid this entirely by using a local Ollama model.

## OAuth integrations

When you connect Google, Microsoft, Notion, Slack, etc., MeetFlow stores an
OAuth refresh token locally. Your data flows directly between MeetFlow and the
provider — never through our servers. You can revoke access at any time from
**Settings → Integrations** and from the provider's account page.

## Analytics

**No telemetry. No analytics. No crash reporting unless you opt in.** We do not
have a backend to receive any of this data.

## Your rights

You have full control:
- **Export all your data**: Settings → Privacy → Export (.zip)
- **Delete all your data**: Settings → Privacy → Delete everything

## Recording laws

Recording laws vary by jurisdiction. Some require consent from all parties.
**You are responsible** for ensuring you have appropriate consent before
recording any meeting. MeetFlow does not warn participants automatically.

## Contact

Questions: open an issue at https://github.com/JonatanGhub/MEETFLOW-AI_MEETING_NOTES/issues
