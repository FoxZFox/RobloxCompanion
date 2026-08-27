# 02 — Roblox API Map

Endpoint ทุกตัวที่ project นี้ใช้หรือวางแผนจะใช้ พร้อม **สถานะการยืนยัน**

| สถานะ | ความหมาย |
|---|---|
| `verified-live` | เคยยิงจริงแล้วเห็น response จริง |
| `docs-only` | อ่านจาก Roblox docs เท่านั้น — **ห้ามสัญญากับผู้ใช้จนกว่าจะ verify** (§53) |
| `planned` | ยังไม่แตะ |

> กฎ: ก่อนจะเอา endpoint ที่เป็น `docs-only` ไปโชว์ใน UI ต้องยิงจริงก่อนแล้วอัปเดตเอกสารนี้

---

## 1. Public Servers — หัวใจของ Phase 2

```http
GET https://games.roblox.com/v1/games/{placeId}/servers/Public
    ?limit=100&sortOrder=Asc&excludeFullGames=true&cursor={cursor}
```

**สถานะ:** `verified-live`

```jsonc
{
  "data": [
    { "id": "a73d...991f", "maxPlayers": 7, "playing": 2, "fps": 59.7, "ping": 43 }
  ],
  "nextPageCursor": "AQAAAB..." // null = จบ
}
```

| ข้อเท็จจริงที่วัดมาแล้ว | ผลต่อการออกแบบ |
|---|---|
| `limit` รับแค่ `10 / 25 / 50 / 100` — ค่าอื่น HTTP 400 | ค่าคงที่ใน `config/constants.ts` |
| `limit=100` บางครั้งคืน `data` ว่าง | fallback เป็น 50 |
| `sortOrder=Asc` เรียงตาม player count จริงฝั่ง server | "lowest first" ไม่ต้อง sort ในเครื่อง |
| cursor ผูกกับทั้ง `serverType` และ `limit` | ห้ามเปลี่ยนสองค่านี้กลางคัน pagination |
| **pagination cap ~150–500 เซิร์ฟ** แล้ว `nextPageCursor` เป็น `null` เอง | UI เขียน "จาก N เซิร์ฟที่แสดงได้" ไม่ใช่ "ทั้งหมด" (§33) |
| **`playerTokens` ว่างเสมอ** | ไม่มีทางรู้ว่าใครอยู่ในเซิร์ฟ → blacklist ตอบ `unknown` (§13) |
| **`ping` / `fps` = ค่าเฉลี่ยฝั่ง server** ไม่ใช่ latency ของผู้ใช้ | label เป็น `avg 43ms` เท่านั้น |
| ไม่มี field uptime / created / version | server age ใช้ `firstSeenAt` ของเราเองเป็น proxy |
| ไม่มี API เช็ค JobId เดี่ยว | ต้อง scan แล้ว match เอง → `computeLiveness` |
| guest = **3 req/60s**, authenticated ≈ **100 req/60s** | ดูหัวข้อ Transport |
| CORS อนุญาตเฉพาะ origin `https://www.roblox.com` | fetch ต้องวิ่งผ่าน content script |
| Roblox ประกาศ (ก.ย. 2025) จะปิด API นี้สำหรับผู้ที่ไม่ล็อกอิน | ส่ง credentials ตั้งแต่แรก |

**Rate limit headers** (อ่านได้จาก service worker เท่านั้น — ไม่ใช่ CORS-safelisted):

```
x-ratelimit-limit: 3, 3;w=60      ← เอาตัวแรกพอ; ≤5 แปลว่าอยู่ใน guest bucket
x-ratelimit-remaining: 2, 2;w=60
retry-after: 5
```

## 2. Join

### 2a. GameLauncher (วิธีหลัก) — `verified-live`

```js
window.Roblox.GameLauncher.joinGameInstance(placeId, jobId, false, false, joinAttemptId, 'ServerList')
```

ฟังก์ชันเดียวกับที่ ServerList ของ roblox.com เรียกเอง ต้องรันใน **MAIN world**
(`window.Roblox` ไม่มีใน isolated world ของ content script)

CSP ของ roblox.com ไม่มี `chrome-extension:` ใน `script-src` → Chrome 130+ บล็อกการ
inject ด้วย `<script src="chrome-extension://...">` **ต้องประกาศ `"world": "MAIN"` ใน manifest**
(ผลพลอยได้: ไม่ต้องขอ permission `scripting`)

### 2b. Start URL (fallback) — `verified-live`

```
https://www.roblox.com/games/start?placeId={placeId}&gameInstanceId={jobId}
```

### 2c. Deeplink (last resort) — `verified-live`, ไม่น่าเชื่อถือ

`roblox://` — Roblox มัก **ไม่เคารพ `gameInstanceId`** ต้องเตือนผู้ใช้เมื่อตกมาถึงขั้นนี้

