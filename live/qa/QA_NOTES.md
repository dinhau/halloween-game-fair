# v4 QA scope

## Completed

- Node v22.16.0 syntax checks for server, inline display code, and client scripts.
- `npm test`: 18 tests passed, 0 failed. Covers scoring boundaries, authorization, pairing approval, idempotent arm/start/finish/gift, stale round IDs, single-attempt locking, manual next, interruptions, timing mismatch, unpair, security headers and static routes.
- QR version10/M/mask0 matrix compared bit-for-bit with the installed Python `qrcode` implementation for a realistic pairing URL; exact match.
- Chromium isolated-document testing with two separate browser contexts, viewport 1920×1080 and 390×844: pairing/approval, eligibility checkboxes, actual monotonic touch timing, 9.97s success screenshot, early-stop failure screenshot, gift registration and next-round flow were exercised. Mobile screenshot and geometry showed no horizontal overflow.

## Important limitations

Direct Chromium navigation to the local Node service was blocked by the environment (ERR_BLOCKED_BY_ADMINISTRATOR). This restriction was not disabled. For UI inspection only, documents were loaded in isolated test pages; their fetch calls were bridged to the real local Node backend and the browser's event stream was simulated with state polling. The genuine SSE endpoint was tested separately through Node HTTP requests. This is **not** a claim of a full real-browser/network/cloud E2E pass.

The full browser capture run did not finish cleanly: a 4K screenshot timed out, and other harness reruns had timing/capture waits. Existing success/failure/rules/phone screenshots were captured in the exercised paths. Do not claim an all-green full browser suite, 4K screenshot completion, physical phone testing, measured cloud latency, or successful deployment.

No GitHub writes, Render deployment, public URL creation, or paid resources were performed. Source is a deployment-ready candidate that still requires cloud and physical-device preflight before the school event.
