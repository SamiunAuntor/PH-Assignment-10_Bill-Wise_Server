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

// Public bills (latest 8)
app.get("/public-bills", async (req, res) => {
    try {
        const bills = await billsCollection.find({}).sort({ date: -1 }).limit(8).toArray();
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
        res.status(201).json({ message: "Bill paid successfully", insertedId: result.insertedId });
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

// Define users collection
const usersCollection = client.db("BillWise").collection("users");

// 1. GET : Check User Status
app.get('/users/check-status', async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).send({ error: "Email is required" });

    try {
        const user = await usersCollection.findOne({ email: email });
        // If user doesn't exist, they are "active" by default (new user)
        if (!user) return res.send({ status: "active" });
        res.send({ status: user.status });
    } catch (error) {
        res.status(500).send({ error: "Server error" });
    }
});

// 2. POST : Sync/Update
app.post('/users', async (req, res) => {
    const user = req.body;
    const query = { email: user.email };
    const existingUser = await usersCollection.findOne(query);

    if (existingUser) {
        // Just return the user; don't overwrite status
        return res.send(existingUser);
    }

    // Insert new user
    const result = await usersCollection.insertOne(user);
    res.send({ ...user, _id: result.insertedId });
});

// PATCH : Update user profile
app.patch('/users/update', verifyFirebaseToken, async (req, res) => {
    try {
        const email = req.user.email;
        const { name, photo } = req.body;

        if (!name || !photo) {
            return res.status(400).json({ error: "Name and photo are required" });
        }

        await usersCollection.updateOne(
            { email },
            {
                $set: {
                    name,
                    photo,
                    lastUpdatedAt: new Date()
                }
            }
        );

        res.status(200).json({
            success: true,
            message: "Profile updated successfully"
        });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// GET : Get specific user data
app.get('/user-profile', verifyFirebaseToken, async (req, res) => {
    const email = req.user.email;
    const user = await usersCollection.findOne({ email });
    res.send(user);
});





// All Dashboard Routes Below

// Middleware to check if user is admin
const verifyAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split(" ")[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;

        // Check if user is admin
        const user = await usersCollection.findOne({ email: decodedToken.email });
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        next();
    } catch (err) {
        console.error("Admin verification error:", err);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};

// Admin Dashboard Stats
app.get("/admin/stats", verifyAdmin, async (req, res) => {
    try {
        const totalUsers = await usersCollection.countDocuments({});
        const activeUsers = await usersCollection.countDocuments({ status: "active" });
        const totalBills = await myBillsCollection.countDocuments({});

        const bills = await myBillsCollection.find({}).toArray();
        const totalAmount = bills.reduce((sum, bill) => sum + (bill.amount || 0), 0);

        res.status(200).json({
            totalUsers,
            activeUsers,
            totalBills,
            totalAmount
        });
    } catch (err) {
        console.error("Stats error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Public Stats for Homepage (No verifyAdmin needed)
app.get("/public-stats", async (req, res) => {
    try {
        const totalUsers = await usersCollection.countDocuments({});
        const activeUsers = await usersCollection.countDocuments({ status: "active" });
        const totalBills = await myBillsCollection.countDocuments({});

        // Using aggregation to calculate sum efficiently
        const amountData = await myBillsCollection.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]).toArray();

        const totalAmount = amountData.length > 0 ? amountData[0].total : 0;

        res.status(200).json({
            totalUsers,
            activeUsers,
            totalBills,
            totalAmount
        });
    } catch (err) {
        console.error("Public stats error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Admin Recent Bills (Last 5)
app.get("/admin/recent-bills", verifyAdmin, async (req, res) => {
    try {
        const bills = await myBillsCollection
            .find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();
        res.status(200).json(bills);
    } catch (err) {
        console.error("Recent bills error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Admin Get All Users
app.get("/admin/all-users", verifyAdmin, async (req, res) => {
    try {
        const users = await usersCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.status(200).json(users);
    } catch (err) {
        console.error("Get all users error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Admin Update User Status
app.patch("/admin/update-user-status/:id", verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !["active", "blocked"].includes(status)) {
            return res.status(400).json({ error: "Invalid status. Must be 'active' or 'blocked'" });
        }

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status, lastUpdatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ message: "User status updated successfully" });
    } catch (err) {
        console.error("Update user status error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Admin Get All Bills
app.get("/admin/all-bills", verifyAdmin, async (req, res) => {
    try {
        const bills = await myBillsCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.status(200).json(bills);
    } catch (err) {
        console.error("Get all bills error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Admin Update Bill
app.put("/admin/update-bill/:id", verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, address, phone, createdAt } = req.body;

        if (phone && !/^\d{11}$/.test(phone)) {
            return res.status(400).json({ error: "Phone must be 11 digits" });
        }

        const bill = await myBillsCollection.findOne({ _id: new ObjectId(id) });
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        const updateDoc = {
            $set: {
                amount,
                address,
                phone,
                createdAt: createdAt ? new Date(createdAt) : bill.createdAt
            }
        };
        await myBillsCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);

        res.json({ message: "Bill updated successfully" });
    } catch (err) {
        console.error("Update bill error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Admin Delete Bill
app.delete("/admin/delete-bill/:id", verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const bill = await myBillsCollection.findOne({ _id: new ObjectId(id) });
        if (!bill) return res.status(404).json({ error: "Bill not found" });

        await myBillsCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ message: "Bill deleted successfully" });
    } catch (err) {
        console.error("Delete bill error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Admin Add Public Bill
app.post("/admin/add-public-bill", verifyAdmin, async (req, res) => {
    try {
        const { title, category, email, location, description, image, date, amount } = req.body;

        if (!title || !category || !amount || !date) {
            return res.status(400).json({ error: "Missing required fields: title, category, amount, date" });
        }

        const newBill = {
            title,
            category,
            email: email || "",
            location: location || "",
            description: description || "",
            image: image || "",
            date,
            amount: Number(amount)
        };

        const result = await billsCollection.insertOne(newBill);
        res.status(201).json({ message: "Public bill added successfully", insertedId: result.insertedId });
    } catch (err) {
        console.error("Add public bill error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


// Admin Add Public Bill
app.post("/admin/add-public-bill", verifyAdmin, async (req, res) => {
    try {
        const { title, category, email, location, description, image, date, amount } = req.body;

        if (!title || !category || !amount || !date) {
            return res.status(400).json({ error: "Missing required fields: title, category, amount, date" });
        }

        const newBill = {
            title,
            category,
            email: email || "",
            location: location || "",
            description: description || "",
            image: image || "",
            date,
            amount: Number(amount)
        };

        const result = await billsCollection.insertOne(newBill);
        res.status(201).json({ message: "Public bill added successfully", insertedId: result.insertedId });
    } catch (err) {
        console.error("Add public bill error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});






module.exports = app;


