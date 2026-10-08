# Job Agent

An AI agent that reads job posts from Gmail, scores them against your profile, drafts a tailored application email, and sends it. It tracks everything in MongoDB.

## How it works

```
Email yourself a post (subject: JOB)
        ↓
Gmail label "JobPosts" → agent fetches unread mails (IMAP)
        ↓
Gemini parses the post (role, experience, location, stack, apply email)
        ↓
Score = Gemini skill fit − rule-based penalties (experience gap, location)
        ↓
  ≥ AUTO_MIN_SCORE   → draft + send automatically (daily cap applies)
  ≥ QUEUE_MIN_SCORE  → draft + queue for manual review
  below              → logged as low fit
        ↓
Result saved in MongoDB (dedupes by email + role)
```

## Features

- Job intake from Gmail (label + IMAP) or `.txt` files in `jobs/`
- Gemini-based parsing and skill-fit scoring with retry on API errors
- Hard rules in code for experience and location, so the LLM can't override them
- Auto-send for high scores, review queue for mid scores
- Daily send cap and random delay between mails
- Duplicate detection (never applies twice to the same role and email)
- `DRY_RUN` mode and a block on fake `example.com` addresses
- Application tracking in MongoDB Atlas

## Tech stack

Node.js, TypeScript (tsx), Gemini API (`@google/genai`), MongoDB Atlas, Nodemailer (SMTP), ImapFlow (IMAP), Windows Task Scheduler

## Setup

**1. Clone and install**
```bash
git clone https://github.com/Varun1206Tom/job-agent.git
cd job-agent
npm install
```

**2. Create `profile.json`** from `profile.example.json` and fill in your details.

**3. Create `.env`** from `.env.example`:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Key from aistudio.google.com |
| `GEMINI_MODEL` | Gemini model name |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Google app password (16 characters, no spaces) |
| `GMAIL_LABEL` | Gmail label to read (default `JobPosts`) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `RESUME_PATH` | Path to your resume PDF |
| `DRY_RUN` | `true` = never send mail |
| `AUTO_MIN_SCORE` | Score needed to auto-send (default 70) |
| `QUEUE_MIN_SCORE` | Score needed to queue for review (default 50) |
| `DAILY_CAP` | Max auto-sent mails per day |

**4. Put your resume** in the project root as `resume.pdf`.

**5. Gmail setup**
- Turn on 2-Step Verification and create an app password
- Create a label named `JobPosts`
- Create a filter: from = you, to = you, subject = `JOB`, apply label `JobPosts`, skip inbox

**6. MongoDB Atlas**
- Create a free cluster and a database user
- Allow your IP under Network Access
- Paste the connection string into `MONGO_URI`

## Usage

| Command | What it does |
|---|---|
| `npm run auto` | Fetch new posts from Gmail and `jobs/`, process them |
| `npm run apply -- file.txt` | Process a single post file with a manual send prompt |
| `npm run review` | Approve or reject queued applications |
| `npm run status` | Show the last 30 applications |

**Daily flow:** copy a job post, email it to yourself with subject `JOB`, and let `npm run auto` handle it.

**Scheduling (Windows):** create a Task Scheduler task that runs `run-agent.bat` daily. Output goes to `agent-log.txt`.

## Safety

- Start with `DRY_RUN=true` and check the output before sending anything
- Keep `DAILY_CAP` low (3 to begin with) and check your Sent folder
- Review drafts before trusting auto-send
- Never commit `.env`, `profile.json` or `resume.pdf`
- Use email-based applications only. Automating LinkedIn or Naukri breaks their terms of service

## Roadmap

- [ ] Follow-up mailer (one reminder 7 days after applying, skipped if they replied)
- [ ] React dashboard (Material UI) to view applications by status
- [ ] Job API intake (Adzuna, Remotive)

## License

MIT
