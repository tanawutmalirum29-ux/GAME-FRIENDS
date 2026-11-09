# GAME-FRIENDS — คู่มือมินิเกมแบบ Plug-in

## โครงสร้างแยกขาดจาก Core

สร้างโฟลเดอร์ใหม่ที่ `src/games/<slug>/` (ชื่อโฟลเดอร์เป็น kebab-case) โดยวางไฟล์เหล่านี้ภายในเกมเท่านั้น:

```text
src/games/meteor-dodge/
├── manifest.json
├── game.js
├── cover.svg
└── ... ไฟล์ Engine, Bot, Map และ SVG ที่เกม import ใช้งาน
```

ไม่ต้องเพิ่มชื่อเกมหรือ `<script>` ใหม่ลง `app.js`, `index.html`, `board-minigame.js` หรือรายการพิเศษในตัวเลือกเกม และไม่ต้องบันทึก Game Registry ด้วยมือ เพราะ `scripts/build-game-catalog.cjs` ค้นหาโฟลเดอร์ที่มี `manifest.json` ตอน Build และคัดลอกไฟล์เป็น `game-assets/<id>/<hash>/` โดยอัตโนมัติ

`manifest.json` ตัวอย่าง:

```json
{
  "id": "meteor_dodge",
  "name": "METEOR DODGE",
  "version": "1.0.0",
  "apiVersion": 1,
  "enabled": true,
  "players": { "min": 1, "max": 12 },
  "modes": ["normal", "board"],
  "controls": ["joystick", "A"],
  "entry": "./game.js",
  "cover": "cover.svg",
  "legacyScripts": []
}
```

เกมใหม่ควรใช้ native ES Module ไม่ใช้ global name; `global` มีไว้เฉพาะ Engine แบบเก่าที่ยังต้องรองรับ Dev Compatibility เท่านั้น

## สัญญา Engine API v1

```js
const engine = {
  resultTitle: 'ผู้รอดชีวิตคนสุดท้าย!',
  countdownSeconds: 3,
  setup(round, players) {
    round.meteorDodge = { elapsed: 0 };
  },
  update(dt, round, players) {
    round.meteorDodge.elapsed += dt;
    // เมื่อจบเกม: return 'winner' ให้ Host ตัดสินผล
    return null;
  },
  draw(ctx, time, round, players) {},
  hud(players, round) {
    return { survivors: players.filter(p => p.active).length };
  },
  getResult(round, players) {
    // ค่า value มากกว่าคืออันดับสูงกว่า; ค่าเท่ากันต้องเสมอ
    // ห้ามคืน NaN หรือ ID ซ้ำ; อนุญาต Infinity สำหรับผู้รอดชีวิต
    return players.filter(p => p.active).map(p => ({
      id: p.id, value: Number(p.score) || 0,
      label: (Number(p.score) || 0) + ' คะแนน'
    }));
  }
};
export default engine;
```

มี Lifecycle เพิ่มเติมได้ตามความจำเป็น: `updateDuringCountdown: true` เพื่อให้เดินระหว่างนับถอยหลัง และ `onCountdownFinished(round,players)` เพื่อเริ่มสถานะจริงหลังนับเสร็จ. ผลการแข่งขันควบคุมผ่าน `getResult` ของเกมเดียวกันสำหรับทั้ง NORMAL และ BOARD; Core จัดอันดับร่วม คะแนนทัวร์นาเมนต์ UI และการแจกของในบอร์ดเอง

## Live Roster สำหรับเกมใหม่ (ทางเลือก)

Engine สามารถประกาศ `getRoster(round, players)` เพื่อให้ HUD แสดงสถานะเฉพาะเกมได้ โดยไม่ต้องแก้ `render.js` หรือสร้างเงื่อนไขชื่อเกมใหม่ใน Core:

```js
getRoster(round, players) {
  return players.filter(p => p.active).map(p => ({
    id: p.id,
    value: Number(p.score) || 0, // ใช้เรียงอันดับระหว่างเล่น
    label: (Number(p.score) || 0) + ' คะแนน',
    status: 'กำลังเล่น',
    eliminated: false
  }));
}
```

หากไม่ประกาศ `getRoster` UI จะแสดงชื่อ สีประจำตัว และ `p.score` โดยอัตโนมัติ **ไม่** แสดงบทบาทคน/ผีผิดเกม; ใช้ `getResult` สำหรับการจัดอันดับตอนจบและ `getRoster` สำหรับข้อมูลสด จึงไม่ต้องประมวลผลอันดับจบการแข่งขันทุกเฟรม

ถ้า BOARD PARTY โหลดมินิเกมใหม่ไม่สำเร็จ จะข้ามเฉพาะมินิเกมนั้นด้วยอันดับเสมอ ไม่มีรางวัล และกลับสู่บอร์ดเดิมโดยรักษา HP, ตำแหน่ง, กระเป๋า และลำดับการเดิน ไม่ยุบห้องทั้งหมด

## Hot Update และรุ่นที่กำลังเล่น

- เว็บที่เปิดค้างจะดึง Catalog ล่าสุดทุก 45 วินาทีขณะหน้าเว็บมองเห็น หรือเมื่อกลับมาที่แท็บ
- การแก้ไฟล์ในโฟลเดอร์มินิเกมหรือ `cover.svg` จะเปลี่ยน Game Hash โดยไม่เปลี่ยน Core Hash ทำให้เกมและภาพปกรุ่นใหม่ถูกใช้กับรอบถัดไปโดยไม่ตัดการเชื่อมต่อห้อง
- รอบที่เริ่มแล้วเก็บอ้างอิง `round.pluginEngine` ไว้ ไม่สลับ Engine กลางคัน หากโหลดรุ่นใหม่ไม่สำเร็จ ระบบเก็บ Engine รุ่นล่าสุดที่เคยผ่านและพักรุ่นเสียชั่วคราว
- การเปลี่ยน `app.js`, สคริปต์ Core, CSS หรือ HTML ต้อง Reload อย่างปลอดภัย ไม่ใช่ Hot Patch ระหว่างการเล่น
- ควรเลี่ยงการดึง Resource ภายนอกแบบไม่มีเวอร์ชันจาก Engine และอย่าโยนข้อผิดพลาดใน `draw`/`update`

## ขั้นตอน QA ก่อน Merge

```sh
node scripts/build-app.cjs --check
node scripts/build-game-catalog.cjs --check
node tests/game-source-ownership.cjs
node tests/game-platform.cjs
node tests/board-party.cjs
node tests/smoke.cjs
```

ทดสอบอย่างน้อย 1, 6, 7 และ 12 ผู้เล่น; ล็อบบี้/การสุ่ม NORMAL และ BOARD, อันดับร่วม, อัปเดต Catalog ระหว่างรอบ, การย้อนกลับรุ่นเก่าเมื่อโหลดล้มเหลว, ปิดเกมด้วย `enabled:false`, การขาดเน็ต และ Browser QA Chromium/WebKit ทั้ง 7 Shards ก่อนรวมเข้า `main`.
