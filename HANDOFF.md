# HANDOFF — อ่านไฟล์นี้ก่อนทำงานต่อ

อัปเดต **28 ส.ค. 2026** · `npm run check` ผ่าน — typecheck สะอาด, **364 tests**, build ~1.9s
· source ~18,100 บรรทัด · **schema v7** · **v0.8.0** · feature ที่ ship แล้วดูที่ `shipped` ใน `config/features.ts`

---

## 1. ทำถึงไหนแล้ว

| Phase | สถานะ | หมายเหตุ |
|---|---|---|
| 0 Research | ✅ | `01`–`05` + `PERMISSIONS.md` |
| 1 Foundation | ✅ | transport · CSRF · scheduler · storage · content injection |
| 2 Server Browser | ✅ | §54 Definition of Done ครบ ยกเว้น private servers |
| 3 Smart Join | ✅ | 4 signal + Explain Why · **region ตัดออก** (ดู §3) |
| 4 Custom flags + notes | ✅ | §21 §22 |
| 5 Import / Export + Presence | ✅ | presence ทำแล้ว (ดู §13) · opt-in + optional permission |
| 6 Private Servers | ✅ | enabled · list · **join ได้แล้ว** (ดู §10) · สร้าง = ไม่ทำ (§8) |
| 7 Playtime + live stats | ✅ | quick search ทำแล้ว (ดู §11) |
| 8 Profiles / Avatar / Themes | 🟡 | Themes ✅ (§9) · **Profiles ✅** (§12) · Avatar ⬜ (write ยัง verify ไม่ได้) |
| 9 Trading | ⬜ | รอ verify |
| 10 Polish | 🟡 | Command Palette ✅ · a11y ของ panel/palette ✅ · i18n ⬜ |

**UI ปัจจุบัน** — surface หลักคือ **in-page floating panel** (Shadow DOM, ลากวางได้, จำตำแหน่ง)
มี tool rail ซ้าย + `Ctrl+K` command palette · popup / side panel ยังอยู่ครบสำหรับใช้นอก roblox.com

---

## 2. งานถัดไป — ต้องขอผู้ใช้ก่อน

**ขอให้ผู้ใช้รัน API probe แล้วส่งผลมา:**

> Settings → เปิด **Developer mode** → **Grant** (optional access) → **Run probe**
> (ต้องอยู่บนหน้าเกม Roblox)

probe ยิง **15 endpoint** จริง (read อย่างเดียว ไม่สร้าง ไม่ซื้อ ไม่ join ไม่รับ/ปฏิเสธเทรด)
แล้วเตือนเมื่อ `02_ROBLOX_API_MAP.md` ไม่ตรงกับความจริง · **รอบเดียวปลดล็อกได้ 4 phase:**

| probe | ปลดล็อก |
|---|---|
| `private-servers/enabled-in-universe` · `vip-servers/my-private-servers` | **Phase 6** |
| `presence/users` (ยิงใส่ตัวเอง — `gameId` โผล่ไหม) | **Phase 5** ที่ค้าง |
| `search-api/omni-search` | **Phase 7** quick search |
| `friends/{id}/friends` · `avatar/{id}/avatar` | **Phase 8** ที่เหลือ |
| `trades/inbound` | **Phase 9** |

4 host หลัง (presence / friends / avatar / trades) อยู่หลัง **optional permission** ที่ไม่ได้ขอ
ตอนติดตั้ง — ถ้ายังไม่กด Grant probe จะตอบ `skipped` ไม่ใช่ `failed` เพราะ "เราไม่มีสิทธิ์"
กับ "Roblox ปฏิเสธ" เป็นคนละคำตอบกันคนละเรื่อง

**ผล probe รอบแรก (28 ส.ค. 2026) — ปลดล็อกไปแล้ว 1 phase เต็ม ๆ:**

