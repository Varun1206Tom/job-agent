import "dotenv/config";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const LABEL = process.env.GMAIL_LABEL || "JobPosts";
const OWN = (process.env.GMAIL_USER || "").toLowerCase();

// Remove mail headers and your own address so the parser can't mistake them for the HR email
function clean(text: string): string {
    return text
        .split("\n")
        .filter((l) => !/^\s*(from|to|cc|bcc|sent|date):/i.test(l))
        .join("\n")
        .replace(new RegExp(OWN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
        .trim();
}

export async function ingest(): Promise<number> {
    const client = new ImapFlow({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
        tls: { rejectUnauthorized: process.env.ALLOW_INSECURE_TLS !== "true" },
        logger: false,
    });

    const posts: string[] = [];
    await client.connect();
    const lock = await client.getMailboxLock(LABEL);

    try {
        const uids = (await client.search({ seen: false }, { uid: true })) || [];
        for (const uid of uids) {
            const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
            if (!msg || !msg.source) continue;
            const parsed = await simpleParser(msg.source);
            const text = clean(`${parsed.subject ?? ""}\n${parsed.text ?? ""}`);
            if (text.length > 80) posts.push(text);
            await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        }
    } finally {
        lock.release();
        await client.logout();
    }

    if (posts.length) {
        if (!existsSync("jobs")) mkdirSync("jobs");
        writeFileSync(join("jobs", `gmail_${Date.now()}.txt`), posts.join("\n---\n"));
    }
    return posts.length;
}