
# Bill Wise - Server

Client (frontend) repository: https://github.com/SamiunAuntor/PH-Assignment-10_Bill-Wise_Client

A clean, secure Node.js + Express REST API for the Utility Bill Management System (server-side of the Bill Wise project).

**Project**: Utility Bill Management System

**Purpose**: This repository implements the server APIs for managing public bills and user-paid bills (CRUD + authentication via Firebase). It stores data in MongoDB and uses Firebase Admin SDK for token validation.

**Features**
- **REST API**: Endpoints for public bills, bill details, and user-specific paid bills.
- **Authentication**: Firebase token verification middleware for protected routes (`/my-bills`, update/delete endpoints).
- **MongoDB storage**: Uses a `bills` (publicBills) and `myBills` collections in the `BillWise` database.
- **Input validation**: Basic server-side validation for required fields and phone format.
- **CORS + JSON body parsing**: Ready for single-page frontends.

**Tech stack**
- Node.js
- Express
- MongoDB (official driver)
- Firebase Admin SDK

**Repository structure (important files)**
- `index.js` - main server entry and API route definitions
- `package.json` - Node dependencies and scripts
- `billwise-server-firebase-adminsdk.json` - Firebase service account (sensitive, do not commit to public repos)

**Quick start (local)**
1. Clone the repository and change into the folder:
   `cd Bill-Wise-Server`
2. Install dependencies:
   `npm install`
3. Create a `.env` file in the project root with the following variables:
   - `MONGO_URI` — your MongoDB connection string (Atlas or local)
   - `PORT` — optional, defaults to `5000`
4. Add the Firebase service account JSON file as `billwise-server-firebase-adminsdk.json` in the project root. (This file is required for token verification.)
5. Run the server:
   `node index.js`

The server will print:
`✅ MongoDB connected successfully!`
`Pinged your deployment successfully!`
`Server running at http://localhost:5000` (if using default port)

**Environment variables**
- `MONGO_URI` (required) — MongoDB connection string.
- `PORT` (optional) — server port.

**Firebase setup notes**
- Create a Firebase project and service account, download the JSON credential file and save it as `billwise-server-firebase-adminsdk.json` in the project root.
- Ensure that the client app's domain is added to Firebase Auth authorized domains when deploying to Netlify/Surge.
- The server expects clients to send Firebase ID tokens in the `Authorization` header as `Bearer <idToken>` for protected routes.

**API Endpoints**
All endpoints return JSON. Replace `:id` placeholders with MongoDB `_id` strings.

- `GET /public-bills` — latest 6 public bills (sorted by date desc)
- `GET /all-public-bills` — all public bills
- `GET /public-bill/:id` — public bill details by ID
- `GET /my-bills` — protected: returns paid bills for the authenticated user's email. Requires `Authorization: Bearer <idToken>` header.
- `POST /add-my-bill` — insert a paid bill record (public route in this server). Body JSON example:
  ```json
  {
    "billId": "abc123",
    "username": "Jane Doe",
    "email": "jane@example.com",
    "amount": 360,
    "address": "Dhaka",
    "phone": "017XXXXXXXX",
    "date": "2025-11-24"
  }
  ```

  Server accepts `billId` or `billsId` (mapped internally). Returns `201` with `insertedId` on success.

- `PUT /update-my-bill/:id` — protected: update a paid bill (amount, address, phone, date). Requires `Authorization` header.
- `DELETE /delete-my-bill/:id` — protected: delete a paid bill. Requires `Authorization` header.

**Sample curl requests**
- Add a bill (public route):
  `curl -X POST http://localhost:5000/add-my-bill -H "Content-Type: application/json" -d "{\"billId\":\"abc123\",\"username\":\"Alice\",\"email\":\"alice@example.com\",\"amount\":100}"`

- Get user bills (protected):
  `curl -H "Authorization: Bearer <idToken>" http://localhost:5000/my-bills`

**Common troubleshooting**
- MongoDB connection errors: confirm `MONGO_URI` value, network access (Atlas IP whitelist), and that the URI includes credentials if required.
- Firebase token verification failures: ensure client sends a valid Firebase ID token in the `Authorization` header. Check `billwise-server-firebase-adminsdk.json` credentials.
- Routes 404: the server registers routes after a successful MongoDB connect. Wait for the `MongoDB connected` logs before testing routes.

**Security notes**
- Do not commit `billwise-server-firebase-adminsdk.json` or other secret files to public repositories. Use environment or secret managers in production.
- If deploying, configure environment variables securely in your host (Vercel, Heroku, etc.).

**Deployment**
- Recommended hosting for server APIs: Vercel (Serverless Functions) or Heroku. Add `MONGO_URI` and Firebase credentials (or use a secure secret) in the host's settings.

**Contributing & Commits**
- Follow conventional commits for clear history. Keep server-side commit messages focused and descriptive.

**License**
- MIT

**Author**
- Add your name, email and repository links here.

---
Update this README with the live server URL and any production deployment details once available.