| ผล | ทำอะไรต่อ |
|---|---|
| private servers ทั้ง 2 ตัว ✅ | Phase 6 list เสร็จ · join ตามมาในรอบถัดไป (ดู §10) |
| presence ✅ (เฉพาะบัญชีตัวเอง) | Phase 5 เขียนได้ **แต่ยังไม่รู้ coverage ของคนอื่น** |
| friends ✅ แต่ `name` ว่าง | mutual friends ต้องยิง `users/{id}` เพิ่มทีละคน → คิด rate limit ก่อน |
| avatar ✅ | Phase 8 avatar เขียนได้ |
| omni-search ○ **ตอบว่าง** | **parameter ผิด** — แก้ด้วย `sessionId` ในรอบถัดไป (ดู §11) |
| trades ○ ไม่มีเทรดค้าง | ยังไม่เห็นรูปร่าง trade → Phase 9 ยังออกแบบไม่ได้ |

**ผล probe รอบสอง–สาม (v0.4.x, v0.5.0) — ปิดได้อีก 2 phase**

| ผล | ทำอะไรต่อ |
|---|---|
| `GET vip-servers/{id}` → **`joinCode: null`** | ทางนี้ตัน แต่ไม่ยอมแพ้ → probe ตัวถัดไป |
| `GET games/{placeId}/private-servers` → **มี `accessCode`** | ✅ **Phase 6 join เสร็จ** (§10) |
| omni-search + `sessionId` → **40 groups** | ✅ **Phase 7 quick search เสร็จ** (§11) |
| trades: inbound ว่าง · completed ก็ว่าง | ⬜ บัญชีนี้ไม่มีเทรดเลย → **ยังไม่เห็นรูปร่าง** |

**บทเรียนของรอบนี้:** endpoint แรกที่ตอบว่า "ไม่มี" ไม่ได้แปลว่าเรื่องจบ — `vip-servers/{id}`
บอกว่าไม่มี code แต่ `games/{placeId}/private-servers` ซึ่ง**ถามคนละคำถาม**มีให้
· ก่อนจะสรุปว่า "ทำไม่ได้" ให้ถามว่ายังมีคำถามอื่นที่ยังไม่ได้ถามไหม

**ที่ยังค้างจริง ๆ ตอนนี้เหลือ Phase 9 อย่างเดียว** และไม่ใช่เพราะ endpoint ใช้ไม่ได้ —
มันตอบ 200 ทั้ง inbound และ completed แต่บัญชีที่ทดสอบไม่มีเทรดสักอัน → **รอจนกว่าจะมี
เทรดจริง** แล้วรัน probe อีกครั้งเพื่อดู field ของ trade ก่อนออกแบบ

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
export const FEATURES_INTRODUCED_AT = {
  2: ['playtime'], 3: ['commandPalette'], 4: ['themes'],
  5: ['privateServers'], 6: ['quickSearch'], 7: ['profiles'],
};
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
| รายชื่อผู้เล่นใน public server | ⚠️ `playerTokens` **มีมาจริง** (แก้ 28 ส.ค. 2026) แต่ต่อกับตัวคนได้ทางเดียวคือ fingerprint thumbnail ซึ่ง §13 ห้าม → blacklist ตอบ `unknown` เพราะ**นโยบาย** ไม่ใช่เพราะทำไม่ได้ |
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
| `src/main-world/index.ts` | signature ของ `GameLauncher.joinPrivateGame` | join private server ล้มเหลว (**ไม่มี fallback ตั้งใจ**) |
| `src/content/injectors/quickActionBar.ts` | selector ปุ่ม Play (`PLAY_ANCHORS`) | แถบไม่โผล่ (panel ยังปกติ) |
| `src/features/themes/robloxSurfaces.ts` | class name ของ Roblox ที่ธีมไปทาสี | ธีมติดไม่ครบ → panel บอกว่าส่วนไหนไม่ match |
| `src/services/roblox/endpoints.ts` | endpoint + query + response shape | error โหลดเซิร์ฟไม่สำเร็จ |
| `src/features/smartJoin/regionData.ts` | IP range ของ datacenter | ไม่มีผลตอนนี้ (region ปิดอยู่) |
| `src/content/panel/mountPanel.tsx` | Shadow DOM + z-index | panel ไม่โผล่ / มุดใต้ Roblox |

