# Production cutover gate (draft PR #26)

Use **Node 24+** and run npm ci from the repository root before executing the scripts.

1. Apply BOTH migrations to the *Study Hub* project hixvbcrrklyajhkyliay only. Verify with
   node scripts/verify-prod-cutover.mjs. Environment: NEXT_PUBLIC_SUPABASE_URL,
   SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GROQ_API_KEY, optionally
   STUDY_EMBEDDING_URL/STUDY_EMBEDDING_API_KEY/STUDY_EMBEDDING_MODEL.
   The script fails closed on wrong project and returns nonzero on any failed check.
   It creates or tightens the existing private study-documents bucket only after
   schema and RPC checks succeed. Existing uploaded objects are not deleted.
   Re-running the script is idempotent.

2. Use a freshly created *dedicated disposable* authenticated Live Class session
   in a deployed instance of this branch. Set E2E_BASE_URL, E2E_AUTH_COOKIE,
   E2E_USER_ID, E2E_SESSION_ID, E2E_CONFIRM_DEDICATED_SESSION=true, and
   LIVEKIT_API_SECRET in addition to the database credentials.
   Run node scripts/e2e-live-class-smoke.mjs.
   The test refuses sessions with preexisting syllabus/lesson data, uploads three
   harmless fixture files, compiles, checks every exact fixture fact against
   source-file citations, exercises HTTP teaching/interrupt/restore, and
   purges the test session. It is destructive ONLY to its own disposable test
   session. A failed run retries cleanup; review any remaining data promptly.

3. Worker: worker/lensiq-voice-tutor/Dockerfile is the production entry.
   Hosted deployment uses LiveKit Cloud directly (not Modal). Initialize the
   agent ID ONCE through the official CLI in that worker directory:
     lk agent create --region eu-central
   From the newly generated livekit.toml, configure the repo Actions variable
   LIVEKIT_AGENT_ID to the [agent].id (CA_...). The workflow deploys the
   *existing agent* on main worker changes, or manual workflow_dispatch with
   confirm_production=DEPLOY. It refuses unknown target project and missing
   secrets. The agent secrets are injected at runtime, not baked into the image.
   Secrets: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GROQ_API_KEY,
   GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
   Enforce required reviewers on GitHub environment production-voice-worker
   when appropriate.

Strict interpretation of the gates:
- The 500-ms embedding threshold is measured on the real network, not promised.
- The <50-ms lookahead is a WARM CACHE HIT, not database/network retrieval time.
- The zero-loss audit covers every non-heading line from the three text fixtures
  and each fixture source path. It does not establish lossless parsing for
  scanned PDFs, complex slides, arbitrary documents, or all 70-MiB cases.
- Storage 0-byte audit covers active bucket objects and active database rows.
  Supabase backups, audit logs and caches are separate retention systems.
- HTTP smoke tests cover database + orchestrator + signed worker HTTP calls.
  They do not prove a LiveKit room, STT, TTS, audio barge-in, RTC data message
  delivery, whiteboard/browser rendering or 90-minute reliability.
- Never merge just because CI is green. Require the real preflight and smoke
  report to pass on the correct project, then validate real voice/visuals with
  a student and real LiveKit Cloud usage and quota limits.
