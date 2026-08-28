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
// ยิงจริง 28 ส.ค. 2026 — ของจริงมี playerTokens ด้วย
{
  "data": [
    {
      "id": "d232d8f0-…-f6b44f54a7d1",
      "maxPlayers": 8,
      "playing": 1,
      "playerTokens": ["09E2E09D0C6B472CEE437A067FC5692B"],  // ⚠️ ไม่ว่าง (ดูล่าง)
      "players": [],                                          // ว่างเสมอ
      "fps": 57.88,
      "ping": 30
    }
  ],
  "nextPageCursor": "AQAAAB..." // null = จบ
}
```

### ⚠️ แก้ข้อมูลที่เคยจดผิด: `playerTokens` **ไม่ได้ว่างเปล่า**

เอกสารนี้ (และ `README` / `HANDOFF`) เคยเขียนว่า `playerTokens` ว่างเสมอ — **ผิด**
ยิงจริง 28 ส.ค. 2026 ได้ token กลับมา 1 ตัวต่อผู้เล่น 1 คน (`playing: 1` → 1 token)
ที่ว่างจริงคือ `players` ซึ่งเป็นคนละ field กัน

**แล้ว token เอาไปทำอะไรได้?** มันไม่ใช่ userId และ decode ไม่ได้ · วิธีเดียวที่จะเชื่อมมันกับ
ตัวคนได้คือ ขอ thumbnail ด้วย `token` แล้วขอ thumbnail ของ userId ที่เรารู้จัก
มาเทียบ URL ว่าเป็นรูปเดียวกันไหม (thumbnail fingerprinting)

**ซึ่ง §13 ห้ามไว้ชัดเจน** — Roblox ตั้งใจไม่บอกว่าใครอยู่เซิร์ฟไหน การเอา token ไปไล่เทียบ
คือการ**ย้อนสิ่งที่เขาตั้งใจปิด** ไม่ใช่การอ่านสิ่งที่เขาเปิด

→ **สถานะจึงไม่เปลี่ยน:** blacklist ยังตอบ `Membership unknown` เหมือนเดิม
แต่เหตุผลเปลี่ยนจาก **"ทำไม่ได้"** เป็น **"ทำได้แต่เราเลือกไม่ทำ"** ซึ่งต้องเขียนให้ตรง
ห้ามอ้างข้อจำกัดทางเทคนิคที่ไม่มีอยู่จริงเป็นข้ออ้าง (§55)

| ข้อเท็จจริงที่วัดมาแล้ว | ผลต่อการออกแบบ |
|---|---|
| `limit` รับแค่ `10 / 25 / 50 / 100` — ค่าอื่น HTTP 400 | ค่าคงที่ใน `config/constants.ts` |
| `limit=100` บางครั้งคืน `data` ว่าง | fallback เป็น 50 |
| `sortOrder=Asc` เรียงตาม player count จริงฝั่ง server | "lowest first" ไม่ต้อง sort ในเครื่อง |
| cursor ผูกกับทั้ง `serverType` และ `limit` | ห้ามเปลี่ยนสองค่านี้กลางคัน pagination |
| **pagination cap ~150–500 เซิร์ฟ** แล้ว `nextPageCursor` เป็น `null` เอง | UI เขียน "จาก N เซิร์ฟที่แสดงได้" ไม่ใช่ "ทั้งหมด" (§33) |
| **`playerTokens` มีมาจริง** (แก้ 28 ส.ค. 2026) | เชื่อมกับตัวคนได้ทางเดียวคือ fingerprint thumbnail ซึ่ง §13 ห้าม → blacklist ยังตอบ `unknown` แต่เพราะ**นโยบาย** ไม่ใช่เพราะทำไม่ได้ |
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

## 4. Private Servers (Phase 6) — **2 ตัวหลัก verified แล้ว**

| Endpoint | Method | สถานะ | คืนอะไร |
|---|---|---|---|
| `/v1/private-servers/enabled-in-universe/{universeId}` | GET | ✅ **`verified-live`** 28 ส.ค. 2026 | `{ privateServersEnabled: true }` |
| `/v1/vip-servers/my-private-servers` | GET | ✅ **`verified-live`** 28 ส.ค. 2026 | ดูข้างล่าง |
| `/v1/vip-servers/{id}` | GET | ✅ **`verified-live`** 28 ส.ค. 2026 | **`joinCode: null`** ← คำตอบสำคัญ (ดูล่าง) |
| `/v1/vip-servers/{id}` | PATCH | ⛔ ไม่แตะ | PATCH **regenerate link ได้** → ลิงก์ที่ผู้ใช้แจกเพื่อนไปแล้วจะใช้ไม่ได้ |
| `/v1/games/vip-servers/{universeId}` | POST | `docs-only` | สร้าง = ใช้ Robux → §8 ห้าม auto |
| `/v1/games/{placeId}/private-servers` | GET | ✅ **`verified-live`** 28 ส.ค. 2026 | **มี `accessCode`!** → join ได้โดยไม่ต้องเขียน |

base = `https://games.roblox.com`, auth = cookie

