# 05 — Implementation Plan

## สถานะปัจจุบัน

อัปเดต **28 ส.ค. 2026 · v0.9.0**

| Phase | ชื่อ | สถานะ |
|---|---|---|
| 0 | Research | ✅ เสร็จ — `01`–`05` + `PERMISSIONS.md` |
| 1 | Foundation | ✅ เสร็จ |
| 2 | Server Browser | ✅ เสร็จ |
| 3 | Smart Join | ✅ เสร็จ |
| 4 | Reputation ขั้นสูง | ✅ เสร็จ |
| 5 | Player Blacklist ขั้นสูง | ✅ เสร็จ — local + presence (opt-in, verified) |
| 6 | Private Servers | ✅ เสร็จ — enabled · list · join · share link · smart preference (สร้าง = ไม่ทำ §8) |
| 7 | Experience features | ✅ เสร็จ — playtime · live stats · quick search |
| 8 | Profiles / Avatar / Themes | 🟡 Themes ✅ · Profiles ✅ · Last online ⏳ รอ probe · Avatar ⬜ รอ verify write |
| 9 | Trading | ⬜ บล็อก — endpoint ตอบ 200 แต่บัญชีทดสอบไม่มีเทรดให้ดูรูปร่าง |
| 10 | Polish | 🟡 Command Palette ✅ · a11y ✅ (ทุก surface) · size budget ✅ · **i18n = ไม่ทำ** (ดูล่าง) |

**i18n — ตัดสินใจแล้วว่าไม่ทำ (28 ส.ค. 2026)** · UI เป็นภาษาอังกฤษทั้งหมดโดยตั้งใจ:
ผู้ใช้เจ้าของโปรเจกต์เลือกเองว่าอังกฤษ **global กว่า** การแปลเป็นภาษาใดภาษาหนึ่ง
· เอกสาร (`README`, `01`–`05`, `HANDOFF`) ยังเป็นไทยเหมือนเดิม · comment ในโค้ดยังเป็นอังกฤษ
→ ไม่ต้องมี `_locales/` ไม่ต้องมี `chrome.i18n` และ **ห้ามเพิ่มกลับเข้ามาโดยไม่ถาม**

---

## Phase 1 — Foundation ✅

MV3 + React + TS strict + Vite · storage repositories · `RobloxHttpClient` (CSRF) ·
`RequestScheduler` (queue/dedupe/cache/backoff) · `AdaptiveTransport` · content injection ·
theme tokens · feature flags · settings

**Port มาจาก `../RobloxStealAnEgg`** (verified live แล้ว ไม่ต้องค้นพบซ้ำ):
`transport.ts` · `main-world/index.ts` · `serverLauncher.ts` · `parseRateLimit` ·
`computePresence` (เปลี่ยนชื่อเป็น `liveness.ts`) · `pageFetch.ts` · `AppError`

## Phase 2 — Server Browser ✅

pagination + cap detection · sort/filter · join by jobId · Join Lowest · Random ·
recent servers · server history · reputation flags · manual player blacklist

### Definition of Done — Server V1 (§54)

| | ทำได้ | phase |
|---|---|---|
| Detect current Experience | ✅ | 2 |
| Resolve PlaceId / UniverseId | ✅ | 2 |
| Load public servers | ✅ | 2 |
| Pagination | ✅ | 2 |
| Lowest player sort | ✅ | 2 |
| Exclude full | ✅ | 2 |
| Join specific JobId | ✅ | 2 |
| Join Lowest | ✅ | 2 |
| Random Join | ✅ | 2 |
| Remember last server | ✅ | 2 |
| Server History | ✅ | 2 |
| Mark Clean / Exploiter / Bugged / Avoid | ✅ | 2 |
| Skip flagged server | ✅ | 2 |
| Manual player blacklist | ✅ | 2 |
| Smart Join | ✅ | 3 |
| Detect private server availability | ✅ | 6 |
| Join private server | ✅ | 6 |
| Create private server | ⛔ **จงใจไม่ทำ** — ใช้ Robux (§8) | 6 |
| Never auto-buy paid private server | ✅ (บังคับใน design) | 6 |

> §54 ปิดครบแล้วทุกข้อ ยกเว้นข้อที่เราตัดสินใจว่าจะไม่ทำ · แถว "Create & Join FREE private
> server" ของเดิมรวมสองเรื่องที่คนละคำตอบไว้ด้วยกัน จึงแยกออกเป็นสองแถว

