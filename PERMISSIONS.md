# PERMISSIONS

ทุก permission ต้องมีเหตุผลในเอกสารนี้ก่อนเพิ่มลง manifest (§45)
หลักการ: **ขอน้อยที่สุดเท่าที่ feature ต้องการจริง** (§44)

## Permission ที่ใช้อยู่

| Permission | เหตุผล | Feature ที่ต้องใช้ | optional ได้ไหม |
|---|---|---|---|
| `storage` | เก็บ settings, server history, reports, blacklist ในเครื่อง | ทุก feature | ❌ core |
| `tabs` | หาแท็บ roblox.com เพื่อ proxy fetch (CORS) และสั่ง join จาก origin ที่ถูก · อ่าน URL เพื่อรู้ placeId ปัจจุบัน | Server browser, Join, Context detection | ❌ core |
| `sidePanel` | Side Panel เป็น surface หลักของ loop join→flag (popup ปิดตอน Alt+Tab) | Command Center | ❌ core |
| `alarms` | prune record เก่าเป็นระยะ · (phase 9) poll trade notification | Maintenance, Trading | 🟡 ได้ ถ้าตัด maintenance |

## Host permissions

| Host | เหตุผล |
|---|---|
| `https://www.roblox.com/*` | inject content script + MAIN world · fetch proxy ที่ origin ถูกตาม CORS · สั่ง join |
| `https://games.roblox.com/*` | server list, private servers, game info |
| `https://users.roblox.com/*` | username → userId (blacklist §12) |
| `https://apis.roblox.com/*` | placeId → universeId |

## Permission ที่เคยขอแล้วถอดออก

| Host | เคยใช้ทำอะไร | ทำไมถอด |
|---|---|---|
| `https://gamejoin.roblox.com/*` | Region probe (Smart Join) | ยิงจริงแล้ว Roblox ตอบ `status: 12` — endpoint นี้เปิดให้เฉพาะ game client ที่ส่ง `User-Agent: Roblox/WinInet` ซึ่ง extension เซ็ตไม่ได้ · การปลอม header เพื่อผ่านด่านขัดกับ §55 → ถอด permission ออกดีกว่าถือไว้เฉย ๆ |

> หลักการ: permission ที่ feature ใช้ไม่ได้จริง **ต้องถอดออก** ไม่ใช่ถือไว้เผื่ออนาคต
> ผู้ใช้ประเมิน extension จากสิ่งที่มันขอ ไม่ใช่จากสิ่งที่มันตั้งใจจะใช้

> ถ้าเรียก `chrome.permissions.request()` ในอนาคต ต้องเรียกจาก **user gesture ในหน้า Settings เอง**
> ส่งผ่าน service worker ไม่ได้ (gesture ไม่ข้าม `sendMessage`) — แบบเดียวกับ `sidePanel.open()`

## เพิ่มทีหลัง (ยังไม่ขอตอนนี้)

| Permission | สำหรับ | phase | optional? |
|---|---|---|---|
| `notifications` | trade / private server ready (§43) | 9 | ✅ **optional** — ขอตอนผู้ใช้เปิด feature |
| `https://presence.roblox.com/*` | last online, blacklist presence check | 5, 8 | ✅ optional |
| `https://friends.roblox.com/*` | mutual friends | 8 | ✅ optional |
| `https://avatar.roblox.com/*` | avatar sandbox / equip | 8 | ✅ optional |
| `https://trades.roblox.com/*` | trading | 9 | ✅ optional |
| `https://thumbnails.roblox.com/*` | รูป avatar ใน blacklist page | 5 | ✅ optional |

> feature ที่แตะข้อมูลอ่อนไหว (presence, friends, trades) จะขอ host permission
> **ตอนผู้ใช้เปิด feature นั้นจริง ๆ** ผ่าน `chrome.permissions.request()` ไม่ขอล่วงหน้าตอนติดตั้ง

## Permission ที่จงใจ **ไม่** ขอ

| Permission | ทำไมไม่ขอ |
|---|---|
| `cookies` | §30 — extension นี้ไม่แตะ `.ROBLOSECURITY` เลย ใช้ `credentials: 'include'` ให้ browser จัดการ การไม่มี permission นี้คือหลักฐานว่าอ่าน cookie ไม่ได้แม้จะอยากอ่าน |
| `scripting` | ไม่ต้องใช้ — MAIN world script ประกาศใน manifest ให้ browser inject เอง |
| `webRequest` / `declarativeNetRequest` | ไม่ดัก/ไม่แก้ traffic ของผู้ใช้ |
| `<all_urls>` | ทำงานเฉพาะ roblox.com |
| `identity` | ไม่มีบัญชีของเรา ไม่มี backend |
| `downloads` | export ใช้ blob + `<a download>` พอ |

## CSP

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

ไม่มี `unsafe-eval` · ไม่มี remote script · ไม่โหลด code จากที่ไหนมารัน (§44)
