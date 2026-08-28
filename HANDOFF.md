# HANDOFF — อ่านไฟล์นี้ก่อนทำงานต่อ

อัปเดต **28 ส.ค. 2026** · `npm run check` ผ่าน — typecheck สะอาด, **414 tests**, build ~2.0s
· source ~20,300 บรรทัด · **schema v7** · **v0.11.1** · feature ที่ ship แล้วดูที่ `shipped` ใน `config/features.ts`

---

## 1. ทำถึงไหนแล้ว

| Phase | สถานะ | หมายเหตุ |
|---|---|---|
| 0 Research | ✅ | `01`–`05` + `PERMISSIONS.md` |
| 1 Foundation | ✅ | transport · CSRF · scheduler · storage · content injection |
| 2 Server Browser | ✅ | §54 Definition of Done **ปิดครบแล้ว** (ที่เหลือคือข้อที่จงใจไม่ทำ) |
| 3 Smart Join | ✅ | 4 signal + Explain Why · **region ตัดออก** (ดู §3) |
| 4 Custom flags + notes | ✅ | §21 §22 |
| 5 Import / Export + Presence | ✅ | presence ทำแล้ว (ดู §13) · opt-in + optional permission |
| 6 Private Servers | ✅ | enabled · list · join (§10) · **share link + smart preference (§14)** · สร้าง = ไม่ทำ (§8) |
| 7 Playtime + live stats | ✅ | quick search (§11) · visit log ต่อเซิร์ฟ (§17) · **session tracking จาก presence (§18)** |
| 8 Profiles / Avatar / Themes | 🟡 | Themes ✅ (§9) · Profiles ✅ (§12) · **Last online ⏳ รอ probe** · Avatar ⬜ (write ยัง verify ไม่ได้) |
| 9 Trading | ⬜ | บล็อก — endpoint ตอบ 200 แต่บัญชีทดสอบไม่มีเทรดให้ดูรูปร่าง |
| 10 Polish | ✅ | Command Palette ✅ · **a11y ครบทุก surface (§15)** · **size budget (§16)** · i18n = **ไม่ทำ** |

**i18n — ปิดเรื่องแล้ว (28 ส.ค. 2026)** ผู้ใช้ตัดสินใจเองว่า **UI ภาษาอังกฤษ global กว่า**
การแปลเป็นภาษาใดภาษาหนึ่ง → ไม่มี `_locales/` ไม่มี `chrome.i18n` และ **ห้ามเพิ่มกลับโดยไม่ถาม**
· เอกสารยังเป็นไทย · comment ในโค้ดยังเป็นอังกฤษ (เหมือนเดิม)

**UI ปัจจุบัน** — surface หลักคือ **in-page floating panel** (Shadow DOM, ลากวางได้, จำตำแหน่ง)
มี tool rail ซ้าย + `Ctrl+K` command palette · popup / side panel ยังอยู่ครบสำหรับใช้นอก roblox.com

---

## 1b. เหลืออะไรจริง ๆ (อ่านแค่ตารางนี้ก็พอ)

| งาน | ติดอะไร | ปลดล็อกยังไง |
|---|---|---|
| **Phase 9 Trading** ทั้ง phase | บัญชีทดสอบไม่มีเทรดสักอัน → ไม่เห็น field | รอมีเทรดจริง 1 อัน แล้วรัน probe ซ้ำ |
| **Avatar (equip / body scales)** | เป็น **write** (`set-wearing-assets`) · probe เป็น read-only ล้วน | ต้องตกลงกันก่อนว่าจะ probe write แบบ **no-op** ไหม |
| **Last online** | endpoint ยัง `planned` | **เพิ่มเข้า probe แล้ว (v0.9.0)** → รันรอบหน้าแล้วดูผล |
| *(ทำได้เลยโดยไม่ต้องรอ)* Avatar sandbox + saved outfits แบบไม่มีปุ่ม equip | — | อ่าน avatar + thumbnail = verified แล้ว |

**ทุกอย่างอื่นที่ทำได้โดยไม่ต้องรอใคร ปิดหมดแล้วใน v0.9.0** (§14 §15 §16)

---

## 2. งานถัดไป — ต้องขอผู้ใช้ก่อน

**ขอให้ผู้ใช้รัน API probe แล้วส่งผลมา:**