---

## Phase 3 — Smart Join ✅

`ServerScoringService.score(server, preferences) → SmartJoinScore` พร้อม breakdown (§27 §28)

**สิ่งที่ส่งมอบจริง:** scoring 4 signal — population · reputation · freshness · favourite
พร้อม Explain Why · **ไม่ยิง request เพิ่มหา Roblox เลยแม้แต่นัดเดียว**

ทำแล้ว: `smartJoin/scoring.ts` (pure, test ไม่ต้องเปิด Roblox) · `SmartJoinService.ts` ·
Explain Why panel · Smart Join settings (§26) · `regionSource.ts` (interface รอ backend) ·
`regionTable.ts` + `regionData.ts` (CIDR longest-prefix, test ครบ)

### ⚠️ Region — พิสูจน์แล้วว่าทำจาก browser ไม่ได้

แผนเดิมคือ two-phase probe (probe เฉพาะ top-N) แต่พอยิงจริงพบว่า
`join-game-instance` ตอบ **`status: 12`** ให้ request ที่มาจาก browser
เพราะต้องการ header `User-Agent: Roblox/WinInet` ซึ่งเป็น forbidden header

→ จำแนกใหม่เป็น 🔵 **ต้องมี backend** (§34 อนุญาตไว้แล้วสำหรับ "server region database")
→ ถอด probe / toggle / optional permission ออกหมด เหลือ `RegionSource` interface + ตาราง
→ **บทเรียน:** ผมสร้าง UI ก่อน verify ซึ่งผิดกฎข้อ 7 ของเอกสารนี้เอง — Phase 6 ต้องไม่ทำซ้ำ

**กฎที่สำคัญของ scoring** — component ที่ไม่มีข้อมูลถูก **ตัดออกจากทั้งเศษและส่วน**
ไม่ใช่ให้ 0 คะแนน — เพราะ "ไม่รู้" กับ "แย่" ต้องไม่เหมือนกัน

## Phase 4 — Reputation ขั้นสูง ✅

**Custom flags (§22)** — ผู้ใช้สร้าง flag เองได้ พร้อม icon และตัวเลือก "ข้ามใน Smart Join"
scope ได้ทั้งแบบเฉพาะเกม (§21) และแบบทุกเกม · flag ที่ตั้ง avoid ไว้จะถูก
`isAvoided` และ `disqualify` เคารพเหมือน built-in status ทุกประการ

**Server notes** — กด `⋯` ที่แถวเซิร์ฟเพื่อกาง flag picker + ช่องโน้ต (บันทึกตอน blur ไม่ใช่ทุกคีย์)

ลบ flag แล้ว **ถอดออกจากทุกเซิร์ฟที่ติดไว้ด้วย** (`purgeCustomFlag`) — ถ้าปล่อยทิ้งไว้
เซิร์ฟจะมี id ล่องหนที่ยังมีผลกับ avoid rule โดยไม่มีอะไรใน UI อธิบายว่าทำไมถึงถูกข้าม

## Phase 5 — Player Blacklist ขั้นสูง ✅

**Import / Export** ทั้งชุด (settings + flags + blacklist + reports) เป็น JSON
พร้อม `schemaVersion` (§37) · **import เป็นการ merge ไม่ใช่ replace** — คนที่ restore backup เก่า
หรือรับ flag ชุดของเพื่อนมา ต้องไม่เสีย report ที่มีอยู่แล้ว · ถ้าชนกันของในเครื่องชนะ

**Presence check ✅ (verified 28 ส.ค. 2026)** — `presence/users` คืน `gameId` จริง
· 3 ด่านก่อนยิงได้: setting opt-in → optional permission → กดปุ่มเท่านั้น (ไม่มี polling)
· `none-detected` ใช้ได้เฉพาะตอน Roblox บอกตำแหน่งครบทุกคน ถ้ามีใครถูกปิดบัง = `unknown`
ทั้งชุด เพราะคนที่ถูกปิดบังคือคนที่เราอยากรู้ที่สุดพอดี · **ห้าม deanonymization** (§13)
· รายละเอียดอยู่ที่ `HANDOFF.md` §13

## Phase 6 — Private Servers ✅ (verify ครบแล้ว · 28 ส.ค. 2026)

