# Phase 1 audit and implementation

Repository: `lenchingozi2-web/LensiQ` — description: “AI powered study hub”.

Audited application revision: `30b09c02765d6fba98b753db94b81f009de75414` (tree `c78721a6e76e51aa01de67c391f97b3e885e0472`). This is the feature commit immediately before the documentation-only commit containing this report. PR: https://github.com/lenchingozi2-web/LensiQ/pull/32. Branch: `chore/pause-subscriptions`; base: `main`.

## Task 1 — source audit

Next.js **16.2.10**, React **19.2.4**. The complete 353-path tracked inventory is in [phase-1-repository-inventory.txt](phase-1-repository-inventory.txt). [phase-1-billing-inventory.json](phase-1-billing-inventory.json) lists every matching runtime, SQL policy, and operational source file. The exact import/route closure, packages, environment names, worker sources and database/Storage names are in [live-class-extraction-manifest.json](live-class-extraction-manifest.json).

The only purchase-initiation HTTP route found is `app/api/checkout/route.ts`, using Flutterwave. `app/api/checkout/verify/route.ts` verifies existing payments; `lib/payment-recovery.ts` reconciles pending receipts. Wallet and administrative finance endpoints report data rather than start charges. Existing verification and recovery remain intact. There are no new Stripe/Paystack replacements or billing schemas in this repair.

The initial flag bypass was incomplete: paid RLS still applied to questions, knowledge chunks, conversations, attachments and Storage inserts; the Live Class reservation/charge/gateway RPCs still enforced paid plans; timed mock creation still debited monthly counters. A passing typecheck alone did not test those behaviors. The latest pre-repair `d2adf14f` only added a duplicate access panel.

## Task 2 — implementation

`lib/subscriptions.ts` is the single policy. Only literal `true` enables subscription gates and checkout. While paused, verified signed-in users receive full learning access without profile-role changes, fake paid plans, credit/minute deductions or schema changes. Existing billing records and protected SQL policies remain intact. Private server access is preceded by `auth.getUser()` and retains explicit owner filters; editable Storage paths are validated against the verified user.

Live Class creates real owned session/history rows, enforces a server-clock 90-minute session maximum, scopes worker tokens to user/session/room, and preserves disconnect cleanup. Newer concurrent rooms supersede older rooms without closing a later reservation. A `lensiq-open-` server-generated room marker prevents retroactive billing after subscriptions resume. The switch removes subscription quotas, not authentication, ownership, administrative permissions, file size restrictions or the classroom session-duration safeguard.

Timed mocks resume the caller's existing attempt and preserve the existing authenticated scoring/results RPC. New paused attempts do not update subscription counters. Pricing, navigation, dashboard, subscription status and teaching errors no longer suggest a paid upgrade during the pause. No purchase buttons appear in the paused pricing render; enabled mode restores them.

### Modified files

