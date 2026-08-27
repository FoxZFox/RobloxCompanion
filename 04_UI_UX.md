# 04 — UI / UX

## ทิศทาง

```
RoPro (ครบ) + Raycast (เร็ว) + Steam server browser (แน่น) + dev tool (ตรงไปตรงมา)
```

เข้ากับ Roblox · dark/light ตาม Roblox · compact · แน่นข้อมูลแต่ไม่รก · click น้อยกว่า RoPro

## กฎเหล็ก: honest labeling

ตัวเลขที่เราไม่ได้วัดเอง ห้ามแสดงเหมือนว่าวัดมา

| ห้ามเขียน | ต้องเขียน | เพราะ |
|---|---|---|
| `43 ms` | `avg 43ms` + tooltip "ค่าเฉลี่ยของผู้เล่นในเซิร์ฟ ไม่ใช่ ping ของคุณ" | API คืนค่าเฉลี่ยฝั่ง server |
| `Uptime 18m` | `เห็นครั้งแรก 18m ที่แล้ว` | Roblox ไม่บอก uptime — นี่คือ first-seen ของ **เรา** |
| `Version 583` | (ไม่แสดง) | ไม่มีใน API |
| `✓ Safe` | `? ไม่ทราบว่ามีใครอยู่` | `playerTokens` ว่างเสมอ (§13) |
| `เซิร์ฟที่ดีที่สุดในเกม` | `ดีที่สุดจาก 200 เซิร์ฟที่แสดงได้` | pagination cap (§33) |
| `Singapore` (ยังไม่ probe) | `Region —` / `กำลังตรวจ...` / `ไม่ทราบ (UDMUX)` | ห้ามเดา (§55) |

## Theme

อ่าน class ที่ Roblox ใส่บน `<html>` (`.dark-theme` / `.light-theme`) แล้ว map เป็น CSS
custom property ชุดเดียว UI ทุกตัวใช้ token ไม่ hardcode สี → เปลี่ยนธีมที่เดียวจบ
มี `prefers-color-scheme` เป็น fallback สำหรับ surface ที่ไม่ได้อยู่บนหน้า Roblox

## Surface — In-page panel เป็นหลัก

| | **In-page panel** ⭐ | Side Panel | Popup |
|---|---|---|---|
| อยู่ที่ไหน | ลอยอยู่บนหน้า Roblox เอง | แถบข้างของ Chrome | หลุดจากไอคอน |
| ย้ายตำแหน่งได้ | ✅ ลากวางตรงไหนก็ได้ + จำตำแหน่ง | ❌ ตรึงข้างขวา | ❌ |
| ปรับขนาดได้ | ✅ | ปรับได้เล็กน้อย | ❌ |
| **รอด Alt+Tab** | ✅ | ✅ | ❌ ปิดทันที |
| กินพื้นที่หน้าจอ | เฉพาะตอนเปิด | บีบหน้าเว็บตลอด | — |
| ใช้ได้นอก roblox.com | ❌ | ✅ | ✅ |

ทั้งสามอันใช้ component ชุดเดียวกัน เลือกได้ว่าไอคอน toolbar เปิดอันไหนใน Settings
(ค่าเริ่มต้น = **in-page panel**)

### ทำไม in-page ถึงดีที่สุด

อยู่ **ที่เดียวกับสิ่งที่ผู้ใช้กำลังดูอยู่** — ไม่ต้องสลับสายตาไปมุมจอ ไม่บีบหน้าเว็บให้แคบลง
และเลื่อนไปวางตรงที่ไม่บังอะไรได้ · popup ตายตอน Alt+Tab (ทำลาย loop §15)
ส่วน side panel กินพื้นที่ถาวรไม่ว่าจะใช้อยู่หรือไม่