> Settings → เปิด **Developer mode** → **Grant** (optional access) → **Run probe**
> (ต้องอยู่บนหน้าเกม Roblox)

probe ยิง **16 endpoint** จริง (read อย่างเดียว ไม่สร้าง ไม่ซื้อ ไม่ join ไม่รับ/ปฏิเสธเทรด)
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

**probe รอบหน้ามีของใหม่ 1 ตัว (v0.9.0):** `presence/last-online` — เป็นตัวสุดท้ายที่กั้น
"Last online" ของ Phase 8 อยู่ · host เดียวกับ presence ที่ Grant ไปแล้ว จึงไม่ต้องขอ
permission เพิ่ม แต่**คนละ endpoint คนละกฎ privacy** → การที่ `presence/users` ตอบ
ไม่ได้แปลว่าตัวนี้จะตอบ

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
| server uptime / created / version | ⚠️ **ไม่มี และปิดประตูแล้ว** · ไม่อยู่ใน response · jobId เป็น UUID **v4** สุ่มล้วน (ยืนยัน 198 ตัว 28 ส.ค. 2026) จึงไม่มี timestamp สำรอง → เหลือทางเดียวคือ `firstSeenAt` ของเราเองเป็น **floor** (§17) |
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
10. **ทุก response ของ `UiRequest` คือ `AppState` ทั้งก้อน** · ข้อยกเว้นเดียวคือ `UiQuery`
    ซึ่งมีไว้สำหรับ **ความลับ** เท่านั้น (ดู §14) — อย่าเพิ่ม query เพราะอยากประหยัด round trip
11. **ห้ามใส่ i18n / `_locales` / `chrome.i18n` กลับเข้ามาโดยไม่ถาม** — UI อังกฤษล้วนเป็น
    การตัดสินใจของผู้ใช้ ไม่ใช่งานที่ยังทำไม่เสร็จ
12. **`build.mjs` มี size budget** ของ 3 script ที่ถูกฉีดเข้าหน้า Roblox (ดู §16) —
    ขึ้น budget ได้ แต่ต้องตั้งใจขึ้นพร้อมวัดใหม่ ไม่ใช่ขึ้นให้ build ผ่าน

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
npm run check     # typecheck + 414 tests + build   ← รันก่อน commit เสมอ
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

---

## 14. Private servers รอบสอง — share link + smart preference (v0.9.0)

### 🔗 Share link — `joinCode` **ไม่ใช่** `accessCode`

สองค่านี้ฟังดูเหมือนกันแต่คนละตัวคนละที่ใช้ และตรงนี้เกือบพลาด:

| | มาจาก | ใช้กับ |
|---|---|---|
| `accessCode` | `GET games/{placeId}/private-servers` | `joinPrivateGame()` — launcher เท่านั้น |
| `joinCode` | `GET vip-servers/{id}` | ลิงก์เว็บ `?privateServerLinkCode=` |

→ ลิงก์ที่ประกอบจาก `accessCode` จะ **หน้าตาถูกทุกอย่างแต่เข้าไม่ได้** · ปุ่ม Share link (โผล่เฉพาะ
เซิร์ฟที่ผู้ใช้**เป็นเจ้าของ** — ของเพื่อนที่แชร์มาให้ ไม่ใช่ของเราที่จะเอาไปแจกต่อ) จึง
**อ่าน `joinCode` อย่างเดียว**: มี = copy ลิงก์ให้ · ไม่มี (`null`) = บอกว่า Roblox ยังไม่เคย
สร้างลิงก์ให้เซิร์ฟนี้ แล้วให้ไปสร้างเองบนหน้า Roblox

**ทำไมไม่สร้างให้** — สร้าง = `PATCH vip-servers/{id}` = **regenerate** ลิงก์เดิม
→ ลิงก์ที่ผู้ใช้แจกเพื่อนไปแล้วตายทันทีโดยไม่มีใครรู้ตัว (§8)

### one-shot query — ข้อยกเว้นเดียวของ "ทุก response คือ AppState ทั้งก้อน"

ลิงก์ = ความลับ · `AppState` ถูก copy ไปทุก surface และ rebuild ทุก message → เป็นที่เก็บ
ความลับที่แย่ที่สุดเท่าที่จะหาได้ จึงเพิ่ม channel ที่สองที่แคบมาก:

- `models/messages.ts` → `UiQuery` + `UiQueryResults` (ตอนนี้มี **type เดียว**)
- `background/queryRouter.ts` → ตอบเอง ไม่ broadcast `state/changed` (มันไม่เปลี่ยนอะไร)
- `hooks/sendQuery.ts` → ไม่ใช่ hook ตั้งใจ เพื่อให้ panel (content script) ใช้ได้ด้วย
- UI เอาไปเข้า clipboard ตรง ๆ **ไม่เข้า React state ไม่ขึ้นจอ**

**เกณฑ์ของการเพิ่ม query ตัวที่สอง: มันต้องเป็นความลับ** ถ้าไม่ใช่ ให้ไปอยู่ใน `AppState`
ตามเดิม ไม่งั้นจะเสีย guarantee ที่ว่า "สอง surface เห็นไม่ตรงกันไม่ได้" ไปฟรี ๆ

### ⚡ Smart private preference (§29)

setting `smartJoin.preferOwnPrivateServer` — **default off** เพราะมันเปลี่ยนว่าผู้ใช้จะไปโผล่ที่ไหน

- เปิดแล้ว Smart Join ถาม private list **1 request** → เจอ = เข้าเลย **ไม่ scan public
  สักหน้าเดียว** (จึงถูกลงไม่ใช่แพงขึ้น) → ไม่เจอ = ตกไป public แบบเดิม
- `choosePrivateServer()` เป็น pure + มี test 8 เคส: **ข้ามเซิร์ฟที่เต็ม** (Roblox จะปฏิเสธ
  อยู่ดี) · เซิร์ฟที่ Roblox ไม่บอก `playing` **จัดท้ายสุด ไม่ใช่ถือว่าว่าง** (กฎ `unknown ≠ safe`
  ในรูปแบบใหม่) · เรียงตาม population preference เดิมของผู้ใช้เท่านั้น ไม่คิด signal ใหม่ให้
- Explain Why แสดงว่าเป็น private pick **ไม่มีคะแนน ไม่มี coverage** เพราะไม่ได้ให้คะแนนอะไร
  และไม่ได้โหลด public สักตัว — เขียน "Best of 0 servers" ตรงนั้นจะเป็นการโกหกที่ดูเป็นตัวเลข
- ถ้าเปิดไว้แล้วไม่ได้ใช้ (ไม่มี / เต็มหมด / ถามไม่สำเร็จ) → เขียนเหตุผลหนึ่งบรรทัดใน
  Explain Why เสมอ ไม่งั้น setting ที่เปิดอยู่จะดูเหมือนไม่ทำงาน

**decision:** private join **ไม่บันทึก history / playtime** เหมือน public join เพราะเราไม่รู้
`jobId` ของมัน — บันทึกด้วย jobId ว่างจะทำให้ประวัติเสีย ดีกว่าคือไม่บันทึกแล้วรู้ว่าทำไม

---

## 15. a11y — ปิดครบทุก surface แล้ว (v0.9.0)

panel กับ palette ทำไปแล้วใน v0.3.0 · รอบนี้คือ **popup / side panel / options / dashboard**

| ที่ | เดิม | แก้เป็น |
|---|---|---|
| popup / side panel — tab | `role="tab"` ลอย ๆ ไม่มี `aria-controls` ไม่มี roving tabIndex | tablist เต็มรูปแบบ · Tab ข้ามทั้งแถว ลูกศร/Home/End เดินในแถว (ใช้ `utils/rovingIndex.ts` ตัวเดียวกับ rail — ย้ายออกจาก `content/panel/` เพราะ page bundle ไม่ควร import จากโค้ดฝั่ง content script) · tabpanel มีชื่อจาก tab ที่เลือก |
| popup — error | `<div class="rc-banner">` เฉย ๆ | `role="alert"` |
| popup — toast | container render เฉพาะตอนมี toast | **render ไว้ตลอดแม้ว่าง** + `aria-live="polite"` · live region ต้องอยู่ในหน้าก่อนข้อความจะมา ไม่งั้นอันแรกเงียบ · CSS `:empty { padding: 0 }` กันช่องว่าง (**ห้ามใช้ `display:none`** มันจะหลุดจาก accessibility tree) |
| options — ทุก select / input | `<span class="rc-field__label">` ลอย ๆ | `<label htmlFor>` จริง · ของเดิม screen reader อ่านว่า "combo box, blank" |
| options — hint | อยู่ **ใน** `<label>` | `aria-describedby` · ไม่งั้นชื่อของ toggle = ป้าย + ย่อหน้าอธิบายทั้งก้อน อ่านทุกครั้งที่ focus |
| options / dashboard — section | `<div class="rc-card__label">` | `<h2>` จริง + `aria-labelledby` + `<main>` landmark |
| options — Grant / Revoke | ปุ่มชื่อซ้ำกัน 4 คู่ในหน้าเดียว | `aria-label` มีชื่อ host + สถานะเป็น `role="status"` |
| options — ผล probe | icon อย่างเดียว | สรุป 1 บรรทัดเป็น `role="status"` + คำแทน icon ใน `.rc-sr-only` |
| ThemePicker (ใช้ร่วมกัน) | บอกว่าเลือกอันไหนด้วย**สี**อย่างเดียว | `aria-pressed` |

