# Architecture Note

## ปัญหาเดิม
- มีการอ้างอิงไฟล์/โมดูลที่ไม่อยู่ใน repo (เช่น core/project-rules, rooms* routes) ทำให้เกิด Cannot find module ใน IDE
- สคริปต์ seed ใช้โมเดลที่ไม่มีใน schema (User) และ path alias `@` จากไฟล์นอก `src/` ทำให้เกิด diagnostic
- middleware เดิมถูกแทนด้วย proxy แต่ยังมีรายงานค้างจากไฟล์ที่ถูกลบ

## ขอบเขตและ Boundary ปัจจุบัน
- Path alias `@` ชี้ไปที่ `src/**`
- proxy.ts ทำหน้าที่เป็น edge adapter บาง: ตรวจ session/role และปล่อยให้ server routes จัดการต่อ
- โดเมนและอินฟราแยกจาก HTTP; use case ใหม่สำหรับ Occupancy Timeline อยู่ในโดเมนและไม่ผูก Next.js

## Future Work (ยังไม่ทำ)
- RoomTimelineReader: reader ที่ผูกกับแหล่งข้อมูลจริงสำหรับ timeline
- RoomMonthlyAggregator: การรวมข้อมูลรายเดือนอย่างเป็นทางการแทนการอ้างอิงจาก invoice โดยตรง

## Known Editor Issue
- บาง editor/TS Server อาจแสดง false-positive: `Cannot find module '@/app/api/.../route'`
- เป็นปัญหา cache/การ resolve ของ TS Server กับ ESM + path alias + NodeNext
- แก้โดย Restart TS Server หรือ Reload Window; กรณีดื้อให้ลบ `.next` และ `node_modules/.cache` แล้วเปิดใหม่
- ไม่ใช่ defect ของโค้ดหรือคอนฟิก: tsc (`--noEmit`) และ vitest ผ่านครบ