| endpoint | ผล |
|---|---|
| `private-servers/enabled-in-universe/{universeId}` | ✅ `{privateServersEnabled: true}` |
| `vip-servers/my-private-servers` | ✅ 25 server + รูปร่างครบ (ดู `02` §4) แต่**ไม่มี** `accessCode` |
| `GET vip-servers/{id}` | ✅ ตอบ แต่ `joinCode: null` |
| `GET games/{placeId}/private-servers` | ✅ **มี `accessCode`** → join ได้โดยไม่ต้องเขียนอะไร |

**ทำแล้วทั้งหมด:**

- tool 🔒 **Private** ใน panel + tab ใน popup/side panel — เกมนี้เปิด private server ไหม ·
  list ที่เราเป็นเจ้าของ (แยก "เกมนี้" กับ "เกมอื่น") · วันหมดอายุ · auto-renew · ราคาต่ออายุ
- **ปุ่ม Join** ผ่าน `GameLauncher.joinPrivateGame(placeId, accessCode)` · code อยู่ใน SW
  memory เท่านั้น ไม่เข้า `AppState` ไม่ลง storage (ดู `HANDOFF.md` §10)
- **🔗 Share link (v0.9.0)** — **อ่าน** `joinCode` จาก `GET vip-servers/{id}` แล้วประกอบเป็น
  `roblox.com/games/{placeId}?privateServerLinkCode={joinCode}` · ถ้า Roblox ยังไม่เคยสร้าง
  ลิงก์ให้เซิร์ฟนั้น (`joinCode: null`) จะ**บอกตรง ๆ ว่าไม่มี** แล้วให้ไปสร้างเองที่หน้า Roblox
  **ไม่ PATCH เด็ดขาด** เพราะ PATCH = regenerate = ลิงก์ที่แจกเพื่อนไปแล้วตายทันที
  · ตอบผ่าน **one-shot query** ไม่ผ่าน `AppState` (ดู `03_ARCHITECTURE.md`)
- **Smart private preference (§29) (v0.9.0)** — setting `preferOwnPrivateServer`
  **default off** · เปิดแล้ว Smart Join จะหยิบ private server ที่เข้าได้ที่นี่ก่อน public
  · เลือกด้วย population preference เดิม · **ข้ามเซิร์ฟที่เต็ม** · เซิร์ฟที่ Roblox ไม่บอก
  จำนวนคน = จัดไว้ท้ายสุด (ไม่ใช่ถือว่าว่าง) · ไม่มี/เต็มหมด → falls back ไป public
  พร้อมเขียนเหตุผลใน Explain Why

**สิ่งที่จงใจไม่ทำ:** สร้าง private server (ใช้ Robux → §8) · `PATCH vip-servers/{id}`
· `accessCode` ห้ามออกจาก SW (share link ใช้ `joinCode` คนละตัวกัน)

---

### บันทึกไว้: ตอนที่ยังบล็อกอยู่เขียนว่าอย่างนี้ (เก็บไว้เป็นบทเรียน)

> **ยังไม่เขียนโค้ด และตั้งใจไม่เขียน** จนกว่าจะ verify API
>
> Phase 3 สอนบทเรียนราคาแพง: ผมสร้าง region ทั้ง feature บน endpoint ที่เป็น `docs-only`
> พอ ship แล้วถึงรู้ว่า Roblox ตอบ `status: 12` ต้องถอดทิ้งทั้งหมด
>
> Phase 6 ตั้งอยู่บน endpoint ที่ยังไม่เคยยิงจริง **5 ตัว** → ความเสี่ยงเดิมเป๊ะ
>
> **ลำดับที่ถูกต้อง:** probe → อ่าน response จริง → อัปเดต `02_ROBLOX_API_MAP.md` → ค่อยสร้าง

**ลำดับนี้ใช้จริงแล้วและได้ผล** — probe 3 รอบกว่าจะเจอ `accessCode` และตอนหา share link
`joinCode` ก็ตอบ `null` รอบแรกเหมือนกัน · endpoint แรกที่ตอบว่า "ไม่มี" ไม่ได้แปลว่าเรื่องจบ
แต่ก็ไม่ได้แปลว่าให้เดาต่อ — แปลว่า**ยังมีคำถามอื่นที่ยังไม่ได้ถาม**

## Phase 7 — Experience ✅

**เสร็จแล้ว:**