**ของใหม่:** `src/options/controls.tsx` — `Section` / `Row` / `Toggle` ที่ **เจ้าของ id คือ
ตัว control เอง** แล้วส่ง id ให้ลูกผ่าน render prop → `htmlFor` กับ `aria-describedby`
ลืมไม่ได้ที่ call site แม้จะเพิ่ม setting ใหม่ทีหลัง

---

## 16. Performance — วัด ไม่เดา (v0.9.0)

`build.mjs` พิมพ์ขนาดของ 3 script ที่**ผู้ใช้ต้องจ่ายโดยไม่ได้ขอ** ทุกครั้งที่ build
แล้ว **fail build ถ้าเกิน budget**:

```
  dist/background.js         69.9 KB / 96 KB
  dist/content.js          288.8 KB / 320 KB
  dist/main-world.js         1.0 KB / 4 KB
```

- `content.js` + `main-world.js` ถูกฉีด **ทุกครั้งที่โหลดหน้า roblox.com**
- `background.js` ถูก parse ใหม่**ทุกครั้งที่ MV3 ปลุก service worker** ซึ่งบ่อยมาก
- หน้า extension เอง (popup / options / dashboard) **ไม่นับ** เพราะผู้ใช้ตั้งใจเปิดเอง

budget ตั้งไว้สูงกว่าที่วัดราว 10% → โตตามปกติเงียบ, โตกระโดด (เช่นมีคนลาก library เข้า
content script) ดังทันที · **ขึ้น budget ได้ แต่ต้องตั้งใจขึ้นพร้อมวัดใหม่** ไม่ใช่ขึ้นให้ build ผ่าน

ตัวเลขใน `SIZE_BUDGET_KB` เป็น "measured" แบบเดียวกับใน `config/constants.ts` —
การแก้มันคือการอ้างอิงถึงความจริงใหม่ ไม่ใช่เรื่องรสนิยม

---

## 17. Visit log — "เล่นเซิร์ฟไหน เกมอะไร กี่นาที" (v0.10.0)

tool ⏱ **Time** → การ์ด **Your visits** · หนึ่งแถว = หนึ่งครั้งที่กด Join

| แสดงอะไร | มั่นใจแค่ไหน |
|---|---|
| เกมอะไร · เซิร์ฟไหน (jobId) · กดเข้าตอนกี่โมง | **แน่นอน** — เรายิง launcher เอง |
| เล่นมากี่นาที | **upper bound** — นับจากตอนกด Join ถึงตอน join ที่อื่น/กด Stop · alt-tab ไปทำอย่างอื่นก็ยังนับ (คำเดิมของ playtime §7) · session ค้างถูก cap ที่ 45 นาที |
| เซิร์ฟเปิดมานานแค่ไหนตอนที่เข้า | **floor เท่านั้น** — นับจาก**ครั้งแรกที่เราเห็นเซิร์ฟนั้นเอง** ไม่ใช่เวลาที่เซิร์ฟเริ่มจริง · ถ้าเพิ่งเห็นตอน join = **"not known"** ไม่ใช่ 0 |

**ที่มาของ "ครั้งแรกที่เราเห็น" มี 2 ทาง** (อ่านตอน join ก่อน `markJoined` จะประทับเวลาใหม่ทับ):

