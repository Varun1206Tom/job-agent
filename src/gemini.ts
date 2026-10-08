import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(e: any): boolean {
    const msg = String(e?.message || e);
    return /"code":\s*(429|500|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(msg);
}

export async function askJSON<T>(prompt: string): Promise<T> {
    const maxAttempts = 6;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await ai.models.generateContent({
                model: MODEL,
                contents: prompt,
                config: { responseMimeType: "application/json", temperature: 0.2 },
            });
            return JSON.parse(res.text ?? "{}") as T;
        } catch (e: any) {
            if (attempt === maxAttempts || !isRetryable(e)) throw e;
            const wait = Math.min(60000, 2000 * 2 ** attempt) + Math.random() * 1000;
            console.log(`  Gemini busy, retry ${attempt}/${maxAttempts - 1} in ${Math.round(wait / 1000)}s...`);
            await sleep(wait);
        }
    }
    throw new Error("unreachable");
}