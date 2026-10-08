import { readFileSync } from "fs";
import { createInterface } from "readline/promises";
import { parseJob, scoreJob, draftMail } from "./agent";
import { sendMail } from "./mailer";
import { alreadyApplied, logApplication, closeDb } from "./db";

const THRESHOLD = 50;

async function ask(q: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = await rl.question(q);
    rl.close();
    return a.trim().toLowerCase();
}

async function main() {
    const file = process.argv[2] || "job.txt";
    const raw = readFileSync(file, "utf8");

    console.log(`Reading ${file}...`);
    const job = await parseJob(raw);
    console.log("\nJOB:", job.role, "|", job.location, "|", job.applyEmail ?? job.applyLink);

    const s = await scoreJob(job);
    console.log("SCORE:", s.score, s.dealBreakers);

    const base = {
        company: job.company,
        role: job.role,
        email: job.applyEmail,
        link: job.applyLink,
        score: s.score,
    };

    if (s.score < THRESHOLD) {
        console.log("\nSkipping: low fit.");
        await logApplication({ ...base, status: "low_fit" });
        return;
    }

    if (!job.applyEmail) {
        console.log("\nNo email found. Apply manually:", job.applyLink);
        await logApplication({ ...base, status: "skipped" });
        return;
    }

    if (await alreadyApplied(job.applyEmail, job.role)) {
        console.log("\nAlready applied to this role. Skipping.");
        return;
    }

    const mail = await draftMail(job);
    console.log("\nTO:", job.applyEmail);
    console.log("SUBJECT:", mail.subject);
    console.log("\n" + mail.body + "\n");

    const answer = await ask("Send? (y/n): ");
    if (answer !== "y") {
        console.log("Not sent.");
        await logApplication({ ...base, status: "skipped", subject: mail.subject });
        return;
    }

    const sent = await sendMail(job.applyEmail, mail.subject, mail.body);
    await logApplication({
        ...base,
        status: sent ? "sent" : "dry_run",
        subject: mail.subject,
    });
    console.log(sent ? "Sent and logged." : "Dry run logged.");
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await closeDb();
        process.exit(0);
    });