1. `report.firstSeenAt` — เซิร์ฟที่ผู้ใช้เคยกด flag / favourite / โน้ตไว้
2. `context.firstSightingOf()` — **map ใน memory ของ SW** ที่จำว่า scan รอบไหนเห็น jobId ไหนครั้งแรก
   · ไม่ลง storage เด็ดขาด: `touchSeen` จงใจไม่บันทึกเซิร์ฟที่ผู้ใช้ไม่ได้แตะ (ไม่งั้น 500 เซิร์ฟ × ทุกเกม
   จะลง storage หมด) แต่ "เปิด panel ดูอยู่ 10 นาทีแล้วค่อยเข้า" เป็นข้อมูลที่มีค่าและฟรี
   · ใช้ `outcome.scannedAt` ไม่ใช่ `Date.now()` — เห็นตอน fetch ไม่ใช่ตอน paginate จบ
   · cap 5000 entry แล้วล้างทั้งก้อน (เป็นของอำนวยความสะดวก ไม่ใช่ของที่ต้องแม่น)

`features/playtime/sessionLog.ts` เป็น pure ทั้งไฟล์ · test 11 เคส · เคสที่สำคัญที่สุดคือ
**"เพิ่งเห็นตอน join → null ไม่ใช่ 0"** เพราะ 0 จะอ่านว่า "เซิร์ฟเพิ่งเปิด" ซึ่งไม่มีใครวัดมา

### ทำไมไม่มี "uptime" จริง ๆ — และคำถามที่ยังไม่เคยถาม

`GET /servers/Public` ไม่มี field เวลาเริ่มเลย ไม่มี uptime ไม่มี created ไม่มี version
· แต่ **jobId คือ UUID** และ UUID **version 1** มี timestamp 60 บิตฝังอยู่ข้างใน
ถ้า Roblox mint แบบนั้น = ได้เวลาเริ่มจริงของทุกเซิร์ฟฟรี ๆ โดยไม่ต้องยิงอะไรเพิ่มเลย

→ ทำ **Settings → Developer mode → Server clock** ขึ้นมาตอบคำถามนี้: อ่าน version nibble
ของ jobId ที่โหลดมาแล้ว (ไม่ยิง request) แล้วบอกว่า v1 (มี timestamp) หรือ v4 (สุ่มล้วน)
· `features/devtools/jobIdClock.ts` pure + test 9 เคส (รวมเคส v1 ที่ decode ออกมาเป็นปี 1583
ซึ่งต้องตอบว่า **ไม่น่าเชื่อถือ** ไม่ใช่รับมาใช้)

**ผลจริง (ผู้ใช้รัน 28 ส.ค. 2026): `198 × v4` — ทุกตัวสุ่มล้วน ไม่มี timestamp**

→ **ปิดประตูถาวร** · uptime จริงเอามาจาก browser ไม่ได้ และ backend ก็ช่วยไม่ได้ด้วยซ้ำ
เพราะ field นี้ไม่มีอยู่ใน API ตั้งแต่แรก (ต่างจาก region ที่ข้อมูลมีอยู่แต่ browser เข้าไม่ถึง)
→ อายุเซิร์ฟมีทางเดียวคือ **floor จากการที่เราเห็นเอง** และต้องเขียนว่า "อย่างน้อย" เสมอ
→ การ์ด Server clock **เก็บไว้** (dev only) เพราะเป็นข้อเท็จจริงว่า Roblox mint id ยังไง *วันนี้*
กดเช็คซ้ำได้ถ้าสงสัยว่าเปลี่ยน · `02` §1 บันทึกผลไว้แล้ว

---

## 18. Session tracking จาก presence ของตัวเอง (v0.11.0)

**ปัญหาที่แก้:** ของเดิมเห็นแค่ "ตอนกดปุ่ม Join ของเรา" → join จากหน้า Roblox เอง = ไม่นับเลย
· ออกจากเกม = session ไม่ปิดจนกว่าจะมีอะไรมาปิด (นับเกินยาว)

**Settings → Playtime → `Track sessions from my Roblox presence`** (default **ปิด**)

