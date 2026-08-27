# HANDOFF — อ่านไฟล์นี้ก่อนทำงานต่อ

อัปเดต **28 ส.ค. 2026** · `npm run check` ผ่าน — typecheck สะอาด, **269 tests**, build ~1.9s
· source ~13,200 บรรทัด · schema v3 · `SHIPPED_PHASE = 10`

---

## 1. ทำถึงไหนแล้ว

| Phase | สถานะ | หมายเหตุ |
|---|---|---|
| 0 Research | ✅ | `01`–`05` + `PERMISSIONS.md` |
| 1 Foundation | ✅ | transport · CSRF · scheduler · storage · content injection |
| 2 Server Browser | ✅ | §54 Definition of Done ครบ ยกเว้น private servers |
| 3 Smart Join | ✅ | 4 signal + Explain Why · **region ตัดออก** (ดู §3) |
| 4 Custom flags + notes | ✅ | §21 §22 |
| 5 Import / Export | 🟡 | local ครบ · presence ค้างรอ verify |
| 6 Private Servers | 🔒 | **บล็อกไว้ตั้งใจ** รอ probe (ดู §2) |
| 7 Playtime + live stats | 🟡 | quick search ยังไม่ทำ |
| 8 Profiles / Avatar / Themes | ⬜ | **Themes ทำได้เลย** (CSS ล้วน) ที่เหลือรอ verify |
| 9 Trading | ⬜ | รอ verify |
| 10 Command Palette | ✅ | a11y / i18n ยังไม่ครบ |

**UI ปัจจุบัน** — surface หลักคือ **in-page floating panel** (Shadow DOM, ลากวางได้, จำตำแหน่ง)
มี tool rail ซ้าย + `Ctrl+K` command palette · popup / side panel ยังอยู่ครบสำหรับใช้นอก roblox.com

---

## 2. งานถัดไป — ต้องขอผู้ใช้ก่อน

**ขอให้ผู้ใช้รัน API probe แล้วส่งผลมา:**

> Settings → เปิด **Developer mode** → **Run probe** (ต้องอยู่บนหน้าเกม Roblox)

probe ยิง 7 endpoint จริง (read อย่างเดียว ไม่สร้าง ไม่ซื้อ ไม่ join) แล้วเตือนเมื่อ
`02_ROBLOX_API_MAP.md` ไม่ตรงกับความจริง · **ผลของ 2 ตัวนี้ปลดล็อก Phase 6:**

- `private-servers/enabled-in-universe/{universeId}`
- `vip-servers/my-private-servers`

ยังมี **8 endpoint ที่เป็น `docs-only`** ค้างอยู่ → Phase 6 / 8 / 9 ตั้งอยู่บนพวกนี้ทั้งหมด

**ถ้าอยากทำต่อโดยไม่ต้องรอ:** ทำ **Themes** (ส่วนหนึ่งของ Phase 8) ได้เลย เป็น CSS injection
ล้วน ไม่แตะ API — แต่ **asset ต้องเป็นของเราเอง ห้ามใช้ของ RoPro** (§23)

---

## 3. บทเรียนที่แลกมาแพง — อย่าทำซ้ำ

### กฎข้อ 1: verify endpoint ก่อนสร้าง UI

ผม (Claude) สร้าง feature **region detection** ทั้งชุดบน `join-game-instance` ที่ยังเป็น
`docs-only` — scoring, ตาราง IP→region, probe, settings UI, optional permission, test ครบ

พอผู้ใช้ลองจริง Roblox ตอบ **`status: 12`** ปฏิเสธ request จาก browser เพราะต้องมี
`User-Agent: Roblox/WinInet` ซึ่งเป็น **forbidden header** ที่ extension เซ็ตไม่ได้
(ปลอมผ่าน `declarativeNetRequest` ได้ แต่ = ปลอมตัวเป็น game client → **เราไม่ทำ** §55)

→ ต้องถอดทิ้งทั้งหมด · จำแนกใหม่เป็น 🔵 **ต้องมี backend**
→ นี่ผิด **กฎข้อ 7 ของ `05_IMPLEMENTATION_PLAN.md` ที่ผมเขียนไว้เอง**
→ จึงสร้าง **API probe** ขึ้นมาเพื่อไม่ให้เกิดซ้ำ

