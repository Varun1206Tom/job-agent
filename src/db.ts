import "dotenv/config";
import { MongoClient, Collection, ObjectId } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
let col: Collection | null = null;

export type Status = "sent" | "dry_run" | "skipped" | "low_fit" | "queued" | "rejected";

async function getCol(): Promise<Collection> {
  if (!col) {
    await client.connect();
    col = client.db("job_agent").collection("applications");
  }
  return col;
}

const key = (email: string, role: string) =>
  `${email.toLowerCase().trim()}|${role.toLowerCase().trim()}`;

export async function alreadyApplied(email: string, role: string): Promise<boolean> {
  const c = await getCol();
  return !!(await c.findOne({ key: key(email, role), status: { $in: ["sent", "queued"] } }));
}

export async function logApplication(data: {
  company: string | null;
  role: string;
  email: string | null;
  link: string | null;
  score: number;
  status: Status;
  subject?: string;
  body?: string;
}) {
  const c = await getCol();
  const now = new Date();
  await c.insertOne({
    ...data,
    key: key(data.email || data.link || "none", data.role),
    createdAt: now,
    followUpAt: data.status === "sent" ? new Date(now.getTime() + 7 * 86400000) : null,
  });
}

export async function countSentToday(): Promise<number> {
  const c = await getCol();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return c.countDocuments({ status: "sent", createdAt: { $gte: start } });
}

export async function getQueued() {
  const c = await getCol();
  return c.find({ status: "queued" }).sort({ score: -1 }).toArray();
}

export async function updateStatus(id: ObjectId, status: Status) {
  const c = await getCol();
  const now = new Date();
  await c.updateOne(
    { _id: id },
    {
      $set: {
        status,
        updatedAt: now,
        followUpAt: status === "sent" ? new Date(now.getTime() + 7 * 86400000) : null,
      },
    }
  );
}

export async function closeDb() {
  await client.close();
}