**build guard ที่มีอยู่:** `assertNoRuntimeImports()` ใน `build.mjs` จะ **fail build**
ถ้า `content.js` หรือ `main-world.js` มี runtime `import()` — เพราะ CSP ของ roblox.com
จะบล็อกแล้ว **พังเงียบ ๆ ตรงจุดที่แย่ที่สุด** (ปุ่ม Join)

---

## 7. คำสั่งที่ใช้บ่อย

```bash
npm run check     # typecheck + 364 tests + build   ← รันก่อน commit เสมอ
npm run build     # → dist/
npm run watch     # rebuild อัตโนมัติ
```

**ทำงานเสร็จทุกครั้งให้ bump version ก่อน build** — แก้ `version` ใน `package.json`
· feature / phase ใหม่ = minor (`0.2.0` → `0.3.0`) · แก้บั๊ก / ปรับเล็กน้อย = patch (`0.2.0` → `0.2.1`)
· `build.mjs` จะ sync ลง `dist/manifest.json` ให้เอง → ผู้ใช้ดูเลขบนการ์ดที่ `chrome://extensions`
แล้วรู้ทันทีว่าโหลด build ใหม่แล้วจริง (`public/manifest.json` ไม่ต้องแตะ มันถูกทับตอน sync)

**หลังแก้โค้ด:** reload extension ที่ `chrome://extensions`
· ถ้าแก้ content script / panel → **reload หน้า roblox.com ด้วย**

**ดู state ที่เก็บไว้** (console ของ service worker):
```js
chrome.storage.local.get(null).then(console.log)
```
key: `rc:v` (=**4**) · `rc:settings` (override เท่านั้น) · `rc:flags` · `rc:blacklist` ·
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

---

## 9. Themes (Phase 8 — ส่วนที่ทำเสร็จแล้ว)

**สีล้วน** ไม่มีรูป ไม่มีฟอนต์ ไม่มี asset ใด ๆ (§23) · ไม่แตะ API ของ Roblox เลย จึง ship ได้
ทั้งที่ phase 6 / 8 / 9 ยังติด probe อยู่

| ไฟล์ | หน้าที่ |
|---|---|
| `models/theme.ts` | type + default (`preset: 'off'`) |
| `features/themes/colors.ts` | คณิตศาสตร์สี + **ด่านตรวจ hex** |
| `features/themes/presets.ts` | 6 palette ที่เราวาดเอง (Midnight / Carbon / Ember / Forest / Paper / Daylight) |
| `features/themes/robloxSurfaces.ts` | **จุดเปราะ** — class name ของ Roblox ที่ไปทาสี |
| `features/themes/buildThemeCss.ts` | สร้าง CSS (pure, มี test) |
| `content/injectors/themeInjector.ts` | ฉีด `<style>` + ทาสี shadow host + **วัดผลจริง** |
| `hooks/useThemeTokens.ts` | ทาสีหน้า extension (popup / side panel / dashboard / options) |
| `components/ThemePicker.tsx` | picker ที่ options กับ panel ใช้ร่วมกัน |
| `content/panel/ThemePane.tsx` | tool ใน panel + รายงานว่า match อะไรบ้าง |

**3 อย่างที่ตั้งใจออกแบบให้ตรงกับกฎของโปรเจกต์:**

1. **ผู้ใช้เลือก 3 สี ที่เหลือคำนวณเอง** — surface / border / muted text / สีตัวอักษรบนปุ่ม
   derive จาก background + text + accent ทั้งหมด palette จึงเพี้ยนไม่ได้
   · `readableTextOn()` เลือกขาว/ดำจาก contrast จริง (accent เหลืองอ่อนก็ยังอ่านออก)
