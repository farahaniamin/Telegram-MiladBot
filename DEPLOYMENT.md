# Cloudflare Workers Deployment Guide

## Prerequisites

1. **Cloudflare Account** - Sign up at https://dash.cloudflare.com (Free tier is sufficient)
2. **Wrangler CLI** - Install with: `npm install -g wrangler`
3. **Telegram Bot** - Create a bot with @BotFather and get your BOT_TOKEN

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate Wrangler

```bash
npx wrangler login
```

### 3. Create D1 Database

```bash
npx wrangler d1 create milad-bot-db
```

Copy the database ID from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "milad-bot-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Run Database Migrations

```bash
npx wrangler d1 migrations apply milad-bot-db
```

### 5. Set Secrets

Set your Telegram bot token and other secrets:

```bash
npx wrangler secret put BOT_TOKEN
# Enter your bot token when prompted

npx wrangler secret put ADMIN_IDS
# Enter comma-separated Telegram user IDs (e.g., "123456789,987654321")

npx wrangler secret put SYSTEM_NATIONAL_CODE
# Enter the national code for checking appointments (e.g., "0310751942")
```

### 6. Deploy

```bash
npx wrangler deploy
```

After deployment, you'll get a URL like:
```
https://milad-appointment-bot.YOUR_SUBDOMAIN.workers.dev
```

### 7. Set Webhook

Set your Telegram bot webhook to point to your Workers URL:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://milad-appointment-bot.YOUR_SUBDOMAIN.workers.dev/webhook"}'
```

## Development

### Local Development

```bash
npx wrangler dev
```

This starts a local development server with hot reloading.

### Database Operations

Create a new migration:
```bash
npx wrangler d1 migrations create milad-bot-db migration_name
```

Apply migrations:
```bash
npx wrangler d1 migrations apply milad-bot-db
```

View database:
```bash
npx wrangler d1 execute milad-bot-db --command="SELECT * FROM infirmaries"
```

## Configuration

### Cron Schedule

The bot checks for appointments every 2 minutes (configured in `wrangler.toml`):

```toml
triggers = { crons = ["*/2 * * * *"] }
```

You can change this to any valid cron expression:
- Every minute: `* * * * *`
- Every 5 minutes: `*/5 * * * *`
- Every hour: `0 * * * *`

### Environment Variables

Edit `wrangler.toml` to change default settings:

```toml
[vars]
DEFAULT_INTERVAL_MIN = "2"  # Check interval in minutes
JITTER_SEC = "20"           # Random delay to avoid patterns
```

## Monitoring

View logs:
```bash
npx wrangler tail
```

Check deployment status:
```bash
npx wrangler deployment status
```

## Troubleshooting

### Bot not responding
1. Check webhook URL is set correctly
2. Verify BOT_TOKEN secret is set
3. Check Workers logs with `npx wrangler tail`

### Database errors
1. Verify database ID in wrangler.toml
2. Run migrations: `npx wrangler d1 migrations apply milad-bot-db`
3. Check database exists: `npx wrangler d1 list`

### Cron not running
1. Verify cron expression in wrangler.toml
2. Check Workers dashboard for cron triggers
3. Review logs for scheduled events

## Free Tier Limits

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 1,000 scheduled triggers per day
- 1 GB D1 storage
- 5 million D1 rows read per day
- 100,000 D1 rows written per day

For a personal bot, these limits are usually sufficient.

## Architecture

```
Cloudflare Workers
├── HTTP Handler (/webhook) - Receives Telegram updates
├── Cron Trigger (every 2 min) - Checks for appointments
└── D1 Database - Stores users, watches, and settings
```

## Security Notes

- Never commit `wrangler.toml` with secrets
- Always use `wrangler secret put` for sensitive data
- The BOT_TOKEN and ADMIN_IDS are encrypted by Cloudflare