### กฎข้อ 2: ship feature ที่ default เปิด ต้องเพิ่มใน `FEATURES_INTRODUCED_AT`

```ts
// src/config/features.ts
export const FEATURES_INTRODUCED_AT = { 2: ['playtime'], 3: ['commandPalette'] };
```

settings เก็บเป็น **override** ไม่ใช่ snapshot แต่ค่าที่เก็บไว้ก่อนหน้ายังทับ default ใหม่ได้
→ **playtime ship ออกไปแล้วผู้ใช้หาไม่เจอเลย** เพราะ `false` เก่าค้างอยู่
→ ถ้าเพิ่ม feature ใหม่ที่ default `true` **ต้องเพิ่มชื่อลง registry นี้ + bump schema version**

### กฎข้อ 3: content script เข้าถึง chrome API ได้จำกัดมาก

`chrome.runtime.openOptionsPage` **ไม่มี** ใน content script (มีแค่ `sendMessage`, `connect`,
`getURL`, `storage`, `i18n`) — โค้ดบรรทัดเดียวกันใช้ได้ในหน้า extension แต่ throw เงียบใน panel
→ ต้องส่งผ่าน service worker (`ui/openOptions`)

เช่นเดียวกับ `chrome.sidePanel.open()` ที่ **user gesture ไม่ข้าม `sendMessage`**
([crbug 355266358](https://issues.chromium.org/issues/355266358))

### กฎข้อ 4: อย่าใช้ `all: initial` กับ shadow host

inline style **มีลำดับสูงกว่า `:host`** → มันล้าง `position` กับ `z-index` ทิ้ง
panel เลยมุดใต้ layer ของ Roblox · ต้องตั้ง property ที่ต้องการ inline ตรง ๆ พร้อม `!important`

### กฎข้อ 5: อย่าเขียนไฟล์ทับด้วย Python ถ้ามี emoji

ผมทำ `README.md` กับ `02_ROBLOX_API_MAP.md` **พังเป็น 0 byte สองครั้ง** เพราะ
`io.open(p,'w')` truncate ไฟล์ก่อน แล้วไปตายตอน encode surrogate pair ของ emoji
→ ใช้ Edit/Write tool กับไฟล์ที่มี emoji

---

## 4. ข้อจำกัดที่พิสูจน์แล้ว (อย่าเสียเวลาลองใหม่)

| อยากได้ | ความจริง |
|---|---|
| ping จริงของผู้ใช้ | ⚠️ ไม่มี · ที่ API คืนคือค่าเฉลี่ยของผู้เล่น**ในเซิร์ฟนั้น**วัดไปหาเซิร์ฟนั้น |
| ใช้ ping หาเซิร์ฟใกล้ตัว | ⚠️ ไม่ได้ · Roblox จับคู่คนเข้าเซิร์ฟใกล้บ้านอยู่แล้ว → เซิร์ฟดีทุกทวีป ping ต่ำหมด |
| region ของเซิร์ฟ | 🔵 ต้องมี backend · `status: 12` (ดู §3) |
| รายชื่อผู้เล่นใน public server | ⚠️ `playerTokens` **ว่างเสมอ** → blacklist ตอบ `unknown` ตลอด |
| server uptime / created / version | ⚠️ ไม่มี · ใช้ `firstSeenAt` ของเราเองเป็น proxy |
| server list ครบทุกตัว | ⚠️ Roblox cap ที่ ~150–500 แล้วคืน cursor `null` (staff บอกว่าตั้งใจ) |
| เช็ค JobId เดี่ยว ๆ | ⚠️ ไม่มี · ต้อง scan แล้ว match เอง |
| เวลาเล่นในเกมจริง | ⚠️ ไม่มี · นับจากตอนกด Join = **upper bound** เท่านั้น |

---

## 5. กฎที่ต้องรักษาไว้

1. **`unknown` ≠ `safe`** — signal ที่ตัดสินไม่ได้ต้อง**ตัดออกจากทั้งเศษและส่วน** ไม่ใช่ให้ 0
   (เซิร์ฟที่เพิ่งเห็นครั้งแรกต้องไม่โดนหักคะแนนเหมือน "เก่า")
2. **ห้ามอ่าน/เก็บ/ส่ง `.ROBLOSECURITY`** — ไม่ขอ permission `cookies` ด้วยซ้ำ
3. **ห้ามปลอม header เพื่อผ่านด่านของ Roblox** (§55)
4. **ห้าม auto-purchase อะไรที่ใช้ Robux** (§8)
5. **ห้าม deanonymize** ผู้เล่นที่ Roblox ซ่อนไว้ (§13)
6. **ห้าม bypass** pagination cap / rate limit (§32 §33)
7. **endpoint `docs-only` ห้ามโชว์ใน UI จนกว่าจะ verify** (§53) — กฎที่ผมเคยพลาดเอง
8. feature ใหม่ต้องมี flag ใน `config/features.ts` (§25)
9. UI **ห้ามเรียก `chrome.storage` ตรง ๆ** ต้องผ่าน Repository (§36)

---

## 6. จุดเปราะ — พังเมื่อ Roblox เปลี่ยน

| ไฟล์ | ผูกกับอะไร | อาการ |
|---|---|---|
| `src/main-world/index.ts` | signature ของ `Roblox.GameLauncher.joinGameInstance` | toast "Used the deeplink fallback" |
| `src/content/injectors/quickActionBar.ts` | selector ปุ่ม Play (`PLAY_ANCHORS`) | แถบไม่โผล่ (panel ยังปกติ) |
| `src/services/roblox/endpoints.ts` | endpoint + query + response shape | error โหลดเซิร์ฟไม่สำเร็จ |
| `src/features/smartJoin/regionData.ts` | IP range ของ datacenter | ไม่มีผลตอนนี้ (region ปิดอยู่) |
| `src/content/panel/mountPanel.tsx` | Shadow DOM + z-index | panel ไม่โผล่ / มุดใต้ Roblox |

**build guard ที่มีอยู่:** `assertNoRuntimeImports()` ใน `build.mjs` จะ **fail build**
ถ้า `content.js` หรือ `main-world.js` มี runtime `import()` — เพราะ CSP ของ roblox.com
จะบล็อกแล้ว **พังเงียบ ๆ ตรงจุดที่แย่ที่สุด** (ปุ่ม Join)

---

## 7. คำสั่งที่ใช้บ่อย

```bash
npm run check     # typecheck + 269 tests + build   ← รันก่อน commit เสมอ
npm run build     # → dist/
npm run watch     # rebuild อัตโนมัติ
```

**หลังแก้โค้ด:** reload extension ที่ `chrome://extensions`
· ถ้าแก้ content script / panel → **reload หน้า roblox.com ด้วย**

**ดู state ที่เก็บไว้** (console ของ service worker):
```js
chrome.storage.local.get(null).then(console.log)
```
key: `rc:v` (=3) · `rc:settings` (override เท่านั้น) · `rc:flags` · `rc:blacklist` ·
`rc:playtime` · `rc:reports:{placeId}` · `rc:history:{placeId}` · `rc:lastJoined:{placeId}`

---

## 8. เอกสารอื่น

| ไฟล์ | เนื้อหา |
|---|---|
| `README.md` | วิธีใช้ · build · ข้อจำกัด · โครงสร้าง |
| `01_FEATURE_MATRIX.md` | RoPro Free/Plus/Rex ทุก feature + เราทำได้แค่ไหน |
| `02_ROBLOX_API_MAP.md` | endpoint ทุกตัว + สถานะ `verified-live` / `docs-only` |
| `03_ARCHITECTURE.md` | layer · message protocol · storage · error isolation |
| `04_UI_UX.md` | in-page panel · tool rail · honest labeling rules |
| `05_IMPLEMENTATION_PLAN.md` | รายละเอียดแต่ละ phase + §54 Definition of Done |
| `PERMISSIONS.md` | เหตุผลของทุก permission + ที่จงใจไม่ขอ |