2. **hex เท่านั้น** — `settings` เข้ามาทาง **import backup ได้** (`BackupService` เอา
   `bundle.settings` ไปใส่ทั้งก้อน) ถ้าไม่กรอง สตริงที่มี `}` จะ**ปิด rule แล้วเขียน CSS ของตัวเอง**
   ลงหน้าที่ผู้ใช้ล็อกอิน → `isHexColor()` ปฏิเสธทุกอย่างที่ไม่ใช่ hex แล้วถอยไปใช้ค่า default
3. **ไม่เคลม บอกเท่าที่วัดได้** — ฉีด `<style>` แล้ว**อ่าน `style.sheet` กลับ** (ถ้า CSP บล็อกจะเป็น
   `null` → panel บอกว่า "โดน CSP บล็อก") และนับ `querySelectorAll` ของทุก surface group
   → panel เขียนว่า "match 4 จาก 6 ส่วนบนหน้านี้" แทนที่จะปล่อยให้ผู้ใช้เดาว่าทำไมสีไม่ครบ

**สิ่งที่ตามมาด้วย (ต้องรู้):**

- **schema v3 → v4** เพราะ `themes` ship แบบ default `true` → ต้องอยู่ใน `FEATURES_INTRODUCED_AT[4]`
  ไม่งั้นซ้ำรอย playtime (กฎข้อ 2 §3) · flag เปิดแต่ `preset: 'off'` → **ยังไม่ทาสีอะไรจนกว่าจะเลือกเอง**
- **`SHIPPED_PHASE` ถูกถอดออก** เปลี่ยนเป็น `shipped: boolean` ต่อ feature — ของเดิมสมมติว่า
  phase ship เรียงกัน แต่ phase 10 ship ไปแล้วขณะที่ 8/9 ยังไม่ทำ → toggle ของ profiles /
  avatar / trading **เปิดได้แต่ไม่ทำอะไร** มาตลอด ตอนนี้ disable ถูกต้องแล้ว
- **`BackupService` รับ bundle เวอร์ชันเก่าได้แล้ว** (ปฏิเสธเฉพาะที่ใหม่กว่า) — ถ้าไม่แก้ การ bump
  schema ทุกครั้งจะทำให้ backup ที่ผู้ใช้ export ไว้ก่อนหน้าใช้ไม่ได้เงียบ ๆ ซึ่งค้านกับจุดประสงค์ของ backup

**ผล verify จากผู้ใช้ (28 ส.ค. 2026) — ยิงบนหน้า Roblox จริง:**

- **`<style>` ไม่โดน CSP บล็อก** → content script เขียน stylesheet ลงหน้า roblox.com ได้
- **match 6/6 กลุ่ม** — page 5 · navigation 2 · cards 19 · buttons 16 · links 8 · fields 4
  → selector ใน `robloxSurfaces.ts` ใช้ได้จริงทั้งหมด ณ วันนี้

**กฎที่เพิ่มหลังจากนั้น (v0.2.1): palette ต้องตรงกับธีมของ Roblox**

CSS ของเราตั้งได้แค่ 3 property (`background-color` / `color` / `border-color` — มี test บังคับ)
จึง**ซ่อนอะไรไม่ได้เลย** แต่ทาพื้นหลังเข้มใต้ตัวอักษรเข้มของ Roblox ได้ → เนื้อหายังอยู่ครบแต่
**อ่านไม่เห็น** ซึ่งหน้าตาเหมือนหน้าเว็บโหลดไม่ขึ้น (อาการที่ผู้ใช้เจอบนหน้า profile)

→ `conflictsWithPage()` เทียบ `base` ของ palette กับ class `.dark-theme` / `.light-theme` ของ Roblox
ถ้าไม่ตรง **หยุดทาหน้า Roblox** (ของเราเองยังทาครบ เพราะเราคุมสีตัวอักษรเองทั้งหมด) แล้วบอกเหตุผล
ใน panel · ถ้า Roblox ไม่ได้ stamp class เลย = ไม่รู้ → **ไม่ถือว่าขัดกัน ไม่เดา**

