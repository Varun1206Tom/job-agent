import { readFileSync } from "fs";
import { askJSON } from "./gemini";

const profile = JSON.parse(readFileSync("profile.json", "utf8"));

export type Job = {
    company: string | null;
    role: string;
    minExperience: number | null;
    location: string;
    remote: boolean;
    stack: string[];
    applyEmail: string | null;
    applyLink: string | null;
};

export type Score = { score: number; reasons: string[]; dealBreakers: string[] };

export async function parseJob(rawText: string): Promise<Job> {
    return askJSON<Job>(`
Extract job details from this post. Return JSON only with keys:
company (string or null), role, minExperience (number or null), location,
remote (true only if the post says remote or work from home), stack (string[]),
applyEmail (string or null), applyLink (string or null).
Use null when missing. Do not guess.

POST:
${rawText}`);
}

export async function scoreJob(job: Job): Promise<Score> {
    const llm = await askJSON<{ skillFit: number; reasons: string[] }>(`
Rate ONLY the skill and stack match between candidate and job, 0-100.
Ignore experience years and location. Another system handles those.
Return JSON only: { "skillFit": number, "reasons": string[] } (max 3 short reasons).

CANDIDATE:
${JSON.stringify({ skills: profile.skills, highlights: profile.highlights })}

JOB:
${JSON.stringify({ role: job.role, stack: job.stack })}`);

    const dealBreakers: string[] = [];
    let penalty = 0;

    // Experience rule
    if (job.minExperience != null) {
        const gap = job.minExperience - profile.yearsExperience;
        if (gap > 2) { penalty += 40; dealBreakers.push(`Needs ${job.minExperience}+ yrs, you have ${profile.yearsExperience}`); }
        else if (gap > 1) penalty += 20;
        else if (gap > 0) penalty += 5;
    }

    // Location rule
    const loc = (job.location || "").toLowerCase();
    const locOk =
        job.remote ||
        profile.openToLocations.some((l: string) => loc.includes(l.toLowerCase()));
    if (!locOk) { penalty += 30; dealBreakers.push(`Location not in your list: ${job.location}`); }

    const score = Math.max(0, Math.min(100, Math.round(llm.skillFit - penalty)));
    return { score, reasons: llm.reasons, dealBreakers };
}

export async function draftMail(job: Job): Promise<{ subject: string; body: string }> {
    return askJSON(`
Write a short job application email. Return JSON only: { "subject": string, "body": string }.
Rules: under 120 words, direct tone, no em-dashes, no buzzwords,
mention 2 achievements relevant to the job stack, mention GitHub, say resume is attached.
If company is null, address it to "Hiring Team".
Only use facts from the candidate profile. Never invent experience.
Use ${profile.yearsExperience} years of experience.
Use correct spacing and punctuation. Re-read every sentence before answering.

CANDIDATE:
${JSON.stringify(profile)}

JOB:
${JSON.stringify(job)}`);
}