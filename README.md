# Roblox Companion

Chrome/Edge Extension (Manifest V3) สำหรับ roblox.com — **server intelligence** เป็นหลัก

```
Smart Join → เล่น → เจอ exploiter → Alt+Tab → กด ⚠ → Smart Join อีกรอบ
```

> ชื่อ `Roblox Companion` เป็นชื่อชั่วคราว · ไม่ได้เกี่ยวข้องกับ RoPro
> ไม่มีการลอก source code / asset / branding ของใคร ทุก feature เขียนขึ้นเองจาก official Roblox API

---

## สถานะ

| Phase | | |
|---|---|---|
| 0 | Research | ✅ `01`–`05` + `PERMISSIONS.md` |
| 1 | Foundation | ✅ |
| 2 | Server Browser | ✅ |
| 3 | Smart Join | ✅ |
| 4 | Custom flags + notes | ✅ |
| 5 | Import / Export | 🟡 local เสร็จ · presence ค้างรอ verify |
| 6 | Private Servers | 🔒 บล็อกไว้จนกว่าจะ verify API |
| 7 | Playtime + live stats | 🟡 เสร็จ · quick search ค้าง |
| 8–9 | Profiles / Avatar / Themes / Trading | ⬜ |
| 10 | Command Palette | ✅ · a11y / i18n ค้าง |

**ใช้งานได้แล้วตอนนี้:** browse/paginate/filter public servers · **⚡ Smart Join + Explain Why** ·
Join Lowest · Random · Rejoin · Server History · flag `Clean / Exploiter / Bugged / Avoid` ·
**custom flags ของตัวเอง** · **server notes** · favourite · skip flagged server ตอน auto-join ·
Player Blacklist (local) · **Import / Export JSON** · **Playtime** · **Live like/dislike** ·
**⌘K Command Palette** · **Developer Mode API probe** · Settings · Dashboard

> 📌 **จะทำงานต่อ อ่าน [`HANDOFF.md`](HANDOFF.md) ก่อน** — สรุปว่าทำถึงไหน อะไรบล็อกอยู่
> บทเรียนที่แลกมาแพง และกฎที่ต้องรักษา

---

## Build

```bash
npm install
npm run build      # → dist/
```

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run build` | build ลง `dist/` (~2 วิ) |
| `npm run watch` | rebuild อัตโนมัติเมื่อแก้ไฟล์ใน `src/` |
| `npm run typecheck` | `tsc --noEmit` (strict + `exactOptionalPropertyTypes`) |
| `npm test` | vitest — 269 tests |
| `npm run check` | typecheck + test + build |

ไอคอนอยู่ใน `public/icons/` แล้ว สร้างใหม่ได้ด้วย `node tools/make-icons.mjs`

### ทำไม build ถึงแบ่งเป็นสองขา

`build.mjs` รัน **Vite** กับ **esbuild** คนละงาน เพราะ JS สองประเภทนี้มีข้อจำกัดคนละแบบ:

| | รันที่ไหน | bundler | ทำไม |
|---|---|---|---|
| popup / side panel / dashboard / options | origin ของ extension | Vite (ESM + React) | อยู่ใต้ CSP ของเราเอง แตกไฟล์ได้ตามปกติ |
| content script · MAIN world · service worker | หน้า roblox.com | esbuild (**IIFE ไฟล์เดียว ไม่มี import**) | ดูข้างล่าง |

> **นี่ไม่ใช่เรื่องรสนิยม** — CSP ของ roblox.com ไม่มี `chrome-extension:` ใน `script-src`
> Chrome 130+ จึงบล็อกทุกอย่างที่พยายามโหลด `chrome-extension:` จาก context ของหน้าเว็บ
>
> MV3 plugin ของ Vite ที่นิยมใช้กัน (`@crxjs/vite-plugin`) จะ emit loader ที่ทำ
> `import("./chunk.js")` ซึ่ง **พังเงียบ ๆ** สำหรับ MAIN world script → ปุ่ม Join ใช้ไม่ได้
> เราจึงเลิกใช้ แล้ว bundle เองเป็น IIFE ไฟล์เดียว
>
> ตรวจได้ว่ายังปลอดภัยอยู่: `grep "import(" dist/main-world.js` ต้องไม่เจออะไร

---

## ติดตั้งแบบ Load unpacked

1. `npm run build`
2. เปิด `chrome://extensions` → เปิด **Developer mode**
3. **Load unpacked** → เลือกโฟลเดอร์ **`dist`** (ไม่ใช่โฟลเดอร์โปรเจกต์)
4. ปักหมุด 📌 ไว้บน toolbar

