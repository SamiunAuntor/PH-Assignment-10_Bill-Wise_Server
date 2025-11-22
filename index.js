require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection using Stable API
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Connect to MongoDB
async function connectDB() {
    try {
        await client.connect();
        console.log("✅ MongoDB connected successfully!");

        // Ping to confirm connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment successfully!");


        // public bills api - latest 6 bills
        app.get("/public-bills", async (req, res) => {
            try {
                const billsCollection = client.db("BillWise").collection("publicBills");

                // Fetch latest 6 bills sorted by date descending
                const bills = await billsCollection
                    .find({})
                    .sort({ date: -1 }) // -1 for descending
                    .limit(6)
                    .toArray();

                res.status(200).json(bills);
            }
            catch (err) {
                console.error("Error fetching public bills:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        // all ppublic bills api - all public bills
        app.get("/all-public-bills", async (req, res) => {
            try {
                const billsCollection = client.db("BillWise").collection("publicBills");

                const bills = await billsCollection
                    .find({})
                    .sort({ date: -1 })   
                    .toArray();

                res.status(200).json(bills);
            }
            catch (err) {
                console.error("Error fetching all public bills:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });


    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
}

// Immediately connect
connectDB();

// Default route
app.get("/", (req, res) => {
    res.send("Bill Wise server is running...");
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
