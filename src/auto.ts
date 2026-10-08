import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { processJob } from "./pipeline";
import { ingest } from "./ingest";
import { closeDb } from "./db";

const DIR = "jobs";
const DONE = join(DIR, "done");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!existsSync(DIR)) mkdirSync(DIR);
  if (!existsSync(DONE)) mkdirSync(DONE);

  try {
    const n = await ingest();
    console.log(`Gmail: ${n} new post(s) fetched.`);
  } catch (e: any) {
    console.log("Gmail ingest failed:", String(e.message).slice(0, 150));
  }

  const files = readdirSync(DIR).filter((f) => f.endsWith(".txt"));
  if (!files.length) return console.log("Nothing to process.");

  for (const f of files) {
    const posts = readFileSync(join(DIR, f), "utf8")
      .split(/^-{3,}\s*$/m)
      .map((p) => p.trim())
      .filter((p) => p.length > 80);

    console.log(`\n${f}: ${posts.length} post(s)`);
    const failed: string[] = [];

    for (const post of posts) {
      try {
        console.log(await processJob(post));
      } catch (e: any) {
        console.log("ERROR:", String(e.message).slice(0, 150));
        failed.push(post);
      }
      await sleep(15000 + Math.random() * 30000);
    }

    if (failed.length) {
      const retryFile = join(DIR, `retry_${Date.now()}.txt`);
      writeFileSync(retryFile, failed.join("\n---\n"));
      console.log(`\n${failed.length} post(s) failed. Saved to ${retryFile} for the next run.`);
    }

    renameSync(join(DIR, f), join(DONE, `${Date.now()}_${f}`));
  }
}

main().finally(async () => {
  await closeDb();
  process.exit(0);
});