---

## 10. Private Servers (Phase 6 — ส่วนที่ verify แล้ว)

| ไฟล์ | หน้าที่ |
|---|---|
| `models/privateServer.ts` | type — ทุก field อ่านจาก response จริง ไม่ได้อ่านจาก docs |
| `features/privateServers/privateServers.ts` | parse · group by universe · sort · describeExpiry (pure, มี test 13 เคส) |
| `services/roblox/privateServersApi.ts` | 2 endpoint ที่ยิงจริงแล้วเท่านั้น |
| `background/handlers/privateServerHandlers.ts` | โหลดตอนผู้ใช้ขอ **ไม่ใช่ทุกครั้งที่ build state** |
| `components/PrivateServersPane.tsx` | tool 🔒 ใน panel + tab ใน popup / side panel |

**ปุ่ม Join ทำได้แล้ว (v0.6.0) — ใช้เวลา 3 probe กว่าจะหาเจอ:**

| probe | ผล |
|---|---|
| `vip-servers/my-private-servers` | ไม่มี `accessCode` |
| `GET vip-servers/{id}` | **`joinCode: null`** → ทางที่เหลือคือ PATCH ซึ่งเป็น write |
| `GET games/{placeId}/private-servers` | ✅ **มี `accessCode`** → join ได้ฟรี ๆ |

→ `Roblox.GameLauncher.joinPrivateGame(placeId, accessCode)` ใน MAIN world
(ตัวเดียวกับที่หน้า private server ของ Roblox เรียกเอง) · **ไม่แตะ PATCH เลย** ลิงก์ที่ผู้ใช้
แจกเพื่อนไว้ไม่ถูกล้าง

**`accessCode` = ความลับ · กติกาที่บังคับไว้ในโค้ด:**

- อยู่ใน `context.privateServerCodes` (SW memory) **เท่านั้น** — ไม่เข้า `AppState`
  ไม่ลง `chrome.storage` · UI join ด้วย `vipServerId` แล้ว SW แปลงกลับตอนจะยิงจริง
- `parseJoinable()` แยก code ออกจาก view model ตั้งแต่ parse **มี test ยืนยันว่า
  serialize view model แล้วต้องไม่เจอ code**
- **ไม่มี fallback chain** — start URL / deeplink รับได้แต่ jobId ถ้าปล่อย fall through
  ผู้ใช้จะโดนโยนเข้า **public** server ทั้งที่กดปุ่ม join private → fail ตรง ๆ ดีกว่าโกหก

**สิ่งที่ยังตั้งใจไม่ทำ:**

- **สร้าง private server** — ใช้ Robux → §8 ห้าม auto-purchase
- **PATCH `vip-servers/{id}`** — regenerate ลิงก์ได้ → ไม่แตะ
- **match ด้วย `universeId` ไม่ใช่ `placeId`** — เกมหนึ่งมีหลาย place ถ้า match ด้วย place
  ผู้ใช้จะมองไม่เห็น private server ของตัวเอง
- **`expirationDate` ปี 2124 = ไม่แสดง** — Roblox ใช้วันที่ร้อยปีข้างหน้าแทนคำว่า "ไม่หมดอายุ"
  การเขียนว่า "expires in 35,000 days" คือ noise ที่แต่งตัวเป็นข้อมูล
- **ราคาอ่านต่อผู้ใช้** — `priceInRobux` มาจาก response ของบัญชีนี้ ไม่ใช่ราคาที่เกมประกาศ

**bug เก่าที่เจอระหว่างทาง (แก้แล้ว):** ปุ่ม **⚡ Smart Join** บนแถบข้างปุ่ม Play เป็น
disabled พร้อม tooltip ว่า *"arrives in phase 3"* มาตั้งแต่ phase 2 — ทั้งที่ Smart Join
ship ไปตั้งแต่ phase 3 · placeholder ซื่อสัตย์ได้แค่ตอนที่ของยังไม่มี หลังจากนั้นมันคือคำโกหก

