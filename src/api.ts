import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { existsSync, readFileSync } from "fs";

const PORT = Number(process.env.API_PORT || 4000);
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    console.error("Set API_KEY in .env");
    process.exit(1);
}

const client = new MongoClient(process.env.MONGO_URI!);
const app = express();
app.use(cors());

app.use((req, res, next) => {
    if (req.header("x-api-key") !== API_KEY) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    next();
});

const col = () => client.db("job_agent").collection("applications");

app.get("/api/applications", async (req, res) => {
    try {
        const status = String(req.query.status || "");
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const rows = await col()
            .find(status ? { status } : {})
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
        res.json(rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/stats", async (_req, res) => {
    try {
        const groups = await col()
            .aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])
            .toArray();
        const counts: Record<string, number> = {};
        let total = 0;
        for (const g of groups) {
            counts[String(g._id)] = g.n;
            total += g.n;
        }
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const sentToday = await col().countDocuments({
            status: "sent",
            createdAt: { $gte: start },
        });
        res.json({ counts, total, sentToday });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/log", (_req, res) => {
    const file = "agent-log.txt";
    if (!existsSync(file)) {
        res.json({ log: "No log yet." });
        return;
    }
    res.json({ log: readFileSync(file, "utf8").slice(-8000) });
});

client
    .connect()
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => console.log(`Job Agent API on port ${PORT}`));
    })
    .catch((e) => {
        console.error("Mongo connect failed:", e.message);
        process.exit(1);
    });