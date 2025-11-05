# Spartan Product Overview — Juno (Resume Optimizer Chrome Extension)
\1
**Product name:** Juno

> **Scope:** Lean, problem-first plan: problems → user stories → prioritized feature list with **high-level UX requirements per feature**. (Supabase + MiniMax M2 via OpenRouter; Chrome MV3; local-first.)

---

## Problem Summary
- **Who hurts most:** Active job seekers (early-career to mid-career, tech & ops roles), career switchers, and international applicants facing strict ATS filters.
- **Core pain:** Resumes are rejected by ATS before human review; current tooling forces uploads to external sites, adds friction, and raises privacy concerns.
- **Current workaround(s):** Generic resume builders, manual keyword stuffing, copy/paste into web tools, spreadsheets to track applications.
- **Why now:** Opaque ATS screening + rising AI job-matching; strong demand for privacy-first tools that meet users where they apply (job boards).

## Target Users (Quick Personas)
- **Primary persona:** “Heads-Down Applicant” — applies daily on Indeed/LinkedIn; wants fast, secure, practical improvements; success = more callbacks per week.
- **Secondary personas:** “Optimizer” — tinkers with versions/cover letters; “Switcher/International” — needs tailored language to pass filters.

## Success Signals (Lean)
- **Activation:** ≥70% of new users get a match score within **120s** of install on a supported job post.
- **Retained usage:** Median **5+** optimized applications/week per active user.
- **Business outcome:** Free→Pro conversion ≥7% with AI suggestions; Pro monthly churn ≤6%.
- **Quality:** Resume edits accepted by user ≥60% of suggested changes; callback rate uplift (self-reported) ≥15%.

---

## Feature Backlog (Spartan)

| Priority | Feature | User Story | Acceptance Criteria (Lean) | High-Level UX Requirements | Dependencies |
|---|---|---|---|---|---|
| P0 | Job Post Detection (Indeed MVP) | As an applicant, I want the extension to recognize an Indeed job page so that optimization appears exactly when needed. | Given an Indeed job detail page, when the extension loads, then a floating action button (FAB) and side panel become available; **Edge:** if DOM shifts, auto-retry and show “refresh to continue”. | Non-intrusive FAB at bottom-right; slide-in panel on click. | DOM selectors; MV3 content script; QA on 3 Indeed layouts. |
| P0 | Local Resume Upload & Parsing | As a user, I want to import my resume without leaving the page so that I can optimize quickly and privately. | Given a PDF/DOCX, when I upload, then sections (contact, summary, experience, skills) parse locally and are editable; **Edge:** if parse fails, preserve original and show field-by-field import. | Drag/drop area in panel; inline editable fields; **no network calls** in Free mode. | PDF.js/docx parsing; IndexedDB; Chrome storage. |
| P0 | ATS Keyword Match & Score (Local) | As a user, I want a match score and missing keywords so that I can improve targeted fit. | Given JD text, when analyzed, then show score (0–100), top 10 missing hard/soft skills; **Edge:** dedupe synonyms. | Score dial with chips for missing keywords; tap-to-insert suggestions. | **Model:** DistilBERT-base-uncased (ONNX quantized ~40–50MB); token limits; stopwords. |
| P0 | Rule-Based Edit Suggestions (Local) | As a user, I want quick wording fixes so that I can improve clarity without AI/cloud. | Given parsed sections, when I click “Improve”, then show 3–5 rule-based edits per section; **Edge:** never alter numbers/PII. | Inline diffs with Accept/Reject; undo; batch apply. | Client rules engine; regex + heuristics. |
| P0 | Local Application History | As a user, I want my applications tracked automatically so that I can avoid duplicates and see progress. | Given a submission attempt, when I click “Mark Applied”, then an entry saves locally with URL, date, score, status; **Edge:** offline-first. | Compact timeline in panel; quick status picker. | IndexedDB schema; URL normalization. |
| P0 | Auth & Plans (Pro) | As a user, I want to sign in and manage subscription so that I can access AI and sync features. | Given signup/login, when successful, then plan and quota load; **Edge:** read-only UI in expired state. | Simple auth sheet; plan badge; quota meter in panel. | Supabase Auth; Stripe customer portal; webhooks. |
| P0 | AI Suggestions via MiniMax M2 | As a Pro user, I want advanced rewrites and cover letter drafts so that I can submit a stronger application fast. | Given JD+resume, when I request “Rewrite bullets” or “Generate cover letter”, then AI returns structured suggestions within **≤10s**; **Edge:** timeouts surface retry. | Tabbed results (Bullets/Summary/Cover Letter); copy buttons; safe PII handling. | Supabase Edge Function → OpenRouter (MiniMax M2); PII scrubbing; rate limits. |
| P0 | Cloud Storage & Sync (Pro) | As a Pro user, I want my resumes/letters synced so that I can use multiple devices. | Given save, when online, then files and metadata appear across devices; **Edge:** conflict resolution prompts. | “Active Resume” toggle; version list with timestamps. | Supabase Storage; RLS policies; Postgres. |
| P0 | Usage Metering & Quotas (Pro) | As the business, I need per-user usage tracked so that costs are controlled. | **Free:** 20 matches/mo, 5 AI suggestions/mo, 1 resume, **0** AI calls. **Pro:** 100 matches/mo, 50 AI suggestions/mo, 5 resumes, 50 AI calls. **Premium:** 300 matches/mo, 200 AI suggestions/mo, 50 resumes, 200 AI calls. When quota reached, show warning → upsell → block. | Subtle meter; upgrade CTA near limit. | `ai_usage` table; Stripe plan mapping; server-side enforcement. |
| P1 | LinkedIn & Glassdoor Detection | As an applicant, I want optimization on more boards so that I can apply anywhere. | Given a LinkedIn/Glassdoor job page, when loaded, then same FAB/panel flows work. | Layout-aware selectors; graceful degradation. | Site-specific adapters; tests. |
| P1 | Backup/Restore (Pro) | As a Pro user, I want one-click backup/restore so that I never lose my data. | Manual backup creates timestamped snapshot; restore confirms and overwrites. | “Backup now” + “Restore” in Settings; progress UI. | Supabase Storage; signed URLs. |
| P1 | Cover Letter Templates (AI) | As a Pro user, I want tailored templates so that I can customize quickly. | Generate 3 variants with tone options; always cite pulled keywords. | Tone selector (neutral/friendly/formal). | Same AI path; prompt library. |
| P1 | Guided Onboarding Checklist | As a new user, I want a 3-step setup so that I reach first value fast. | Steps: upload resume, detect JD, view score ≥60. | Persistent checklist with deep links. | None beyond above. |
| P1 | **Email Callback Tracking (Opt-in)** | As a user, I want automatic callback detection so that I can measure results without data entry. | With explicit consent and Gmail read-only scope, when recruiter replies are detected for tracked applications, then mark “callback = true” and timestamp; **Edge:** no matches → no changes. | Clear consent screen; disable anytime; privacy notice. | Gmail API read-only; message matching logic. |
| P2 | Team/Recruiter Workspace | As a recruiter, I want candidate analytics so that I can shortlist faster. | Aggregate performance across resumes; export CSV. | Separate “Recruiter mode”; permissions. | New roles; separate billing. |
| P2 | Insights & Analytics | As a user, I want trends so that I can improve my applications over time. | Weekly overview: apps, avg score, callbacks. | Simple charts in panel; email digest opt-in. | Aggregations; email service. |

