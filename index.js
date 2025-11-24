require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let billsCollection, myBillsCollection;
let dbReady = false;

// Connect to MongoDB
async function connectDB() {
    try {
        await client.connect();
        billsCollection = client.db("BillWise").collection("publicBills");
        myBillsCollection = client.db("BillWise").collection("myBills");
        dbReady = true;
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
}
connectDB();

// Middleware to ensure DB is ready
app.use(async (req, res, next) => {
    let retries = 0;
    while (!dbReady && retries < 50) {
        await new Promise(r => setTimeout(r, 100)); // wait 100ms
        retries++;
    }
    if (!dbReady) return res.status(503).json({ error: "Database not ready" });
    next();
});

// Firebase token verification
const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

    const idToken = authHeader.split(" ")[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (err) {
        console.error("Firebase token verification error:", err);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};

// Test route
app.get("/", (req, res) => res.send("Bill Wise server is running..."));

// Public bills (latest 6)
app.get("/public-bills", async (req, res) => {
    try {
        const bills = await billsCollection.find({}).sort({ date: -1 }).limit(6).toArray();
        res.status(200).json(bills);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// All public bills
app.get("/all-public-bills", async (req, res) => {
    try {
        const bills = await billsCollection.find({}).sort({ date: -1 }).toArray();
        res.status(200).json(bills);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Single public bill by ID
app.get("/public-bill/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const bill = await billsCollection.findOne({ _id: new ObjectId(id) });
        if (!bill) return res.status(404).json({ error: "Bill not found" });
        res.status(200).json(bill);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// My bills (secured)
app.get("/my-bills", verifyFirebaseToken, async (req, res) => {
    try {
        const email = req.user.email;
        const bills = await myBillsCollection.find({ email }).toArray();
        res.status(200).json(bills);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Add a bill
app.post("/add-my-bill", async (req, res) => {
    try {
        const newBill = req.body;
        if (!newBill.billId || !newBill.username || !newBill.email || !newBill.amount)
            return res.status(400).json({ error: "Missing required fields" });
        if (newBill.phone && !/^\d{11}$/.test(newBill.phone))
            return res.status(400).json({ error: "Phone must be 11 digits" });

        newBill.createdAt = new Date();
        const result = await myBillsCollection.insertOne(newBill);
        res.status(201).json({ message: "Bill inserted successfully", insertedId: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update a bill
app.put("/update-my-bill/:id", verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;
        const email = req.user.email;
        const { amount, address, phone, createdAt } = req.body;

        const bill = await myBillsCollection.findOne({ _id: new ObjectId(id), email });
        if (!bill) return res.status(404).json({ error: "Bill not found or unauthorized" });

        const updateDoc = { $set: { amount, address, phone, createdAt: createdAt ? new Date(createdAt) : bill.createdAt } };
        await myBillsCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);

        res.json({ message: "Bill updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Delete a bill
app.delete("/delete-my-bill/:id", verifyFirebaseToken, async (req, res) => {
    try {
        const { id } = req.params;
        const email = req.user.email;

        const bill = await myBillsCollection.findOne({ _id: new ObjectId(id), email });
        if (!bill) return res.status(404).json({ error: "Bill not found or unauthorized" });

        await myBillsCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ message: "Bill deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = app;