**response จริงของ `my-private-servers`** (28 ส.ค. 2026 — ค่าที่ระบุตัวตนถูกตัดออก):

```jsonc
{
  "active": true,
  "universeId": 2647834887,
  "placeId": 6924758805,
  "name": "…",
  "ownerId": 0, "ownerName": "…",
  "priceInRobux": null,                        // null = ไม่มีค่าใช้จ่ายต่ออายุ
  "privateServerId": 1381799380,
  "expirationDate": "2124-04-22T21:21:15.197Z",
  "willRenew": false,
  "universeName": "…",
  "purchaseScheduleId": null,
  "totalDiscountAmountInRobux": null,
  "metadata": null
}
```

> **สิ่งที่ไม่มีใน response นี้คือ `accessCode` / `link`** → รายการนี้อย่างเดียว **join ไม่ได้**

### `GET /v1/vip-servers/{id}` — probe แล้ว 28 ส.ค. 2026 · **`joinCode: null`**

```jsonc
{
  "id": 1381799380,
  "name": "…",
  "game": { "id": 2647834887, "name": "…", "rootPlace": { "id": 6924758805, "name": "…" } },
  "joinCode": null,                 // ← field มีอยู่ แต่เป็น null
  "active": true,
  "subscription": {
    "active": false, "expired": false, "expirationDate": "2124-04-22T21:21:15.197Z",
    "price": 0, "canRenew": false, "hasInsufficientFunds": false,
    "hasRecurringProfile": false, "hasPriceChanged": false, "purchaseScheduleId": null
  }
}
```

response นี้ละเอียดกว่า list มาก (มี `subscription` ครบ) แต่ **ไม่คืน join code**

**หมายเหตุที่ต้องซื่อสัตย์:** ตัวอย่างนี้มาจาก server เดียว → แยกไม่ออกระหว่าง
"Roblox ไม่คืน `joinCode` ทาง GET เลย" กับ "server ตัวนี้ยังไม่เคยสร้างลิงก์" · แต่**ผลลัพธ์
เท่ากัน**: จะได้ code ต้อง **เขียน** (PATCH `{newJoinCode:true}`) ซึ่งอาจล้างลิงก์เดิมที่ผู้ใช้
แจกเพื่อนไปแล้ว → **เราไม่ยิง** (§8 — ทุก state change ต้องมาจากคำสั่งของผู้ใช้)

### `GET /v1/games/{placeId}/private-servers` — **มี `accessCode`** ✅ (28 ส.ค. 2026)

ถามคนละคำถามกับตัวบน ("อะไรที่ join ได้ที่ place นี้" ไม่ใช่ "server ที่ฉันเป็นเจ้าของหน้าตายังไง")
แล้วคำตอบต่างกันคนละเรื่อง:

