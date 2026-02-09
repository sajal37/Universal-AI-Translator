# Universal AI Translator

Universal AI Translator is a full-stack translation app with authentication, real-time queue processing, OCR support, caching, and translation history.

## Features

- User signup/signin with JWT authentication
- Real-time translation workflow using WebSocket + Bull queue
- Text translation with source auto-detect support
- OCR from images and files (image/PDF extraction + translation)
- Redis caching for faster repeated translations
- Translation history, favorites, and saved phrase management
- Clean responsive UI with dark/light themes
- Rate limiting and CORS support for API hardening

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express, Socket.IO
- Queue: Bull + Redis
- Databases:
  - PostgreSQL + Prisma (`User` auth model)
  - PostgreSQL + Sequelize (translation/history models)
- OCR and media: Tesseract.js, Sharp, pdf-parse
- Translation: `google-translate-api-x`
- Testing: Jest + Supertest

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- PostgreSQL running locally or remotely
- Redis running locally or remotely

## Quick Start

```bash
git clone https://github.com/sajal37/Universal-AI-Translator.git
cd Universal-AI-Translator
npm install
```

Create `.env` in the project root:

```env
# App
PORT=3000
JWT_SECRET=replace_with_a_long_random_secret
CORS_ORIGIN=http://localhost:3000

# Prisma (used by auth/User model)
DATABASE_URL=postgresql://postgres:password@localhost:5432/universal_translator

# Sequelize (used by translation/history models)
DB_NAME=universal_translator
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=
```

Generate Prisma client and sync Prisma schema:

```bash
npx prisma generate
npx prisma db push
```

If your database already exists, ensure the Prisma `User` model (string CUID id + `updatedAt`) matches the DB schema before running the app.

Start the server:

```bash
npm start
```

App URL: `http://localhost:3000`  
Health check: `http://localhost:3000/health`

## Available Scripts

- `npm start` - Run server
- `npm run dev` - Run server with nodemon
- `npm test` - Run all tests with coverage
- `npm run test:watch` - Run Jest in watch mode
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:functional` - Run functional tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:all` - Verbose full test run

## API Overview

### Auth
- `POST /signup`
- `POST /sign-in`

### Translation
- `POST /translate`
- `GET /queue/stats`
- `GET /translation/cache`

### OCR
- `POST /ocr/extract` (base64 image payload)
- `POST /ocr/translate` (base64 image payload)
- `POST /ocr/file/extract` (multipart file)
- `POST /ocr/file/translate` (multipart file + language)

### History
- `GET /history`
- `GET /history/favorites`
- `PATCH /history/:id/favorite`
- `DELETE /history/:id`
- plus saved phrase and stats routes under `/history/*`

## Project Structure

```text
controller/      Request handlers
middleware/      Validation and auth middleware
routes/          Express route definitions
services/        Cache/history/pubsub services
queue/           Bull queue configuration and workers
websocket/       Socket.IO handlers
models/          Sequelize models
config/          DB/Redis/upload/common config
public/          Frontend files
prisma/          Prisma schema
__tests__/       Unit/integration/functional/e2e tests
```

## Troubleshooting

- If dropdown options appear blank, hard refresh the page (`Ctrl+F5`) to clear cached CSS.
- If `/health` is degraded, verify PostgreSQL and Redis are reachable with your `.env` values.
- If Prisma fails, re-run `npx prisma generate` and `npx prisma db push`.
- If `/signup` or `/sign-in` is rate limited, wait a few minutes and try again.

## Documentation

- `TESTING.md`
- `FUNCTIONAL_TESTING.md`
- `TEST_BEST_PRACTICES.md`
- `TEST_COVERAGE.md`

## License

MIT