- **Playtime** — เปิด session ตอนกด Join ปิดตอน join ที่อื่น / กด Stop / ค้างเกิน 45 นาที
  · label เขียนว่า *"since you joined"* ไม่ใช่ *"played"* เพราะ Roblox ไม่บอกอะไรเลย
  เกี่ยวกับเกมที่กำลังรัน → ตัวเลขนี้เป็น **upper bound** ไม่ใช่เวลาเล่นจริง
  · session ที่ค้างถูก cap ที่ 45 นาที ไม่งั้นปิดโน้ตบุ๊กทิ้งไว้ = playtime หลายชั่วโมง
- **Live stats** — like / dislike / playing count (RoPro คิดเงิน Plus — ของเราฟรี)
  · `approvalRatio` คืน `null` เมื่อยังไม่มีโหวต ไม่ใช่ 0% เพราะเกมใหม่ = ยังไม่รู้ผลตอบรับ ไม่ใช่แย่

**Quick search ✅ (28 ส.ค. 2026)** — probe รอบแรกได้ผลว่าง เพราะ query ขาด `sessionId`
ใส่แล้วได้ 40 result groups ทันที · tool 🔍 ใน panel + tab ใน popup / side panel

- **debounce 450ms** — request พวกนี้ใช้โควต้าเดียวกับ server browser ชื่อเกม 9 ตัวอักษร
  ต้องไม่กลายเป็น 9 requests (§32)
- **`isSponsored` ติดป้าย ไม่ซ่อน** — ซ่อน = ตัดสินใจแทนผู้ใช้ · โชว์เฉย ๆ = เสิร์ฟโฆษณา
  เป็นผลค้นหา · ติดป้ายเป็นทางเดียวที่ไม่ใช่ทั้งสองอย่าง
- **ผลค้นหาไม่มี `placeId`** มีแต่ `universeId` → resolve `rootPlaceId` **ตอนกด Open**
  ไม่ใช่ทุกแถว ไม่งั้นเปลืองโควต้ากับแถวที่ไม่มีใครแตะ
- นับซื่อสัตย์: "แสดง 24 จาก N ที่ Roblox คืนมา"

**invite links ✅ (v0.9.0)** — ย้ายไปอยู่กับ private servers ซึ่งเป็นที่ของมัน (ดู Phase 6)
· public server ไม่มี invite link ถาวรอยู่แล้ว จึงไม่มีอะไรค้างในหัวข้อนี้

**Visit log ✅ (v0.10.0)** — การ์ด **Your visits** ใน tool ⏱ : หนึ่งแถวต่อหนึ่งครั้งที่กด Join
บอก **เกมอะไร · เซิร์ฟไหน · กี่นาที · เซิร์ฟเปิดมานานแค่ไหนตอนที่เข้า**

- นาที = upper bound เหมือน playtime เดิม (นับจากตอนกด Join ไม่ใช่เวลาในเกม)
- อายุเซิร์ฟ = **floor** จากครั้งแรกที่**เราเอง**เห็นเซิร์ฟนั้น · เพิ่งเห็นตอน join → เขียนว่า
  **"not known"** ไม่ใช่ 0 (0 จะอ่านว่า "เซิร์ฟเพิ่งเปิด" ซึ่งไม่มีใครวัดมา)
- ที่มาของครั้งแรกที่เห็น: report ที่ผู้ใช้เคยแตะ + map ใน memory ของ SW ที่จำ scan ไว้
  (ไม่ลง storage — ดู `HANDOFF.md` §17)
- ไม่มี flag ใหม่: อยู่ใต้ Playtime ที่มี flag อยู่แล้ว (บันทึกใน `PHASE_NOTES`)

**Session tracking จาก presence ✅ (v0.11.0)** — setting `playtime.followPresence` **default ปิด**
· เปิดแล้วถาม `presence/users` ของ**บัญชีตัวเอง** นาทีละครั้งตอนอยู่ในเกม / 5 นาทีตอนไม่ได้เล่น

- แก้ข้อจำกัดที่ใหญ่ที่สุดของ playtime: join จากหน้า Roblox เองก็นับ · ออกจากเกมแล้ว **ปิดจริง**
- `decideFollow()` pure + test 13 เคส · กฎหลัก: **ไม่มีคำตอบ ≠ ออกจากเกม** (lookup ล้มเหลว /
  enum ที่ไม่รู้จัก → ไม่แตะ session)