```jsonc
{
  "id": null,                    // jobId — null เพราะเซิร์ฟยังไม่รัน
  "maxPlayers": 12, "playing": 0, "fps": 0, "ping": 0,
  "playerTokens": [], "players": [],
  "name": "…'s server",
  "vipServerId": 4155694220,
  "accessCode": "dbc04db0-…",    // ← ตัวนี้แหละที่ต้องการ
  "owner": { "id": …, "name": "…", "displayName": "…", "hasVerifiedBadge": false }
}
```

→ **Phase 6 join ทำได้แล้วโดยไม่ต้องยิง write อะไรเลย** · เรียก
`Roblox.GameLauncher.joinPrivateGame(placeId, accessCode)` ใน MAIN world (ตัวเดียวกับที่
หน้า private server ของ Roblox เรียกเอง)

**`accessCode` เป็นความลับ — กติกาในโค้ด:**

- เก็บใน **service worker memory เท่านั้น** (`context.privateServerCodes`)
  ไม่เข้า `AppState` (ซึ่งทุก surface ถือ copy) และ**ไม่ลง storage** เด็ดขาด
- UI join ด้วย **`vipServerId`** แล้ว SW แปลงกลับเป็น code ตอนจะ join จริง
- `parseJoinable()` แยก code ออกจาก view model ตั้งแต่ parse — มี test บังคับว่า
  serialize view model แล้วต้องไม่เจอ code
- **ไม่มี fallback chain** สำหรับ private join · start URL กับ deeplink รับได้แต่ jobId
  ถ้าปล่อยให้ fall through ผู้ใช้จะโดนโยนเข้า public server ทั้งที่บอกว่า join private → **fail ตรง ๆ ดีกว่า**

⚠️ **ราคาต้องอ่านต่อผู้ใช้ ไม่ใช่ต่อเกม** — ตั้งแต่ 30 เม.ย. 2026 Roblox ให้ Premium/Plus
subscriber สร้าง private server ฟรีแม้เกมตั้งราคาไว้ ดังนั้น logic §9 ("price = 0 → สร้างได้เลย")
ต้องอิงจากสิ่งที่ API บอกว่า **ผู้ใช้คนนี้จะถูกเรียกเก็บเท่าไหร่** ไม่ใช่ราคาที่เกมประกาศ

**ห้าม auto-purchase เด็ดขาด** (§8) — ถ้าราคา > 0 แสดงปุ่มพาไปหน้า Roblox เท่านั้น

> บทเรียนจาก §3: endpoint พวกนี้ยังไม่เคยยิงจริง **ต้อง verify ก่อนสร้าง UI** ไม่ใช่สร้างแล้วค่อยรู้

## 5. Users / Presence

| Endpoint | Method | สถานะ | ใช้ทำอะไร |
|---|---|---|---|
| `users.roblox.com/v1/usernames/users` | POST | ✅ **`verified-live`** | username → userId (blacklist §12) · **ผ่าน CSRF จริง** |
| `users.roblox.com/v1/users/authenticated` | GET | ✅ **`verified-live`** | `{id, name, displayName}` ของผู้ใช้เอง |
| `users.roblox.com/v1/users/{userId}` | GET | `docs-only` | ชื่อ/displayName ปัจจุบัน |
| `thumbnails.roblox.com/v1/users/avatar-headshot` | GET | `planned` | รูป avatar ใน blacklist page |
| `presence.roblox.com/v1/presence/users` | POST | ✅ **`verified-live`** (ดูล่าง) | `gameId` = jobId |
| `presence.roblox.com/v1/presence/last-online` | POST | `planned` | Last online (§23) |

**Presence — verified 28 ส.ค. 2026 แต่ verify ได้แค่ครึ่งเดียว**

```jsonc
// ยิงใส่บัญชีตัวเอง ขณะอยู่ในเกม
{ "userPresenceType": 2, "lastLocation": "…", "placeId": 74729868188364,
  "rootPlaceId": 74729868188364, "gameId": "12997a38-…", "universeId": 9582986239 }
```

