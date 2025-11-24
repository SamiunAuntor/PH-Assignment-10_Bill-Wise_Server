
# Bill Wise — Server API

Production-ready Node.js + Express API for the Utility Bill Management System. Secured with Firebase and backed by MongoDB. Designed for serverless deployment on Vercel.

Client (frontend): https://github.com/SamiunAuntor/PH-Assignment-10_Bill-Wise_Client

**Overview**
- Manages public utility bills and user-specific bills.
- Protects user data with Firebase ID token verification.
- Uses MongoDB (`BillWise` database) with `publicBills` and `myBills` collections.
- Optimized for Vercel serverless functions via `vercel.json` routing.

**Live URLs**
- API base URL: Provide your deployed Vercel URL (e.g., `https://<your-project>.vercel.app`).
- Health check: `GET /` returns `"Bill Wise server is running..."`.

**Tech Stack**
- Node.js, Express, MongoDB (official driver), Firebase Admin SDK

**Project Structure**
- `index.js` — Express app and route definitions (exported for serverless runtime)
- `vercel.json` — Vercel build and routing config
- `encode.js` — helper to encode Firebase service account JSON to base64
- `Assets/` — static images used by the project
- `.gitignore` — excludes secrets and build artifacts

**Environment & Secrets**
Create `.env` in the project root with:
- `MONGO_URI` (required) — MongoDB connection string
- `FIREBASE_KEY` (required) — base64-encoded Firebase service account JSON

How to set `FIREBASE_KEY`:
1. Save your Firebase service account file as `billwise-server-firebase-adminsdk.json` in the project root.
2. Run `node encode.js` — copy the printed base64 string.
3. Put that string in `.env` as `FIREBASE_KEY=<printed-base64>`.

Note: `PORT` is not used because the app is exported for serverless. Use Vercel CLI for local development.

**Local Development**
- Install dependencies: `npm install`
- Install Vercel CLI: `npm i -g vercel`
- Run locally with serverless runtime: `vercel dev`
  - Ensures environment variables are loaded from `.env` and routes match production.

**API Reference**
All endpoints return JSON. Replace `:id` with a MongoDB `_id` string.

- `GET /public-bills`
  - Returns latest 6 public bills (sorted by `date` desc).

- `GET /all-public-bills`
  - Returns all public bills (sorted by `date` desc).

- `GET /public-bill/:id`
  - Returns a single public bill by `_id`.

- `GET /my-bills` — Auth required
  - Header: `Authorization: Bearer <Firebase ID token>`
  - Returns bills for the authenticated user's `email`.

- `POST /add-my-bill` — Public
  - Body fields (required): `billId`, `username`, `email`, `amount`
  - Optional: `address`, `phone` (11 digits), `createdAt` (server sets current date if absent)
  - Response: `201 { message, insertedId }`

- `PUT /update-my-bill/:id` — Auth required
  - Header: `Authorization: Bearer <Firebase ID token>`
  - Body: any of `amount`, `address`, `phone`, `createdAt` (date string)
  - Only updates documents that match the authenticated user's `email`.

- `DELETE /delete-my-bill/:id` — Auth required
  - Header: `Authorization: Bearer <Firebase ID token>`
  - Deletes only if the bill belongs to the authenticated user.

**Sample Requests**
- Add a bill:
  `curl -X POST https://<your-api>/add-my-bill -H "Content-Type: application/json" -d "{\"billId\":\"abc123\",\"username\":\"Alice\",\"email\":\"alice@example.com\",\"amount\":100}"`

- Get my bills (requires Firebase token):
  `curl -H "Authorization: Bearer <idToken>" https://<your-api>/my-bills`

**Deployment (Vercel)**
- `vercel.json` config routes all methods to `index.js` using `@vercel/node`.
- Set `MONGO_URI` and `FIREBASE_KEY` in Vercel Project Settings → Environment Variables.
- Use `vercel` to deploy and `vercel env pull` to sync envs locally if needed.

**Troubleshooting**
- MongoDB not ready: API returns `503 { error: "Database not ready" }` until the driver connects.
- Auth failures: ensure the client sends a valid Firebase ID token in `Authorization: Bearer <idToken>` and `FIREBASE_KEY` is correctly set.
- Phone validation: must be exactly 11 digits when provided.

**Security Notes**
- Do not commit service account files. `.gitignore` already excludes `billwise-server-firebase-adminsdk.json`.
- Use environment variables or secret managers in production.

**License**
- MIT

**Maintainers**
- Add your name and contact information here.

---
Update the "Live URLs" section after deployment.
