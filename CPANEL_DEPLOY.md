# cPanel Node.js Deployment Guide

## Prerequisites
- cPanel hosting with Node.js 20.x
- SSH/Terminal access
- Domain: https://afarahani.ir

## Deployment Steps

### 1. Connect to cPanel Terminal

Access your cPanel and open **Terminal** or connect via SSH:
```bash
ssh your_username@afarahani.ir
```

### 2. Upload Bot Code

**Option A: Clone from GitHub**
```bash
cd /home/username
git clone https://github.com/farahaniamin/Telegram-MiladBot.git
cd Telegram-MiladBot
git checkout mizbanfa-host-wp
```

**Option B: Upload via File Manager**
- Download the code as ZIP from GitHub
- Upload to cPanel File Manager
- Extract to `/home/username/milad-bot/`

### 3. Install Dependencies

```bash
cd /home/username/milad-bot
npm install
```

### 4. Set Environment Variables

Create a `.env` file:
```bash
nano .env
```

Add these contents:
```env
BOT_TOKEN=8517765773:AAEbn5zjYsSnkyvUX6ZVLopSFifa2eDY0cg
ADMIN_IDS=51072330
SYSTEM_NATIONAL_CODE=0310751942
USE_LOCAL_PROXY=off
USE_API_WORKER=off
DEFAULT_INTERVAL_MIN=2
```

Save: `Ctrl + O`, `Enter`, `Ctrl + X`

### 5. Run the Bot

Test if it works:
```bash
cd /home/username/milad-bot
node src/index.js
```

You should see:
```
🔧 Creating bot with configuration...
✅ Bot connected: @MiladAppointmentBot
🚀 Starting bot polling...
```

**Test by sending /start to your bot!**

### 6. Keep Bot Running 24/7

**Option A: Using PM2 (Recommended)**
```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start src/index.js --name milad-bot

# Keep running after logout
pm2 startup
pm2 save
```

**Option B: Using cPanel Node.js App**
1. In cPanel → **Setup Node.js App**
2. Create New Application:
   - Node.js Version: 20.x
   - Application Mode: Production
   - Application Root: milad-bot
   - Application URL: Select your domain or create subdomain (e.g., bot.afarahani.ir)
   - Application Startup File: src/index.js
3. Save
4. Click "Start App"

### 7. Set Webhook (Optional - for webhook mode)

If using webhook instead of polling:
```bash
# Set webhook URL (replace with your domain)
curl -X POST "https://api.telegram.org/bot8517765773:AAEbn5zjYsSnkyvUX6ZVLopSFifa2eDY0cg/setWebhook" \
  -d "{\"url\": \"https://bot.afarahani.ir/webhook\"}"
```

## Troubleshooting

### Bot not responding?
1. Check if running: `pm2 list` or cPanel Node.js status
2. Check logs: `pm2 logs milad-bot`
3. Check if port is correct (cPanel usually uses port 3000-5000)

### Database error?
```bash
# Make sure database file is writable
chmod 755 milad-bot
chmod 644 milad-bot/*.db
```

### Proxy issues?
The proxy settings are in `.env`:
- `USE_LOCAL_PROXY=off` - Disable local proxy (use direct connection)
- `USE_API_WORKER=off` - Disable API worker

## Quick Commands

```bash
# Check if bot is running (PM2)
pm2 list

# View bot logs
pm2 logs milad-bot

# Restart bot
pm2 restart milad-bot

# Stop bot
pm2 stop milad-bot
```

## Files Structure

```
~/milad-bot/
├── .env                    # Environment variables
├── package.json
├── src/
│   ├── index.ts           # Main entry point
│   ├── config.ts         # Configuration
│   ├── bot/              # Bot handlers
│   ├── storage/          # Database
│   ├── services/         # Hospital API
│   └── core/             # Scheduler, watcher
└── node_modules/
```

## Support

- Bot should work with Iranian IPs
- Hospital API should be accessible
- If issues, check PM2 logs or cPanel error logs
