import "dotenv/config";
import { MongoClient } from "mongodb";

(async () => {
    const client = new MongoClient(process.env.MONGO_URI!);
    await client.connect();

    const rows = await client
        .db("job_agent")
        .collection("applications")
        .find({})
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray();

    console.table(
        rows.map((r) => ({
            status: r.status,
            score: r.score,
            role: String(r.role).slice(0, 30),
            email: r.email,
            date: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 16) : "",
        }))
    );

    await client.close();
    process.exit(0);
})();