---

## 11. Quick Search (Phase 7 — ปิดจ๊อบแล้ว)

`sessionId` คือทั้งหมดที่ขาด · ไม่มี = `searchResults: []` · มี = 40 result groups

| ไฟล์ | หน้าที่ |
|---|---|
| `features/search/parseSearch.ts` | parse + กรอง group ที่ไม่ใช่ `Game` + dedupe (pure, test 9 เคส) |
| `services/roblox/searchApi.ts` | ยิง omni-search · ถือ `sessionId` เดียวตลอดอายุ service worker |
| `components/SearchPane.tsx` | tool 🔍 ใน panel + tab ใน popup / side panel |

**3 อย่างที่ response บังคับให้ต้องตัดสินใจ:**

1. **`isSponsored: true` มาปนในผลค้นหา** — Roblox ยัดโฆษณามาด้วย
   · ซ่อน = เราตัดสินใจแทนผู้ใช้ · โชว์เฉย ๆ = เอาโฆษณามาเสิร์ฟเป็นผลค้นหา
   → **ติดป้าย `sponsored`** เป็นทางเดียวที่ไม่ใช่ทั้งสองอย่าง
2. **ไม่มี `placeId`** มีแต่ `universeId` → กด Open ถึงค่อยยิง `games?universeIds=`
   เอา `rootPlaceId` · resolve ทุกแถวล่วงหน้า = เปลืองโควต้ากับแถวที่ไม่มีใครแตะ
3. **`nativeAdData`** — blob ของโฆษณา · parser ไม่หยิบมาเลย และมี test บังคับไว้

**debounce 450ms** เพราะ request พวกนี้ใช้โควต้าเดียวกับ server browser (§32)

**Phase 9 ยังบล็อกอยู่ แต่คนละเหตุผลกับเมื่อก่อน** — `trades/inbound` และ `trades/completed`
ตอบ 200 ทั้งคู่ (envelope `{previousPageCursor, nextPageCursor, data}` ถูกต้อง) แต่บัญชีที่ทดสอบ
**ไม่มีเทรดเลยสักอัน** → ไม่ใช่ "endpoint ใช้ไม่ได้" แต่เป็น "ยังไม่มีข้อมูลให้ดูรูปร่าง"
→ ต้องรอจนกว่าจะมีเทรดจริงสักอัน ถึงจะออกแบบ Phase 9 ได้โดยไม่ต้องเดา field

---

## 12. Profiles — mutual friends (Phase 8)

| ไฟล์ | หน้าที่ |
|---|---|
| `features/profiles/mutualFriends.ts` | intersect + คำอธิบายผล (pure, test 8 เคส) |
| `services/roblox/friendsApi.ts` | `users/authenticated` (cache) + `friends/{id}/friends` |
| `background/handlers/profileHandlers.ts` | เช็คตอนผู้ใช้ขอ **เท่านั้น** |
| `components/ProfilePane.tsx` | tool 👤 ใน panel (โผล่เฉพาะตอนอยู่หน้าโปรไฟล์) |
| `options/OptionalAccess.tsx` | ปุ่ม Grant / Revoke ที่ใช้ร่วมกันทั้ง probe และ profiles |

**สิ่งที่ response บังคับ:**

- **`name` / `displayName` ว่างเปล่า** → เทียบด้วย **id** เท่านั้น · แสดงได้แค่**จำนวน**
  จะโชว์ชื่อต้องยิง `users/{id}` ทีละคน = เปลืองโควต้า → ไม่ทำ แล้วเขียนใน UI ว่าทำไม
- **list ที่ private ≠ list ที่ว่าง** — `intersectFriends()` แยกเป็น 3 verdict
  (`compared` / `their-list-private` / `own-list-unavailable`) เพราะ "ไม่มีเพื่อนร่วมกัน"
  กับ "เขาไม่เปิดให้ดู" ผู้ใช้ทำอะไรกับมันต่างกัน · มี test บังคับว่าห้ามรายงานเหมือนกัน