### Global UX Guardrails
- First value ≤ **60s** and **≤5 clicks** (install → detect JD → upload → score).
- Side panel never obscures page CTAs; responsive & keyboard accessible.
- Empty states teach (with examples); inline validation; one-click rollback for edits.
- **Performance:** On 2017+ CPUs with ≥8GB RAM, match/extract runs **<2s** on ~500-word resume/JD; low-end devices auto-fallback to template/regex or suggest Pro for large docs.
- **Privacy badge** clearly indicates **Local Mode** vs **Cloud Mode**.

---

## MVP Slice (P0 Only)
- **Scope:** Indeed detection, local upload & parsing, local ATS match & score, rule-based edits, local history, Pro auth + Stripe, AI suggestions via MiniMax M2, cloud storage/sync, usage metering.
- **Out-of-scope (defer):** LinkedIn/Glassdoor, templates library, analytics, recruiter features, backup/restore UX polish, email callback tracking.

## Risks & Assumptions (Quick)
- **DOM Fragility:** Use site adapters + monitoring; ship hotfix channel.
- **Privacy:** Strict separation: Free = on-device only; Pro = encrypted cloud + consent.
- **AI Cost:** Enforce quotas; cache prompt patterns; cap max tokens.
- **Availability:** OpenRouter latency variance; implement retries + circuit-breaker UI.
- **Compliance:** RLS everywhere; store minimal PII; Stripe SCA ready.
- **Locales:** MVP = English only; warn on unsupported locales; roadmap multilingual in V2.0.
- **Assumptions:** Users value privacy enough to install; match score affects behavior; Indeed first gives fastest path to value.

---

## **Decisions Locked (Resolved Gaps)**
- **Local Model:** `distilbert-base-uncased` → ONNX quantized (~40–50MB). Target **<2s** on 2017+ CPUs/8GB RAM; auto-fallback below 4GB RAM or very old devices.
- **Quotas by Plan:** Free (20 matches/5 AI/1 resume/0 AI calls), Pro (100/50/5/50), Premium (300/200/50/200). Admin-adjustable; warn → upsell → block.
- **Locales/Languages:** MVP English (US/UK/CA/AU). Locale detection; UTF‑8 + diacritics; warn on unsupported; V2.0: FR/DE/ES + selected Asian languages.
- **Callback Measurement:** Default **self-report** prompts after apply; optional **Gmail read-only** tracking with explicit consent.
- **Pricing & Refunds:** Free $0; Pro **$9.99/mo** or **$79/yr**; Premium **$24.99/mo** or **$199/yr**. Refunds: 7‑day full refund; annual pro‑rata on request; monthly cancels at period end via Stripe portal.

---

### Prompting Notes (for AI features, reference only)
- Always **strip PII** before sending. Inject job requirements and user bullets as separate, labeled sections.
- Return **structured JSON** for bullets/edits (with rationale), plus a formatted text version for quick copy.
- Guardrails: never hallucinate employer names/dates; highlight uncertainties explicitly.
