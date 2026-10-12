# Gemini Chatbot

A clean, fast, responsive AI chatbot that runs on your own computer. It talks to the [Google Gemini API](https://ai.google.dev) (default model `gemini-3.8-flash`) through a small Node.js server, so your API key stays private and never reaches the browser.

## What it does

You type a message, the assistant answers. Replies appear **live while they are being written**, and they are displayed at an even pace so the text never jumps, whether the answer takes one second or ten. With web search turned on, the assistant can look things up online, so it can answer questions about recent events, prices and news.

**Features**

- Live streaming replies with smooth, steady text reveal
- **Live web search** (optional): up-to-date answers about news, prices and recent events
- A gentle "Working on it" note when an answer takes more than a few seconds
- **Stop** button (the send button turns into Stop while the assistant is writing)
- Conversation memory, kept in your browser so a page refresh does not lose it
- **New chat** button to start over
- Markdown replies: lists, tables, links, inline code and code blocks with a **Copy** button
- **Copy** button under every reply
- Knows today's date and time (taken from your browser's timezone)
- Works with Urdu / Arabic script (text direction is detected per message)
- Light and dark theme that follow your system setting
- Responsive: phones, tablets and desktops
- Friendly error messages (bad key, usage limit, no internet, ...) instead of silent failures
- Keyboard friendly and screen-reader friendly

**Limitations**

- The model's own knowledge has a cutoff. Newer information comes only from **web search** (`WEB_SEARCH` in `.env`). With search off, the assistant answers from its built-in knowledge plus today's date and says so when it cannot verify something recent.
- Answers that use web search take longer (often 5 to 20 seconds). The page keeps showing that it is working.
- Free Gemini accounts have usage limits (see "Limits and errors" below). Web search uses many more tokens than a normal answer, so it can reach those limits sooner. On some free plans web search is not available at all; the chatbot then answers without it automatically.
- Like every AI model it can make mistakes. Check important information, especially anything from search.

## How it works

```
Browser (public/)                    Your server (src/)                Gemini API
┌──────────────────┐   POST /api/chat   ┌──────────────────────┐   HTTPS   ┌──────────────┐
│ chat page        │ ─────────────────▶ │ validates the input  │ ────────▶ │ gemini-3.8-  │
│ shows the reply  │ ◀───────────────── │ adds system prompt   │ ◀──────── │ flash        │
│ as it streams    │   streamed text    │ adds date and time   │  streamed └──────────────┘
└──────────────────┘                    │ keeps the API key    │
                                        └──────────────────────┘
```

