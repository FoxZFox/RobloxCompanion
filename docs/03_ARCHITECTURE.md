# 03 — Architecture

## หลักการ

1. **Service worker เป็นเจ้าของ state ทั้งหมด** — UI ทุกตัวเป็น view ล้วน
2. **UI ห้ามเรียก `chrome.storage` ตรง ๆ** (§36) ต้องผ่าน Repository เสมอ
3. **Feature พังทีละตัวได้** (§38) — injector ตัวหนึ่งพังต้องไม่ลาก extension ทั้งตัวลงไปด้วย
4. **ข้อมูลที่ไม่รู้ต้องบอกว่าไม่รู้** (§13 §33 §55) — `unknown` ไม่เท่ากับ `safe`
5. **Local-first** (§34 §35) — V1 ไม่มี backend ไม่มีการอัปโหลดอะไรทั้งสิ้น

## Layer

```
┌──────────────────────────────────────────────────────────────┐
│ Surfaces  popup · sidepanel · dashboard · options            │
│           React ล้วน ไม่มี business logic ไม่แตะ storage      │
└───────────────────────┬──────────────────────────────────────┘
                        │ chrome.runtime.sendMessage  (typed, Result<T>)
┌───────────────────────▼──────────────────────────────────────┐
│ Background (service worker)  ── เจ้าของ state                 │
│   messageRouter → handlers → features/* → services/*          │
└───────┬──────────────────────────────────┬───────────────────┘
        │ chrome.tabs.sendMessage          │
┌───────▼──────────────────┐   ┌───────────▼───────────────────┐
│ Content (ISOLATED)       │   │ services/storage (Repository) │
│  fetch proxy + injectors │   │  chrome.storage.local         │
└───────┬──────────────────┘   └───────────────────────────────┘
        │ window.postMessage
┌───────▼──────────────────┐
│ MAIN world (~80 บรรทัด)   │
│  Roblox.GameLauncher      │
└──────────────────────────┘
```

**ทำไม MAIN world ต้องแยก** — `window.Roblox` มีเฉพาะใน JS context ของหน้าเว็บ และ
CSP ของ roblox.com บล็อกการ inject `<script src="chrome-extension://...">` ตั้งแต่ Chrome 130
ทางเดียวที่เหลือคือประกาศ `"world": "MAIN"` ใน manifest ให้ browser inject ให้ (ดู §2 ของ `02_ROBLOX_API_MAP.md`)

## โครงสร้าง

```
src/
├── background/
│   ├── serviceWorker.ts       entry — สร้าง context, ลงทะเบียน handler
│   ├── context.ts             DI container: repos + services ทุกตัว
│   ├── messageRouter.ts       UiRequest → handler, ห่อด้วย Result<T>
│   ├── alarms.ts              งานตามเวลา (prune)
│   └── handlers/              serverHandlers · recordHandlers · blacklistHandlers
│
├── content/
│   ├── bootstrap.ts           ลงทะเบียน injector + RPC listener
│   ├── pageFetch.ts           fetch ที่ origin ถูกและ cookie ติด (ทางเดียวที่ CORS ยอม)
│   ├── joinBridge.ts          สะพานไป MAIN world
│   ├── observers/             domObserver (shared MutationObserver) · routeObserver
│   ├── injectors/             mountWhenPresent() ต่อ feature — try/catch แยกกัน
│   └── pages/experience/      QuickActionBar
│
├── main-world/index.ts        เรียก GameLauncher อย่างเดียว
│
├── features/                  business logic ต่อ feature (เปิด/ปิดได้จาก config/features.ts)
│   ├── servers/               ServerListService · serverFilters · liveness · reputation · joinService
│   ├── serverHistory/
│   ├── playerBlacklist/
│   ├── smartJoin/             (phase 3)
│   └── privateServers/        (phase 6)
│
├── services/
│   ├── roblox/                endpoints · transport · RobloxHttpClient · RequestScheduler · *Api
│   ├── storage/               Repository ทุกตัว + schema migration
│   └── external/              (phase 9) ItemValueProvider adapter
│
├── components/                UI ที่ใช้ร่วมกันทุก surface + theme tokens
├── hooks/                     useAppState (bridge ไป service worker)
├── models/                    type ล้วน
├── utils/                     errors · async · format · dom
└── config/                    constants · features (feature flag registry)
```

## Message protocol