| | |
|---|---|
| ถามอะไร | `presence/users` ของ **บัญชีตัวเองคนเดียว** (verified 28 ส.ค. 2026 — `gameId` มาครบสำหรับตัวเอง) |
| ถามบ่อยแค่ไหน | **1 นาที** ตอนอยู่ในเกม · **5 นาที** ตอนไม่ได้เล่น (`chrome.alarms` สร้างใหม่ทุกครั้งตามผล) |
| ได้อะไร | session เริ่มเองไม่ว่าจะเข้าเกมทางไหน · **ปิดตอนออกจริง** → เวลาเลิกเป็น "วัดมา" ไม่ใช่ "เดา" |
| ไม่ทำอะไร | ไม่แตะบัญชีคนอื่นเลย · ปิด setting = ลบ alarm ทันที · ไม่มีอะไรออกจากเครื่อง |

**§13 ยังอยู่ครบ** — กฎคือห้าม poll ตำแหน่ง**คนอื่น**เป็นพื้นหลัง สิ่งที่ทำคือถามว่า*ตัวเอง*อยู่ไหน

### กฎที่ต้องไม่พัง

1. **ไม่มีคำตอบ ≠ ออกจากเกม** — lookup ล้มเหลว / rate limit / enum ที่ไม่รู้จัก → **ไม่ปิด session**
   ถ้าปิด session จริงที่เล่นอยู่ 3 ชั่วโมงจะถูกตัดเพราะ request เดียวพลาด แล้วผู้ใช้จะเห็นเลขผิด
   โดยไม่มีทางรู้ว่าผิด · `decideFollow()` เป็น pure มี test 13 เคสคุมข้อนี้โดยเฉพาะ
2. **`confirmedAt` ทำให้ cap 45 นาทีไม่ตัดเกมยาว** — เดิม open session ถูก cap ที่ idle timeout
   เพราะเรารู้แค่ "เริ่มเมื่อไหร่" · ตอนนี้ทุกครั้งที่ presence ยืนยัน จะเขียน `confirmedAt` ลง storage
   แล้ว `sessionDuration` / `isStale` นับจาก **หลักฐานล่าสุด** ไม่ใช่จากตอนเริ่ม
   → เล่น 3 ชั่วโมงได้ 3 ชั่วโมง · session ที่ไม่มีใครยืนยันยังถูก cap เหมือนเดิมเป๊ะ
3. **`endedBy` บอกว่าเลขนั้นเชื่อได้แค่ไหน** — `presence` = เห็นตอนจบจริง · `join`/`stop`/`stale` =
   อนุมาน · visit log เขียนคนละประโยคให้สองแบบนี้ ไม่ปัดให้เท่ากัน
4. **Roblox ไม่บอก server เสมอ** — ถ้าได้ `placeId` แต่ไม่ได้ `gameId` → เก็บ session ด้วย
   `jobId: ''` แล้ว UI เขียนว่า **"server not named"** ไม่ใช่ปล่อยว่างให้ดูเหมือนบั๊ก
5. **session ที่ detect ได้ ไม่เข้า Server History** — History คือ "เซิร์ฟที่กด join ผ่านเรา"
   (มี flag/status ผูกอยู่) ส่วน **Your visits** คือทุกครั้งที่เล่นจริง · สองอันตอบคนละคำถาม
   จงใจไม่รวมกัน · presence-detected session จึงเขียนแค่ playtime ไม่แตะ report/history
6. **สถานะต้องพูดออกมาเสมอ** — `lastPresenceFollow` เก็บเหตุผลของ poll ล่าสุด (รวม "ยังไม่ได้ Grant",
   "ไม่รู้ว่าใคร login") เพราะ tracker ที่ตัดสินใจถูกว่า "ไม่ต้องทำอะไร" หน้าตาเหมือน tracker ที่พัง

### บั๊ก MV3 ที่เจอระหว่างทาง (สำคัญ)

`chrome.alarms.onAlarm` เคยถูก register **ข้างใน `registerAlarms(context)`** ซึ่งรันหลัง
`AppContext.create()` → MV3 ปลุก service worker ตอน alarm ดัง แล้ว dispatch event ให้เฉพาะ
listener ที่มีอยู่**ตอน script ประเมินเสร็จ** · listener ที่มาทีหลัง 2-3 await **พลาด event ที่ปลุกตัวเอง**
เงียบ ๆ → prune alarm เดิมก็โดนด้วย · ย้ายไป register ที่ **top level ของ `serviceWorker.ts`**
แล้วให้ `alarms.ts` export `handleAlarm` แทน (สร้าง alarm ได้ แต่ไม่ฟังเอง)