1. The browser sends the conversation to the local server (`/api/chat`). It never sees the API key.
2. The server cleans the input, keeps only as much history as fits the limits, adds the system prompt (including today's date) and forwards it to Gemini's `streamGenerateContent` endpoint. If web search is on, it also switches on Google Search grounding, and the model decides when to use it.
3. Gemini streams the answer back as server-sent events. The server relays it to the browser piece by piece and sends small keep-alive pings while the model is busy searching.
4. The browser reveals the text at an even pace, renders Markdown safely and saves the conversation locally.

## Technologies

| Part | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 18 or newer | Runs the server |
| Server | Express 4 (ES modules) | API endpoint and static files |
| AI client | Built-in `fetch` + Gemini REST API | No SDK needed; streams SSE directly |
| Configuration | `dotenv` | Reads settings and the API key from `.env` |
| Protection | `express-rate-limit` | Limits requests per visitor |
| AI provider | Google Gemini API | Model `gemini-3.8-flash` (backup: `gemini-3.5-flash-lite`) |
| Web search | Google Search grounding | Optional live search |
| Interface | HTML, CSS, vanilla JavaScript (ES modules) | No framework, no build step |
| Markdown | `marked` (loaded from cdnjs) | Turns Markdown into HTML |
| Safety | `DOMPurify` (loaded from cdnjs) | Cleans reply HTML so it cannot run scripts |
| Font | IBM Plex Sans (Google Fonts, system fallback) | Clean, neutral typography |

The two libraries and the font load from the internet (CDN). If they are blocked, the chat still works: replies are shown as plain text and the system font is used.

## Folder structure

```
gemini-chatbot/
├── .env                  Your settings and API key (private, never share or upload)
├── .env.example          Template of the settings, safe to share
├── .gitignore            Keeps .env and node_modules out of Git
├── package.json          Project info and dependencies
├── README.md             This file
├── server.js             Entry point: checks Node version, starts the server
├── src/
│   ├── config.js         Reads and validates the settings
│   ├── app.js            Express setup: JSON, rate limit, static files, errors
│   ├── routes/
│   │   └── chat.js       POST /api/chat: validation and streaming
│   ├── services/
│   │   ├── llm.js        Talks to Gemini: search, thinking options, retry, backup model
│   │   └── mock.js       Fake replies for testing without a key
│   └── utils/
│       ├── prompt.js     System prompt with the current date and time
│       └── errors.js     Turns provider errors into friendly messages
└── public/
    ├── index.html        The page
    ├── css/
    │   ├── tokens.css    Colors, fonts and sizes (change the look here)
    │   ├── base.css      Reset, typography, focus rings, shared button style
    │   └── chat.css      Layout and components
    └── js/
        ├── main.js       Chat logic: sending, stopping, errors, new chat
        ├── ui.js         All page updates (DOM)
        ├── api.js        Sends the request and reads the stream
        ├── reveal.js     Even-paced text reveal
        ├── markdown.js   Safe Markdown rendering
        └── store.js      Saves the conversation in the browser
```

## Requirements

- **Node.js 18 or newer** (download the LTS version from https://nodejs.org). Check with `node -v`.
- An internet connection (for npm install, the AI service and the CDN libraries).
- A free Gemini API key from https://aistudio.google.com/apikey

## Run it

1. **Open a terminal inside the `gemini-chatbot` folder.**
   - Windows: open the folder in File Explorer, click the address bar, type `cmd` and press Enter.
   - macOS / Linux: open Terminal and `cd` into the folder.
2. **Install** the dependencies (once):
   ```bash
   npm install
   ```
3. **Add your API key.** Copy `.env.example` to `.env` (skip this if `.env` already exists) and put your key after `GEMINI_API_KEY=`:
   ```
   GEMINI_API_KEY=your-gemini-key-here
   ```
4. **Start** the chatbot:
   ```bash
   npm start
   ```
5. **Open** http://localhost:3000 in your browser and say hello.

Stop the server with `Ctrl + C`.

### Try the interface without a key

The mock mode streams a fake reply so you can test the interface offline, with no API key:

```bash
# macOS / Linux
MOCK_LLM=true npm start

# Windows PowerShell
$env:MOCK_LLM="true"; npm start

# Windows cmd
set MOCK_LLM=true && npm start
```

## Configuration (`.env`)

Where the API key goes: **only** in the `.env` file, on the line `GEMINI_API_KEY=`. Never put it in any other file.

| Setting | Default | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | (required) | Your Gemini API key |
| `MODEL` | `gemini-3.8-flash` | Main model |
| `FALLBACK_MODEL` | `gemini-3.5-flash-lite` | Used automatically when the main model is rate-limited or unavailable. Leave empty to disable. |
| `THINKING_LEVEL` | `low` | `low` keeps replies fast, `high` thinks more. Empty lets the model decide. |
| `WEB_SEARCH` | `off` if missing, `auto` in the provided `.env` | `off`: no search. `auto`: the model decides when to search. `always`: search on every message (slow, but good for testing). |
| `MAX_TOKENS` | `2048` | Maximum length of one reply |
| `HISTORY_CHARS` | `8000` | How much earlier conversation is sent with each message |
| `PORT` | `3000` | Port of the local server |
| `MOCK_LLM` | (unset) | Set to `true` to use fake replies |

Restart the server after changing `.env`.

To use another model, change `MODEL`. The available names are listed in the [Gemini API models documentation](https://ai.google.dev/gemini-api/docs/models) or in Google AI Studio. Choose a text/chat model (not an image, TTS or embedding model).

## Web search

Gemini can use **Google Search grounding**. When `WEB_SEARCH=auto`, the model decides by itself: a greeting or a general-knowledge question is answered directly, while a question about news, prices or "the latest" something makes it search first and name its source.

**To check that search works:** set `WEB_SEARCH=always`, restart, and ask "What is the latest news today?". The answer will take longer and should mention a source. Set it back to `auto` afterwards.

If Gemini rejects search (some free plans do not include grounding), or search hits a usage limit, the chatbot does not fail: it answers without search instead and remembers this for a while so the next messages are fast.

## Smooth replies, fast or slow

A reply can reach the browser in very different ways: all at once in about a second, steadily over five seconds, or with pauses. Showing raw network chunks would look jumpy. So the browser keeps what has arrived and reveals it at an even pace:

- Big backlogs are drained quickly but steadily (a long answer that arrives at once appears in about a second).
- Slow streams are shown as they arrive, with only a fraction of a second of delay.
- Text is drawn about 30 times per second, so long replies stay light on the browser.
- While the assistant is preparing its first words, three soft dots are shown. After about 4 seconds a short note ("Working on it...") appears so you know nothing is stuck.
- If you scroll up to read, the view stays where you are and a small arrow lets you jump back down.

## Limits and errors

| Situation | What happens |
|---|---|
| Usage limit of the main model reached | The server tries the backup model immediately. If that is also limited, you see "The free usage limit was reached. Please wait a minute and try again." |
| Temporary failure of the AI service | One automatic retry after a short pause |
| Gemini rejects an option | Retries automatically with simpler settings |
| Web search is unavailable | Answers without search instead, and skips search for a while |
| Wrong or revoked API key | "The API key is invalid. Check your .env file." |
| No internet | "Cannot reach the AI service. Check your internet connection and try again." |
| Conversation too long for your plan | "This conversation is too long ... start a new chat." |
| A reply hits the length limit | The reply ends with a note: say "continue" to get the rest |
| Nothing arrives for 90 seconds | The request is cancelled with a clear message (the server's keep-alive pings count as activity, so slow searches are not cut off) |
| Anything fails | The failed message disappears and its text is put back in the input box so you can resend it |

Other protections: at most 20 requests per minute per visitor, messages are cut at 4,000 characters, only the latest part of the conversation is sent, and the request to Gemini is cancelled if you press Stop or close the page.

The exact free limits depend on your account. See https://ai.google.dev/gemini-api/docs/rate-limits.

## Security

- The API key lives only in `.env` and only the server reads it.
- `.env` is listed in `.gitignore`. **Do not upload or share the `.env` file**, and do not share a zip that contains it.
- Reply text is sanitized (DOMPurify) before it is shown, so a reply cannot run scripts.
- Links in replies open in a new tab with `noopener noreferrer`.
- If a key is ever exposed, delete it in Google AI Studio and create a new one.
- Your conversation is stored only in your own browser (localStorage). "New chat" erases it.

## Customizing

- **Name and text:** the title is in `public/index.html` (`<title>`, `.wordmark`, the empty-state heading).
- **Colors, fonts, sizes:** `public/css/tokens.css` (light theme at the top, dark theme below).
- **Assistant personality and rules:** `src/utils/prompt.js`.

## Troubleshooting

| Problem | Solution |
|---|---|
| `npm` is not recognized | Install Node.js from https://nodejs.org and open a new terminal |
| "Node.js 18 or newer is required" | Install the current LTS version of Node.js |
| "Missing GEMINI_API_KEY" | Open `.env` and put your key after `GEMINI_API_KEY=` (no quotes, no spaces) |
| "Port 3000 is already in use" | Set `PORT=3001` in `.env` and open http://localhost:3001 |
| "The API key is invalid" | Create a new key at https://aistudio.google.com/apikey and update `.env` |
| "Model not found" | Check `MODEL` in `.env` against the list at https://ai.google.dev/gemini-api/docs/models |
| Replies show plain text without formatting | The CDN libraries were blocked or offline; check your internet connection |
| Replies are slow | Keep `THINKING_LEVEL=low`. Answers that use web search are slower by nature; set `WEB_SEARCH=off` if you prefer speed |
| The assistant does not know recent events | Make sure `WEB_SEARCH=auto` (or `always`) is in `.env`, restart the server, and test with `always` as described in "Web search" |
| Often "free usage limit was reached" | Search uses many tokens, and each model has its own daily limit. Set `WEB_SEARCH=off`, or wait a minute between questions |
