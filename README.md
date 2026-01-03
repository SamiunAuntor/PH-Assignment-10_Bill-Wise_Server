# Bill Wise — Server API

Production-ready Node.js + Express API for the **Bill Wise** Utility Management System. Secured with Firebase Authentication and backed by MongoDB. Designed for serverless deployment on Vercel.

**Client (Frontend):** [https://github.com/SamiunAuntor/PH-Assignment-10_Bill-Wise_Client](https://github.com/SamiunAuntor/PH-Assignment-10_Bill-Wise_Client)

## Overview
- **User Management**: Syncs Firebase users to MongoDB, manages user profiles, and handles roles (User/Admin).
- **Billing System**: Manages public utility bills and personal user bills (`myBills`).
- **Security**: Protects private routes with Firebase ID token verification.
- **Admin Dashboard**: Provides statistics, user management (block/unblock), and bill oversight.
- **Database**: Uses MongoDB (`BillWise` database) with `publicBills`, `myBills`, and `users` collections.
- **Serverless**: Optimized for Vercel via `vercel.json` routing.

## Live URLs
- **API Base URL**: `https://bill-wise-server-beta.vercel.app` (Replace with your actual deployed URL)
- **Health Check**: `GET /` returns `"Bill Wise server is running..."`.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Official Driver)
- **Auth**: Firebase Admin SDK
- **Deployment**: Vercel

## Project Structure
- `index.js` — Main application entry point, Express app, and route definitions.
- `vercel.json` — Vercel build and routing configuration.
- `encode.js` — Helper script to encode Firebase service account JSON to base64.
- `Assets/` — Static images used by the project.
- `.env` — Environment variables (not committed).

## Environment & Secrets
Create a `.env` file in the project root with the following variables:

```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
FIREBASE_KEY=<base64-encoded-firebase-service-account>
```

### How to generate `FIREBASE_KEY`:
1. Download your Firebase service account key JSON file.
2. Save it as `billwise-server-firebase-adminsdk.json` in the project root.
3. Run the helper script: `node encode.js`
4. Copy the output string and paste it as the value for `FIREBASE_KEY` in your `.env` file.

## Local Development
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Install Vercel CLI** (optional but recommended for local serverless emulation):
   ```bash
   npm i -g vercel
   ```
3. **Run Locally**:
   - Standard Node: `node index.js` (Note: Ensure `.env` is loaded)
   - Vercel Dev: `vercel dev` (Simulates serverless environment)

## API Reference

All endpoints return JSON. Replace `:id` with a MongoDB `_id` string.

### 🔓 Public Routes

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Health check. |
| `GET` | `/public-bills` | Returns latest 8 public bills (sorted by date desc). |
| `GET` | `/all-public-bills` | Returns all public bills. |
| `GET` | `/public-bill/:id` | Get a single public bill by ID. |
| `GET` | `/users/check-status?email=...` | Check if a user is `active` or `blocked`. |
| `POST` | `/users` | Sync/Create a user in MongoDB after Firebase login. |

### 🔐 User Routes (Protected)
**Headers required**: `Authorization: Bearer <Firebase ID Token>`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/user-profile` | Get logged-in user's profile data. |
| `PATCH` | `/users/update` | Update user profile (name, photo). |
| `GET` | `/my-bills` | Get bills for the authenticated user. |
| `POST` | `/add-my-bill` | Add a new personal bill. |
| `PUT` | `/update-my-bill/:id` | Update a personal bill. |
| `DELETE` | `/delete-my-bill/:id` | Delete a personal bill. |

**Request Body for `/add-my-bill`**:
```json
{
  "billId": "string",
  "username": "string",
  "email": "string",
  "amount": number,
  "address": "string (optional)",
  "phone": "11 digits (optional)",
  "createdAt": "Date string (optional)"
}
```

### 🛡️ Admin Dashboard Routes (Admin Only)
**Headers required**: `Authorization: Bearer <Firebase ID Token>` (User must have `role: 'admin'` in MongoDB)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/admin/stats` | Get total users, active users, total bills, and total revenue. |
| `GET` | `/admin/recent-bills` | Get the 5 most recent bills. |
| `GET` | `/admin/all-users` | Get a list of all users. |
| `PATCH` | `/admin/update-user-status/:id` | Update user status (`active` or `blocked`). |
| `GET` | `/admin/all-bills` | Get all user bills. |
| `PUT` | `/admin/update-bill/:id` | Admin update for any bill. |
| `DELETE` | `/admin/delete-bill/:id` | Admin delete for any bill. |
| `POST` | `/admin/add-public-bill` | Add a new public utility bill. |

## Troubleshooting
- **Database not ready**: API returns `503 { error: "Database not ready" }` if MongoDB hasn't connected yet.
- **Unauthorized**: Ensure the Firebase ID Token is valid and passed in the `Authorization` header.
- **Admin Access**: Ensure the user document in MongoDB has `role: "admin"`.

## License
MIT