`gameId` **มาครบสำหรับบัญชีตัวเอง** → รูปร่าง response ยืนยันแล้ว และ Phase 5 เขียนได้

⚠️ **แต่นี่ยังไม่ตอบคำถามที่สำคัญกว่า** — เราต้องใช้กับ **คนอื่น** (คนใน blacklist) ซึ่ง Roblox
คืน `gameId` ให้เฉพาะเมื่อ privacy ของ**เป้าหมาย**อนุญาต การเห็นข้อมูลตัวเองครบ **ไม่ได้แปลว่า**
จะเห็นของคนอื่น → UI ต้องเขียนว่า coverage ไม่ครบ และยังคงตอบ `Membership unknown` (§13)

## 6. Games / Universe

| Endpoint | Method | สถานะ | ใช้ทำอะไร |
|---|---|---|---|
| `apis.roblox.com/universes/v1/places/{placeId}/universe` | GET | ✅ **`verified-live`** | `{universeId}` |
| `games.roblox.com/v1/games?universeIds=` | GET | ✅ **`verified-live`** | `{id, rootPlaceId, name, description, …}` |
| `games.roblox.com/v1/games/votes?universeIds=` | GET | ✅ **`verified-live`** | `{id, upVotes, downVotes}` |

ทั้งสามตัวยิงจริง 28 ส.ค. 2026 ผ่านหมด

## 6b. endpoint ที่ probe เข้าถึงได้อย่างเดียว (เพิ่ม 28 ส.ค. 2026)

ทั้งหมดยัง `docs-only` และ **ยังไม่มี feature ไหนเรียกใช้** — มีไว้เพื่อให้ probe รอบเดียว
ตอบคำถามที่บล็อก phase 5 / 7 / 8 / 9 อยู่ ว่า "endpoint นี้ตอบ browser extension ไหม"

**ผลรอบแรก 28 ส.ค. 2026:**

| Endpoint | phase | ผล |
|---|---|---|
| `users/authenticated` | — | ✅ `{id, name, displayName}` |
| `presence/users` | 5 | ✅ `gameId` มาครบ (**เฉพาะบัญชีตัวเอง** — ดู §5) |
| `friends/{id}/friends` | 8 | ✅ ตอบ 40 คน **แต่ `name` กับ `displayName` เป็น `""`** ⚠️ |
| `avatar/{id}/avatar` | 8 | ✅ `{assets:[{id, name, assetType:{id,name}, currentVersionId}], playerAvatarType:"R15"}` |
| `search-api/omni-search` | 7 | ✅ **`verified-live`** — แต่ **ต้องมี `sessionId`** (ดูล่าง) |
| `trades/inbound` · `trades/completed` | 9 | ○ ตอบ 200 ทั้งคู่ แต่บัญชีนี้ไม่มีเทรดเลย → **ยังไม่เห็นรูปร่าง** |

### omni-search — `sessionId` คือทั้งหมดที่ขาด (verified 28 ส.ค. 2026)

**ไม่มี `sessionId`** → `{"searchResults": [], "nextPageToken": "", "filteredSearchQuery": "", …}`
ชื่อ field ครบทุกตัวแต่ผลว่าง = endpoint ถูก query ไม่ครบ

**มี `sessionId`** (GUID ที่ client สร้างเอง) → **40 result groups** สำหรับคำว่า `obby`

```jsonc
{ "contentGroupType": "Game",          // ← มี group ที่ไม่ใช่ Game ปนมาด้วย ต้องกรอง
  "contents": [{
    "universeId": 10759627860,          // ⚠️ ไม่มี placeId! เปิดหน้าเกมต้อง resolve ก่อน
    "name": "the Obby World [NEW]",
    "description": "", "playerCount": 2,
    "totalUpVotes": 6, "totalDownVotes": 9,
    "emphasis": false,
    "isSponsored": true,                // ⚠️ Roblox ยัดโฆษณาปนมาในผลค้นหา
    "nativeAdData": "lPwaw8RpjdYM…",    // blob ของโฆษณา — เราไม่เก็บ ไม่ส่งต่อ
    "creatorName": "…"
  }] }
```

