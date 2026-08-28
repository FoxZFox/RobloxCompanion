# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Roblox Companion** — a Manifest V3 Chrome extension for roblox.com built to RoPro
feature-parity from scratch, with server intelligence as the differentiator. No backend,
no uploads, everything in `chrome.storage.local`.

> **Read `HANDOFF.md` before doing anything.** It carries the current phase status, the
> constraints proven at runtime, and the rules. This file covers the parts of the codebase
> you would otherwise have to read many files to learn.
>
> Project docs (`README.md`, `01`–`05`, `PERMISSIONS.md`, `HANDOFF.md`) are written in Thai
> with English technical terms; source comments are in English. Match both conventions.

## Commands

```bash
npm run check      # typecheck + 364 tests + build — run before every commit
npm run build      # → dist/  (~2s)
npm run watch      # rebuild on any change under src/
npm run typecheck  # tsc --noEmit
npm test           # vitest run
```

Single test file / single case:

```bash
npx vitest run src/features/smartJoin/scoring.test.ts
npx vitest run -t "leaves a position that already fits alone"
```

Vitest runs in the **node** environment and only collects `src/**/*.test.ts` — a `.test.tsx`
file is silently never run. Tests that need a DOM stand up the globals they need by hand
(see `src/content/panel/panel.test.ts`).

Icons: `node tools/make-icons.mjs`. Shared panel CSS: `node tools/make-shared-styles.mjs`
(also runs as part of the build).

**After changing code:** reload the extension at `chrome://extensions`; if content script or
panel code changed, reload the roblox.com page as well. Only the user can verify against live
Roblox — hand them a specific thing to check and say what pass and fail each look like.

**Bump the version on every finished piece of work**, before the build: edit `version` in
`package.json` — minor (`0.2.0` → `0.3.0`) for a feature or a phase, patch (`0.2.0` → `0.2.1`)
for a fix or a tweak. `build.mjs` copies it into `dist/manifest.json`, so the number on the card
at `chrome://extensions` is how the user confirms the build they just loaded is the new one.
Leave `public/manifest.json` alone: its version field is overwritten by that sync, and
`package.json` is the single source.

## Build: two stages, and why it cannot be one

`build.mjs` runs Vite and esbuild for different jobs:

- **Extension pages** (popup, side panel, dashboard, options) — Vite, normal ES modules,
  code splitting fine. They run on the extension's own origin under our own CSP.
- **Injected scripts** (`content.js`, `main-world.js`, `background.js`) — esbuild, one
  self-contained IIFE each, `splitting: false`, minified with `NODE_ENV=production`.

roblox.com's CSP has no `chrome-extension:` in `script-src`, so any runtime `import()` of a
chrome-extension URL is blocked in Chrome 130+ — which is exactly what the usual MV3 Vite
plugin emits, and it breaks the MAIN-world join bridge *silently*. `assertNoRuntimeImports()`
in `build.mjs` fails the build if a page-CSP script ever contains a real `import(`. Do not
"simplify" this into a single bundler, and do not introduce dynamic imports into
`src/content/**` or `src/main-world/**`.

## Architecture

Four execution contexts, in strict order of authority:

```
Surfaces (popup · sidepanel · dashboard · options)   React only, no business logic
        ↕ chrome.runtime.sendMessage — typed UiRequest, always answers Result<AppState>
Service worker                                       OWNS ALL STATE
        ↕ chrome.tabs.sendMessage
Content script (ISOLATED)                            fetch proxy + injectors + in-page panel
        ↕ window.postMessage
MAIN world (~80 lines)                               Roblox.GameLauncher.joinGameInstance only
```

- `background/messageRouter.ts` is the single entry point: `UiRequest` → handler →
  `features/*` → `services/*`. **Every** response is a whole freshly-built `AppState`, never a
  delta — that is what lets the popup, side panel and in-page panel be open simultaneously
  without drifting. Mutations also broadcast `state/changed` so other surfaces refetch.
- `background/queryRouter.ts` is the **one exception**, and only for secrets. `AppState` is
  copied into every surface and rebuilt on every message, so it is the worst possible carrier
  for a private-server link. A `UiQuery` is asked once, answered once, never stored and never
  broadcast; there is exactly one (`query/privateServerLink`) and the bar for a second is that
  its answer must also be a secret — not that it would save a round trip.
- `background/context.ts` (`AppContext`) is the DI container: every repository and service is
  constructed once there, plus the state that outlives a single message (scan cache, session
  visited job ids, last Smart Join plan). New service → wire it here.
- `models/messages.ts` types the whole protocol. Errors cross the boundary via
  `serializeError`/`deserializeError`; `AppError` codes map to user-actionable Thai text.