- แสดง **จำนวนเพื่อนทั้งสองฝั่ง** ด้วย — "2 จาก 40" กับ "2 จาก 800" คือคนละเรื่อง

**privacy:** อ่าน friend list ของ**คนอื่น** → `friends.roblox.com` เป็น optional permission
ที่ไม่ขอตอนติดตั้ง · panel ขอเองไม่ได้ (`chrome.permissions` ไม่มีใน content script)
จึงส่งไปกด Grant ที่ Settings · **ไม่เก็บอะไรของคนนั้นลง storage เลย** อยู่ใน SW ชั่วคราว
แล้วโดนทับทันทีที่เปิดโปรไฟล์คนใหม่

**Avatar ยังไม่ทำ** — อ่าน avatar ได้ (verified) แต่ feature จริงคือ **equip** ซึ่งเป็น
`POST avatar/set-wearing-assets` = **write ที่ยังไม่ verify** · probe เป็น read-only ล้วน
จึง verify ไม่ได้โดยไม่เปลี่ยน contract ของมัน → ถ้าจะทำต้องคุยกันก่อนว่าจะ probe write
แบบ **no-op** (เขียนชุดที่ใส่อยู่แล้วกลับไปเหมือนเดิม) ไหม

---

## 13. Presence — "คนใน blacklist อยู่ไหน" (Phase 5)

**endpoint verify แล้ว** (`presence/users` — เห็น `gameId` = jobId ของเซิร์ฟ)
แต่มาพร้อมข้อจำกัดที่กำหนดดีไซน์ทั้งหมด: **Roblox คืน location ให้เฉพาะคนที่ privacy
ของเขาอนุญาต** ซึ่งส่วนใหญ่คือ "ไม่" → feature นี้ตอบได้แค่ส่วนน้อย และ**ต้องบอกว่าส่วนน้อยแค่ไหน**

| ไฟล์ | หน้าที่ |
|---|---|
| `features/playerBlacklist/presence.ts` | parse · `detectedIn` · `describePresence` (pure, test 12 เคส) |
| `services/roblox/presenceApi.ts` | POST batch (cap 100/ครั้ง) |
| `background/handlers/presenceHandlers.ts` | ด่าน 3 ชั้น (ดูล่าง) |
| `stateBuilder.ts` | `withPresence()` แปะผลลง ServerView + `summariseBlacklist()` |

**3 ด่านก่อนจะยิงได้เลยสักครั้ง:**

1. `privacy.allowPresenceChecks` = **off เป็นค่าเริ่มต้น** (ไปอ่านข้อมูลคนอื่น)
2. `presence.roblox.com` เป็น **optional permission** ต้องกด Grant เอง
3. **ยิงตอนกดปุ่มเท่านั้น** ไม่มี polling — poll ตำแหน่งคนอื่นเป็นพื้นหลัง = สอดแนม
   ไม่ว่าจะเรียกมันว่าอะไร

**กฎที่ใส่ไว้ใน `summariseBlacklist()`:**

`none-detected` ใช้ได้เฉพาะตอนที่ **Roblox บอกตำแหน่งครบทุกคน** แล้วไม่มีใครอยู่ที่นี่
· ถ้ามีแม้แต่คนเดียวที่ถูกปิดบัง → **`unknown`** ต่อให้ที่เหลือสะอาดหมด
เพราะคนที่ถูกปิดบังคือคนที่เราอยากรู้ที่สุดพอดี

ServerRow ขึ้นแบนเนอร์เตือน**เฉพาะเซิร์ฟที่ Roblox ยืนยันว่ามีคนใน blacklist อยู่**
· **ไม่มีป้าย "ปลอดภัย" ตรงข้าม** เพราะการไม่มีป้ายไม่ได้แปลว่าเช็คแล้วไม่เจอ

**ไม่เก็บลง storage เลย** — ตำแหน่งของคนอื่นอยู่ใน SW memory ชั่วคราวเท่านั้น
