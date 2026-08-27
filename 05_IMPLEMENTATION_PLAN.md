# 05 — Implementation Plan

## สถานะปัจจุบัน

| Phase | ชื่อ | สถานะ |
|---|---|---|
| 0 | Research | ✅ เสร็จ — `01`–`05` + `PERMISSIONS.md` |
| 1 | Foundation | ✅ เสร็จ |
| 2 | Server Browser | ✅ เสร็จ |
| 3 | Smart Join | ✅ เสร็จ |
| 4 | Reputation ขั้นสูง | ✅ เสร็จ |
| 5 | Player Blacklist ขั้นสูง | 🟡 ส่วน local เสร็จ · presence ค้างรอ verify |
| 6 | Private Servers | 🔒 **บล็อกตัวเอง** — ต้อง verify API ก่อน (ดูล่าง) |
| 7 | Experience features | 🟡 playtime + live stats ✅ · quick search ⬜ |
| 8 | Profiles / Avatar / Themes | ⬜ |
| 9 | Trading | ⬜ |
| 10 | Polish | 🟡 Command Palette ✅ · a11y / i18n ⬜ |

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
| Detect private server availability | ⬜ | 6 |
| Create & Join FREE private server | ⬜ | 6 |
| Never auto-buy paid private server | ✅ (บังคับใน design) | 6 |

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

## Phase 5 — Player Blacklist ขั้นสูง 🟡

**เสร็จแล้ว:** Import / Export ทั้งชุด (settings + flags + blacklist + reports) เป็น JSON
พร้อม `schemaVersion` (§37) · **import เป็นการ merge ไม่ใช่ replace** — คนที่ restore backup เก่า
หรือรับ flag ชุดของเพื่อนมา ต้องไม่เสีย report ที่มีอยู่แล้ว · ถ้าชนกันของในเครื่องชนะ

**ยังค้าง:** presence check สำหรับ subset ที่ privacy อนุญาต — `presence.roblox.com` ยังเป็น
`docs-only` **ต้อง verify ก่อน** (ดู Phase 6) · **ห้าม deanonymization** (§13)

## Phase 6 — Private Servers 🔒 บล็อกตัวเองไว้ก่อน

**ยังไม่เขียนโค้ด และตั้งใจไม่เขียน** จนกว่าจะ verify API

Phase 3 สอนบทเรียนราคาแพง: ผมสร้าง region ทั้ง feature บน endpoint ที่เป็น `docs-only`
พอ ship แล้วถึงรู้ว่า Roblox ตอบ `status: 12` ต้องถอดทิ้งทั้งหมด

Phase 6 ตั้งอยู่บน endpoint ที่ยังไม่เคยยิงจริง **5 ตัว** → ความเสี่ยงเดิมเป๊ะ

**เครื่องมือที่ทำไว้แล้ว:** Settings → Developer Mode → **API probe**
ยิง endpoint จริงแล้วรายงานว่าได้อะไรกลับมา พร้อมเตือนเมื่อเอกสารกับความจริงไม่ตรงกัน

**ลำดับที่ถูกต้อง:** probe → อ่าน response จริง → อัปเดต `02_ROBLOX_API_MAP.md` → ค่อยสร้าง

เมื่อ verify แล้ว: detect enabled → หาที่เราเป็นเจ้าของ → สร้าง (ถ้าฟรี **สำหรับผู้ใช้คนนี้**) → join ·
Smart private preference (§29) · **ห้าม auto-buy** (§8)

## Phase 7 — Experience 🟡

**เสร็จแล้ว:**

- **Playtime** — เปิด session ตอนกด Join ปิดตอน join ที่อื่น / กด Stop / ค้างเกิน 45 นาที
  · label เขียนว่า *"since you joined"* ไม่ใช่ *"played"* เพราะ Roblox ไม่บอกอะไรเลย
  เกี่ยวกับเกมที่กำลังรัน → ตัวเลขนี้เป็น **upper bound** ไม่ใช่เวลาเล่นจริง
  · session ที่ค้างถูก cap ที่ 45 นาที ไม่งั้นปิดโน้ตบุ๊กทิ้งไว้ = playtime หลายชั่วโมง
- **Live stats** — like / dislike / playing count (RoPro คิดเงิน Plus — ของเราฟรี)
  · `approvalRatio` คืน `null` เมื่อยังไม่มีโหวต ไม่ใช่ 0% เพราะเกมใหม่ = ยังไม่รู้ผลตอบรับ ไม่ใช่แย่

**ยังค้าง:** quick search / quick play · invite links (ต้อง private server → phase 6)

## Phase 8 — Profiles / Avatar / Themes
mutual friends · last online · avatar sandbox · saved outfits · quick equip · themes (asset ของเราเอง)

## Phase 9 — Trading
trade panel · `ItemValueProvider` adapter (หลายเจ้า) · calculator · notifications ·
protection features (**default OFF** §24)

## Phase 10 — Polish 🟡

**Command Palette (§40 §41) ✅** — `Ctrl+K` / `Cmd+K` ทุกที่บน roblox.com

- **fuzzy match แบบ subsequence** ไม่ใช่ substring — พิมพ์ `jls` เจอ *Join lowest server*
  · ให้คะแนนตัวอักษรที่เป็น**ต้นคำ**สูงกว่ากลางคำ เพื่อให้เจตนาชนะความบังเอิญ
- **รู้ว่าอยู่หน้าไหน (§41)** — หน้าเกมดัน server command ขึ้นก่อน · หน้าโปรไฟล์ดัน
  copy UserId / blacklist · **ไม่ซ่อนอย่างอื่น** palette จึงไม่มีทางตัน
- command ที่รันไม่ได้ **ซ่อนตัวเอง** (ยังไม่เปิดหน้าเกม / feature ถูกปิด / ยังไม่เคย join)
- `preventDefault` จำเป็นจริง ๆ ไม่ใช่ความเรียบร้อย — Ctrl+K ผูกกับช่องค้นหาของ browser อยู่
- ไม่ดักตอนพิมพ์อยู่ใน input/textarea — คนกำลังพิมพ์ตั้งใจพิมพ์ตัวอักษร ไม่ได้เรียก palette

เพิ่ม command ใหม่ = เพิ่ม 1 entry ใน `COMMANDS` เหมือน tool rail

**ยังค้าง:** a11y ครบถ้วน · i18n · performance profiling

---

## กฎที่ใช้ได้ทุก phase

1. ห้ามอ่าน/เก็บ/ส่ง auth cookie (§30)
2. ห้าม auto-purchase (§8)
3. ห้าม deanonymize ผู้เล่นที่ Roblox ซ่อนไว้ (§13)
4. ห้าม bypass pagination cap / rate limit (§32 §33)
5. `unknown` ≠ `safe` (§13 §55)
6. feature ใหม่ทุกตัวต้องมี flag ใน `config/features.ts` (§25)
7. endpoint ที่เป็น `docs-only` ห้ามโชว์ใน UI จนกว่าจะ verify (§53)
