require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Firebase Admin SDK
const admin = require("firebase-admin");
const serviceAccount = require("./billwise-server-firebase-adminsdk.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Middleware to verify Firebase token
const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

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

async function connectDB() {
    try {
        await client.connect();
        console.log("✅ MongoDB connected successfully!");
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment successfully!");

        const billsCollection = client.db("BillWise").collection("publicBills");
        const myBillsCollection = client.db("BillWise").collection("myBills");

        // public bills API - latest 6 bills
        app.get("/public-bills", async (req, res) => {
            try {
                const bills = await billsCollection
                    .find({})
                    .sort({ date: -1 })
                    .limit(6)
                    .toArray();
                res.status(200).json(bills);
            } catch (err) {
                console.error("Error fetching public bills:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // all public bills API
        app.get("/all-public-bills", async (req, res) => {
            try {
                const bills = await billsCollection
                    .find({})
                    .sort({ date: -1 })
                    .toArray();
                res.status(200).json(bills);
            } catch (err) {
                console.error("Error fetching all public bills:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // get single public bill by ID
        app.get("/public-bill/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const bill = await billsCollection.findOne({ _id: new ObjectId(id) });

                if (!bill) {
                    return res.status(404).json({ error: "Bill not found" });
                }

                res.status(200).json(bill);
            } catch (err) {
                console.error("Error fetching bill by ID:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // get all bills paid by user - secured with Firebase token
        app.get("/my-bills", verifyFirebaseToken, async (req, res) => {
            try {
                const email = req.user.email;
                if (!email) return res.status(400).json([]);
                const bills = await myBillsCollection.find({ email }).toArray();
                res.status(200).json(bills);
            } catch (err) {
                console.error("Error fetching user bills:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // insert a bill to myBills
        app.post("/add-my-bill", async (req, res) => {
            try {
                const newBill = req.body;

                // validate required fields
                if (!newBill.billId || !newBill.username || !newBill.email || !newBill.amount) {
                    return res.status(400).json({ error: "Missing required fields" });
                }

                // optional phone validation
                if (newBill.phone && !/^\d{11}$/.test(newBill.phone)) {
                    return res.status(400).json({ error: "Phone must be 11 digits" });
                }

                newBill.createdAt = new Date();

                const result = await myBillsCollection.insertOne(newBill);

                res.status(201).json({
                    message: "Bill inserted successfully",
                    insertedId: result.insertedId
                });

            } catch (err) {
                console.error("Error inserting bill:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // update my bill
        app.put("/update-my-bill/:id", verifyFirebaseToken, async (req, res) => {
            try {
                const { id } = req.params;
                const email = req.user.email;
                const { amount, address, phone, createdAt } = req.body;

                const bill = await myBillsCollection.findOne({
                    _id: new ObjectId(id),
                    email,
                });

                if (!bill) {
                    return res.status(404).json({ error: "Bill not found or unauthorized" });
                }

                const updateDoc = {
                    $set: {
                        amount,
                        address,
                        phone,
                        createdAt: createdAt ? new Date(createdAt) : bill.createdAt
                    }
                };

                await myBillsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    updateDoc
                );

                res.json({ message: "Bill updated successfully" });

            } catch (err) {
                console.error("Error updating bill:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });



        // delete my bill
        app.delete("/delete-my-bill/:id", verifyFirebaseToken, async (req, res) => {
            try {
                const { id } = req.params;
                const email = req.user.email;

                const bill = await myBillsCollection.findOne({
                    _id: new ObjectId(id),
                    email
                });

                if (!bill) {
                    return res.status(404).json({ error: "Bill not found or unauthorized" });
                }

                await myBillsCollection.deleteOne({ _id: new ObjectId(id) });

                res.json({ message: "Bill deleted successfully" });

            } catch (err) {
                console.error("Error deleting bill:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });


        return;
    }



    // db connection error
    catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
}

connectDB();

// test route
app.get("/", (req, res) => {
    res.send("Bill Wise server is running...");
});

// start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