**3 อย่างที่ต้องจัดการ ไม่ใช่แค่ render:**

1. **`isSponsored`** — ซ่อน = ตัดสินใจแทนผู้ใช้ · โชว์เฉย ๆ = เอาโฆษณามาเสิร์ฟเป็นผลค้นหา
   → **ติดป้าย `sponsored`** เป็นทางเดียวที่ไม่ใช่ทั้งสองอย่าง
2. **ไม่มี `placeId`** — มีแต่ `universeId` → ตอนกด Open ต้องยิง `games?universeIds=`
   (verified-live อยู่แล้ว) เพื่อเอา `rootPlaceId` · resolve **ตอนกด ไม่ใช่ทุกแถว**
   ไม่งั้นเปลืองโควต้ากับแถวที่ผู้ใช้ไม่ได้แตะ
3. **`nativeAdData`** — parser ไม่หยิบมาเลย มี test บังคับว่าห้ามหลุดออกไปจาก parser

**`friends` คืน id แต่ไม่คืนชื่อ** — mutual friends ยัง intersect ด้วย `id` ได้ (ซึ่งเป็นสิ่งที่
feature ต้องใช้จริง) แต่จะโชว์ชื่อต้องยิง `users/{userId}` เพิ่มทีละคน → ต้องคิดเรื่อง rate limit
ก่อนออกแบบ ไม่ใช่เพิ่งมารู้ตอนเขียน UI

**`empty` ≠ `ok`** — 2 บรรทัดล่างตอบ HTTP 200 แต่ไม่มีอะไรให้ดู ซึ่ง**ไม่พอ**จะ mark เป็น
`verified-live` (ไม่รู้ชื่อ field ไม่รู้ type) · probe รอบแรกเคยรายงานสองตัวนี้ว่า "ok — update
the map" ซึ่งเป็นการเคลมเกินจริงโดยตัวเครื่องมือเอง → เพิ่ม verdict `empty` แยกออกมาแล้ว

4 host ล่างอยู่หลัง **optional permission** ไม่ได้ขอตอนติดตั้ง → Settings → Developer mode →
**Grant** ก่อน ไม่งั้น probe จะตอบ `skipped` (ไม่ใช่ `failed` — เพราะ "เราไม่มีสิทธิ์"
กับ "Roblox ปฏิเสธ" เป็นคนละคำตอบ และเราไม่สรุปแทนกัน)

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
| รายชื่อผู้เล่นใน public server | `players` ว่าง · `playerTokens` มีมาจริงแต่ §13 ห้ามเอาไป fingerprint |
| **region ของเซิร์ฟ** | มีข้อมูล แต่ **browser เข้าไม่ถึง** — ต้องมี backend (ดู §3) |
| server list ครบทุกตัว | ไม่มี — cap ~150–500 และ Roblox บอกว่าตั้งใจ |
| เช็ค JobId เดี่ยวว่ายังอยู่ไหม | ไม่มี — ต้อง scan แล้ว match |

## 10. Security (§30, §44)

- ✅ ใช้ cookie ของ browser ผ่าน `credentials: 'include'` เท่านั้น
- ❌ **ห้าม** อ่าน / เก็บ / ส่ง / log / แสดง `.ROBLOSECURITY` — extension นี้ไม่ขอ permission `cookies` ด้วยซ้ำ
- ❌ **ห้ามปลอม header เพื่อผ่านด่านของ Roblox** — ดู §3 เป็นตัวอย่างที่เราเลือกไม่ทำ
- ❌ ห้ามส่งข้อมูลผู้ใช้ออกนอกเครื่อง (V1 ไม่มี backend เลย)
- ❌ ห้าม `eval` / remote code