### โครงสร้าง — tool rail

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
│    │ ── servers ──                       │
│🚩 │ [rows...]                           │
│Flg │                                  ◢ │ ← ปรับขนาด
└────┴─────────────────────────────────────┘
```

**rail ซ้ายคือส่วนที่ออกแบบมาเพื่อโต** — feature ใหม่เพิ่ม 1 entry ใน `TOOLS`
ก็โผล่ใน rail เลย ไม่ต้องตัดสินใจเรื่อง layout อีก และไม่กลายเป็นเมนูซ้อนเมนู

```ts
// src/content/panel/tools.tsx
{ id, icon, label, title, flag?, badge?, render }
```

- `flag` — ซ่อนอัตโนมัติเมื่อ feature ถูกปิดใน Settings
- `badge` — จุดแดงบน rail + ตัวเลขบนปุ่ม launcher ตอนปิดอยู่

### Launcher

ตอนปิด เหลือปุ่มกลมเล็ก ๆ มุมขวาล่าง พร้อม badge บอกจำนวนเซิร์ฟที่ถูก flag
→ **panel ที่ปิดอยู่ก็ยังสื่อสาร status ได้**

### Shadow DOM — ไม่ใช่ทางเลือก แต่จำเป็น

panel render อยู่ใน Shadow DOM root เพราะ:

1. CSS ของ roblox.com กว้างพอที่จะ restyle อะไรก็ตามที่เราแทรกเข้าไป
2. สิ่งที่เราแทรกก็พังหน้าเขาได้เหมือนกัน

shadow root ตัดขาดทั้งสองทางพร้อมกัน · style จึงต้องเดินทางมาเป็น **string**
(`panelStyles.ts` + `sharedStyles.ts` ที่ generate จาก CSS จริง) เพราะ stylesheet
ที่ emit เป็นไฟล์จะไปอยู่ใน main document ซึ่ง shadow root มองไม่เห็น

## Command Center

```
┌─────────────────────────────────────┐
│ Roblox Companion                ⚙  │
├─────────────────────────────────────┤
│ ┌─ LAST JOINED ────────────────────┐│   ← อยู่บนสุด กด 1 ครั้งจบ (§16)
│ │ Steal An Egg · a73d…991f         ││
│ │ 2/7 · avg 43ms · 18m ที่แล้ว      ││
│ │ [👍 Clean][⚠ Exploiter][🐛 Bug]  ││
│ │ [🚫 Avoid]            [↻ Rejoin] ││
│ └──────────────────────────────────┘│
│                                     │
│ ⚡ SMART JOIN            (phase 3)  │
│                                     │
│ [👤 Lowest] [🎲 Random] [🔒 Private]│
│                                     │
│ Server Health                       │
│ 🟢 148 clean · 🔴 7 flagged         │
│ 👤 4 blacklisted (ตรวจไม่ได้)       │
├─────────────────────────────────────┤
│ Servers │ History │ Blacklist       │
└─────────────────────────────────────┘
```

โซนบนไม่เลื่อนหาย เพราะเป็นสิ่งที่ใช้ซ้ำทุกรอบ

## Server row

```
┌──────────────────────────────────────────────────┐
│ 2 / 7          Region —        เห็นครั้งแรก 18m  │
│ avg 43ms                                          │
│ 🟢 CLEAN                                          │
│ [ JOIN ]  [ ⭐ ]  [ ⋯ ]                          │
└──────────────────────────────────────────────────┘
```

`Region —` จะกลายเป็นชื่อจริงหลัง probe (phase 3) หรือ `ไม่ทราบ (UDMUX)` ถ้า probe แล้วไม่ได้

## Quick Action Bar (§2) — แทรกข้างปุ่ม Play

```
┌────────────────────────────────────────────────────┐
│ ▶ PLAY                                             │
│ [⚡ Smart Join] [👤 Lowest] [🔒 Private] [🔎 Panel]│
└────────────────────────────────────────────────────┘
```

phase 2: Smart Join กับ Private แสดงแบบ disabled พร้อม tooltip ว่ามาในเฟสไหน
ไม่ซ่อนไว้หลัง dropdown หลายชั้น (§2)

## One-click (§42)

| action | click |
|---|---|
| Join Lowest | 1 |
| Flag เซิร์ฟล่าสุด | 1 |
| Rejoin | 1 |
| Smart Join | 1 |
| Create + Join free private | 1 (+1 confirm ถ้าเสียเงิน — บังคับ §8) |

## Command Palette (phase 10)

`Ctrl+K` — คำสั่งเรียงตามหน้าที่อยู่ (§41): หน้า Experience ดัน server command ขึ้นก่อน,
หน้า Profile ดัน copy UserId / add blacklist, หน้า Limited ดัน value / chart

## Empty / error state

ทุก state ต้องบอก **สาเหตุ** และ **สิ่งที่ผู้ใช้ทำได้** ไม่ใช่แค่ว่าพัง

```
⚠ Guest 3/min          → "ล็อกอิน roblox.com แล้วเปิดแท็บค้างไว้ 1 แท็บ"  [ลองใหม่]
ไม่พบเซิร์ฟเวอร์         → "เกมนี้อาจไม่มีเซิร์ฟ public"                    [รีเฟรช]
ปุ่มไม่โผล่ในหน้าเกม     → Roblox เปลี่ยน DOM — side panel ยังใช้ได้ปกติ
```

## Accessibility

`prefers-reduced-motion` · focus ring ชัด · ปุ่มมี `aria-label` · เป้ากดขั้นต่ำ 32px ·
สถานะไม่สื่อด้วยสีอย่างเดียว (มี icon + ข้อความกำกับเสมอ)