> ทุกวิธีต้องสั่งจากแท็บ `roblox.com` เพราะ Chrome จำสิทธิ์ protocol `roblox-player://`
> **แยกตาม origin** และผู้เล่นเกือบทุกคนติ๊ก "Always allow" ให้ roblox.com ไว้แล้ว

## 3. Region — ทำจาก browser extension ไม่ได้ (verified)

```http
POST https://gamejoin.roblox.com/v1/join-game-instance
```

**สถานะ:** `verified-live` — ยิงจริงจาก extension เมื่อ **27 ส.ค. 2026**

```jsonc
{ "status": 12, "message": "Unable to join Game 12", "joinScript": null }
```

Roblox **ปฏิเสธ** request ที่มาจาก browser — ไม่คืน `joinScript` มาเลย
จึงไม่มีทางอ่าน `joinScript.UdmuxEndpoints[0].Address` ที่ใช้ระบุตำแหน่งได้

คนที่เรียกสำเร็จ (จาก script ฝั่ง server) ต้องส่ง header ชุดนี้:

```
Referer:    https://www.roblox.com/games/{placeId}/
Origin:     https://roblox.com
User-Agent: Roblox/WinInet     ← ตัวปัญหา
```

`User-Agent` เป็น **Forbidden Header Name** ตาม Fetch spec → extension เซ็ตจาก `fetch()` ไม่ได้
ทั้งจาก content script และ service worker

ทางเดียวที่จะข้ามได้คือใช้ `declarativeNetRequest` เขียนทับ User-Agent ให้ปลอมเป็น Roblox client
ซึ่งคือ **การปลอมตัวเป็นไคลเอนต์เกมเพื่อผ่านด่านที่ Roblox ตั้งไว้แยกเว็บออกจากไคลเอนต์พอดี**
→ **เราไม่ทำ** (§55)

### สรุป

| | |
|---|---|
| จำแนกใหม่ | 🔵 **ต้องมี backend ของเราเอง** (ไม่ใช่ ⚠️ — ข้อมูลมีอยู่ แค่ browser เข้าไม่ถึง) |
| §34 ของ spec | ระบุไว้แล้วว่า "server region database" เป็นเหตุผลที่สมเหตุสมผลของการมี backend |
| นี่คือเหตุผลที่ RoPro คิดเงิน | มีรายงานว่า RoPro ส่ง batch ~400 เซิร์ฟไปที่ API ของตัวเอง — เพราะต้องทำฝั่ง server |
| โค้ดที่เหลือไว้ | `regionSource.ts` (interface เปล่า) + `regionTable.ts` + `regionData.ts` — CIDR matching และตาราง test ครบแล้ว ขาดแค่แหล่งข้อมูล |
| UI | ถอด toggle + optional permission ออกหมด เหลือคำอธิบายใน Settings ที่เดียว |
| Smart Join | ไม่กระทบ — signal ที่เหลือ 4 ตัวทำงานครบและไม่ยิง request เพิ่ม |

## 4. Private Servers (Phase 6) — ทั้งหมดยัง `docs-only`

| Endpoint | Method | คืนอะไร |
|---|---|---|
| `/v1/private-servers/enabled-in-universe/{universeId}` | GET | `{ privateServersEnabled: bool }` |
| `/v1/vip-servers/my-private-servers` | GET | `data[]` = `{active, universeId, placeId, name, ownerId, ownerName}` |
| `/v1/games/vip-servers/{universeId}` | POST | `{id, vipServerId, accessCode, name, ...}` |
| `/v1/vip-servers/{id}` | GET / PATCH | `{id, name, joinCode, active, subscription, link, accessCode}` |
| `/v1/games/{placeId}/private-servers` | GET | private server ของ place นั้น |

base = `https://games.roblox.com`, auth = cookie

⚠️ **ราคาต้องอ่านต่อผู้ใช้ ไม่ใช่ต่อเกม** — ตั้งแต่ 30 เม.ย. 2026 Roblox ให้ Premium/Plus
subscriber สร้าง private server ฟรีแม้เกมตั้งราคาไว้ ดังนั้น logic §9 ("price = 0 → สร้างได้เลย")
ต้องอิงจากสิ่งที่ API บอกว่า **ผู้ใช้คนนี้จะถูกเรียกเก็บเท่าไหร่** ไม่ใช่ราคาที่เกมประกาศ

**ห้าม auto-purchase เด็ดขาด** (§8) — ถ้าราคา > 0 แสดงปุ่มพาไปหน้า Roblox เท่านั้น

> บทเรียนจาก §3: endpoint พวกนี้ยังไม่เคยยิงจริง **ต้อง verify ก่อนสร้าง UI** ไม่ใช่สร้างแล้วค่อยรู้

## 5. Users / Presence