**หลังแก้โค้ด:** `npm run build` แล้วกด ↻ ที่การ์ดของ extension
(ถ้าแก้ content script ต้อง reload หน้า roblox.com ด้วย)

---

## วิธีใช้

### 🪟 In-page panel — surface หลัก

หน้าตาแบบ floating window ที่ลอยอยู่ **บนหน้า Roblox เอง** ลากไปวางตรงไหนก็ได้ ปรับขนาดได้
และจำตำแหน่งไว้ให้

```
┌──────────────────────────────────────────┐
│ ⠿  Server browser              ⚙ — ✕   │ ← ลากตรงนี้
│    Steal An Egg                          │
├────┬─────────────────────────────────────┤
│🖥 │ LAST JOINED                         │
│Srv │ 2/7 · avg 43ms · 60 FPS · 3m ago    │
│    │ [👍][⚠][🐛][🚫]      [↻ Rejoin]   │
│🕘 │                                     │
│His │ ⚡ SMART JOIN                       │
│    │ [👤][🎲][👁][↻]                    │
│🚫 │ 🟢 12  🔴 2  ❓ 40  ⭐ 3            │
│Ply │                                     │
│🚩 │ ── servers ──                       │
│Flg │ [rows...]                        ◢ │ ← ปรับขนาด
└────┴─────────────────────────────────────┘
```

ตอนปิดเหลือปุ่มเล็ก ๆ มุมขวาล่าง **พร้อม badge บอกจำนวนเซิร์ฟที่ถูก flag** —
panel ที่ปิดอยู่ก็ยังบอก status ได้

| | In-page ⭐ | Side Panel | Popup |
|---|---|---|---|
| ลากวางได้ | ✅ จำตำแหน่ง | ❌ | ❌ |
| ปรับขนาด | ✅ | นิดหน่อย | ❌ |
| รอด Alt+Tab | ✅ | ✅ | ❌ |
| กินพื้นที่จอ | เฉพาะตอนเปิด | บีบเว็บตลอด | — |
| ใช้นอก roblox.com | ❌ | ✅ | ✅ |

เลือกได้ใน Settings ว่าไอคอน toolbar จะเปิดอันไหน (ค่าเริ่มต้น = in-page)
นอก roblox.com ไอคอนจะเปิด Dashboard ให้แทน เพราะไม่มีหน้าให้แทรก

### เพิ่ม feature ใหม่ = เพิ่ม 1 บรรทัด

rail ด้านซ้ายขับด้วย registry เดียว — feature ใหม่โผล่เองโดยไม่ต้องแตะ layout

```ts
// src/content/panel/tools.tsx
{ id: 'trading', icon: '💱', label: 'Trade', title: 'Trading',
  flag: 'trading', badge: (s) => s.pendingTrades, render: (p) => <TradePane {...p} /> }
```

`flag` ทำให้ซ่อนอัตโนมัติเมื่อปิด feature · `badge` ขึ้นจุดแดงบน rail และตัวเลขบน launcher

### ทำไมต้อง Shadow DOM

panel render ใน Shadow DOM root เพราะ CSS ของ roblox.com กว้างพอจะ restyle อะไรก็ตาม
ที่เราแทรกเข้าไป **และสิ่งที่เราแทรกก็พังหน้าเขาได้เหมือนกัน** — shadow root ตัดขาดทั้งสองทาง

