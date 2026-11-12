# หมวกโพกผ้าขาวประดับขนนก — SVG บนบรันช์เดิม

**สถานะ: art-only / unintegrated / untested / not merged**

เพิ่มตามภาพด้านหน้าสีเหลือง/สีเขียวและภาพ overhead ที่ผู้ใช้ส่งต่อจากชุดฟาโร โดย **ขนนกและอัญมณีกลมใช้สีเดียวกับตัวละคร** ส่วนผ้าขาว แถบคาดทอง และตัวเรือนอัญมณีเป็นสีคงที่ ทำบน `art/rope-hat-svg-2077-2078` ตามขอบเขต SVG เดิม ไม่ QA หรือทดสอบ

อ่าน [HANDOFF รวม](../HANDOFF.md) และ [wardrobe-assets.json](../wardrobe-assets.json) ก่อนเชื่อม ลำดับ B ล่าสุดรวม `none` เป็น 8 ตัวเลือก: `none → white-rope-wrap → pirate-hat → golden-crown → shades-white-beard → pharaoh-nemes → plumed-turban → paper-bag-mask → none` Catalog และภาพลำดับเป็นข้อกำหนดส่งต่อ ยังไม่ได้ลงทะเบียนเครื่องแต่งกายหรือเชื่อม B ในเกม

## ไฟล์

- [hat-front.svg](hat-front.svg): หมวกด้านหน้า ผ้าขาวจีบโค้ง แถบทอง ขนนกสูง และอัญมณีกลมในตัวเรือนทอง
- [hat-top.svg](hat-top.svg): หมวกมุมบน ขนนกเอนไปทางท้ายศีรษะ แถบทองและอัญมณีอยู่ด้านหน้า
- `colors/front-<hex>.svg`, `colors/top-<hex>.svg`: 24 ไฟล์สำหรับสีผู้เล่นทั้ง 12 สี แยก IDs ของ gradient/clip ตามสีและมุม
- [preview.svg](preview.svg): ด้านหน้าเทียบสีเหลืองกับสีเขียว ด้านบนสองทิศ และตัวอย่าง 12 สี
- `examples/front-wearing.svg`, `examples/front-green.svg`: ตัวอย่างบนรูปทรงตัวละครเดิม สีเหลือง/เขียว
- `examples/top-wearing.svg`, `examples/top-green.svg`: ตัวอย่าง overhead สีเหลือง/เขียว
- [asset.json](asset.json): พิกัด สี ทิศ และข้อกำหนดการเชื่อม

Production SVG โปร่งใส ไม่มีตัวละคร พื้นม่วง กรอบวงกลมทองรอบภาพ สนาม หรือเงาพื้นอยู่ใน overlay ตัวอย่าง `examples/` มีตัวละครเพื่อดูงานเท่านั้น อย่าใช้แทน sprite เคลื่อนไหวหรืออ้างเป็นผล QA

## ขนนกและอัญมณีเปลี่ยนพร้อมกัน

ตั้ง **`color` บน root `<svg>`** ให้เป็น `player.color` ก่อน decode/serialize เช่น `color="#d7b000"` หรือ `color="#009400"` ทั้ง `data-part="player-color-feather"` และ `data-part="player-color-gemstone"` ใช้ `fill="currentColor"` กับแสง/เงาขาวดำโปร่งใส จึงไม่ตรึงสองส่วนนี้เป็นสีเหลือง

`white-cloth`, `gold-band` และ `gold-bezel` ใช้สีตายตัว ไม่เปลี่ยนสีผ้าหรือทองตามตัวละคร และไม่ tint ทั้งภาพ อย่าอาศัย CSS ของ `<img>` ภายนอกส่งสีเข้า SVG image ใช้ root color หรือเลือก variant แล้ว cache ตาม `hatId + color + projection`

อัญมณีด้านหน้าเป็นวงกลมที่ `(48,28.3)` รัศมี `6.25` ส่วนมุมบนฉายเป็นวงรีที่ `(32,20.4)` รัศมี `(2.8,2.05)` บนแถบทองด้านหน้า ตัวเรือนรอบอัญมณียังคงสีทอง

## พิกัดและทิศ

### Portrait

- ฐานตัวละคร `0 0 96 96`, anchor `(48,48)` ขนาดหัวเดิม
- หมวก `viewBox="-12 -64 120 168"` เผื่อขนนกสูงเหนือผ้า โดยไม่ย่อหัว
- หลัง translate ไปกลาง portrait ให้ `k = portraitSize / 96` แล้ววาดที่ `(-60*k,-112*k,120*k,168*k)`
- อย่า fit ภาพสูง 168 กลับลงกรอบตัวละคร 96 เพราะจะเลื่อนแถบหน้าผากและลดขนาดหมวก เผื่อพื้นที่ด้านบนใน UI ที่ clip ภาพแทน

