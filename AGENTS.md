# AGENTS.md - Milad Appointment Bot

This document provides guidelines for agentic coding agents working in this repository.

## Build/Lint/Test Commands

```bash
# Development - run with hot reload
npm run dev

# Build TypeScript to JavaScript (outputs to dist/)
npm run build

# Production - run compiled code
npm start

# Type check only (no emit)
npx tsc --noEmit
```

**Note:** There is no test suite configured. Run `npm run build` to verify code correctness.

## Project Architecture

This is a Telegram bot for hospital appointment notifications using:
- **Runtime:** Node.js with TypeScript (ESM modules)
- **Bot Framework:** grammy
- **Database:** Dual support - PostgreSQL (production) / SQLite (development)
- **Deployment:** Render.com with health check endpoint

### Directory Structure
```
src/
├── bot/           # Telegram bot handlers and keyboards
├── core/          # Scheduler, watcher, cache, queue
├── data/          # Static seed data (infirmaries)
├── services/      # External API clients (hospital)
└── storage/       # Database repositories
```

## Code Style Guidelines

### Imports
- **ALWAYS use `.js` extension** in import paths for ESM compatibility:
  ```typescript
  // Correct
  import { CONFIG } from './config.js'
  import { db } from './storage/db.js'
  
  // Wrong - will fail at runtime
  import { CONFIG } from './config'
  import { db } from './storage/db'
  ```
- Group imports: Node built-ins → external packages → internal modules
- Use named exports preferentially

### TypeScript Configuration
- **Strict mode is enabled** - all code must be type-safe
- Target: ES2022, Module: NodeNext
- `noUncheckedIndexedAccess: true` - always check for undefined when accessing arrays/objects
- `exactOptionalPropertyTypes: true` - be explicit about optional properties

### Async/Await Patterns
- **All database operations are async** - the `db` abstraction returns Promises for both PostgreSQL and SQLite compatibility
- Always use `await` when calling database functions:
  ```typescript
  const user = await getUserNationalCode(uid)
  const watches = await listActiveWatchesByUser(uid)
  ```
- Repository functions must be declared `async` and return `Promise<T>`

### Database Queries
- Use PostgreSQL-style placeholders (`$1, $2, $3`) - they are automatically converted to SQLite `?` format
- Example:
  ```typescript
  await db.run('INSERT INTO users (telegram_id, national_code) VALUES ($1, $2)', [uid, code])
  const row = await db.get('SELECT * FROM users WHERE telegram_id = $1', [uid])
  const rows = await db.all('SELECT * FROM watches WHERE active = $1', [1])
  ```

### Error Handling
- Wrap external API calls in try/catch blocks
- Log errors with descriptive prefixes using emoji for visibility:
  ```typescript
  console.error('❌ Failed to validate patient:', error)
  console.log('✅ Bot started successfully')
  ```
- Use early returns for error conditions instead of nested if-else

### Naming Conventions
- **Files:** kebab-case (e.g., `hospital.client.ts`, `watch.repo.ts`)
- **Functions:** camelCase (e.g., `getUserNationalCode`, `processWatchGroup`)
- **Types/Interfaces:** PascalCase (e.g., `TimingResult`, `WatchGroup`)
- **Constants:** UPPER_SNAKE_CASE for config, camelCase for runtime
- **Repository pattern:** Files named `*.repo.ts` contain database operations

### Function Export Pattern
```typescript
// Use named exports
export async function getUserNationalCode(uid: number): Promise<string | null> {
  return await db.get('SELECT national_code FROM users WHERE telegram_id = $1', [uid])
}

// Type exports
export type WatchGroup = {
  infirmaryId: number
  userIds: number[]
}
```

### Configuration
- Environment variables accessed via `process.env`
- Use fallback values: `process.env.VAR ?? 'default'`
- Centralized config in `src/config.ts` with `as const` for immutability

### Telegram Bot Handlers
- Use grammy's callback query patterns with regex matching:
  ```typescript
  bot.callbackQuery(/^inf:(\d+)$/, async (ctx) => {
    const infirmaryId = Number(ctx.match[1])
    // ...
  })
  ```
- Always answer callback queries to prevent loading state
- Use inline keyboards for navigation

### Code Formatting
- No comments in code unless explicitly requested
- Use template literals for multi-line strings
- Numeric separators for readability: `90_000` instead of `90000`

## Environment Variables

Required for production:
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `DATABASE_URL` - PostgreSQL connection string (auto-set on Render)
- `ADMIN_IDS` - Comma-separated Telegram user IDs

Optional:
- `SYSTEM_NATIONAL_CODE` - Default patient code
- `USE_LOCAL_PROXY` - Enable/disable proxy ('true'/'false')
- `USE_API_WORKER` - Use Telegram API worker

## Deployment Notes

- Health check endpoint at `/health` on port `process.env.PORT || 3000`
- Database tables auto-created on startup
- PostgreSQL uses `$1` placeholders, SQLite uses `?` - abstraction handles conversion
