# LenxiQ Live Class reliability — implementation and verification

**Date:** 2026-11-24  
**Branch:** `fix/live-class-reliability-20261124`  
**Base/deployed audit commit:** `d84ba989902b87b74f16a9ae96a0142b77708123`  
**Implementation commit:** none; changes remain uncommitted and unpushed.  
**Production release:** not performed.

## Summary

Implemented and locally validated the five reliability areas in the working tree. No deployment or live classroom check was attempted because required release inputs are missing: no realistic clinical PDF was supplied, and no Gemini, Groq, or LiveKit worker credentials are present in the sandbox. Production Supabase and Vercel access are available for read-only inspection, but the target Supabase project does not yet have these changes' migrations.

## Root causes addressed and affected files

1. **Document ingest was brittle and wasteful.** MIME/filename hints could miss generic or extensionless mobile files; image-only pages could reject mixed-content PDFs; extraction and parsing were coupled, so retries could repeat expensive parsing. `lib/curriculum/file-types.ts`, `lib/curriculum/extract-text.ts`, `lib/rag/ingestor.ts`, and `lib/rag/syllabus-compiler.ts` now handle signatures and mixed pages, reuse a versioned owner-scoped extraction record, and separate extraction from later compilation. `lib/rag/process-syllabus.ts` groups teachable concepts independently of smaller citation-addressable retrieval chunks and filters document furniture. Source extraction cache is purged after the original compiled binaries are removed and cascades away when the document is deleted.
2. **Model defaults and clinical validation were fragile.** Preview Qwen was selected in default Groq paths; typed clinical number/unit checks produced less useful failure precedence. `lib/live-class/lesson-author.ts`, `lib/live-class/model-router.ts`, `app/api/voice/llm/v1/chat/completions/route.ts`, and `app/api/admin/ai-health/route.ts` use stable defaults and bounded cross-provider fallback, validate clinical quantities and units, and persist provider cooldown state through `lib/live-class/provider-health.ts`. Public catalog findings are in [provider model verification](./provider-model-verification.md). Account-specific model enablement and quota are not verified.
3. **Lesson state could advance before a validated packet existed, and speech progress was not durable.** `app/api/live-class/orchestrate/route.ts` prepares the packet before writing the transition and adds recent-question/taught-concept context plus checkpoint actions. `worker/lensiq-voice-tutor/agent.py` saves sentence-level delivery checkpoints and resumes from them; `worker/lensiq-voice-tutor/medical_speech.py` normalizes clinical abbreviations/units and segments speech conservatively.
4. **Visual and spoken choreography needed to stay aligned.** `lib/live-class/visual-planner.ts` and `lib/live-class/lesson-author.ts` connect authored beats to the board/approved visual and keep speech, board notes, and source evidence distinct. Clinical number, unit, and qualification validation runs before delivery. No broad rewrite of `app/voice/page.tsx` was made.
5. **The lifecycle needed to remain ephemeral.** `lib/rag/ephemeral-cleanup.ts` now clears saved question memory and spoken checkpoints at class end, and removes the persisted extraction cache after compiled raw uploads are purged. Failure to remove Storage objects still prevents quota/index cleanup, retaining the existing retry-safe behavior.

## Verified model IDs and provider behavior

- Gemini planner primary: `gemini-3.8-flash`; Gemini fallback: `gemini-3.6-flash`.
- Groq conversation/authoring default: `openai/gpt-oss-20b`; bounded Groq alternate: `openai/gpt-oss-120b`.
- The code and tests confirm defaults and one-bounded-fallback behavior. Public provider catalog documentation was checked and recorded, but live authentication, account quota, and runtime availability were not testable without provider credentials.

## Local verification

- Node tests: **179 passed, 0 failed** (`node --test tests/*.test.mjs`).
- Python LiveKit worker tests: **15 passed**; `py_compile` passed.
- TypeScript: `pnpm exec tsc --noEmit` passed.
- ESLint: `pnpm lint` passed.
- Production build: `pnpm build` passed. Next.js emitted only the existing middleware-convention deprecation warning.
- `git diff --check` passed.
- Focused tests cover mixed image-only PDF pages, grouped concepts and citation retention, teaching metadata, clinical quantity fidelity, provider routing/fallback, sentence checkpoint resume, and cleanup semantics. These use test fixtures; they are not evidence from a real uploaded medical PDF.

## Production inspection (read-only)

- Supabase target `hixvbcrrklyajhkyliay` is `ACTIVE_HEALTHY`. Its migration history currently ends at **2026-10-31**; none of the three new migrations dated 2026-11-24 are applied. RLS is enabled on the inspected `live_class_lessons`, `study_documents`, and `study_syllabi` tables; the observed authenticated read policies are owner-scoped by `auth.uid() = user_id`. No schema change was applied.
- Vercel project `lensi-q` is linked to `lenchingozi2-web/LensiQ`. Its latest production deployment is `READY` and points to the audit commit above. No build, promotion, alias change, or deployment was initiated.
- This sandbox has no Gemini, Groq, or LiveKit credentials and no user-supplied realistic clinical PDF. Therefore production model access/quota, the PDF workflow, worker deployment, and an authenticated 5–10-minute class were not verified.

## PDF results, sample beats, and recovery

- **Real-PDF concept count and real sample beats:** unavailable; no realistic medical PDF was supplied or processed. Do not interpret the fixture results as a real-document extraction report.
- A synthetic classroom test fixture covers renal-elimination details including `5 mg` and `eGFR 15 mL/min`; its sample mock beat begins, “Think of kidney clearance as the speed at which the blood is cleaned of a medicine.” This demonstrates the validator/choreography fixture only, not production model output.
- The worker unit test confirms sentence checkpoints are retained and resumed without raw-source fallback. This is local simulation, not an authenticated LiveKit session.
- Cleanup tests verify storage-delete failure leaves the syllabus in `purging` without releasing quota/index data; successful class end clears saved visual state, session memory, and delivery checkpoint. Compiled-source purge now also deletes cached extracted text. Existing subscription-pause and room-auth tests passed as part of the full Node suite; no auth implementation was changed.

## Remaining release gates / Phase 2

1. Supply a representative messy medical PDF and validate page/slide extraction, TOC/noise suppression, concept counts, citations, and actual sample spoken/board beats.
2. Verify Gemini and Groq model access and account quotas with authorized credentials; test a worker's actual configured endpoint/model in the target runtime.
3. Apply the three migrations only to the specified production Supabase project after reviewing the release and its RLS implications.
4. Commit and push the reviewed implementation through the intended repository process; then coordinate the Vercel and LiveKit worker releases.
5. Run authenticated production verification, including a 5–10-minute classroom session, interruption/resume, subscription-pause behavior, both `lensiq-open-` and `lensiq-voice-` room authentication, and end-of-session cleanup. A 390×844 audio-unlock/control check remains outstanding.
6. Asset-set expansion/seeding and its rights/storage-headroom review remain separate Phase 2 work; no new paid infrastructure or Modal dependency was introduced.