- `confirmedAt` เขียนลง storage ทุกครั้งที่ยืนยัน → cap 45 นาทีไม่ตัดเกมยาวอีกต่อไป
  แต่ session ที่ไม่มีใครยืนยันยังถูก cap เหมือนเดิม
- `endedBy` แยก "เห็นตอนจบจริง" ออกจาก "อนุมาน" แล้ว visit log เขียนคนละประโยค
- §13 ไม่ถูกละเมิด: กฎห้าม poll ตำแหน่ง**คนอื่น** สิ่งที่ถามคือตัวผู้ใช้เอง
- **บั๊ก MV3 ที่เจอ:** `chrome.alarms.onAlarm` ต้อง register ที่ top level ของ service worker
  ไม่งั้น alarm ที่ปลุก worker เองจะไม่มีใครฟัง (ดู `HANDOFF.md` §18)

**Server clock (dev) ✅ (v0.10.0) → ได้คำตอบแล้ว (v0.11.1)** — คำถามคือ uptime จริงเป็นไปได้ไหม:
jobId เป็น UUID และ UUID v1 มี timestamp ฝังใน แต่ v4 ไม่มี → อ่าน version nibble จาก id
ที่ถืออยู่แล้ว (ไม่ยิง request)

**ผลจริง 28 ส.ค. 2026: `198 × v4` ทุกตัว** → **ปิดประตูถาวร** · uptime จริงไม่มีทางได้
เพราะ field ไม่มีใน API และ id ไม่มี timestamp · อายุเซิร์ฟเป็น **floor จากการที่เราเห็นเอง**
ตลอดไป และต้องเขียนว่า "อย่างน้อย" เสมอ · การ์ดเก็บไว้เผื่อ Roblox เปลี่ยนวิธี mint id

## Phase 8 — Profiles / Avatar / Themes 🟡

**Themes ✅** — สีล้วน ไม่มี asset (§23) ไม่แตะ API จึงทำได้โดยไม่ต้องรอ probe

- ผู้ใช้เลือก **3 สี** (background / text / accent) ที่เหลือ derive ทั้งหมด → palette เพี้ยนไม่ได้
  · สีตัวอักษรบนปุ่มเลือกจาก contrast จริง ไม่ได้ fix ไว้ตอนวาด palette
- **hex เท่านั้น** — settings เข้ามาทาง import backup ได้ ถ้าไม่กรอง สตริงที่มี `}` จะเขียน CSS
  ของตัวเองลงหน้าที่ผู้ใช้ล็อกอิน
- **ไม่เคลมว่าติด** — อ่าน `style.sheet` กลับดูว่า CSP บล็อกไหม + นับ element ที่ selector เจอจริง
  แล้วรายงานใน panel ว่า "match 4 จาก 6 ส่วน" (กฎเดียวกับ honest labeling §55)
- แตะ Roblox เฉพาะ **สี** เท่านั้น ห้ามขยับ/ซ่อน layout — มี test บังคับไว้

**Mutual friends ✅** — verified 28 ส.ค. 2026 · เทียบด้วย id เพราะ `name` ว่าง → แสดงได้แค่
**จำนวน** · list ที่ private ตอบ "ไม่ทราบ" ไม่ใช่ "ไม่มีเพื่อนร่วมกัน" (3 verdict แยกกัน มี test บังคับ)
· `friends.roblox.com` เป็น optional permission (ดู `HANDOFF.md` §12)

**Last online ⏳ รอ probe (v0.9.0 เพิ่ม probe แล้ว)** — `presence/last-online` อยู่ใน host
เดียวกับ presence ที่ Grant ไปแล้ว จึงไม่ต้องขอ permission เพิ่ม แต่**คนละ endpoint คนละกฎ
privacy** → เพิ่มเข้า API probe แล้ว (read-only, ยิงใส่บัญชีตัวเอง) · **ยังห้ามสร้าง UI**
จนกว่าจะเห็น response จริงและอัปเดต `02` (กฎข้อ 7)