typed ทั้งหมดใน `models/messages.ts` ทุก response ถูกห่อด้วย:

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: SerializedError }
```

`AppError` มี `code` ที่ map ไปเป็นข้อความภาษาไทยที่ผู้ใช้ทำอะไรกับมันได้ ไม่ใช่ stack trace
error ข้าม message boundary ด้วย `serializeError` / `deserializeError`

ทุก mutation คืน `AppState` ก้อนใหม่ → popup กับ side panel เปิดพร้อมกันได้โดยไม่หลุด sync
(จำเป็นเพราะ decision 2: สอง surface เท่าเทียมกัน)

### ข้อยกเว้นเดียว: `UiQuery` — สำหรับ "ความลับ" เท่านั้น (v0.9.0)

`AppState` ถูก **copy ไปทุก surface** และ **rebuild ทุก message** ซึ่งทำให้มันเป็นที่เก็บ
ความลับที่แย่ที่สุดเท่าที่จะหาได้ · ลิงก์ private server เป็นความลับ (ใครถือก็เข้าได้)
จึงมี channel ที่สองที่แคบมาก:

```
UiRequest  → messageRouter → Result<AppState>      ← ทุกอย่างที่ไม่ใช่ความลับ
UiQuery    → queryRouter   → Result<payload>       ← ถามครั้งเดียว ตอบครั้งเดียว
```

| | `UiRequest` | `UiQuery` |
|---|---|---|
| ตอบด้วย | `AppState` ทั้งก้อน | payload ของตัวเอง |
| broadcast `state/changed` | ใช่ (ถ้าเป็น mutation) | **ไม่** — มันไม่เปลี่ยนอะไร |
| เก็บไว้ไหน | ใน state ของทุก surface | **ไม่เก็บที่ไหนเลย** — UI เอาไปใช้แล้วทิ้ง |
| ตอนนี้มีกี่ตัว | ทั้งหมด | **1** (`query/privateServerLink`) |

**เกณฑ์ของการเพิ่มตัวที่สอง: ต้องเป็นความลับจริง ๆ** · ถ้าเพิ่มเพราะ "อยากประหยัด round
trip" เท่ากับจ่ายด้วย guarantee ที่ว่า "สอง surface เห็นไม่ตรงกันไม่ได้" ซึ่งแพงกว่ามาก

## Storage

| Repository | key prefix | เก็บอะไร |
|---|---|---|
| `SettingsRepository` | `rc:settings` | feature flags + preference ทุกตัว |
| `ServerHistoryRepository` | `rc:history:{placeId}` | ประวัติการ join |
| `ServerReportRepository` | `rc:reports:{placeId}` | flag / status / note ต่อ jobId |
| `PlayerBlacklistRepository` | `rc:blacklist` | key = `userId` |
| `PlaytimeRepository` | `rc:playtime` | (phase 7) |

pattern เดียวกันหมด: cache ใน memory + write-through
**การกระทำของผู้ใช้เขียนทันที** (เสียไปแล้วผู้ใช้จะเลิกเชื่อเครื่องมือ) ส่วนการ sweep ตอน scan
เขียนครั้งเดียวตอนจบ ทุก repo ผ่าน `schemaVersion` gate ก่อนอ่านครั้งแรก (§37)

## Feature flags (§25)

`config/features.ts` เป็น registry เดียว ทุก feature อ่าน flag ของตัวเองก่อนทำงาน
injector ที่ flag ปิดอยู่จะไม่ mount เลย

## Error isolation (§38)

- injector ทุกตัวห่อด้วย try/catch แยก — selector พังตัวเดียวไม่ลากตัวอื่น
- `domObserver` ใช้ MutationObserver **ตัวเดียว** ทั้งหน้า แล้ว coalesce callback เป็น microtask
  (React ของ Roblox ยิง mutation ได้หลายร้อยครั้งตอน hydrate)
- selector เก็บเป็น **array เรียงตามลำดับความชอบ** ไม่ใช่ string เดียว
- ถ้าหา anchor ไม่เจอภายใน timeout → เลิกเงียบ ๆ side panel ยังทำงานได้ปกติ

## Testing (§46)

logic ที่เป็น pure function อยู่แยกจาก React และ chrome API ทั้งหมด → `vitest` เรียกตรงได้:
`serverFilters` · `computePresence` · `parseRateLimit` · pagination · repositories (ใช้ fake storage)
· `smartJoinScoring` (phase 3) · `privateServerDecision` (phase 6)
