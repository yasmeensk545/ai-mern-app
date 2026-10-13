# Digital Health Record Kiosk

A community-health record kiosk application with secure authentication, protected patient data APIs, QR-based lookup, and server-side Gemini AI summarization.

## Overview

This project includes:

- React + Vite client for the kiosk dashboard and worker flows
- Express + Mongoose server for secure API endpoints
- JWT-based health-worker authentication
- Role-based access control for patient data
- QR-scanning patient lookup flow
- Server-side Gemini AI summary generation using the official `@google/genai` SDK
- Protected admin provisioning workflow for worker accounts

## Tech stack

Client:
- React 19
- Vite 8
- HTML5 QR scanner
- QR code generation

Server:
- Node.js / Express 5
- MongoDB / Mongoose
- JWT
- Helmet
- express-rate-limit
- `@google/genai`

## Project structure

- `client/` — frontend app
- `server/` — backend API and configuration

## Local setup

1. Install dependencies in both apps.

   ```bash
   cd client
   npm install

   cd ../server
   npm install
   ```

2. Configure environment variables in `server/.env`.

   Required values:

   ```env
   PORT=5000
   CLIENT_URL=http://localhost:5173
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_strong_random_secret
   ADMIN_REGISTRATION_SECRET=your_admin_secret
   ALLOW_PUBLIC_REGISTRATION=false
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   ```

3. Start the server.

   ```bash
   cd server
   node server.js
   ```

4. Start the frontend.

   ```bash
   cd client
   npm run dev
   ```

5. Open the frontend in the browser at `http://localhost:5173`.

### Health-worker accounts

The worker utilities run from `server/`, load `server/.env`, and use the same `MONGODB_URI`, `HealthWorker` model, and `healthworkers` collection as the API. Run them in an interactive PowerShell terminal so passwords can be entered without echo:

```powershell
Set-Location .\server
npm run worker:create
npm run worker:check
npm run worker:reset
```

`worker:create` refuses duplicate email addresses. `worker:check` reports account existence, role, and whether the password field has a valid bcrypt hash format without displaying the email or hash. `worker:reset` changes only an existing `health_worker` account and asks for the email and new password interactively. Passwords are never printed. Use a password of at least 12 characters and no more than 72 UTF-8 bytes.

The client defaults to `http://localhost:5000` for its API. For another backend URL, set `VITE_API_URL` in `client/.env.local` (for example, `VITE_API_URL=https://api.example.org`) and rebuild the client.

## Security notes

- Do not expose API keys or JWT secrets in browser-side code.
- Public health-worker registration is disabled by default.
- Worker provisioning requires the admin secret header when `ALLOW_PUBLIC_REGISTRATION=false`.
- Patient data endpoints require valid Bearer tokens and authorized health-worker/admin roles.
- QR data is only used as a Health ID reference; patient medical records are retrieved only through the protected API.
- Gemini AI requests use fictional sample data only and are server-side only.

## API summary

Authentication:
- `POST /api/auth/register`
- `POST /api/auth/login`

Patients:
- `POST /api/patients`
- `GET /api/patients?page=1&limit=20&search=...` (JWT-protected; health-worker/admin role required)
- `GET /api/patients/:healthId`
- `GET /api/patients/:healthId/history`
- `POST /api/patients/:healthId/history`

AI summary:
- `POST /api/ai/patient-summary`

## Deployment checklist

Use this checklist before deploying to a real environment:

- [ ] Replace all placeholder secrets in `server/.env`
- [ ] Set a real `MONGODB_URI` for production MongoDB
- [ ] Set a strong production `JWT_SECRET`
- [ ] Set a secure `ADMIN_REGISTRATION_SECRET`
- [ ] Keep `ALLOW_PUBLIC_REGISTRATION=false` unless public registration is intentionally enabled
- [ ] Set a valid server-side `GEMINI_API_KEY`
- [ ] Confirm `GEMINI_MODEL` is supported by the selected Google API account
- [ ] Configure CORS origins to include only approved frontends
- [ ] Enable HTTPS in production
- [ ] Restrict database access to the deployed backend service only
- [ ] Store secrets in a secure secret manager, not in repo files
- [ ] Configure monitoring, logs, and alerting for auth and AI failures
- [ ] Test unauthorized access to patient and AI endpoints before release
- [ ] Run the production client build and validate the deployed backend startup

## Validation

Run the client checks from `client/`:

```powershell
npm run lint
npm run build
```

Run backend syntax checks from the repository root:

```powershell
Get-ChildItem .\server -Recurse -File -Filter *.js |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
  ForEach-Object { node --check $_.FullName }
```

Live authentication and patient-list results depend on the configured MongoDB database and an existing worker account. Do not infer a successful account login or patient retrieval from a successful build or database connection alone.
# mern-project