### Overhead

- ฐานตัวละคร `0 0 64 64`, anchor `(32,32)`, head pivot `(32,30)`, forward `(0,-1)`
- หมวก `viewBox="-8 -8 80 96"` เพิ่มพื้นที่ทางท้ายศีรษะสำหรับปลายขนนก
- หลัง translate/rotate ตามตัวละคร วาดที่ `(-32.5,-32.5,65,78)` world units ตามอัตราเดิม `52/64` แล้วคูณ scale เดิมของผู้เรียก
- ภาพมุมบน **ไม่เป็นสี่เหลี่ยมจัตุรัส** อย่าบีบให้เป็น `65 × 65` หรือจัด origin ตามกึ่งกลางภาพที่มี padding
- **หน้าตัวละคร/อัญมณีอยู่ −Y ขนนกเอนไปทางท้ายศีรษะ +Y** ตัวอย่างที่หมุน +90° จึงหันหน้าขวาและมีปลายขนนกชี้ซ้ายตามภาพผู้ใช้
- เฉพาะขนนกใช้การฉาย `translate(32 25.2) rotate(180) scale(.72 .62) translate(-48 -21)` จากทรงขนนกด้านหน้า ห้ามหมุนทั้งหมวกหรือย้ายขนนกไปอยู่หน้าใบหน้า

ลำดับวาด: ผ้าขาว → แถบทอง → ขนนก → ตัวเรือนและอัญมณี วาง overlay หลังหัว/ตาและก่อน label/status effect ระหว่างต่อยให้ติดตาม **head transform** และ attackFacing เดียวกับหัวตาม `assets/animations/punch-v2/timing.json`: `translate(torsoDx*.55, torsoDy*.55) rotate(headRotationDeg 32 30)` ไม่ติดหมวกกับ torso twist ทั้งก้อน

คงขนาดตัวละคร เงาพื้น collision, pickup, bounds และ physics เดิม Padding ไม่ใช่ hitbox ถ้าฝังหลาย SVG inline ใน DOM เดียว ให้ namespace gradient/clip IDs และ `url(#...)` ให้ไม่ชนกัน

## ส่งต่อให้ AI ตัวถัดไป

1. เชื่อม `plumed-turban` ถัดจาก `pharaoh-nemes` ในการเลือกเครื่องแต่งกายต่อผู้เล่น เก็บทั้งเจ็ดชุดบนบรันช์เดียวกัน รวมไม่ใส่เป็น 8 ตัวเลือก รักษาทิศตรากะโหลกโจรสลัดและทิศแว่นที่แก้แล้ว
2. ในเขต `wardrobe` ให้กด B ใหม่หนึ่งครั้งเปลี่ยนหนึ่งขั้น แสดง “B เปลี่ยนเครื่องแต่งกาย” คงหน้าที่ B เดิมนอกเขต/ในเกม เก็บการเลือกเมื่อเดินออกจากเขตและใช้ระบบ sync/reconnect เดิม
3. ส่ง cosmetic selection ผ่าน state ของ Plaza ไป renderer ให้ครบ portrait, overhead, punch และ fallback ผูกสีขนนกกับอัญมณีเข้ากับสีปัจจุบันของผู้เล่น
4. อ่าน owner instructions/CI policy แล้วทดสอบทุกสี/ทิศ/ท่า ทั้งสองส่วนเปลี่ยนสีพร้อมกัน ผ้าขาวและทองคงเดิม ขนนกมุมบนชี้ท้ายศีรษะ การวาดไม่ยืด/เลื่อนหัว clipping ของขนนกสูง มือถือ/iPad, B edge, ลำดับ 8 ตัวเลือก, sync และ reconnect
5. เปิด PR ตาม workflow หลังเชื่อมและทำ preflight โดย AI ที่รับผิดชอบ QA รวมเมื่อ required checks ของ latest head ผ่านครบ

รอบทำภาพนี้สร้างเฉพาะ SVG, metadata, ตัวอย่าง และคำแนะนำส่งต่อ **ไม่ได้รันเกม, browser, build, syntax check, QA, tests หรือ CI และไม่เปิด PR/รวม main** ภาพ SVG/PNG ตัวอย่างเป็นงานประกอบภาพ ไม่ใช่ผลทดสอบเกม
