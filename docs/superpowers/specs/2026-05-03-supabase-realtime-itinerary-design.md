---
name: supabase realtime itinerary design
description: Spec (Thai) for using Supabase Free tier as realtime backend with optimistic locking for itinerary day add/update
type: project
---

# Supabase Realtime Itinerary Design (ภาษาไทย)

เวอร์ชัน: 2026-05-03

## เป้าหมายสั้น ๆ
- ให้ผู้ใช้ประมาณ 10 คน สามารถดู, เพิ่ม, แก้ไขแผน (itinerary) แบบ realtime โดยที่การอัปเดตถูก broadcast ไปยังผู้ใช้คนอื่นทันที และลดความเสี่ยงจาก race condition โดยใช้ optimistic locking + server-side transactional RPC

## ข้อสมมติฐาน / ข้อจำกัด
- ข้อมูลเป็นข้อความ / JSON ขนาดเล็ก (ไม่เก็บไฟล์ขนาดใหญ่ใน DB)
- ไม่ต้องการ collaborative editing ระดับตัวอักษร (character-level) — row/field-level เพียงพอ
- โปรเจกต์ใช้ Supabase Free tier (ข้อจำกัด: DB size ~500MB, storage 1GB, project pause ถ้าไม่มี activity 7 วัน)

## ภาพรวมสถาปัตยกรรม
- Frontend: เว็บ (ปัจจุบันเป็น static JS) ใช้ Supabase JS client สำหรับ Auth, Realtime (subscriptions) และ RPC
- Backend: Supabase hosted Postgres + Realtime (ไม่มี server ใหม่ในขั้นต้น)
- RPC: ฟังก์ชัน Postgres (plpgsql) สำหรับทำการเช็คเวอร์ชันและอัปเดตแบบ atomic (optimistic locking)
- Persistence: ตารางหลักใน Postgres และตาราง audit (option) เพื่อเก็บประวัติการแก้ไข

## โครงแบบข้อมูล (SQL แบบย่อ)
- itineraries (id uuid PK, owner uuid, title text, created_at, updated_at)
- days (id uuid PK, itinerary_id uuid FK, day_index int NOT NULL, title text, details jsonb, updated_at timestamptz, updated_by uuid, version int DEFAULT 1, is_locked boolean DEFAULT false)
- changes (optional audit): เก็บ payload jsonb, actor, op_type, created_at

## กระบวนการ Realtime (Client)
- โหลดหน้า: subscribe เพื่อฟังเหตุการณ์บน days ของ itinerary นั้น:
  - supabase.from('days:itinerary_id=eq.<ID>').on('INSERT/UPDATE/DELETE', handler).subscribe()
- เมื่อรับ event: อัปเดต local state และ UI (ถ้าผู้ใช้ไม่กำลังแก้แถวนั้นอยู่)
- เมื่อผู้ใช้แก้: อ่าน row.version ปัจจุบัน → เรียก RPC ส่ง expected_version พร้อม payload การเปลี่ยนแปลง

## RPC atomic (แนวคิด)
- ชื่อ RPC ตัวอย่าง: update_day_if_version(p_id uuid, p_expected_version int, p_changes jsonb, p_actor uuid)
- พฤติกรรม:
  - BEGIN TRANSACTION
  - SELECT version FROM days WHERE id = p_id FOR UPDATE
  - ถ้า version != p_expected_version → RETURN conflict + current row
  - ถ้าเท่ากัน → UPDATE details = p_changes (หรือ merged), version = version + 1, updated_by = p_actor, updated_at = now() RETURNING *
  - COMMIT
- เรียกด้วย supabase.rpc('update_day_if_version', {...})

## กลยุทธ์จัดการ conflict (เลือกอย่างใดอย่างหนึ่ง)
- A) Manual merge (แนะนำ): เมื่อมี conflict ให้ client แสดง modal ที่เปรียบเทียบ server row กับ local change และให้ผู้ใช้เลือก merge/overwrite/cancel
- B) Server-side field-level merge: เขียนกฎผสานใน RPC (เช่น merge arrays, replace scalars) — UX ราบรื่นขึ้นแต่ต้องออกแบบกฎรอบคอบ
- C) Edit lock: ตั้ง is_locked เมื่อเริ่ม edit แล้ว clear เมื่อเสร็จ — ง่ายแต่เสี่ยงติดล็อกถ้าคลไคลเอนต์ค้าง

## แนวทางฝั่ง Client (implementation notes)
- ตอนเปิด editor: เก็บ version ปัจจุบันใน local state
- บน Save: disable ปุ่ม, เรียก RPC; on success -> apply; on conflict -> show merge modal และให้ user retry
- Subscription: ถ้ามี update ขณะที่ user กำลังแก้ ให้แสดง indicator ว่า server เปลี่ยนแล้วและให้ตัวเลือก reload/merge
- ลดปริมาณ writes: debounce บางฟอร์มที่อาจแก้บ่อย

## Offline behavior
- Supabase client มี caching สำหรับ reads แต่ writes จะล้มเมื่อตอน offline — ถ้าต้องการ offline-first ต้องเพิ่ม queue + retry ที่ฝั่ง client และจัดการ conflict เมื่อ retry (เช่น same conflict flow)

## Testing
- Unit: ทดสอบ RPC (สำเร็จ/ข้อขัดแย้ง) กับ local Postgres หรือ Supabase local
- Integration: จำลอง concurrent updates (A & B โหลด v1 → A update → v2 → B update with v1 → must get conflict)
- Load: จำลอง 10 clients ทำงานพร้อมกัน ดู latency, messages/month usage
- Offline: ทดสอบ offline→reconnect→sync path

## Monitoring & quotas
- ติดตาม Supabase dashboard: DB size, Realtime messages, subscriptions, egress, Edge function invocations
- เก็บ metric ในแอพ: จำนวน conflict, failed updates, latency — เพื่อวิเคราะห์ว่า design ต้องเปลี่ยน

## Security & RLS
- ใช้ Supabase Auth (email/Google)
- ตั้ง RLS (Row-Level Security) เพื่ออนุญาตเฉพาะ owner/collaborators ที่จะ INSERT/UPDATE/DELETE
- RPC ควรตรวจ auth.uid() ก่อนดำเนินการ (session context)

## Persistence & backup
- Free tier ไม่มี backup SLA — กำหนด cron job สำรอง DB ด้วย pg_dump (supabase cli) เป็นไฟล์ที่เก็บใน storage/remote เช่น S3 หรือ Drive
- เตรียม upgrade plan ถ้าต้องการ SLA/automatic backups

## Deployment / migration ขั้นต้น
- สร้าง project ใน Supabase
- รัน SQL migration สำหรับ tables + RPC + RLS policies
- ปรับ frontend: subscribe + RPC + conflict modal
- ทดสอบแบบ local (หลาย tab) → invite ผู้ทดสอบ ~10 คน

## Deliverables
- บันทึก spec นี้เป็นไฟล์ใน repo
- ตัวอย่าง SQL migration (CREATE TABLE + RPC function + RLS policy)
- ตัวอย่างโค้ดฝั่ง client (subscription + rpc call + conflict modal sketch)
- รายการทดสอบ integration และ checklist สำหรับ deploy

--
Spec generated and approved by user on 2026-05-03.