### Transport — the reason a roblox.com tab must be open

`services/roblox/transport.ts` picks a route by *measuring*, not guessing:

- `SwTransport` — fetch from the service worker. Rate-limit headers are readable (they are not
  CORS-safelisted elsewhere), but the session cookie may not travel.
- `PageTransport` — proxied through the content script on roblox.com, where cookies are
  first-party and CORS allows the origin. Authenticated by construction, but rate-limit
  headers come back empty, so callers must pace themselves.
- `AdaptiveTransport` tries the worker first, reads `x-ratelimit-limit`, and if it reveals the
  guest bucket (≤5 req/min vs ~100 authenticated) switches to the page route for the session
  and persists that choice. With no roblox.com tab it degrades back to the worker rather than
  failing outright.

### Storage

Repository pattern over a narrow `StorageArea` interface (`services/storage/storageArea.ts`),
so every repo is unit-testable with `MemoryStorageArea`. **UI must never call `chrome.storage`
directly** — always go through a repository via the service worker. Keys are centralised in
`config/constants.ts` (`STORAGE_KEYS`), schema version is `STORAGE_SCHEMA_VERSION` (currently 7).

`SettingsRepository` stores **overrides, not a resolved snapshot**. Storing the resolved object
pinned every default forever — that is how `playtime` shipped invisible to existing users.
`BackupService` accepts bundles from older schema versions and refuses only newer ones, running
the same flag-unpinning (`unpinFeaturesIntroducedAfter`) so an old backup cannot pin a feature
that did not exist when it was taken.

### In-page panel (the primary surface)

`content/panel/` renders a draggable floating window in a **Shadow DOM** root — Roblox's CSS is
broad enough to restyle anything injected, and vice versa. Consequences:

- Styles must arrive as a **string**: `content/panel/sharedStyles.ts` is a **generated file**
  (`// GENERATED FILE - do not edit`) compiled from `src/components/CommandCenter.css`. Edit the
  CSS; the build regenerates the module.
- Never use `all: initial` on the shadow host — inline styles outrank `:host`, so `position` and
  `z-index` get wiped and the panel sinks under Roblox's layers. Set what you need inline with
  `!important`.
- `content/panel/tools.tsx` is a registry: a new panel feature is **one entry** (`icon`, `label`,
  `flag`, optional `badge`, `render`) and appears in the rail with no layout work.

### Feature flags

`config/features.ts` is the single registry. Every feature checks its own flag before doing any
work — switching one off genuinely stops it, not just hides its UI. Each entry carries its own
`shipped: boolean`, which is what Settings disables a toggle by. It is deliberately not derived
from `phase`: phases do not ship in order (phase 10 shipped while 8 was research), and the
`SHIPPED_PHASE` watermark this replaced left every phase 8–9 toggle switchable and inert.

### Themes

`features/themes/` is pure logic — `colors.ts` (derivation plus the hex gate), `presets.ts`,
`robloxSurfaces.ts` (the fragile selector map), `buildThemeCss.ts` — and the DOM work lives in
`content/injectors/themeInjector.ts` for roblox.com and `hooks/useThemeTokens.ts` for extension
pages. Three constraints to keep: colours reaching CSS must pass `isHexColor` (settings arrive
from imported backups, so an unchecked string could close our rule and write its own into a
page the user signs in on); a theme may set only `background-color`, `color` and `border-color`
(tests enforce it); and nothing claims to have worked — the injector reads `style.sheet` back to
detect a CSP block and counts live selector matches so the panel can report what applied.

### Error isolation

Each injector is wrapped in its own try/catch, so a selector Roblox renames takes down only that
feature. Selectors are stored as **arrays in preference order**, not single strings. One shared
`MutationObserver` serves the whole page, coalesced into a microtask (Roblox's React fires
hundreds of mutations while hydrating). If an anchor is not found within `INJECT_TIMEOUT_MS`,
give up quietly.

## Rules that are easy to break by accident

1. **Never build on a `docs-only` endpoint.** `02_ROBLOX_API_MAP.md` marks every endpoint
   `verified-live` / `docs-only` / `planned`. Ask the user to run Settings → Developer mode →
   Run probe (while on a Roblox game page) and report back first. A complete region-detection
   feature — scoring, IP→region table, settings UI, optional permission, tests — had to be
   withdrawn because `join-game-instance` returned `status: 12`, refusing browser traffic.
   Phases 6, 8 and 9 all sit on unverified endpoints and are blocked on this.
2. **`unknown` ≠ `safe`.** A signal that cannot be decided is removed from *both* numerator and
   denominator of a score — never given 0. Labels stay honest: `avg 43ms` not `43ms`,
   `first seen 18m ago` not `Uptime 18m`, `Player identities unavailable` not `✓ Safe`.
