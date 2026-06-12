# ShadowForge Unified Server

All-in-one: License API + Telegram Bot + Admin Panel + Mini App

## Quick Start (Local)

```bash
cd unified-server
npm install
npm start
```

Hoặc chạy `start.bat` trên Windows.

Server chạy tại `http://localhost:3000`.

## Endpoints

| Path | Description |
|------|-------------|
| `/api/activate` | Client activate license |
| `/api/heartbeat` | Client validate license |
| `/api/admin/login` | Admin login |
| `/api/admin/*` | Admin CRUD |
| `/admin` | Admin Panel UI |
| `/mini-app` | Mini App Shop |
| `/telegram` | Bot webhook (for Render) |
| `/health` | Health check |

## Deploy to Render (Free)

1. Push code lên GitHub repo.

2. Tạo **New Web Service** trên Render.com:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Free tier:** 512MB RAM, auto-sleep after 15min

3. Set Environment Variables trên Render:
   ```
   PORT=3000
   BOT_TOKEN=8748609846:AAFS9n154QJZvvKIfW3zJlcdDo07OE16Z-o
   PUBLIC_URL=https://your-app.onrender.com
   KEEPALIVE_URL=https://your-app.onrender.com
   RENDER=true
   ```

4. Sau khi deploy, set Telegram Bot Webhook:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.onrender.com/telegram
   ```

## Chống Sleep trên Render Free

Server tự ping `/health` mỗi 14 phút qua `KEEPALIVE_URL` để giữ awake.

## License Key Format

`SHADOW-XXXXX-XXXXX-XXXXX-XXXXX`