- `.env.example`: Document false default and the public build-time flag rebuild requirement.
- `app/actions.ts`: Authenticate before open mock creation; preserve existing paid start and authenticated scoring when applicable.
- `app/api/checkout/route.ts`: Central pause policy; immediate exact 403 before payment initiation.
- `app/api/curriculum/search/route.ts`: Verify the request user, then use owner-scoped server data/Storage access while paid RLS remains unchanged.
- `app/api/explain/route.ts`: Authenticated full-bank canonical question read while paused; preserve shared explanation integrity and usage records.
- `app/api/library/documents/route.ts`: Verify the request user, then use owner-scoped server data/Storage access while paid RLS remains unchanged.
- `app/api/live-class/orchestrate/route.ts`: Remove paused plan/minute gates while retaining signed credentials, owner predicates, active-session expiry and cleanup; paid behavior remains enabled by true.
- `app/api/rag/compile-syllabus/route.ts`: Bypass paid plan requirement only while paused; retain owner checks, document validation and technical storage limits.
- `app/api/rag/ingest-batch/route.ts`: Bypass paid plan requirement only while paused; retain owner checks, document validation and technical storage limits.
- `app/api/teach/route.ts`: Pause paid Live Class accounting and use authenticated/owned content access without weakening provider validation.
- `app/api/teaching/attachments/[attachmentId]/route.ts`: Verify the request user, then use owner-scoped server data/Storage access while paid RLS remains unchanged.
- `app/api/teaching/attachments/route.ts`: Verify the request user, then use owner-scoped server data/Storage access while paid RLS remains unchanged.
- `app/api/teaching/conversations/[conversationId]/route.ts`: Verify the request user, then use owner-scoped server data/Storage access while paid RLS remains unchanged.
- `app/api/teaching/conversations/route.ts`: Verify the request user, then use owner-scoped server data/Storage access while paid RLS remains unchanged.
- `app/api/teaching/messages/route.ts`: Verify the request user, then use owner-scoped server data/Storage access while paid RLS remains unchanged.
- `app/api/uploads/lecture/route.ts`: Verify the request user, then use owner-scoped server data/Storage access while paid RLS remains unchanged.
- `app/api/voice/context/route.ts`: Remove paused plan/minute gates while retaining signed credentials, owner predicates, active-session expiry and cleanup; paid behavior remains enabled by true.
- `app/api/voice/llm/v1/chat/completions/route.ts`: Remove paused plan/minute gates while retaining signed credentials, owner predicates, active-session expiry and cleanup; paid behavior remains enabled by true.
- `app/api/voice/materials/route.ts`: Remove paused plan/minute gates while retaining signed credentials, owner predicates, active-session expiry and cleanup; paid behavior remains enabled by true.
- `app/api/voice/recording/route.ts`: Remove paused plan/minute gates while retaining signed credentials, owner predicates, active-session expiry and cleanup; paid behavior remains enabled by true.
- `app/api/voice/session/route.ts`: Remove paused plan/minute gates while retaining signed credentials, owner predicates, active-session expiry and cleanup; paid behavior remains enabled by true.
- `app/api/voice/token/route.ts`: Remove paused plan/minute gates while retaining signed credentials, owner predicates, active-session expiry and cleanup; paid behavior remains enabled by true.
- `app/api/wallet/route.ts`: Skip subscription refresh while paused and expose unlimited nullable allowances without low-balance warnings.
- `app/browse/[subject]/[division]/[type]/page.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `app/browse/[subject]/[division]/quiz/page.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `app/browse/[subject]/page.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `app/dashboard/page.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `app/page.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `app/pricing/PricingClient.tsx`: Render one access panel with study links and zero purchase CTAs while paused; preserve enabled plan cards.
- `app/pricing/page.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `app/subscription/page.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `app/teach/page.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `components/MobileNav.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `components/Navbar.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `components/NavbarControls.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `components/curriculum/TopicDiscoveryPanel.tsx`: Hide paused pricing CTAs or replace plan/quota messaging with accurate full-access status; preserve sign-in, history and enabled subscription views.
- `lib/ai/teaching-context.ts`: Require the verified owner ID when loading private conversation attachments.
- `lib/gatekeeper.ts`: Use central flag only after authentication; preserve paid RPCs when enabled.
- `lib/open-timed-mock.ts`: Persist and restore unlimited timed mock attempts without monthly counter deductions; paginate the bank and preserve scoring RPC.
- `lib/paid-access.ts`: Use central flag only after authentication; preserve paid RPCs when enabled.
- `lib/profile.ts`: Skip subscription refresh during the pause, retaining normal profile provisioning and true roles.
- `lib/subscription-access.ts`: Unlocked feature allowances while retaining the true administrator and paid-plan identity.
- `lib/subscription-runtime.ts`: Authenticated server data access, owned unmetered class reservations/heartbeats, session expiry, no retroactive charging, and Storage path validation.
- `lib/subscriptions.ts`: One exact-value environment policy; disabled by default.
- `package.json`: Include pause regression cases in the existing test:study-hub command.
- `tests/explanation-reservations.test.mjs`: Behavioral regressions or updated dependency injection for the unchanged enabled-billing tests.
- `tests/subscription-auth.test.mjs`: Behavioral regressions or updated dependency injection for the unchanged enabled-billing tests.
- `tests/subscription-pause.test.mjs`: Behavioral regressions or updated dependency injection for the unchanged enabled-billing tests.
- `tests/teaching-credit-gate.test.mjs`: Behavioral regressions or updated dependency injection for the unchanged enabled-billing tests.
- `tests/voice-context-auth.test.mjs`: Behavioral regressions or updated dependency injection for the unchanged enabled-billing tests.
- `tests/voice-startup.test.mjs`: Behavioral regressions or updated dependency injection for the unchanged enabled-billing tests.
- `tests/voice-stream-start.test.mjs`: Behavioral regressions or updated dependency injection for the unchanged enabled-billing tests.

## Task 3 — extraction manifest

The JSON manifest contains exact source paths, including helper-called RAG compilation/retrieval routes and dynamic history routes; imported styles/utilities/types; all 17 traced npm packages with their source version declarations; the Python worker packages; required and optional environment names; and all named Postgres/RPC/Storage dependencies. No legacy Study Hub page is in the port list. Shared shell/navigation files require Cortex-specific adaptation; their linked legacy pages are explicitly excluded.

The worker deploy configuration targets an existing LiveKit Cloud Agent. Actual current source uses LiveKit inference for Deepgram STT and Cartesia TTS, plus a web Gemini brain/Groq mouth gateway. Do not assume Kokoro from an obsolete web comment. A long-running Python voice worker remains an independent LiveKit Cloud process; it cannot be copied into a Cloudflare request handler. Cortex must not use Modal or R2. No Phase 2 work was performed.

Next.js 16.2.10 is below the user's requested 16.3.8 baseline. The manifest correctly flags a Phase 2 upgrade; it does not silently upgrade the production repo or assert an unverified public OpenNext support floor.

## Verification and practical limits

A subsequent CI run found a Next.js-reserved test variable name; the test fixture was corrected without changing runtime behavior. Both paused and enabled Next builds passed locally.

Local executed checks: frozen pnpm install, Next type generation, TypeScript, full JavaScript regression suite, configured `test:study-hub`, full ESLint and optimized production build. The new pause suite covers exact flag parsing, signed-out/foreign-owner rejection, enabled paid enforcement, no wallet writes, reservation/heartbeat expiry, concurrent starts, mock persistence and bank pagination, exact checkout response, single-panel pricing render and Storage metadata ownership. Final GitHub CI must confirm the published PR head; see the PR checks rather than inferring a pass from this document.

These are branch checks with fixtures, not a claim that a real classroom or payment transaction was exercised against production. Live provider credentials and remote Storage object availability remain deployment/E2E verification items. Study Hub main, production deployment, database DDL, billing tables, existing subscription/profile balances and Phase 2 have not been modified by this repair. Await explicit approval before merge, production activation or Phase 2.