3. **Never touch `.ROBLOSECURITY`** — the `cookies` permission is deliberately not requested;
   `credentials: 'include'` lets the browser handle it.
4. **Never spoof a header to get past a Roblox gate** (e.g. `User-Agent: Roblox/WinInet` via
   `declarativeNetRequest`). An endpoint closed to browsers gets reclassified as needing a
   backend, and the user is told.
5. No auto-purchase with Robux; no deanonymising players Roblox hides; no bypassing the
   pagination cap or rate limits.
6. **A new feature needs a flag in `config/features.ts`.** If it ships default-**on**, also add
   it to `FEATURES_INTRODUCED_AT` and bump `STORAGE_SCHEMA_VERSION`, or stored settings from
   before it existed will keep it invisible forever.
7. **Do not add i18n.** English-only UI is the user's decision (English is more global than
   picking one translation), not unfinished work: no `_locales/`, no `chrome.i18n`. Docs stay
   Thai, code comments stay English. Ask before reintroducing it.
8. **Settings controls come from `src/options/controls.tsx`.** `Section`/`Row`/`Toggle` own the
   id and hand it to the control, so `htmlFor` and `aria-describedby` cannot be forgotten. A
   caption in a bare `<span>` next to a `<select>` reads as "combo box, blank".
9. **`build.mjs` enforces a size budget** on `content.js`, `main-world.js` and `background.js` —
   the three the user pays for without asking (injected on every roblox.com page load; the
   worker is re-parsed on every MV3 wake). Raising a budget is a deliberate decision with a
   fresh measurement, never a way to get a build to pass.

## Chrome API limits that fail silently

- `chrome.runtime.openOptionsPage` **does not exist** in a content script (only `sendMessage`,
  `connect`, `getURL`, `storage`, `i18n` do). Route it through the service worker
  (`ui/openOptions`, `ui/openDashboard`).
- `chrome.sidePanel.open()` needs a user gesture, and gestures do not survive `sendMessage`
  ([crbug 355266358](https://issues.chromium.org/issues/355266358)). The reliable path is the
  toolbar icon, configured by `applySurfaceBehavior`.
- **`chrome.alarms.onAlarm` must be registered at the top level of `serviceWorker.ts`**, not
  inside a function that runs after `AppContext.create()`. MV3 wakes the worker for an alarm
  and delivers the event only to listeners that exist once the script has evaluated; a
  listener added a few awaits later misses the event that woke it, silently. `alarms.ts`
  exports `handleAlarm` for that reason - it creates alarms, it does not listen for them.

## Fragile points — these break when Roblox changes

| File | Coupled to | Symptom |
|---|---|---|
| `src/main-world/index.ts` | `Roblox.GameLauncher.joinGameInstance` signature | toast "Used the deeplink fallback" |
| `src/content/injectors/quickActionBar.ts` | Play button selectors (`PLAY_ANCHORS`) | bar missing; panel still fine |
| `src/features/themes/robloxSurfaces.ts` | Roblox class names a theme paints | theme half-applies; the panel names which parts found nothing |
| `src/services/roblox/endpoints.ts` | endpoints, query params, response shapes | server list fails to load |
| `src/content/panel/mountPanel.tsx` | Shadow DOM + z-index | panel missing or under Roblox UI |

Values in `config/constants.ts` marked "measured" came from live probing — changing one is a
claim about Roblox's behaviour, not a matter of taste.

## TypeScript

`strict` plus `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes` and
`verbatimModuleSyntax`. Optional properties are built with conditional spreads
(`...(placeId ? { placeId } : {})`) rather than assigning `undefined`, and type-only imports
must use `import type`.

## Editing gotcha

Do not rewrite files containing emoji with a Python `io.open(p, 'w')` script — it truncates
first and then dies encoding surrogate pairs. `README.md` and `02_ROBLOX_API_MAP.md` were each
destroyed twice this way. Use the Write/Edit tools.

## Document map

| File | Contents |
|---|---|
| `HANDOFF.md` | phase status, blockers, hard-won lessons, rules — **read first** |
| `README.md` | usage, build, known limits, structure, debugging |
| `01_FEATURE_MATRIX.md` | every RoPro Free/Plus/Rex feature vs. what we can actually do |
| `02_ROBLOX_API_MAP.md` | every endpoint + `verified-live` / `docs-only` status |
| `03_ARCHITECTURE.md` | layers, message protocol, storage, error isolation |
| `04_UI_UX.md` | in-page panel, tool rail, honest labelling rules |
| `05_IMPLEMENTATION_PLAN.md` | per-phase detail + §54 Definition of Done |
| `PERMISSIONS.md` | why each permission exists, and which are deliberately not requested |