ผลพลอยได้ที่ต้องรู้: style ต้องเดินทางมาเป็น **string** เพราะ stylesheet ที่ emit เป็นไฟล์
จะไปอยู่ใน main document ซึ่ง shadow root มองไม่เห็น · `sharedStyles.ts` จึง **generate
อัตโนมัติ** จาก `CommandCenter.css` ทุกครั้งที่ build (`tools/make-shared-styles.mjs`)
เพื่อไม่ให้ panel กับหน้า extension มี style คนละชุด

### Popup กับ Side Panel

ยังมีอยู่ครบและ render `<CommandCenter/>` ตัวเดียวกัน — มีประโยชน์ตรงที่ **ใช้ได้นอก roblox.com**
ซึ่ง in-page panel ทำไม่ได้ · เลือกให้ไอคอน toolbar เปิดอันไหนก็ได้ใน Settings

> popup ของ Chrome ปิดตัวเองทันทีที่ Alt+Tab ไป Roblox ซึ่งทำลาย loop
> `join → เล่น → Alt+Tab → flag` พอดี — เป็นเหตุผลที่ in-page panel เป็นค่าเริ่มต้นแทน

> **ทำไม setting นี้ถึงไปคุมไอคอนโดยตรง** — Chrome ไม่ยอมให้เปิด side panel จาก
> message handler เพราะ user gesture ไม่ข้าม `chrome.runtime.sendMessage`
> (`sidePanel.open()` จะโยน *"may only be called in response to a user gesture"*
> — [crbug 355266358](https://issues.chromium.org/issues/355266358))
> ทางเดียวที่เปิดได้ชัวร์คือให้ Chrome เปิดเองผ่าน `openPanelOnActionClick`
> ซึ่งจะถูกเมินถ้ายังมี action popup ค้างอยู่ → setting นี้จึงต้องสั่งทั้ง
> `action.setPopup` และ `sidePanel.setPanelBehavior` พร้อมกัน (`src/background/surfaceBehavior.ts`)
>
> ปุ่ม 📌 ใน popup เรียก `chrome.sidePanel.open()` **เอง** ไม่ผ่าน service worker
> และ resolve `windowId` ไว้ตั้งแต่ mount เพื่อไม่ให้มี `await` มาใช้ gesture ทิ้งก่อน
>
> ส่วนปุ่ม 🔎 Panel ในหน้าเกม **กดแล้วเปิด in-page panel ได้เลย** — เมื่อก่อนมันพยายาม
> เปิด side panel ผ่าน service worker ซึ่ง Chrome ปฏิเสธ เลยได้แค่บอกให้ผู้ใช้ไปกดไอคอนเอง
> ตอนนี้ panel อยู่ใน content script เดียวกันแล้ว ปุ่มจึงทำสิ่งที่มันเขียนไว้ได้จริง

### หน้าตา

```
┌─────────────────────────────────┐
│ LAST JOINED                     │  ← ไม่เลื่อนหาย กด 1 ครั้งจบ
│ 2/7 · avg 43ms · 3m ago         │
│ [👍][⚠][🐛][🚫]  [↻ Rejoin]   │
│                                 │
│ ⚡ SMART JOIN                   │
│ Preview the choice              │
│ [👤 Lowest][🎲][🔒][↻]         │
│                                 │
│ SMART JOIN — why this server    │
│ 🟢 12 clean · 🔴 2 flagged      │
├─────────────────────────────────┤
│ Servers │ History │ Blacklist   │
└─────────────────────────────────┘
```

ปุ่มที่ยังไม่ทำ (Private) แสดงเป็น **disabled พร้อมบอกว่าอยู่เฟสไหน** ไม่ซ่อน
เพื่อให้เห็นชัดว่าตอนนี้ extension ทำอะไรได้จริงบ้าง

### Quick Action Bar

แทรกอยู่ข้างปุ่ม Play ในหน้าเกม ถ้า Roblox เปลี่ยน DOM แล้วแถบนี้ไม่โผล่
**ส่วนอื่นยังทำงานปกติทั้งหมด** — เพิ่ม selector ตัวใหม่ได้ที่ `PLAY_ANCHORS`
ใน `src/content/injectors/quickActionBar.ts`

---

## ⌘K Command Palette

กด **`Ctrl+K`** (หรือ `⌘K`) ที่ไหนก็ได้บน roblox.com — ใช้ได้แม้ panel ปิดอยู่

```
┌────────────────────────────────────────────┐
│ jls                                        │
├────────────────────────────────────────────┤
│ 👤  Join lowest server            SERVERS  │
│ ⚡  Smart Join                    SERVERS  │
│     Score every server and join the best   │
│ 🕘  Open server history              OPEN  │
├────────────────────────────────────────────┤
│ ↑↓ move   ↵ run   esc close                │
└────────────────────────────────────────────┘
```

**พิมพ์ตัวย่อได้** — `jls` เจอ *Join lowest server* เพราะเป็น fuzzy subsequence
ไม่ใช่ substring search · ตัวอักษรที่เป็น**ต้นคำ**ได้คะแนนสูงกว่ากลางคำ เพื่อให้เจตนา
ชนะความบังเอิญ (`sm` ควรเจอ *Smart Join* ไม่ใช่ *Open dashboard* ที่บังเอิญมี s กับ m)

**รู้ว่าอยู่หน้าไหน (§41)** — หน้าเกมดัน server command ขึ้นก่อน · หน้าโปรไฟล์ดัน
`Copy user ID` / `Blacklist this player` · **แต่ไม่ซ่อนอย่างอื่น** palette จึงไม่มีทางตัน

command ที่รันไม่ได้จะ **ซ่อนตัวเอง** — ยังไม่เปิดหน้าเกม, feature ถูกปิด,
หรือยังไม่เคย join (พวก `Flag last server`) → list ว่างมักเป็นข้อเท็จจริงเรื่องหน้าที่อยู่
ไม่ใช่เรื่องคำค้น ซึ่ง UI บอกไว้ตรงนั้น

> `preventDefault` ตรงนี้**จำเป็นจริง ๆ ไม่ใช่ความเรียบร้อย** — `Ctrl+K` ผูกกับช่องค้นหา
> ของ browser อยู่ ถ้าไม่กัน address bar จะแย่งคีย์ไปแล้ว palette ไม่มีวันเปิด
> · แต่ตอนพิมพ์อยู่ใน input/textarea จะไม่ดัก เพราะคนกำลังพิมพ์ตั้งใจพิมพ์ตัวอักษร

เพิ่ม command ใหม่ = เพิ่ม 1 entry ใน `COMMANDS` (`src/features/commandPalette/commands.ts`)

---

## ⚡ Smart Join

กดปุ่มเดียว → ให้คะแนนทุกเซิร์ฟที่โหลดมา → เข้าตัวที่ดีที่สุด → บอกเหตุผล
(ถ้าอยากดูก่อนเข้า กด **Preview the choice**)

```
Population    32/40   Nearly empty (2/10)
Reputation    30/30   You marked this server clean
Health        18/20   Server running at 60 FPS, players in it average 43ms to it
Freshness      —      First time we have seen this server
Favourite      —      Not a favourite
                      Best of 47 eligible servers out of 180 loaded
```

**กฎสำคัญที่สุดของ scoring** — signal ที่ "ตัดสินไม่ได้" จะขึ้น `—` แล้ว
**ถูกตัดออกจากทั้งเศษและส่วน** ไม่ใช่ให้ 0 คะแนน

เพราะถ้าให้ 0 เซิร์ฟที่เพิ่งเห็นครั้งแรกจะโดนหักคะแนนราวกับว่า "เก่า" ทั้งที่ความจริงคือ
**เราไม่รู้อายุมัน** — `unknown` กับ `bad` ต้องไม่เหมือนกัน (§13 §55)

Smart Join **ไม่ยิง request เพิ่มหา Roblox เลยแม้แต่นัดเดียว** ใช้ข้อมูลที่โหลดมาแล้วล้วน ๆ

### Region — ทำจาก browser extension ไม่ได้

เดิมตั้งใจให้ region เป็น signal ที่ 5 แต่**พอยิงจริงพบว่าทำไม่ได้**

Roblox ไม่มี endpoint ที่บอกว่าเซิร์ฟอยู่ที่ไหน ทางเดียวคือเรียก `join-game-instance`
ซึ่งเป็นการขอ join จริง แล้วอ่าน IP ที่คืนมา — แต่ยิงจากเบราว์เซอร์แล้วได้:

```jsonc
{ "status": 12, "message": "Unable to join Game 12", "joinScript": null }
```

คนที่เรียกสำเร็จต้องส่ง `User-Agent: Roblox/WinInet` ซึ่งเป็น **Forbidden Header Name**
ตาม Fetch spec — extension เซ็ตไม่ได้ ทางเดียวที่จะข้ามคือใช้ `declarativeNetRequest`
ปลอม User-Agent เป็น Roblox client ซึ่งคือ **การปลอมตัวเป็นไคลเอนต์เกมเพื่อผ่านด่าน
ที่ Roblox ตั้งไว้แยกเว็บออกจากไคลเอนต์พอดี** → **เราไม่ทำ** (§55)

**จำแนกใหม่เป็น 🔵 ต้องมี backend** ซึ่ง §34 ของ spec ระบุไว้แล้วว่า "server region database"
เป็นเหตุผลที่สมเหตุสมผลของการมี backend (และน่าจะเป็นเหตุผลที่ RoPro คิดเงินกับ feature นี้)

โค้ดที่เหลือไว้: `regionSource.ts` (interface เปล่า) · `regionTable.ts` (CIDR longest-prefix)
· `regionData.ts` (ตาราง datacenter) — scoring และ test ครบแล้ว ขาดแค่แหล่งข้อมูล
ถ้าวันหนึ่งมี backend ก็เสียบเข้าไปได้ทันที

---

## ข้อจำกัดที่รู้อยู่แล้ว (มาจากฝั่ง Roblox ไม่ใช่จากเรา)

extension นี้ **จงใจ** เขียน label ให้ตรงกับสิ่งที่รู้จริง ดังนี้

| UI เขียนว่า | เพราะ |
|---|---|
| `avg 43ms` ไม่ใช่ `43ms` | ค่าที่ API คืนคือ **ค่าเฉลี่ยของผู้เล่นที่อยู่ในเซิร์ฟนั้นวัดไปหาเซิร์ฟนั้น** ไม่ใช่ ping ของคุณ และ **ไม่ได้บอกว่าเซิร์ฟอยู่ใกล้คุณ** — ดูหัวข้อถัดไป |
| `first seen 18m ago` ไม่ใช่ `Uptime 18m` | Roblox ไม่บอกเวลาที่เซิร์ฟเริ่ม — นี่คือครั้งแรกที่ **เรา** เห็นมัน (ใช้เป็น proxy ของ server age) |
| `Region —` ถ้ายังไม่ probe | ไม่เดา · `unmatched` ถ้า probe แล้วแต่ตารางไม่ครอบคลุม |
| `แสดง N จาก M เซิร์ฟที่โหลดมา` | Roblox cap pagination ที่ ~150–500 เซิร์ฟแล้วคืน cursor `null` เอง staff ยืนยันว่าตั้งใจ |
| `Player identities unavailable` **ไม่ใช่** `✓ Safe` | `playerTokens` ว่างเสมอ + Presence API คืน `gameId` เฉพาะเมื่อ privacy ของเป้าหมายอนุญาต → ส่วนใหญ่ตอบไม่ได้ |
| `not in the last scan` ไม่ใช่ `Offline` | เพราะ pagination cap การไม่เจอในสแกน **ไม่ได้แปลว่าเซิร์ฟปิด** |

ไม่มี API เช็ค JobId เดี่ยว ๆ — ต้องสแกนแล้ว match เอง

### ทำไม ping ถึงใช้หา "เซิร์ฟที่ใกล้ที่สุด" ไม่ได้

เป็นคำถามที่ถูกถามบ่อยและดูสมเหตุสมผลมาก — ping น้อยน่าจะแปลว่าใกล้ แต่ไม่ใช่ครับ

| เซิร์ฟ | ผู้เล่นข้างใน | `ping` ที่ API คืน | ระยะจากคุณ (ไทย) |
|---|---|---|---|
| Singapore | คนสิงคโปร์ 5 คน | ~40ms | **ใกล้** |
| Dallas | คนเท็กซัส 5 คน | ~40ms | **ไกลมาก** |

Roblox จับคู่ผู้เล่นเข้าเซิร์ฟใกล้บ้านตัวเองอยู่แล้ว → เซิร์ฟสุขภาพดีแทบทุกตัวจะ ping ต่ำ
ไม่ว่าตั้งอยู่ทวีปไหน ค่านี้จึงแยก "ใกล้คุณ" ออกจาก "ไกลคุณ" ไม่ได้เลย

**แต่มันมีความหมายจริงอยู่อย่างหนึ่ง** — ping สูงแปลว่าคนที่อยู่ในเซิร์ฟนั้นกำลังเล่นได้แย่
และ `fps` ต่ำแปลว่าเซิร์ฟทำงานไม่ไหว ทั้งสองอย่างควรเลี่ยงในตัวมันเอง ไม่ว่าคุณอยู่ที่ไหน
→ เราจึงเอามาใช้เป็น signal **`Health`** (คุณภาพเซิร์ฟ) ไม่ใช่ signal ระยะทาง

---

## Privacy & Security

- ✅ ข้อมูลทั้งหมด (server reports, history, blacklist) อยู่ใน `chrome.storage.local` **ของเครื่องคุณเท่านั้น**
- ✅ **ไม่มี backend** ไม่มีการอัปโหลดอะไรทั้งสิ้น
- ✅ region lookup ใช้ตารางในเครื่อง ไม่ส่ง IP ไปหา third-party geolocation service
- ❌ **ไม่แตะ `.ROBLOSECURITY` เลย** — ไม่ขอ permission `cookies` ด้วยซ้ำ ใช้ `credentials: 'include'` ให้ browser จัดการ
- ❌ ไม่ auto-purchase อะไรที่ใช้ Robux
- ❌ ไม่ deanonymize ผู้เล่นที่ Roblox ซ่อนไว้ (ไม่ decode playerToken / ไม่ brute-force avatar / ไม่ fingerprint thumbnail)
- ❌ ไม่มี `eval` ไม่โหลด remote code
- ไม่มี exploit / executor / memory injection / anti-cheat bypass — เป็น server browser + สมุดบันทึกเท่านั้น

เหตุผลของทุก permission อยู่ใน [`PERMISSIONS.md`](PERMISSIONS.md)

---

## ทำไมต้องล็อกอินและเปิดแท็บ roblox.com ค้างไว้

**1. Rate limit** — request ที่ไม่มี cookie ได้โควต้าแค่ `3 ครั้ง/60 วินาที` ถ้ามี cookie จะได้ราว `100`
และ CORS ของ Roblox อนุญาตเฉพาะ origin `https://www.roblox.com`
`AdaptiveTransport` จะ **วัด** เอาเองจาก header `x-ratelimit-limit` ว่าตกอยู่ bucket ไหน
ถ้าเจอว่าเป็น guest จะสลับไปยิงผ่านแท็บ roblox.com แล้วจำไว้ · ถ้าปิดแท็บหมดจะถอยกลับมาใช้
service worker เอง (ช้าลงแต่ยังทำงาน)

**2. Protocol handler** — Chrome จำสิทธิ์ `roblox-player://` **แยกตาม origin** และผู้เล่นเกือบทุกคน
ติ๊ก "Always allow" ให้ roblox.com ไว้แล้ว การสั่งเปิดเกมจากแท็บนั้นจึงไม่มี dialog เด้ง

---

## โครงสร้าง

```
src/
├─ config/      constants (ค่าที่ "measured" มาจากการยิงจริง) · features (registry ของ feature flag)
├─ models/      type ล้วน — server · blacklist · settings · smartJoin · messages
├─ utils/       errors (AppError + ข้อความไทย) · async · format · dom · robloxUrl
├─ services/
│  ├─ roblox/   endpoints · transport · RobloxHttpClient (CSRF) · RequestScheduler · *Api
│  └─ storage/  Repository ทุกตัว (UI ห้ามเรียก chrome.storage ตรง ๆ)
├─ features/
│  ├─ servers/       list · filters · liveness · join
│  ├─ smartJoin/     scoring (pure) · regionTable · regionProbe · SmartJoinService
│  └─ playerBlacklist/
├─ background/  service worker — เจ้าของ state ทั้งหมด
├─ content/     content script (ISOLATED) — fetch proxy + injectors
│  └─ panel/    in-page floating window (Shadow DOM) + tool registry
├─ main-world/  ~80 บรรทัด เรียก Roblox.GameLauncher เท่านั้น
├─ components/  UI ที่ popup/panel ใช้ร่วมกัน + theme tokens
├─ hooks/       useAppState
└─ popup · sidepanel · dashboard · options
```

### การไหลของข้อมูล

```
Popup / Side Panel      ← UI ล้วน ไม่มี business logic ไม่แตะ storage
        ↕ chrome.runtime.sendMessage (typed, Result<T>)
Service Worker          ← เจ้าของ state ทั้งหมด
        ↕ chrome.tabs.sendMessage
Content script          ← fetch proxy (origin ถูก, cookie ติด) + inject ปุ่ม
        ↕ window.postMessage
MAIN world script       ← Roblox.GameLauncher.joinGameInstance()
```

ทุก mutation คืน `AppState` ก้อนใหม่ แล้ว broadcast `state/changed` ให้ surface อื่น refetch
→ popup กับ side panel เปิดพร้อมกันได้โดยไม่หลุด sync

---

## Debug

| ส่วน | วิธีเปิด DevTools |
|---|---|
| **Service worker** | `chrome://extensions` → การ์ดของ extension → คลิก **service worker** |
| **Side panel** | คลิกขวาในตัว panel → **Inspect** |
| **Content script** | DevTools ของหน้า roblox.com → Console → เลือก context **Roblox Companion** |
| **MAIN world script** | Console เดียวกัน เลือก context **top** |
| **Storage** | DevTools ของ service worker → Application → Extension storage → Local |

```js
chrome.storage.local.get(null).then(console.log)   // ดูข้อมูลที่เก็บไว้
chrome.storage.local.clear()                       // ล้างทั้งหมด (ระวัง)
```

key ที่ใช้: `rc:v` · `rc:settings` · `rc:transport` · `rc:blacklist` ·
`rc:reports:{placeId}` · `rc:history:{placeId}` · `rc:lastJoined:{placeId}`

---

## Maintenance

จุดที่เปราะที่สุดคือส่วนที่ผูกกับหน้าเว็บ Roblox — ทั้งสามจุดมี fallback และไม่ทำให้ส่วนอื่นพังตาม

| ไฟล์ | ผูกกับอะไรของ Roblox | อาการเมื่อพัง |
|---|---|---|
| `src/main-world/index.ts` | signature ของ `Roblox.GameLauncher.joinGameInstance` | toast "Used the deeplink fallback" |
| `src/content/injectors/quickActionBar.ts` | selector ของปุ่ม Play (`PLAY_ANCHORS`) | แถบไม่โผล่ในหน้าเกม (panel ยังปกติ) |
| `src/services/roblox/endpoints.ts` | endpoint + query params + response shape | error "โหลดรายชื่อเซิร์ฟเวอร์ไม่สำเร็จ" |
| `src/features/smartJoin/regionData.ts` | IP range ของ datacenter (Roblox ย้าย/เพิ่มได้เงียบ ๆ) | region ขึ้น `unmatched` มากผิดปกติ |

รัน `npm run check` หลังแก้ทุกครั้ง

---

## 🚩 Custom flags

flag ที่ built-in มา (`Clean / Exploiter / Bugged / Avoid`) ตอบได้แค่ว่า "เซิร์ฟพังหรือมีคนโกงไหม"
แต่สิ่งที่คุณสนใจจริง ๆ ในเกมที่คุณเล่นเราเดาแทนไม่ได้ → สร้างเองได้ที่ Settings

```
+ Add flag
Name:  [No guardian]
Icon:  🐣
☑ Skip these servers in Smart Join
☑ Only for Steal An Egg
```

- ติด flag ที่แถวเซิร์ฟด้วยปุ่ม `⋯` (กางช่องโน้ตมาด้วย)
- flag ที่ตั้ง **Skip** ไว้จะถูก Smart Join / Join Lowest / Random ข้ามเหมือน built-in status ทุกประการ
- scope เลือกได้ว่าเฉพาะเกมนี้ (§21) หรือทุกเกม
- **ลบ flag แล้วมันจะถูกถอดออกจากทุกเซิร์ฟที่ติดไว้ด้วย** — ไม่งั้นเซิร์ฟจะเหลือ id ล่องหน
  ที่ยังทำให้ถูกข้ามอยู่โดยไม่มีอะไรอธิบาย

## 💾 Import / Export

Settings → Backup → export ทั้ง settings + flags + blacklist เป็นไฟล์ JSON พร้อม `schemaVersion`

**import เป็นการ merge ไม่ใช่ replace** — restore backup เก่าหรือรับ flag ชุดของเพื่อนมา
แล้วต้องไม่เสีย report ที่มีอยู่ · ถ้าชนกัน **ของในเครื่องชนะ** เพราะมันคือสิ่งที่คุณเห็นมาเอง

ไฟล์สร้างและดาวน์โหลดในเบราว์เซอร์ล้วน ไม่มีการอัปโหลดไปไหน

## 🔍 Developer Mode → API probe

เปิดที่ Settings → General → Developer mode

ยิง endpoint ที่ extension พึ่งพาจริง ๆ แล้วรายงานว่าได้อะไรกลับมา พร้อมเตือนเมื่อ
`02_ROBLOX_API_MAP.md` กับความจริงไม่ตรงกัน — ทุก probe เป็น read อย่างเดียว
ไม่สร้าง ไม่ซื้อ ไม่ join อะไรทั้งนั้น

> **ทำไมถึงมีเครื่องมือนี้** — Phase 3 ผมสร้าง region ทั้ง feature บน endpoint ที่ยังไม่เคยยิงจริง
> พอ ship แล้วถึงรู้ว่า Roblox ปฏิเสธ ต้องถอดทิ้งทั้งหมด · Phase 6 (private servers)
> ตั้งอยู่บน endpoint ที่ยังไม่ verify อีก 5 ตัว → ลำดับที่ถูกคือ **probe ก่อน สร้างทีหลัง**

## ก่อนจะไป Phase 6

endpoint ที่ยังเป็น `docs-only` ใน [`02_ROBLOX_API_MAP.md`](02_ROBLOX_API_MAP.md)
(private servers, presence, users, universe, **gamejoin**) **ต้องยิงจริงแล้วอัปเดตเอกสารก่อน**
ถึงจะเอาไปโชว์ใน UI ได้ — อย่าสัญญากับผู้ใช้ว่า feature ไหนทำได้จนกว่าจะตรวจ API จริง

โดยเฉพาะ **region probe** ที่เพิ่งทำเสร็จ: logic + test ครบแล้ว แต่ยังไม่เคยเห็น response จริง
จาก `join-game-instance` ควรเปิด Developer Mode แล้วลอง probe สัก 1 เซิร์ฟก่อนใช้งานจริงจัง
