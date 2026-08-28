# Roblox Companion

A Chrome extension for roblox.com that helps you pick a server, remember which ones went
badly, and get back into a good one fast.

```
Smart Join → play → run into an exploiter → Alt+Tab → press ⚠ → Smart Join again
```

🇹🇭 [อ่านฉบับภาษาไทย](TH.md)

---

## Install

1. Download `roblox-companion-vX.Y.Z.zip` from
   [Releases](https://github.com/FoxZFox/RobloxCompanion/releases) and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder — the one with `manifest.json`
   inside it.
4. Pin 📌 the icon to your toolbar.

Needs **Chrome 114 or newer**. Stay signed in to roblox.com: signed out, Roblox allows a
browser about 3 requests a minute and loading a server list will crawl.

Prefer to build it yourself? See [Build from source](#build-from-source).

---

## Where it appears

The main surface is a floating panel drawn on top of roblox.com. Drag it anywhere; it
remembers where you left it and which tool you had open.

```
┌──────────────────────────────────────────┐
│ ⠿  Server browser              ⚙ — ✕   │ ← drag here
│    Steal An Egg                          │
├────┬─────────────────────────────────────┤
│🖥 │ LAST JOINED                         │
│Srv │ 2/7 · avg 43ms · 60 FPS · 3m ago    │
│    │ [👍][⚠][🐛][🚫]      [↻ Rejoin]   │
│🕘 │                                     │
│His │ ⚡ SMART JOIN                       │
│    │ [👤][🎲][👁][↻]                    │
│🚫 │ 🟢 12  🔴 2  ❓ 40  ⭐ 3            │
│Ply │                                     │
│🚩 │ ── servers ──                       │
│Flg │ [rows...]                        ◢ │ ← resize
└────┴─────────────────────────────────────┘
```

Closed, it shrinks to a small button in the corner that still shows how many servers you
have flagged.

Settings can point the toolbar icon at a **side panel** or a **popup** instead. All three
show the same thing.

|                        | In-page panel ⭐ | Side panel | Popup |
| ---------------------- | ---------------- | ---------- | ----- |
| Drag anywhere          | ✅ remembers      | ❌          | ❌     |
| Resize                 | ✅                | a little   | ❌     |
| Survives Alt+Tab       | ✅                | ✅          | ❌     |
| Takes up screen space  | only when open   | always     | —     |
| Works away from Roblox | ❌                | ✅          | ✅     |

Off roblox.com the icon opens the dashboard instead, because there is no page to draw on.

---

## What it does

### ⚡ Smart Join, and why it chose that server

One press scores every server it has loaded and joins the best one. Press **Preview the
choice** first if you want to read the reasoning before committing to it.

```
Population    32/40   Nearly empty (2/10)
Reputation    30/30   You marked this server clean
Health        18/20   Server running at 60 FPS, players in it average 43ms to it
Freshness      —      First time we have seen this server
Favourite      —      Not a favourite
                      Best of 47 eligible servers out of 180 loaded
```

A dash means that signal could not be judged for that server. It is then **left out of the
score entirely** rather than counted as zero — a server nobody has seen before is unknown,
not bad. Smart Join makes no extra requests to Roblox; it works from the list you already
loaded.

### 🖥 Server browser

Sort by player count, exclude full servers, cap the count, load more pages. **Join Lowest**
and **Random** skip anything you have flagged as bad.

### 🚩 Flags and notes

Mark a server **Clean · Exploiter · Bugged · Avoid**, star it as a favourite, or write
yourself a note. You can add flags of your own — "no guardian", "good farming", "AFK
server" — for one experience or for all of them, and tick "skip in Smart Join" if landing
there again would only waste your time.

Deleting a flag also removes it from every server carrying it, so nothing keeps being
skipped for a reason you can no longer see.

### 🔒 Private servers

Lists the private servers you own, split into this experience and everywhere else, with
renewal dates and prices as Roblox reports them **for your account**.

| Button           | What it does                                                 |
| ---------------- | ------------------------------------------------------------ |
| 🔒 **Join**       | Enters a private server you are allowed into on this page     |
| 🔗 **Share link** | Copies the link Roblox has already made for a server you own  |

Neither creates nor changes anything on Roblox, so links you have already handed out keep
working. If a server has no link yet, make one on its Roblox page — generating one
replaces the previous link, which is not something to do on your behalf.

Creating a private server is not offered at all: it spends Robux, and nothing here spends
Robux.

### ⏱ Playtime and visits

Every visit gets a row: which experience, which server, how long, and how old the server
already was when you joined.

```
┌ Steal An Egg                        ▶ 32m ┐
│ d232...a7d1 · joined 14:32 · 32m ago      │
│ Server had been running at least 12m      │
│ when you joined.                          │
└
```

By default a session starts when you press Join here — so a game you started from Roblox's
own page is not counted, and a session you walk away from keeps counting.

Switch on **Track sessions from my Roblox presence** in Settings and that changes. It asks
Roblox where your own account is: once a minute while you are in a game, once every five
when you are not. Sessions then start and end on their own however you got there, accurate
to about a minute. It reads your account and nobody else's, and it needs a permission you
grant yourself.

### 🚫 Player blacklist

Keep a local list of people to avoid, with the reason and when you last ran into them.
Roblox does not publish who is in a public server, so this can rarely tell you where
somebody is — and where it cannot, it says **unknown** rather than implying a server is
clear.

### 🔍 Search · 👤 Profiles · 🎨 Themes

Search for an experience without leaving the panel; sponsored results are labelled rather
than hidden. On somebody's profile, see how many friends you have in common. Recolour
Roblox and the extension with six palettes or three colours of your own — colour only, so
a theme cannot move or hide anything on the page.

### ⌘K Command palette

`Ctrl+K` (`Cmd+K` on Mac) anywhere on roblox.com. Type roughly what you want: `jls` finds
*Join lowest server*. It knows which page you are on and puts the useful commands first,
and it hides commands that cannot run yet instead of failing after you pick them.

### 💾 Backup

Settings → Backup writes your settings, flags and blacklist to a file. Importing **merges**
rather than replaces, so restoring an old backup — or taking a friend's flag set — never
costs you what you already had.

---

## What it cannot do, and why

These are limits on Roblox's side, not missing work. Wherever one applies, the interface
says so rather than showing a number nobody measured.

| You might expect              | What is actually true                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Your ping to a server**     | The figure shown is the average of the players **already in** that server, not yours — and it says nothing about how near the server is.   |
| **A "nearest server" filter** | Roblox already seats people on servers near themselves, so healthy servers everywhere report a low number. There is nothing to sort by.    |
| **Server region**             | Roblox does not tell a browser where a server runs. Getting it would mean impersonating the Roblox game client, which this will not do.    |
| **Server uptime**             | Not published anywhere. Age reads "at least X", counted from the first time this extension saw that server.                                |
| **Time actually played**      | Roblox tells a browser nothing about a running game. Without presence tracking, playtime is a ceiling rather than a measurement.           |
| **Who is in a server**        | Roblox withholds it. Identifying people anyway would mean matching avatar pictures against your list, which this will not do.              |
| **Every server in a game**    | Roblox stops paginating after roughly 150–500. What you get is a window onto the experience, and the footer says as much.                  |

---

## Privacy

- **No backend.** Flags, notes, history, blacklist and playtime live in this browser, in
  `chrome.storage.local`. Nothing is uploaded anywhere.
- **The `cookies` permission is never requested**, so this extension cannot read your
  Roblox login token even if it wanted to — requests let the browser attach your session
  itself.
- **Presence, friends, avatar and trades are optional permissions** and are not granted at
  install. You grant them in Settings when a feature needs one, and Revoke sits next to
  Grant.
- No button here spends Robux.

---

## Keyboard

- `Ctrl+K` / `Cmd+K` — command palette, anywhere on roblox.com
- Arrows, Home and End move along the tool rail and the section tabs; **Tab skips the whole
  row** instead of walking through it
- Closing the palette returns focus to where it was
- Every control in Settings has a real label, and outcomes you cannot see — "link copied",
  a session ending — are announced, not only drawn

---

## Troubleshooting

**The panel does not appear.** Reload the roblox.com tab. If you have just rebuilt or
reinstalled, reload the extension at `chrome://extensions` first, then the page.

**"Used the deeplink fallback" after joining.** Roblox ignored the exact server we asked
for and may have put you somewhere else — check before trusting a flag you set afterwards.

**Server lists load slowly.** Sign in to roblox.com and keep a tab open; signed out you are
on a much smaller request budget.

**A theme only half applies.** Roblox renames its own CSS classes without notice. The Theme
tool reports how many parts of the page it matched, so you can see when that has happened.

**Playtime looks too long.** Without presence tracking, a session only ends when you join
somewhere else, press Stop, or leave it idle for 45 minutes. Turning presence tracking on
in Settings makes it end when you actually leave.

---

## Build from source

```bash
npm install
npm run build          # → dist/          development build
npm run build:release  # → dist-release/  what ships
npm run check          # typecheck + tests + build
```

Both builds behave identically on Roblox. The development one is named **Roblox Companion
(dev)** so it can be loaded next to the release build, and it keeps Developer Mode, the API
probe and the unfinished-feature toggles that the release build leaves out.

Engineering notes — architecture, the Roblox API map, permissions, phase history — live in
[`docs/`](docs/) and are written in Thai.

---

## Not included yet

**Avatar tools** and **Trading** are unfinished, so the release build does not show
switches for them. The interface is English only, deliberately.

---

Not affiliated with RoPro. No source code, assets or branding were copied from anyone —
every feature here is written against the official Roblox API.
