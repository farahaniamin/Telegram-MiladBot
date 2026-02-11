# Milad Hospital Appointment Watcher Bot (grammy + TS)

## Setup
1) Copy `.env.example` to `.env` and fill values.
2) Install deps:
```bash
npm i
```
3) Run in dev:
```bash
npm run dev
```
4) Build & run:
```bash
npm run build
npm start
```

## Commands
### User
- `/start` شروع
- `انتخاب درمانگاه` (دکمه‌ها)
- `🔍 جستجو` بررسی لحظه‌ای
- `🔔 خبرم کن` فعال‌سازی نوتیفیکیشن

### Admin
- `/status`
- `/interval <minutes>`
- `/pause`
- `/resume`
- `/seed` (نمایش درمانگاه‌ها و وضعیت کدها)
- `/setcode <infirmaryId> <code>` (تکمیل code اگر unknown باشد)

> NOTE: بر اساس دیتایی که دادی فقط code درمانگاه اطفال (id=22, code=242) قطعی است. بقیه درمانگاه‌ها با code خالی Seed می‌شوند و تا تکمیل نشوند قابل Watch نیستند.
