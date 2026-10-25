# LenxiQ Live Class — implementation and visual direction

## Product outcome

Build `/voice?mode=class` as an advanced visual medical classroom: natural tutor speech is accompanied by one concept-matched view at a time—3D anatomy or organ systems, an approved drug–target structure, a physiology simulation, medical media, original pathology/histology/cytology schematics, or a concise interactive whiteboard. The workspace follows the *currently explained concept*, not the learner's course label: a hematology lesson can switch into pharmacology or chemical pathology without leaving an unrelated blood model on screen. If no approved visual matches a topic, the tutor's current explanation becomes the whiteboard content.

## Architecture and project structure

- `app/voice/page.tsx`: LiveKit lifecycle, short-segment assistant transcript routing, data-channel commands, learner feedback, pre-class transition, and floating controls.
- `app/api/voice/token/route.ts`: dispatch tutor metadata with concrete approved assets, model-specific caveats, visual commands, interaction topics, course/focus context, and uploaded materials.
- `lib/voice/live-class-visuals.ts`: typed asset registries, HTTPS allowlists, transcript-to-stage selection, and chemical-pathology/pharmacokinetics whiteboard routing.
- `lib/voice/live-class-model-catalog.ts`: human-readable asset topics, titles, source URLs, licenses, ligands, and attribution.
- `components/LiveClassVisualStage.tsx`: dominant stage router for 3D models, pharmacology, physiology, medical media, and concept whiteboards.
- `components/AnatomyViewer.tsx`, `components/MoleculeViewer.tsx`, and `components/Whiteboard.tsx`: touch-friendly rotation/zoom/focus, drug–target exploration, selectable explanation points, and zoomable tutor-synced board.
- `scripts/` and `.github/workflows/extract-z-anatomy.yml`: reproducible licensed model extraction, original schematic generation, geometry validation, per-file and total-size budgets, manifest provenance, storage preflight, and Supabase uploads without changing bucket visibility.
- `lib/curriculum/` and upload route handlers: shared file-type validation, legacy Word parsing, and Live Class `.doc` text conversion.
- `pipecat-voice-agent/agent.py` and `agent_modal.py`: metered LiveKit speech turns and the separately deployed Modal worker; voice-model configuration must be explicitly Gemini or Groq, with no GPT fallback.

## Design direction

**Design movement:** premium cinematic medical-lab instrumentation, not a generic neon dashboard. **Core principles:** one dominant teaching visual; quiet chrome; clinically legible contrast; every state responds to the active explanation. **Color philosophy:** near-black navy (`#070B13`) gives anatomy depth; slate glass keeps controls unobtrusive; warm amber (`#E8A23D`) marks focus; model colors stay source-faithful where possible. **Layout paradigm:** edge-to-edge stage with minimal overlays, a centered frosted-glass voice dock at the bottom, and restrained lab-status/header elements. **Signature elements:** amber focus highlights, the compact `VISUAL LIVE CLASS` badge, and a translucent glass dock with soft edge lighting. **Interaction philosophy:** drag, pinch, or scroll to manipulate 3D models; focus structures; select and zoom the whiteboard's explanation cards; learner interaction packets accompany model changes. **Animation:** a short badge-into-the-lab transition and restrained stage transitions; loading states appear in-canvas instead of showing a blank panel. **Typography:** retain the app's sans-serif system; tracked uppercase labels pair with clear, high-contrast lesson titles and explanations. **Brand essence:** “LenxiQ turns MBBS concepts into manipulable visual labs”; the tone is clinical, immersive, and calm. Preserve the existing LenxiQ wordmark and use only a restrained orbital focus-ring motif.

## Asset policy

Target catalog: **25 assets**—16 anatomy models (11 system exports, four Z-Anatomy organs, and the separately licensed HRA kidney), six original pathology/histology/cytology schematics, and three CC0 RCSB PDB structures for beta-2 receptor/carazolol, acetylcholinesterase/donepezil, and DHFR/methotrexate. The original schematics are clearly labelled as simplified teaching aids, not diagnostic imagery. The HRA kidney carries its model-level CC BY 4.0 attribution. Z-Anatomy-derived BodyParts3D meshes are attributed and distributed under the embedded CC BY-SA 2.1 Japan share-alike terms, while the Zenodo record's CC BY 4.0 metadata is retained in the manifest. RCSB structures carry PDB IDs and CC0 attribution.

The workflow rejects missing/empty meshes, objects over 48 MB, and projected total project storage beyond 250 MB. This leaves substantial headroom in this project's own buckets; storage usage across other Supabase projects in the organization is not available from the credentials used, so it is not assumed. Bucket visibility is not changed by the upload workflow.

## Current repair scope

Live Class must leave `THINKING` when assistant text arrives, even if the companion state packet is lost, and must surface a recoverable timeout rather than spinning indefinitely. The initial greeting must not be overwritten by a late startup state update. Voice model configuration must accept only Gemini or Groq and log the selected provider/model without logging credentials. Preserve existing Premium voice-minute metering, shared AI budget gates, spend caps, and alerting; do not automatically retry a failed model call or alter user credits. The Next.js website deploys from GitHub to Vercel; the Pipecat worker is a separate Modal deployment and requires its own authorized deployment access.
