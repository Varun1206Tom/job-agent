import "dotenv/config";
import { parseJob, scoreJob, draftMail } from "./agent";
import { sendMail } from "./mailer";
import { alreadyApplied, logApplication, countSentToday } from "./db";

const AUTO_MIN = Number(process.env.AUTO_MIN_SCORE || 70);
const QUEUE_MIN = Number(process.env.QUEUE_MIN_SCORE || 50);
const DAILY_CAP = Number(process.env.DAILY_CAP || 10);

export async function processJob(raw: string): Promise<string> {
    const job = await parseJob(raw);
    const s = await scoreJob(job);
    const label = `${job.role} | ${job.location} | score ${s.score}`;

    const base = {
        company: job.company,
        role: job.role,
        email: job.applyEmail,
        link: job.applyLink,
        score: s.score,
    };

    if (s.score < QUEUE_MIN) {
        await logApplication({ ...base, status: "low_fit" });
        return `LOW FIT   ${label}`;
    }

    if (!job.applyEmail) {
        await logApplication({ ...base, status: "skipped" });
        return `NO EMAIL  ${label} -> apply manually: ${job.applyLink ?? "no link"}`;
    }

    if (await alreadyApplied(job.applyEmail, job.role)) {
        return `DUPLICATE ${label}`;
    }

    const mail = await draftMail(job);

    if (s.score < AUTO_MIN) {
        await logApplication({ ...base, status: "queued", subject: mail.subject, body: mail.body });
        return `QUEUED    ${label} -> run: npm run review`;
    }

    if ((await countSentToday()) >= DAILY_CAP) {
        await logApplication({ ...base, status: "queued", subject: mail.subject, body: mail.body });
        return `CAP HIT   ${label} -> queued for review`;
    }

    const sent = await sendMail(job.applyEmail, mail.subject, mail.body);
    await logApplication({
        ...base,
        status: sent ? "sent" : "dry_run",
        subject: mail.subject,
        body: mail.body,
    });
    return `${sent ? "SENT     " : "DRY RUN  "} ${label} -> ${job.applyEmail}`;
}