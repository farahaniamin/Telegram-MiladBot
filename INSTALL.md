# Milad Appointment Bot - Installation & Deployment Guide

## Table of Contents
1. [How It Works](#how-it-works)
2. [Prerequisites](#prerequisites)
3. [Architecture Overview](#architecture-overview)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Configuration](#configuration)
6. [Monitoring & Logs](#monitoring--logs)
7. [Troubleshooting](#troubleshooting)

---

## How It Works

### System Overview

This bot helps users find and get notified about available appointment slots at Milad Hospital in Iran.

**Key Features:**
- **Real-time Search**: Users can search for immediate available appointments
- **Smart Notifications**: Users can set watches on clinics and get notified when slots open
- **Duplicate Prevention**: Prevents users from setting multiple watches on the same clinic
- **User Management**: Stores user national codes for hospital system validation

**Workflow:**

```
User sends /start
    ↓
Bot asks for National Code (10 digits)
    ↓
Validates code with hospital system
    ↓
Shows Main Menu:
  - View Clinics
  - My Watches  
  - Help
    ↓
User selects Clinic
    ↓
Options:
  - Search Now (immediate check)
  - Notify Me (set watch)
    ↓
If "Notify Me":
  - Bot checks every 2 minutes
  - Sends notification when slot found
  - User chooses: Continue watching or Stop
```

### Technical Flow

1. **HTTP Handler** (`/webhook`): Receives Telegram updates
2. **Cron Trigger**: Runs every 2 minutes to check appointments
3. **D1 Database**: Stores users, watches, and settings
4. **Hospital API**: Checks real-time availability

---

## Prerequisites

### Required Accounts

1. **Cloudflare Account** (Free tier works)
   - Sign up: https://dash.cloudflare.com/sign-up
   - Verify email

2. **Telegram Account**
   - Install Telegram app
   - Find @BotFather

3. **GitHub Account** (optional, for code management)

### Required Tools

Install these on your computer:

```bash
# Install Node.js (v18 or higher)
# Download from: https://nodejs.org/

# Verify installation
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher

# Install Wrangler CLI globally
npm install -g wrangler

# Verify Wrangler
wrangler --version
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────────┐     │
│  │  Telegram Bot    │◄───────►│   Cloudflare Worker  │     │
│  │  (@YourBotName)  │ Webhook │   (Your Code)        │     │
│  └──────────────────┘         └──────────┬───────────┘     │
│                                          │                 │
│                                          ▼                 │
│                             ┌──────────────────────┐      │
│                             │   Cron Trigger       │      │
│                             │   (Every 2 min)      │      │
│                             └──────────┬───────────┘      │
│                                        │                  │
│                                        ▼                  │
│                             ┌──────────────────────┐      │
│                             │   D1 Database        │      │
│                             │   (SQLite)           │      │
│                             └──────────────────────┘      │
│                                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────┐
                   │  Milad Hospital  │
                   │  API             │
                   └──────────────────┘
```

**Components:**
- **Worker**: Runs your bot code (JavaScript/TypeScript)
- **D1**: Serverless SQLite database (free up to 5M reads/day)
- **Cron**: Scheduled tasks (free up to 1,000/day)
- **Webhook**: HTTP endpoint for Telegram updates

---

## Step-by-Step Deployment

### Step 1: Get Your Telegram Bot Token

1. Open Telegram and search for **@BotFather**
2. Start chat and send: `/newbot`
3. Follow prompts:
   - Enter bot name (e.g., "Milad Appointment Bot")
   - Enter username (must end in 'bot', e.g., "milad_appointment_bot")
4. **Save the token** (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Send `/setcommands` to BotFather and paste:
   ```
   start - Start the bot
   help - Show help
   mywatches - View your active watches
   ```

### Step 2: Get Your Telegram User ID

1. Search for **@userinfobot** on Telegram
2. Start chat
3. Bot will reply with your ID (e.g., `123456789`)
4. **Save this number** - you'll need it as ADMIN_ID

### Step 3: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/farahaniamin/Telegram-MiladBot.git

# Enter directory
cd Telegram-MiladBot

# Switch to cloudflare branch
git checkout cloud-flare-deploy

# Install dependencies
npm install
```

### Step 4: Login to Cloudflare

```bash
# Authenticate Wrangler with your Cloudflare account
npx wrangler login

# This will open a browser window
# Log in to Cloudflare and authorize
# You should see: "Successfully logged in"
```

### Step 5: Create D1 Database

```bash
# Create the database
npx wrangler d1 create milad-bot-db

# Output will show:
# ✅ Successfully created DB 'milad-bot-db'
# Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Important:** Copy the Database ID from the output.

### Step 6: Update Configuration

Edit `wrangler.toml` file:

```toml
name = "milad-appointment-bot"
main = "src/index.ts"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]

# Update this with your database ID
triggers = { crons = ["*/2 * * * *"] }

[[d1_databases]]
binding = "DB"
database_name = "milad-bot-db"
database_id = "YOUR_DATABASE_ID_HERE"  # <-- REPLACE THIS

[vars]
DEFAULT_INTERVAL_MIN = "2"
JITTER_SEC = "20"
```

Replace `YOUR_DATABASE_ID_HERE` with the ID from Step 5.

### Step 7: Run Database Migrations

```bash
# Create and apply the database schema
npx wrangler d1 migrations apply milad-bot-db

# Should show: "✅ Successfully applied migration"
```

### Step 8: Set Secrets

Secrets are encrypted and secure:

```bash
# Set your bot token (from Step 1)
npx wrangler secret put BOT_TOKEN
# Enter: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Set admin IDs (from Step 2, comma-separated for multiple)
npx wrangler secret put ADMIN_IDS
# Enter: 123456789

# Set system national code for checking appointments
npx wrangler secret put SYSTEM_NATIONAL_CODE
# Enter: 0310751942 (or any valid 10-digit national code)
```

### Step 9: Deploy

```bash
# Deploy to Cloudflare
npx wrangler deploy

# Output will show:
# ✅ Successfully published your script
# Available at: https://milad-appointment-bot.xxx.workers.dev
```

**Save the URL** - you'll need it for the webhook.

### Step 10: Set Webhook

Replace `YOUR_BOT_TOKEN` and `YOUR_WORKER_URL`:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://milad-appointment-bot.xxx.workers.dev/webhook"}'

# Success response:
# {"ok":true,"result":true,"description":"Webhook was set"}
```

### Step 11: Test the Bot

1. Open Telegram
2. Find your bot (from Step 1)
3. Send `/start`
4. You should see the welcome message!

---

## Configuration

### Changing Check Interval

Edit `wrangler.toml`:

```toml
# Check every minute
triggers = { crons = ["* * * * *"] }

# Check every 5 minutes  
triggers = { crons = ["*/5 * * * *"] }

# Check every hour
triggers = { crons = ["0 * * * *"] }
```

Valid cron formats:
- `* * * * *` - Every minute
- `*/2 * * * *` - Every 2 minutes
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour

### Adding Multiple Admins

```bash
npx wrangler secret put ADMIN_IDS
# Enter: 123456789,987654321,555555555
```

### Environment Variables

Edit `[vars]` section in `wrangler.toml`:

```toml
[vars]
DEFAULT_INTERVAL_MIN = "5"    # Check every 5 minutes
JITTER_SEC = "30"             # Random delay 0-30 seconds
```

---

## Monitoring & Logs

### View Real-time Logs

```bash
# Watch logs as they happen
npx wrangler tail
```

### Check Deployment Status

```bash
# See deployment info
npx wrangler deployment status

# List all deployments
npx wrangler deployment list
```

### Database Queries

```bash
# View all clinics
npx wrangler d1 execute milad-bot-db --command="SELECT * FROM infirmaries"

# Count active watches
npx wrangler d1 execute milad-bot-db --command="SELECT COUNT(*) as active_watches FROM watches WHERE active = 1"

# View recent notifications
npx wrangler d1 execute milad-bot-bot-db --command="SELECT * FROM watch_history ORDER BY notified_at DESC LIMIT 10"
```

### Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Select your account
3. Go to "Workers & Pages"
4. Click on "milad-appointment-bot"
5. View:
   - Real-time logs
   - HTTP traffic
   - Cron triggers
   - D1 database metrics

---

## Troubleshooting

### Bot Not Responding

**Symptom:** Bot doesn't reply to messages

**Checklist:**
1. Verify webhook is set:
   ```bash
   curl https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo
   ```
   
2. Check if URL matches:
   - Should show your Workers URL
   - Should have `"has_custom_certificate":false`

3. Check logs:
   ```bash
   npx wrangler tail
   ```

4. Verify BOT_TOKEN secret:
   ```bash
   npx wrangler secret list
   ```

**Fix:**
```bash
# Reset webhook
npx wrangler deploy
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -d '{"url": "https://your-worker.workers.dev/webhook"}'
```

### Database Errors

**Symptom:** "Database not found" or query errors

**Checklist:**
1. Verify database exists:
   ```bash
   npx wrangler d1 list
   ```

2. Check database ID in `wrangler.toml` matches

3. Run migrations again:
   ```bash
   npx wrangler d1 migrations apply milad-bot-db
   ```

**Fix:**
```bash
# If database is missing, create it again
npx wrangler d1 create milad-bot-db
# Then update wrangler.toml and re-deploy
```

### Cron Not Running

**Symptom:** Watches not being checked

**Checklist:**
1. Check Cron Triggers in Cloudflare Dashboard
2. Verify `isPaused()` returns false
3. Check scheduled events in logs:
   ```bash
   npx wrangler tail
   ```

**Fix:**
```bash
# Check if paused (as admin, send /status)
# Resume if needed (send /resume)

# Redeploy to ensure triggers are registered
npx wrangler deploy
```

### "Allow to set timing" Error

**Symptom:** Users can't validate national codes

**Cause:** SYSTEM_NATIONAL_CODE is not valid

**Fix:**
```bash
# Update with a valid national code
npx wrangler secret put SYSTEM_NATIONAL_CODE
# Enter a valid 10-digit code that works on miladhospital.com
```

### High Error Rate

**Symptom:** Many failed requests

**Checklist:**
1. Check if hitting free tier limits:
   - Workers: 100,000 requests/day
   - D1: 5M reads/day, 100K writes/day

2. Check hospital website is accessible

3. Verify network connectivity:
   ```bash
   curl -I https://miladhospital.com
   ```

**Fix:**
- Upgrade to paid plan if hitting limits
- Check if hospital API has changed

---

## Free Tier Limits

Cloudflare Workers free tier includes:

| Resource | Free Limit |
|----------|-----------|
| Worker Requests | 100,000/day |
| Scheduled Triggers | 1,000/day |
| D1 Storage | 1 GB |
| D1 Reads | 5,000,000/day |
| D1 Writes | 100,000/day |
| CPU Time | 50ms/request |

**For this bot:**
- With 100 users and 2-minute checks: ~72,000 requests/day
- Well within free tier limits

---

## Updating the Bot

When code changes:

```bash
# Pull latest changes
git pull origin cloud-flare-deploy

# Install any new dependencies
npm install

# Deploy updates
npx wrangler deploy

# Bot updates automatically!
```

---

## Security Best Practices

1. **Never commit secrets**
   - `wrangler.toml` has no secrets
   - Use `wrangler secret put` only
   - `.gitignore` should exclude sensitive files

2. **Use strong bot tokens**
   - If token is compromised, regenerate via @BotFather
   - Update with `npx wrangler secret put BOT_TOKEN`

3. **Limit admin access**
   - Only trusted Telegram user IDs in ADMIN_IDS
   - Admins can see stats and pause bot

4. **Monitor usage**
   - Check Cloudflare dashboard regularly
   - Watch for unusual activity

---

## Support

**Issues:** Report on GitHub: https://github.com/farahaniamin/Telegram-MiladBot/issues

**Telegram:** Contact @farahaniamin (if available)

**Cloudflare Docs:** https://developers.cloudflare.com/workers/

---

## Quick Reference

```bash
# Deploy
npx wrangler deploy

# View logs
npx wrangler tail

# Database query
npx wrangler d1 execute milad-bot-db --command="SELECT * FROM users"

# Set secret
npx wrangler secret put SECRET_NAME

# Local development
npx wrangler dev
```

---

**Last Updated:** 2024-12-30  
**Version:** 2.0.0 (Cloudflare Workers Edition)
