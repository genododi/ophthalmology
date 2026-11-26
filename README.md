# Ophthalmic Infographic Creator

AI-powered ophthalmology study studio. Turn a topic, your notes or a PDF/DOCX into a clinical
infographic poster, then reuse it as a quiz, flashcards, mind map, slide deck, audio or video overview.
Everything you make is kept in a searchable, chapter-organised **Knowledge Base** (190+ topics included).

## Quick start

```bash
npm install
npm start          # http://localhost:3000
```

Pick a generation source (keyless HF Med LLM, Gemini or OpenAI) in the sidebar, type a topic such as
`Diabetic retinopathy staging`, and press **Generate** (or <kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd>).

The app is also a static site, so it works on GitHub Pages without the server. The server adds
library sync to disk (`library/*.json`) and an optional read-only FTP share.

### Alternative: Python server

```bash
python3 server.py 8000   # http://localhost:8000
```

Serves the same app and provides the local Gemini-key bootstrap from macOS Keychain
(`scripts/store-gemini-keychain.sh`) or `config/gemini-api-key.local`.

## Features

| Area | What you get |
| --- | --- |
| Generation | Keyless in-browser HF Med LLM, Gemini key pool with model failover and schema-constrained JSON, or OpenAI; topic mode or verbatim text mode; PDF/DOCX/TXT attachments; evidence links per section |
| Knowledge Base | Chapters, auto-categorisation, search, bookmarks, read tracking, sort by date / name / chapter |
| Studio tools | Audio and video overviews, mind map, reports, flashcards, quiz, slide deck (PPTX), Kanski pics, sticky notes |
| Sharing | Community hub with moderation (`moderation.html`), Q&A generator (`qa-generator.html`) |
| Export | Print-ready A4 / landscape poster, PDF, PPTX |
| Keyboard | <kbd>Esc</kbd> closes dialogs, <kbd>Ctrl/⌘</kbd>+<kbd>Enter</kbd> generates, arrow keys / <kbd>F</kbd> in presentation mode |

## Configuration (server.js)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `OPHTHALMIC_HTTP_PORT` | `3000` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` automatically when `OPHTHALMIC_UPLOAD_TOKEN` is set) |
| `OPHTHALMIC_UPLOAD_TOKEN` | unset | Bearer token for remote `POST /api/daily-infographic` (see `OPHTHALMIC_PULSE_SETUP.md`) |
| `FTP_PORT` | `2121` | FTP port |
| `FTP_USER` | `ophthalmics` | FTP username |
| `FTP_PASS` | random per run | FTP password (printed on start and shown in the FTP dialog on this machine) |

## Security model

- The HTTP server binds to localhost and never serves keys, server code, `config/`, `scripts/` or dot-folders.
- Write APIs (`/api/library/*`, `/api/ftp/*`) reject requests from other websites.
- The local Gemini-key endpoint answers only same-origin requests from this machine.
- FTP is read-only and limited to the `library/` folder.
- GitHub Pages is built by the deploy workflow (Settings → Pages → Source: GitHub Actions), which
  publishes only the public app files to `_site` after syntax checks and server tests pass
  (see `.github/workflows/deploy.yml`). If that workflow fails, the live site keeps the last good build.

No API key ships with the app: every user brings their own ([free Gemini key](https://aistudio.google.com/apikey)).
Keys typed into the app stay in your browser (Gemini in `localStorage`, OpenAI for the session only).
A formerly bundled key is recognised by fingerprint and dropped from browsers and local config that cached it.

## Development

```bash
npm test        # server integration tests (node:test, no extra deps)
npm run check   # syntax-check the front-end bundles
npm run dev     # restart the server on file changes
```

Mobile builds (Capacitor): see `MOBILE_RELEASE_SETUP.md`. Daily evidence pulse: see `OPHTHALMIC_PULSE_SETUP.md`.

Project layout: `index.html` + `script.js` + `style.css` (the app), `server.js` / `server.py` (local servers),
`library/` (saved infographics), `library-index.json` (static index built by `sync_to_github.py --index`).

## Disclaimer

Generated content is an educational aid for ophthalmology trainees and is not a substitute for
clinical judgement or published guidelines. Always verify AI-generated material before clinical use.