| Endpoint | Method | สถานะ | ใช้ทำอะไร |
|---|---|---|---|
| `users.roblox.com/v1/usernames/users` | POST | `docs-only` | username → userId (blacklist §12) |
| `users.roblox.com/v1/users/{userId}` | GET | `docs-only` | ชื่อ/displayName ปัจจุบัน |
| `thumbnails.roblox.com/v1/users/avatar-headshot` | GET | `planned` | รูป avatar ใน blacklist page |
| `presence.roblox.com/v1/presence/users` | POST | `docs-only` | ⚠️ คืน `gameId` (= jobId) **เฉพาะเมื่อ privacy ของเป้าหมายอนุญาต** ส่วนใหญ่เป็น `null` |
| `presence.roblox.com/v1/presence/last-online` | POST | `planned` | Last online (§23) |

**ข้อจำกัดสำคัญของ Presence** — field `placeId` / `rootPlaceId` / `gameId` / `universeId`
จะเป็น `null` ถ้าผู้ใช้ตั้ง privacy ไว้ ไม่ใช่ bug ของเรา จึงเป็นเหตุผลที่ §13 บังคับให้
ตอบ `Membership unknown` แทน `Safe`

## 6. Games / Universe

| Endpoint | Method | สถานะ | ใช้ทำอะไร |
|---|---|---|---|
| `apis.roblox.com/universes/v1/places/{placeId}/universe` | GET | `docs-only` | placeId → universeId |
| `games.roblox.com/v1/games?universeIds=` | GET | `docs-only` | ชื่อเกม, playing, maxPlayers |
| `games.roblox.com/v1/games/votes?universeIds=` | GET | `planned` | like / dislike (§23) |

## 7. Transport — ทำไมต้องซับซ้อน

```
                    ┌─ SwTransport ─────────────────────────┐
ต้องการ GET  ──────▶│ fetch จาก service worker              │
                    │ ✅ อ่าน rate-limit header ได้          │
                    │ ❓ cookie อาจไม่ติดไปด้วย              │
                    └───────────────┬───────────────────────┘
                                    │ ถ้า x-ratelimit-limit ≤ 5
                                    │ (= อยู่ใน guest bucket) หรือ 401
                                    ▼
                    ┌─ PageTransport ───────────────────────┐
                    │ fetch ผ่าน content script บน roblox.com│
                    │ ✅ origin ถูกต้องตาม CORS              │
                    │ ✅ cookie ติดไปแบบ first-party         │
                    │ ❌ อ่าน rate-limit header ไม่ได้       │
                    └───────────────────────────────────────┘
                          ถ้าไม่มีแท็บ roblox.com → ถอยกลับไป sw
```

`AdaptiveTransport` **วัด** เอาว่าอยู่ bucket ไหน แทนที่จะเดา แล้วจำการตัดสินใจไว้ทั้ง session

## 8. CSRF (§31)

Roblox ต้องการ `X-CSRF-TOKEN` สำหรับ POST/PATCH/DELETE ทุกตัว

flow: ยิงไปก่อนโดยไม่มี token → ได้ `403` พร้อม header `x-csrf-token` → cache แล้วยิงซ้ำ
**อยู่ที่เดียวใน `RobloxHttpClient` เท่านั้น** ห้าม feature ไหน implement เอง

## 9. สิ่งที่ Roblox ไม่ expose (⚠️ ต้องบอกผู้ใช้ ไม่ใช่เดา)

| อยากได้ | ความจริง |
|---|---|
| ping จริงของผู้ใช้ต่อเซิร์ฟ | ไม่มี — ที่ API ให้คือค่าเฉลี่ยฝั่ง server |
| server uptime / created time | ไม่มี |
| server version / build | ไม่มี |
| รายชื่อผู้เล่นใน public server | ไม่มี — `playerTokens` ว่างเสมอ |
| **region ของเซิร์ฟ** | มีข้อมูล แต่ **browser เข้าไม่ถึง** — ต้องมี backend (ดู §3) |
| server list ครบทุกตัว | ไม่มี — cap ~150–500 และ Roblox บอกว่าตั้งใจ |
| เช็ค JobId เดี่ยวว่ายังอยู่ไหม | ไม่มี — ต้อง scan แล้ว match |

## 10. Security (§30, §44)

- ✅ ใช้ cookie ของ browser ผ่าน `credentials: 'include'` เท่านั้น
- ❌ **ห้าม** อ่าน / เก็บ / ส่ง / log / แสดง `.ROBLOSECURITY` — extension นี้ไม่ขอ permission `cookies` ด้วยซ้ำ
- ❌ **ห้ามปลอม header เพื่อผ่านด่านของ Roblox** — ดู §3 เป็นตัวอย่างที่เราเลือกไม่ทำ
- ❌ ห้ามส่งข้อมูลผู้ใช้ออกนอกเครื่อง (V1 ไม่มี backend เลย)
- ❌ ห้าม `eval` / remote code