**Avatar ⬜ บล็อกที่ write** — อ่าน avatar ได้แล้ว (verified) แต่ feature จริงคือ **equip** =
`POST avatar/set-wearing-assets` ซึ่งเป็น **write** และ probe เป็น read-only ล้วนโดยสัญญา
→ ต้องตกลงกันก่อนว่าจะ probe write แบบ **no-op** (ใส่ชุดเดิมกลับเข้าไป) ไหม
· ถ้าไม่เอา write เลย ยังทำได้ครึ่งเดียวโดยไม่ต้องรออะไร: **avatar sandbox (preview ผ่าน
thumbnail)** + **saved outfits (เก็บ local)** โดยไม่มีปุ่ม equip

## Phase 9 — Trading ⬜ (บล็อก — รอข้อมูล ไม่ใช่รอโค้ด)

`trades/inbound` และ `trades/completed` **ตอบ 200 ทั้งคู่** envelope ถูกต้อง
แต่บัญชีที่ทดสอบ**ไม่มีเทรดเลยสักอัน** → ยังไม่เห็น field ของ trade object
→ ออกแบบตอนนี้ = เดา = ผิดกฎข้อ 7 · **ต้องรอจนมีเทรดจริงสัก 1 อัน แล้วรัน probe ซ้ำ**

ขอบเขตที่รออยู่: trade panel · `ItemValueProvider` adapter (หลายเจ้า) · calculator ·
notifications · protection features (**default OFF** §24) · account value

## Phase 10 — Polish ✅ (ยกเว้น i18n ที่ตัดสินใจว่าไม่ทำ)

**Command Palette (§40 §41) ✅** — `Ctrl+K` / `Cmd+K` ทุกที่บน roblox.com

- **fuzzy match แบบ subsequence** ไม่ใช่ substring — พิมพ์ `jls` เจอ *Join lowest server*
  · ให้คะแนนตัวอักษรที่เป็น**ต้นคำ**สูงกว่ากลางคำ เพื่อให้เจตนาชนะความบังเอิญ
- **รู้ว่าอยู่หน้าไหน (§41)** — หน้าเกมดัน server command ขึ้นก่อน · หน้าโปรไฟล์ดัน
  copy UserId / blacklist · **ไม่ซ่อนอย่างอื่น** palette จึงไม่มีทางตัน
- command ที่รันไม่ได้ **ซ่อนตัวเอง** (ยังไม่เปิดหน้าเกม / feature ถูกปิด / ยังไม่เคย join)
- `preventDefault` จำเป็นจริง ๆ ไม่ใช่ความเรียบร้อย — Ctrl+K ผูกกับช่องค้นหาของ browser อยู่
- ไม่ดักตอนพิมพ์อยู่ใน input/textarea — คนกำลังพิมพ์ตั้งใจพิมพ์ตัวอักษร ไม่ได้เรียก palette

เพิ่ม command ใหม่ = เพิ่ม 1 entry ใน `COMMANDS` เหมือน tool rail

**a11y — ทำแล้วบางส่วน (v0.3.0)**

- **palette = combobox/listbox จริง** — focus อยู่ที่ช่องพิมพ์ตลอด แล้วบอกแถวที่เลือกด้วย
  `aria-activedescendant` (แถวเป็น `role="option"` ไม่ใช่ปุ่ม เพราะปุ่มจะแย่ง focus)
  · `aria-modal` · **กิน Tab ไว้** ไม่งั้นหลุดไปหน้า Roblox แล้วเหลือ palette ที่คีย์บอร์ดสั่งไม่ได้
  · คืน focus ให้จุดเดิมตอนปิด (อ่านจาก `getRootNode()` เพราะอยู่ใน shadow root)
- **tool rail = tablist** — ลูกศร/Home/End เลื่อนได้ วนรอบ · `tabIndex` -1 ทุกตัวยกเว้นตัวที่เลือก
  · logic แยกเป็น `utils/rovingIndex.ts` (pure) มี test · ตัวเดียวกับที่ tab ใน popup ใช้
- จุดแดงบน rail มี `.rc-sr-only` กำกับ เพราะสีกับตำแหน่งอย่างเดียวไม่พูดอะไรออกมา
- toast อยู่ใน `aria-live="polite"` · error banner เป็น `role="alert"`

**a11y — ครบทุก surface แล้ว (v0.9.0)**

- **popup / side panel** — tab ของจริง: `role="tablist"` + `aria-controls` + roving
  `tabIndex` (Tab ข้ามทั้งแถว ลูกศรเดินในแถว) · tabpanel มีชื่อจาก tab ที่เลือก · error เป็น
  `role="alert"` · **toast region render ไว้ตลอดแม้ว่าง** เพราะ live region ต้องอยู่ในหน้า
  ก่อนข้อความจะมา ไม่งั้นอันแรก (ที่บอกว่า join สำเร็จ) เงียบ
