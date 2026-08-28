# 01 — Feature Matrix

Inventory ของ feature ทั้งหมดที่ RoPro โฆษณาไว้ (Free / Plus $3.99 / Rex $7.99) สำรวจจาก
[ropro.io](https://ropro.io/) และ Chrome Web Store listing เมื่อ **27 ส.ค. 2026**
พร้อมคำตัดสินว่า **เรา** จะทำ equivalent ของแต่ละอันได้แค่ไหน

> เอกสารนี้ไม่ได้ลอก RoPro — เป็นการ inventory ว่า "ปัญหาอะไรที่ผู้ใช้ต้องการให้แก้"
> แล้วออกแบบทางแก้ของเราเอง หลายอันเราตั้งใจทำ **ต่างจาก** RoPro เพราะ UX เดิมไม่ดี

## เกณฑ์ Feasibility

| | ความหมาย |
|---|---|
| ✅ | Implement ได้เต็มรูปแบบด้วย official API + browser API |
| 🟡 | Implement ได้บางส่วน — มีข้อจำกัดที่ต้องบอกผู้ใช้ตรง ๆ |
| 🔵 | ต้องมี backend ของเราเอง ถึงจะเทียบเท่าได้ |
| ⚠️ | Roblox ไม่ expose ข้อมูลนี้ — ทำไม่ได้ ไม่ใช่เพราะเราขี้เกียจ |
| ❌ | ไม่ควร implement (ละเมิด privacy / ToS / ไม่คุ้ม) |

**Status** = สถานะใน repo นี้ ณ ตอนนี้ · `done` / `phase N` / `deferred` / `wont-do`
· คอลัมน์นี้อัปเดตครั้งล่าสุด **28 ส.ค. 2026 (v0.9.0)**

---

## A. Server Intelligence — differentiator ของเรา (§51)

feature กลุ่มนี้ **ไม่ใช่** RoPro parity ส่วนใหญ่เป็นของเราเอง และได้ priority สูงสุด

| Feature | Source/API | Feasibility | Backend? | Privacy Risk | Status | Notes |
|---|---|---|---|---|---|---|
| Public server browser | `GET games.roblox.com/v1/games/{placeId}/servers/Public` | ✅ | ไม่ | ไม่ | **phase 2** | คืนแค่ `{id, playing, maxPlayers, fps, ping}` |
| Pagination (cursor) | `nextPageCursor` | 🟡 | ไม่ | ไม่ | **phase 2** | Roblox cap ที่ ~150–500 เซิร์ฟ แล้ว cursor เป็น null — staff ยืนยันว่าตั้งใจ |
| Sort lowest / highest | `sortOrder=Asc\|Desc` | ✅ | ไม่ | ไม่ | **phase 2** | เรียงฝั่ง server จริง ไม่ต้อง sort เอง |
| Exclude full | `excludeFullGames=true` | ✅ | ไม่ | ไม่ | **phase 2** | query param ตรง ๆ |
| Exact / max player count filter | local filter | ✅ | ไม่ | ไม่ | **phase 2** | กรองในเครื่องหลังโหลด |
| Join specific JobId | `Roblox.GameLauncher.joinGameInstance` (MAIN world) | ✅ | ไม่ | ไม่ | **phase 2** | fallback `/games/start` → deeplink |
| Join Lowest | ของเรา | ✅ | ไม่ | ไม่ | **phase 2** | §6 — sort ASC + exclude full + skip flagged |
| Random server hop | ของเรา (RoPro Free มี) | ✅ | ไม่ | ไม่ | **phase 2** | สุ่มจาก list ที่โหลดมา |
| Recent servers | local history | ✅ | ไม่ | local only | **phase 2** | RoPro Free มี — ของเราเก็บ flag ด้วย |
| Server history + notes | `chrome.storage.local` | ✅ | ไม่ | local only | **phase 2** | §18 §20 |
| Server reputation flags | ของเรา | ✅ | ไม่ | local only | **phase 2** | clean / exploiters / bugged / avoid / favorite |
| Custom flags ต่อเกม | ของเรา | ✅ | ไม่ | local only | **✅ ทำแล้ว** | §22 · ลบ flag แล้วถอดออกจากทุกเซิร์ฟที่ติดไว้ด้วย |
| Skip flagged ตอน join | ของเรา | ✅ | ไม่ | ไม่ | **phase 2** | §14 |
| Server age (newest/oldest) | **ของเรา — ไม่ใช่ของ Roblox** | 🟡 | ไม่ | ไม่ | **✅ phase 3** | ⚠️ API ไม่มี uptime/created — ใช้ `firstSeenAt` ของ **เราเอง** เป็น proxy แล้ว label ว่า "เห็นครั้งแรก Xm ที่แล้ว" · เซิร์ฟที่เพิ่งเห็นครั้งแรก = ไม่รู้อายุ → ตัดออกจากการให้คะแนน ไม่ใช่ให้ 0 |
| Server region / country | `POST gamejoin…/join-game-instance` | 🔵 | **ใช่** | — | **deferred** | ⚠️ **ยิงจริงแล้ว 27 ส.ค. 2026 → `status: 12` Roblox ปฏิเสธ request จาก browser** · ต้องมี header `User-Agent: Roblox/WinInet` ซึ่งเป็น forbidden header ที่ extension เซ็ตไม่ได้ · ปลอมผ่าน `declarativeNetRequest` ได้แต่ = ปลอมตัวเป็น game client → **เราไม่ทำ** (§55) · §34 ระบุว่า "server region database" เป็นเหตุผลที่ควรมี backend — นี่คือเหตุผลที่ RoPro คิดเงินกับ feature นี้ |
| Best ping (ping จริงของผู้ใช้) | — | ⚠️ | — | — | **wont-do** | วัดจาก browser ไม่ได้ · `ping` ที่ API คืนคือค่าเฉลี่ยของ**ผู้เล่นที่อยู่ในเซิร์ฟนั้น**วัดไปหาเซิร์ฟนั้น → แสดงเป็น `avg 43ms` เท่านั้น |
| ใช้ ping หา "เซิร์ฟที่ใกล้ที่สุด" | — | ⚠️ | — | — | **wont-do** | Roblox จับคู่ผู้เล่นเข้าเซิร์ฟใกล้บ้านอยู่แล้ว → เซิร์ฟดี ๆ ทุกทวีป ping ต่ำหมด แยก "ใกล้คุณ" กับ "ไกลคุณ" ไม่ได้ |
| **Server health (ping + fps)** | `ping` / `fps` จาก servers API | ✅ | ไม่ | ไม่ | **✅ phase 3** | สิ่งที่ ping บอกได้จริง: ping สูง = คนในเซิร์ฟเล่นได้แย่, fps ต่ำ = เซิร์ฟทำงานไม่ไหว → เป็น signal **คุณภาพเซิร์ฟ** ไม่ใช่ระยะทาง |
| Smart Join (scoring) | ของเรา | ✅ | ไม่ | ไม่ | **✅ phase 3** | §5 §27 §52 — differentiator หลัก · 4 signal: population · reputation · freshness · favourite · **ไม่ยิง request เพิ่มเลยแม้แต่นัดเดียว** |
| Explain Why | ของเรา | ✅ | ไม่ | ไม่ | **✅ phase 3** | §28 — RoPro ไม่มี · แสดง breakdown รวมสิ่งที่ "ตัดสินไม่ได้" |
| Server invite link | **`GET /v1/vip-servers/{id}` → `joinCode`** | 🟡 | ไม่ | ไม่ | **✅ ทำแล้ว (v0.9.0)** | อ่านลิงก์ที่ Roblox สร้างไว้แล้วเท่านั้น · `joinCode: null` = ยังไม่เคยสร้าง → บอกตรง ๆ แล้วให้ไปสร้างเองที่หน้า Roblox · **ไม่ PATCH** เพราะ PATCH = regenerate = ลิงก์ที่แจกไปแล้วตาย · public server ไม่มี invite link ถาวรอยู่แล้ว |
| Community reputation (ข้าม user) | ต้องมี backend | 🔵 | **ใช่** | **สูง** | deferred | §35 ต้อง opt-in + privacy model แยก — ไม่อยู่ใน V1 |

## B. Private Servers (§7–§9)

| Feature | Source/API | Feasibility | Backend? | Privacy Risk | Status | Notes |
|---|---|---|---|---|---|---|
| ตรวจว่าเกมเปิด private server ไหม | `GET /v1/private-servers/enabled-in-universe/{universeId}` → `privateServersEnabled` | ✅ | ไม่ | ไม่ | **✅ ทำแล้ว** | verified 28 ส.ค. 2026 |
| หา private server ที่เราเป็นเจ้าของ | `GET /v1/vip-servers/my-private-servers` | ✅ | ไม่ | ไม่ | **✅ ทำแล้ว** | verified · ไม่มี accessCode มาด้วย (ใช้ endpoint ต่อ place แทน) |
| สร้าง private server | `POST /v1/games/vip-servers/{universeId}` | 🟡 | ไม่ | ไม่ | **wont-do** | ใช้ Robux → §8 ห้าม auto-purchase · ปุ่มที่มีคือ "Open on Roblox" ให้ไปสร้างเองบนหน้าของ Roblox |
| Join private server | **`accessCode` จาก `GET /v1/games/{placeId}/private-servers`** | ✅ | ไม่ | ไม่ | **✅ ทำแล้ว** | ไม่ต้องใช้ PATCH เลย · code เก็บใน SW memory ไม่เข้า state ไม่ลง storage |
| ตรวจ ฟรี vs เสียเงิน | `priceInRobux` จาก `my-private-servers` | 🟡 | ไม่ | ไม่ | **✅ เท่าที่มีความหมาย** | แสดง **ราคาต่ออายุของบัญชีนี้** เมื่อ Roblox ส่งตัวเลขมา · ราคา**ตอนสร้าง**ไม่ได้ใช้ เพราะเราไม่สร้างให้อยู่แล้ว · ⚠️ ตั้งแต่ 30 เม.ย. 2026 Premium/Plus สร้างฟรีแม้เกมตั้งราคา → ราคาต้องอ่าน **ต่อผู้ใช้** ไม่ใช่ต่อเกม |
| Auto-buy private server ที่เสียเงิน | — | ❌ | — | — | **wont-do** | §8 — ทุก transaction ต้อง explicit confirm ของผู้ใช้เสมอ |

## C. Player Blacklist (§12–§13)

| Feature | Source/API | Feasibility | Backend? | Privacy Risk | Status | Notes |
|---|---|---|---|---|---|---|
| เพิ่ม blacklist ด้วย username | `POST users.roblox.com/v1/usernames/users` | ✅ | ไม่ | local only | **phase 2** | resolve เป็น `userId` แล้วใช้ userId เป็น key (username เปลี่ยนได้) |
| เก็บ encounter / reason / note | `chrome.storage.local` | ✅ | ไม่ | local only | **phase 2** | |
| Import / Export blacklist | JSON + `schemaVersion` | ✅ | ไม่ | local only | **✅ ทำแล้ว** | §37 · import = **merge ไม่ใช่ replace** · รับ bundle เวอร์ชันเก่าได้ ปฏิเสธเฉพาะที่ใหม่กว่า |
| **ตรวจว่า blacklisted player อยู่เซิร์ฟไหน** | ดู notes | ⚠️ | ไม่ | — | **phase 2 (แสดง unknown)** | ⚠️ `playerTokens` **มีมาจริง** (28 ส.ค. 2026) แต่ระบุตัวคนได้ต้อง fingerprint thumbnail = §13 ห้าม · Presence คืน `gameId` เฉพาะเมื่อ privacy อนุญาต → **ต้องแสดง `Membership unknown` ห้ามแสดง `Safe`** |
| Presence check (subset ที่ทำได้) | `POST presence.roblox.com/v1/presence/users` | 🟡 | ไม่ | ปานกลาง | **✅ ทำแล้ว** | verified 28 ส.ค. · ได้เฉพาะ user ที่ตั้ง privacy ให้เห็น → opt-in + optional permission + ยิงตอนกดปุ่มเท่านั้น · ถ้ามีแม้แต่คนเดียวที่ถูกปิดบัง สรุปรวมตอบ `unknown` ทั้งชุด |
| Deanonymize hidden players | — | ❌ | — | — | **wont-do** | §13 ห้าม decode playerToken / avatar brute-force / thumbnail fingerprint เด็ดขาด |

## D. Experience (RoPro Free ส่วนใหญ่)

| Feature | Source/API | Feasibility | Backend? | Privacy Risk | Status | Notes |
|---|---|---|---|---|---|---|
| Playtime tracking ต่อเกม | `chrome.tabs` + presence ของตัวเอง | 🟡 | ไม่ | local only | **✅ ทำแล้ว** | วัดเวลาในเกมจริงไม่ได้ → label เขียนว่า *"since you joined"* ไม่ใช่ *"played"* · session ค้างถูก cap ที่ 45 นาที |
| Quick search / quick play | omni-search API | ✅ | ไม่ | ไม่ | **✅ ทำแล้ว** | ต้องส่ง `sessionId` ไม่งั้นคืนผลว่าง · ผลมีโฆษณา (`isSponsored`) ปนมา → **ติดป้าย ไม่ซ่อน** · คืน `universeId` ไม่ใช่ `placeId` |
| Live like / dislike counter | `GET games.roblox.com/v1/games/votes?universeIds=` | ✅ | ไม่ | ไม่ | **✅ ทำแล้ว** | RoPro คิดเงิน (Plus) — ของเราให้ฟรี · ยังไม่มีโหวต = `null` ไม่ใช่ 0% |
| Live player count | `GET games.roblox.com/v1/games?universeIds=` → `playing` | ✅ | ไม่ | ไม่ | **✅ ทำแล้ว** | |
| Experience profile ต่อเกม | ของเรา | ✅ | ไม่ | local only | **✅ ทำแล้ว** | §21 |
| **Visit log ต่อเซิร์ฟ** (เกม · jobId · กี่นาที) | ของเรา — playtime session + jobId | ✅ | ไม่ | local only | **✅ ทำแล้ว (v0.10.0)** | RoPro ไม่มี · นาทีเป็น upper bound เหมือน playtime (นับจากตอนกด Join) |
| **Session tracking อัตโนมัติ** (join เองก็นับ) | `POST presence/users` ของบัญชีตัวเอง | ✅ | ไม่ | ต่ำ (ตัวเอง) | **✅ ทำแล้ว (v0.11.0)** | default ปิด · นาทีละครั้งตอนอยู่ในเกม / 5 นาทีตอนไม่ได้เล่น · ปิด session ตอนออกจริง → เวลาเป็นค่าที่วัดมา ±1 นาที · request ล้มเหลว = ไม่ปิด session |
| **Server uptime** (เปิดมานานแค่ไหน) | — | ⚠️ | — | — | **🟡 floor เท่านั้น (สุดทางแล้ว)** | ⚠️ server list ไม่มี field เวลาเริ่ม/uptime/version · **jobId เป็น UUID v4 สุ่มล้วน** (ยืนยัน 198 ตัว 28 ส.ค. 2026) จึงไม่มี timestamp สำรอง → แสดงได้แค่ "อย่างน้อย X" จากครั้งแรกที่**เรา**เห็น · ไม่เคยเห็นมาก่อน = **"not known"** ไม่ใช่ 0 |

## E. Profiles

| Feature | Source/API | Feasibility | Backend? | Privacy Risk | Status | Notes |
|---|---|---|---|---|---|---|
| Mutual friends | `GET friends.roblox.com/v1/users/{id}/friends` ทั้งสองฝั่งแล้ว intersect | 🟡 | ไม่ | ปานกลาง | **✅ ทำแล้ว** | verified 28 ส.ค. · **`name` ว่างเปล่า** → เทียบด้วย id แสดงได้แค่จำนวน · list ที่ private ตอบ "ไม่ทราบ" ไม่ใช่ "ไม่มีเพื่อนร่วม" · optional permission |
| Last online | `POST presence.roblox.com/v1/presence/last-online` | ✅ | ไม่ | ปานกลาง | **⏳ รอ probe** | v0.9.0 เพิ่มเข้า API probe แล้ว (read-only ยิงใส่บัญชีตัวเอง) · host เดียวกับ presence ที่ Grant แล้ว แต่**คนละ endpoint คนละกฎ privacy** → ห้ามสร้าง UI จนกว่าจะเห็น response จริง (กฎข้อ 7) |
| Copy UserId / quick actions | DOM | ✅ | ไม่ | ไม่ | **✅ ทำแล้ว** | อยู่ใน ⌘K command palette (Copy user ID · Blacklist this player · Copy place ID) โผล่เฉพาะหน้าที่ใช้ได้ |
| Account value | inventory API + `ItemValueProvider` | 🟡 | ไม่ (ใช้ provider) | ปานกลาง | phase 9 (บล็อก) | inventory ส่วนใหญ่ตั้ง private → คำนวณไม่ได้ ต้องแสดงว่า "inventory ไม่เปิดเผย" |
| Profile likes / comments (RoPro social) | backend ของ RoPro | 🔵 | **ใช่** | สูง | **wont-do** | เป็น social network ของ RoPro เอง ไม่ใช่ข้อมูล Roblox — ไม่มี network effect ก็ไร้ค่า |
| Discord username บน profile | backend ของ RoPro | 🔵 | **ใช่** | สูง | **wont-do** | เหตุผลเดียวกัน + เก็บ PII |

## F. Avatar

| Feature | Source/API | Feasibility | Backend? | Privacy Risk | Status | Notes |
|---|---|---|---|---|---|---|
| Avatar Sandbox (ลองชุด) | thumbnail / avatar render API | 🟡 | ไม่ | ไม่ | phase 8 | preview ผ่าน thumbnail API |
| Quick equip / unequip | `POST avatar.roblox.com/v1/avatar/set-wearing-assets` | ✅ | ไม่ | ไม่ | phase 8 | ต้องมี CSRF |
| Saved outfits | `chrome.storage.local` (RoPro คิดเงิน Plus) | ✅ | ไม่ | local only | phase 8 | ของเราให้ฟรี เพราะเก็บในเครื่อง |
| Body type tools | `POST avatar.roblox.com/v1/avatar/set-body-scales` | ✅ | ไม่ | ไม่ | phase 8 | |

**สถานะจริงของกลุ่มนี้ (28 ส.ค. 2026):** อ่าน avatar ได้แล้ว (`GET avatar/{id}/avatar` verified)
แต่สามแถวบนต้องการ **write** (`set-wearing-assets` / `set-body-scales`) ซึ่ง API probe เป็น
read-only ล้วนโดยสัญญา จึง verify ไม่ได้โดยไม่เปลี่ยน contract ของมัน → **ยังไม่สร้าง**
· ทางที่ทำได้โดยไม่ต้อง write เลยคือ **avatar sandbox (preview ผ่าน thumbnail)** +
**saved outfits (เก็บ local)** โดยไม่มีปุ่ม equip

## G. Themes

| Feature | Source/API | Feasibility | Backend? | Privacy Risk | Status | Notes |
|---|---|---|---|---|---|---|
| Custom theme / สี / background | CSS injection | ✅ | ไม่ | ไม่ | **✅ ทำแล้ว** | 6 preset ที่วาดเอง + custom 3 สี · **สีล้วน ไม่มี asset เลย** (§23) · panel รายงานว่า match กี่ส่วนบนหน้านั้นจริง |
| ตาม dark/light ของ Roblox | อ่าน class ที่ Roblox ใส่ไว้ | ✅ | ไม่ | ไม่ | **phase 1** | UI ของเราทุกตัวใช้ token ชุดเดียวกัน |

## H. Trading

| Feature | Source/API | Feasibility | Backend? | Privacy Risk | Status | Notes |
|---|---|---|---|---|---|---|
| Trade list / detail | `GET trades.roblox.com/v1/trades/{type}` | ✅ | ไม่ | ปานกลาง | phase 9 | |
| Trade notifications | polling + `chrome.notifications` | ✅ | ไม่ | ไม่ | phase 9 | ต้องเปิด/ปิดได้ ห้าม spam (§43) |
| Item value / calculator | `ItemValueProvider` adapter | 🟡 | ไม่ (third-party) | ไม่ | phase 9 | §23 ห้ามผูกกับ provider เดียว — ต้องเช็ค ToS ของแต่ละเจ้าก่อนใช้ |
| Value charts | provider เดียวกัน | 🟡 | ไม่ | ไม่ | phase 9 | |
| Auto-decline bad trades | `POST trades.roblox.com/v1/trades/{id}/decline` | 🟡 | ไม่ | — | phase 9 | §24 **default OFF** + threshold + คำอธิบายก่อนเปิด |
| Outbound trade protection | เหมือนบน | 🟡 | ไม่ | — | phase 9 | §24 |
| Trade Board (โพสต์หาคู่เทรด) | backend ของ RoPro | 🔵 | **ใช่** | สูง | **wont-do** | social network ของ RoPro เอง |

**สถานะจริงของกลุ่มนี้ (28 ส.ค. 2026):** `trades/inbound` และ `trades/completed` **ตอบ 200
ทั้งคู่** envelope ถูกต้อง — บล็อกไม่ใช่เพราะ endpoint ใช้ไม่ได้ แต่เพราะบัญชีที่ทดสอบ
**ไม่มีเทรดเลยสักอัน** → ยังไม่เห็น field ของ trade object → ออกแบบตอนนี้คือเดา (กฎข้อ 7)
· **ต้องรอจนมีเทรดจริงสัก 1 อัน แล้วรัน probe ซ้ำ**

---

## สรุปสิ่งที่เราจงใจไม่ทำ

1. **RoPro social layer** (Trade Board, profile likes, comments, Discord tag) — ต้องมี backend + network effect ที่ลอกไม่ได้ และเก็บ PII โดยไม่จำเป็น
2. **Deanonymization ทุกรูปแบบ** — §13
3. **Auto-purchase อะไรก็ตามที่ใช้ Robux** — §8
4. **"Best ping" แบบที่โฆษณาว่าเป็น ping ของผู้ใช้** — วัดไม่ได้จริง การแสดงตัวเลขที่ไม่ได้วัดคือการโกหกผู้ใช้

## สิ่งที่เราทำได้ดีกว่า

| | RoPro | เรา |
|---|---|---|
| Server age filter | Plus ($3.99/mo) | ฟรี (proxy จาก first-seen ของเราเอง + บอกตรง ๆ ว่าเป็น proxy) |
| Live like/dislike | Plus | ฟรี |
| Saved outfits | Plus | ฟรี (เก็บ local) |
| Server reputation / exploiter tracking | ไม่มี | ✅ core feature |
| Smart Join + Explain Why | ไม่มี | ✅ core feature |
| Custom flags ต่อเกม | ไม่มี | ✅ |
| บอกว่าข้อมูลไหน "ไม่รู้" | แสดงเป็นตัวเลขเสมอ | ✅ แยก `unknown` ออกจาก `safe` ชัดเจน |
