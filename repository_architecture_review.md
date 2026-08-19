# LensiQ Repository Architecture Review

## Scope and safety status

This review uses the provided repository `https://github.com/lenchingozi2-web/LensiQ`. The repository was cloned at commit `39ffcf5` on the `main` branch. No source files were modified, no commits were created, and no Supabase data was changed.

## Current stack and application shape

LensiQ is a small Next.js 16.2.10 App Router application using React 19, TypeScript, Tailwind CSS 4, `@supabase/ssr`, and `@supabase/supabase-js`. Authentication is wired through server and browser Supabase helpers, while `middleware.ts` refreshes the Supabase session on requests. The existing route surface includes home, authentication, pricing, dashboard, browse, study, exam, teaching, admin, checkout, explanation, and teaching API routes.

The existing production build passes successfully. The lint command currently reports 14 errors and 26 warnings, including an effect/state issue in `components/CbtEngine.tsx`, a deprecated TypeScript suppression in `components/Navbar.tsx`, `prefer-const` issues and an explicit `any` in `lib/gatekeeper.ts`, and multiple unused variables. Next.js also reports that the `middleware` convention is deprecated in favor of the newer `proxy` convention.

## Existing feature flows and gaps

| Briefing requirement | Current implementation | Finding |
|---|---|---|
| Practical images recognized in the app | `app/browse/[subject]/[division]/[type]/page.tsx` selects `questions.*`; `StudyCard` does not declare or render `image_url` | Practical images can exist in Supabase but are invisible in the question card. The division format page exposes only MCQ and theory, so practicals are not reachable through normal browse navigation. |
| New subscription prices | `PricingClient.tsx` sends ₦6,000, ₦8,000, ₦10,000, and ₦12,000 | The requested values are ₦9,000, ₦13,000, ₦17,000, and ₦20,000. The price catalog must be centralized and validated server-side. |
| Paid tiers unlock everything immediately | `lib/gatekeeper.ts` allows every non-`free` plan; practical gating is not represented as a feature type | The bypass is broad, but practical navigation is missing. The subscription verification route writes `plan: 'elite'`, while the observed profile constraint permits `free`, `3mo`, `6mo`, `9mo`, and `12mo`; this is a production-risk inconsistency that must be resolved before checkout changes. |
| Chat interface and history | `/teach` has a local `messages` state only | The current teaching page is a single ephemeral chat. There is no conversation table, conversation-message persistence, history sidebar, file attachment flow, or voice-note flow. |
| Smooth streaming | `/api/teach` pipes DeepSeek SSE directly to the browser; `/teach` splits each raw network chunk by newline and calls `scrollIntoView` whenever messages or loading change | SSE records can be split across network chunks, so the parser can lose partial events. Repeated forced scrolling is also the likely source of the stiff/shaking behavior and prevents natural user scrolling during generation. A buffered SSE parser and scroll-lock-aware viewport are needed. |
| Grounded system prompt | `/api/teach` constructs a prompt from `courseName` and the conversation only | It does not query `public.questions` or the new `public.knowledge_documents` table, and it does not enforce lecture-slide/question-bank grounding or past-question framing. |
| Knowledge-bank retrieval | Repository search found no reference to `knowledge_documents`, `knowledge-banks`, or a retrieval service | The five uploaded educational PDF sources are present in Supabase, but this codebase currently has no code path that retrieves their metadata or content for AI teaching. |
| Live voice tutor | No Deepgram, Cartesia, or LiveKit dependency, route, client, or server module is present | This requires a new realtime architecture, not a small extension of `/api/teach`. It needs session state, audio transport, interruption handling, TTS/STT orchestration, and slide ingestion. |
| Slide-deck input | No upload route or client file-picker exists in the teaching flow | A safe upload pipeline and document-processing route are required before slide-based narrated classes can work. |
| Visual polish | The app uses a simple starter-style layout, emoji icons, broad utility classes, and a shared `max-w-4xl` shell | The requested premium UI bar is achievable, but should be implemented incrementally after the data and interaction foundations are stabilized. |

## Important code-level risks

The checkout route accepts `amount` and `duration` from the browser and passes them directly to Flutterwave. The server should instead accept a plan identifier and derive the amount and duration from a single server-side catalog. The verification route should validate the verified transaction amount, currency, reference, user identity, and plan metadata before updating the profile.

The current verification route stores `plan: 'elite'`, but the production schema previously inspected uses a constrained plan vocabulary that does not include `elite`. This mismatch can cause payment verification updates to fail or produce inconsistent entitlement behavior. The corrected design should use the existing allowed duration identifiers, such as `3mo`, `6mo`, `9mo`, and `12mo`, unless a deliberate schema migration is separately approved.

The explanation route reads and writes `question_explanations`, while the inspected public schema exposes `ai_explanations` and not `question_explanations`. The admin page also selects `questions ( text )`, although the questions table uses `question_text`. These are existing schema mismatches that should be corrected or confirmed before expanding AI retrieval.

## Recommended implementation sequence

1. Establish a typed server-side configuration layer for plan catalog, course identifiers, feature entitlements, and knowledge-bank records. Add automated checks for plan amounts and profile-plan values before touching payment UI.
2. Wire practical browse navigation and rendering first: expose the `practical` format, include `image_url` in the question type, render accessible images with stable dimensions, and preserve text-only practical records.
3. Add a knowledge retrieval layer that reads active `knowledge_documents` records and relevant question-bank rows. The retrieval contract should return source title, course, text context, and document URL or storage path, with strict course filtering.
4. Refactor `/api/teach` around a reusable grounded-context builder and a versioned system-prompt function. Preserve the existing tone and temperature, but add the approved grounding and exam-native instruction. The response should continue to stream through a robust SSE parser.
5. Add persistent chat conversations and messages, then build the sidebar/history UI. Conversation creation, message persistence, and retry behavior should be server-authorized and scoped to the current authenticated user.
6. Fix streaming UX using a buffered SSE parser, a stable message reducer, and an auto-scroll policy that only follows the bottom when the user is already near it. Users must be able to scroll upward while generation continues.
7. Implement file uploads and slide ingestion as a separate capability with size/type limits, storage paths scoped to the user, and server-side processing. Do not feed arbitrary uploaded content into the model without an explicit extraction and sanitization step.
8. Implement the LiveKit, Deepgram, and Cartesia voice tutor as a separate session subsystem. Begin with a text-only class-session state machine, then add STT interruption events, pause/resume, narrated sections, and TTS playback. Background music should be mixed as a controlled client/server audio layer rather than embedded into every generated voice segment.
9. Apply the visual redesign after the core flows are covered by tests. Use reusable components for chat panels, course selectors, cards, tables, audio controls, and upload states.
10. Resolve the existing lint errors and add regression checks before deployment. The production build already passes, so each change should preserve that baseline.

## Proposed first code slice

The safest first implementation slice is the practical-question visibility and knowledge-bank retrieval foundation. It has a small surface area, directly addresses the uploaded data, and enables the later grounded-teaching work. The next slice should be server-side pricing/entitlement hardening, followed by persistent chat and streaming fixes. Live voice should be implemented only after the text teaching and persistence contracts are stable.
