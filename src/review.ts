import "dotenv/config";
import { createInterface } from "readline/promises";
import { getQueued, updateStatus, closeDb } from "./db";
import { sendMail } from "./mailer";

async function main() {
    const queued = await getQueued();
    if (!queued.length) return console.log("Nothing queued.");

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    for (const q of queued) {
        console.log(`\n=== ${q.role} (score ${q.score}) ===`);
        console.log("TO:", q.email);
        console.log("SUBJECT:", q.subject);
        console.log("\n" + q.body + "\n");

        const a = (await rl.question("Send? y = send, n = reject, s = skip: ")).trim().toLowerCase();
        if (a === "y") {
            const sent = await sendMail(q.email, q.subject, q.body);
            await updateStatus(q._id, sent ? "sent" : "dry_run");
            console.log(sent ? "Sent." : "Dry run.");
        } else if (a === "n") {
            await updateStatus(q._id, "rejected");
        }
    }
    rl.close();
}

main().finally(async () => {
    await closeDb();
    process.exit(0);
});