- **options** — `<main>` + `<h2>` จริงทุก section · **ทุก select / input มี `<label htmlFor>`**
  (ของเดิมเป็น `<span>` ลอย ๆ = screen reader อ่านว่า "combo box, blank") · hint ย้ายไป
  `aria-describedby` แทนที่จะอยู่ใน label (ไม่งั้นชื่อของ toggle = ป้าย + ย่อหน้าอธิบายทั้งก้อน)
  · ปุ่ม Grant / Revoke ตั้งชื่อด้วยชื่อ host เพราะมีหลายชุดในหน้าเดียว
  · ผล probe มีสรุปหนึ่งบรรทัดเป็น `role="status"` + คำแทน icon สำหรับคนที่ไม่เห็น icon
- **dashboard** — `<main>` + `<h2>` + `aria-labelledby` ทุก card
- **ที่ใช้ร่วมกัน** — swatch ของธีมมี `aria-pressed` (ของเดิมบอกด้วยสีอย่างเดียว)
- controls ที่ options ใช้รวมศูนย์ที่ `src/options/controls.tsx` — id เกิดที่เดียว
  `htmlFor` กับ `aria-describedby` จึงลืมไม่ได้ที่ call site

**performance — วัดแล้ว มี budget กันบวม (v0.9.0)** · `build.mjs` พิมพ์ขนาดของ 3 script
ที่ผู้ใช้ต้องจ่ายโดยไม่ได้ขอ (content / main-world ฉีดทุกครั้งที่โหลดหน้า Roblox,
background parse ใหม่ทุกครั้งที่ SW ตื่น) แล้ว **fail build ถ้าเกิน budget**
· วัดที่ v0.8.0: content 286 KB · background 66 KB · main-world 1 KB
· budget ตั้งไว้สูงกว่าที่วัดราว 10% → โตปกติเงียบ โตกระโดดดัง

**Release build ✅ (v0.12.0)** — `npm run build:release` → `dist-release/` · โค้ดชุดเดียวกัน
ต่างกันแค่ Settings โชว์อะไร

- ตัด **Developer mode / API probe / Server clock** ออกทั้งหมด (gate ที่ `!IS_RELEASE`
  ไม่ใช่แค่ `developerMode` — setting เก่าที่ค้างว่าเปิดต้องไม่ปลุกมันกลับมา)
- **ไม่โชว์ toggle ของ feature ที่ยังไม่เสร็จ** (Avatar / Trading) และอันที่ทำไม่ได้
  ("Share reports with the community") · การ์ด "Coming later" บน Dashboard ก็ไม่โชว์
- คำอธิบายยาว → ฉบับสั้นผ่าน `explain(short, long)` ที่เก็บสองเวอร์ชันไว้ติดกัน
  เพื่อไม่ให้อันหนึ่งเก่าค้างโดยไม่มีใครเห็น
- dev build ชื่อ **Roblox Companion (dev)** จะได้โหลดคู่กันแล้วไม่สับสน

**เส้นที่ห้ามข้าม:** ประโยคที่บอกความไม่แน่นอน (upper bound / "อย่างน้อย" / "Roblox ไม่บอก")
**ห้ามหายไปใน release** · ที่ตัดคือชื่อ endpoint, เลข phase, `status 12`, §ต่าง ๆ
— ไม่ใช่ความซื่อสัตย์

**i18n — ไม่ทำ** (ดูหัวข้อ "สถานะปัจจุบัน" ด้านบน)

---

## กฎที่ใช้ได้ทุก phase

1. ห้ามอ่าน/เก็บ/ส่ง auth cookie (§30)
2. ห้าม auto-purchase (§8)
3. ห้าม deanonymize ผู้เล่นที่ Roblox ซ่อนไว้ (§13)
4. ห้าม bypass pagination cap / rate limit (§32 §33)
5. `unknown` ≠ `safe` (§13 §55)
6. feature ใหม่ทุกตัวต้องมี flag ใน `config/features.ts` (§25)
7. endpoint ที่เป็น `docs-only` ห้ามโชว์ใน UI จนกว่าจะ verify (§53)
