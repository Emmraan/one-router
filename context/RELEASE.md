# MVP release checklist

Status: Phase 10 in progress on `phase-10-hardening`. **Release blocked.**
No MVP tag, npm publication, or GitHub release has been created.

## Required evidence

| Check | Evidence / remaining work |
|---|---|
| Full phase gate | Local gates passed on the final revision: 691 tests, lint (three existing warnings), typecheck, build, JS 188.1 KB gzip, CSS 7.1 KB, audit gate, docs check, shared target smoke. CI 46165166603 passed quality on Node 24 and 26, integration, E2E, visual, and web budget; CLI package 46165166616 passed. |
| Shared target suite | Built CLI passed locally on the final revision. Run 46165166585 passed clean Node 24 tarball, Docker lifecycle, systemd, and runtime budgets. Those jobs are now promoted to permanent `release-verification.yml`; rerun on the promoted workflow required. Hosted preview failed for missing credentials. |
| OS conformance | CLI package 46165166616 passed Ubuntu, Windows, macOS, and Alpine on the final revision. |
| Docker lifecycle and image | Run 46165166585 passed image/lifecycle checks. N-1 uses Phase 7 source until a previous image tag exists. |
| systemd lifecycle | Run 46165166585 passed. Real VPS/TLS remains owner-declined and unverified. |
| Vercel + Turso + S3 | Dedicated preview and secrets required. Missing credentials must fail, not skip. Preview verification pending. |
| Runtime budgets | Latest local gate: 96,063,488 bytes (about 92 MiB) idle RSS, authenticated API p95 6.1 ms over 50 samples after 10 warmups. The Ubuntu budget job passed on the final revision and is now permanent. Local bootstrap is diagnostic only; Vercel cold start <=2 s still unverified. |
| Audit / supply chain | Current audit: zero high/critical; one moderate esbuild development-server advisory, previously accepted. Lockfile changes accompany manifests. Installed lifecycle inventory found esbuild/unrs-resolver postinstall scripts; remaining dependency entries are prepare scripts, which registry installs do not execute. The first-party CLI prepack rebuilds after release versioning. Frozen CI install passed on the final revision. |
| Security pass | Four high findings reproduced and fixed below (findings 1, 2, 7, and 8). Final adversarial review of the remaining checklist areas found no new high or critical issues; finding 11 is accepted as low. Final CI passed on the newest revision. |
| Release automation | CLI-only semantic-release configuration; npm publish depends on NPM_TOKEN. Main-only workflow requires an explicit ready marker in this checklist and successful required check runs for the same revision, including hosted preview; skipped checks fail. Configuration/readiness tests passed, including rebuilding the CLI with the version written before packing. Verification jobs are now permanent, so the required checks exist on `main`. Actual release remains blocked on hosted and owner-run evidence. |
| Live providers | Owner-run only, no live network in tests. OpenAI, Anthropic, Gemini, and Ollama smoke pending. |
| Backup/restore | Shared suite checks portable encrypted archive merge restore. Whole-data-directory/Turso/S3 disaster recovery still needs owner sign-off. |
| Upgrade / uninstall | Existing Docker and CLI scripts cover lifecycle, preserved data, and uninstall; CI passed on the final revision. Owner manual sign-off pending. |
| Landing | Layout/preview unchanged. Copy reviewed: npm remains explicitly unavailable until the first release; no unsupported hosted-verification claim was added. Provider docs now describe the loopback-only local Ollama exception. |

## Success criteria

Prior phase evidence is not a substitute for final release verification.

| Criterion | Current evidence / release gap |
|---|---|
| SC-1 | CLI smoke and browser flow passed in CI; registry install waits for publication. |
| SC-2 | DB encryption tests and persistence smoke passed in CI. |
| SC-3 | Web cutover E2E passed in CI. |
| SC-4 | Four provider fixtures and gateway tests passed; owner-run live provider smoke pending. |
| SC-5 | Vercel artifact previously verified; hosted Turso/S3 preview unverified. |
| SC-6 | Docker volume lifecycle passed on the final revision. |
| SC-7 | Archive tests and local shared-suite export/merge restore passed. |
| SC-8 | Upload/storage fixtures and local text upload passed. Real S3 and the hosted target matrix are pending. |
| SC-9 | Enhance fixture/browser tests passed in CI. |
| SC-10 | Chat/temp-mode tests passed in CI. |
| SC-11 | Windows visual baselines passed in CI. |
| SC-12 | Network O assets shipped and previously checked. |
| SC-13 | Full local hardening gate passed with 691 tests; CI passed on the final revision. |
| SC-14 | Source-length/lint gate passed locally. |
| SC-15 | CLI release configuration/readiness tested and guarded workflow added; actual release pending. |
| SC-16 | Audit reports all severities and blocks high/critical; current audit passes. |
| SC-17 | Minimal README/local SVG preview unchanged; build checks passed locally. |
| SC-18 | Owner approved supported-major exceptions: TypeScript 7 is outside typescript-eslint's supported range (<6.1); eslint-plugin-react excludes ESLint 10; Node types follow the Node 24 target. Compatible patch/minor updates applied. Revisit when peers support the newer majors. |
| SC-20 | Uninstall docs and CLI/Docker/systemd smoke passed in CI; owner manual sign-off pending. |
| SC-21 | Shared HTTP suite passed for the tarball, Docker, and systemd targets; hosted preview pending. Full browser suite currently runs on local fixtures only. |
| SC-22 | Docker lifecycle script retained; run 46165166585 passed on the final revision, now in permanent verification. |
| SC-23 | Docs build passed; 19 registered command blocks across 25 pages verified locally. |

SC-19 is post-MVP and is not a release requirement.

## Numbered security findings

1. **High, fixed: concurrent password-check memory exhaustion.** Send simultaneous `POST /api/auth/login` requests with different forged `X-Forwarded-For` values. Each previously started a 128 MiB scrypt operation; three requests all reached password verification. Smallest fix: one shared in-flight admission slot for login/password-change work per server instance, released in `finally`, with `429` and `Retry-After: 1` for concurrent work. Admission happens after bounded body parsing: a regression test also reproduced and prevents a slow body from reserving the slot. Real-libSQL regression tests proved red before the fixes. Distributed account lockout remains database-backed; this is not a global serverless concurrency guarantee.

2. **High, fixed: arbitrary credential reflection in provider failures.** A fixture upstream returns a bare key without a known prefix in a 502 response, throws it during stream reads, or includes it in a discovery connection error. The server previously returned that exact string despite pattern-based redaction. Smallest fix: never expose upstream-controlled error text; return a fixed public error while retaining HTTP status/code where available. Regression tests cover HTTP, streams, discovery, and gateway failures without network access. Existing redaction tests now assert the stronger fixed-message contract.

3. **Low, previously accepted in Phase 7: inline styles.** HTML `style-src` retains `unsafe-inline` for React, KaTeX, and Mermaid. Script execution uses per-page hashes and does not permit `unsafe-inline` or `unsafe-eval`. Documented in the security page and guarded by static-host tests.

4. **Medium, fixed with owner approval: private DNS resolution and rebinding.** A public provider hostname can resolve to a private address despite passing literal URL checks. The new connection-time lookup validates the entire DNS answer set and supplies only validated addresses to the socket; mixed private/public answers fail closed. New connections repeat validation, avoiding a separate unchecked DNS resolution. Fixture tests cover private IPv4/IPv6, mapped addresses, mixed answers, a later rebinding answer, and the Ollama localhost exception, including case and trailing-dot forms. Final CI passed on the final revision.

5. **Medium, fixed with owner approval: forwarding-header throttle bypass and unbounded counters.** Rotating forged `X-Forwarded-For` values previously bypassed address counters and grew their map. Red real-DB regressions reproduced both. Forwarding headers are now ignored by default; an explicit trusted-proxy option requires exclusive proxy access and header replacement. Counters are capped at 1,000 addresses, reject new entries at capacity without evicting live counters, and recover after expiration. Final CI passed on the final revision.

6. **Low, fixed with owner approval: stream cache directive.** A red fixture-stream regression proved global middleware lost `no-transform`. SSE now receives `Cache-Control: no-store, no-transform`; non-stream APIs retain `no-store`. Final CI passed on the final revision.

7. **High, fixed: configured session expiry was extended silently.** Set `ONE_ROUTER_SESSION_DAYS=1`, log in, access an authenticated route after 61 minutes, then replay the cookie two days later. The database touch used a fixed 30-day lifetime, so the policy-expired credential still returned `200` instead of `401`. A real-libSQL regression proved this red. Smallest fix: pass the configured lifetime to the session touch, validate it like session creation, and keep database and cookie expiry aligned.

8. **High, fixed: provider streams ignored client backpressure and left upstream work running.** A fixture provider stream with `highWaterMark: 0` was pulled 32 times while the consumer read nothing, and cancelling the output did not cancel the source. In non-streaming collection, an 8 MiB overflow rejected but did not cancel the provider stream, so a malicious or broken upstream could keep reading until the request deadline. Smallest fix: pull-based normalization, redaction, and gateway wrappers emit one frame per pull and propagate cancellation; collection cancels on every exit and counts flushed events toward its limit. Regression tests cover core chat, chat redaction, the gateway stream, and collection overflow. Final CI passed on the final revision.

9. **Medium, fixed with owner approval: unbounded model discovery.** A discovery response with a false `Content-Length: 1` streamed more than 2 MiB and was still parsed; a response with 10,000 models succeeded. Discovery now reads actual bytes with fatal UTF-8 decoding, cancels at more than 2 MiB, and rejects more than 1,000 models instead of truncating. The owner approved both limits, and regression tests cover the lying length and the oversized model list. Final CI passed on the final revision.

10. **Medium, fixed: SSE event data grew without an event separator.** A provider sending many short `data:` lines and no blank line accumulated an unbounded data array even though each line and the chunk buffer stayed under the existing limit. The parser now caps total data per event at the same 1 MiB limit and resets the count on dispatch. A regression test reproduces the separator-less growth. Final CI passed on the final revision.

11. **Low, accepted: unauthenticated version disclosure.** `GET /health` returns the package version without a session. Reproduction: request `/health` and read `version`. The version is already public in the npm package and repository, and the response exposes no configuration, data path, or secret. Accepted as informational; no change.

## Dependency justification

`semantic-release` and its changelog, commit-analyzer, git, GitHub, npm, and release-notes plugins implement the planned version/tag/changelog/artifact publication lifecycle. The stdlib and installed build tools do not provide that release protocol. All are development-only and pinned.

`undici` is a pinned server/CLI runtime dependency because Node's built-in fetch does not expose a public constructor for a per-client DNS-validating dispatcher. Its connector preserves fetch streaming, TLS host verification, and connection-time address validation without implementing a second HTTP client. No vendor SDK or client bundle dependency was added.

## Final sign-off

- Required jobs must pass for the release revision. A skipped job is not green.
- Verification jobs are promoted to `release-verification.yml`; the scratch workflow is removed. Run them on the release revision.
- Record the owner-run provider, backup/restore, upgrade, uninstall, and deployment outcomes without storing credentials.
- Only after evidence and owner approval, change the status to `Status: Ready for release.`; the release workflow otherwise fails closed.
- The owner approved fixing findings 4 to 6 and keeping supported compiler/linter majors; final verification is still required.
- Do not merge, tag, publish, or empty PLAN/PROGRESS while release requirements remain incomplete.
- Keep main local until the owner releases it. Only the phase branch may be pushed for CI verification.

## Owner-run checks

Use a disposable deployment and provider account. Do not paste keys, session cookies, or archive passphrases into the evidence record.

1. Configure OpenAI, Anthropic, Gemini, and Ollama through Settings. For each, discover models, send one short chat, stop a stream, and try one invalid credential. Confirm that errors do not expose the key and that the provider dashboard matches the response. Exercise the same configured model through the documented authenticated gateway client. Record provider/model, date, and pass/fail only.
2. Export an encrypted archive containing a chat, attachment, and provider configuration. Restore into an empty disposable instance and compare the chat, attachment bytes, and masked provider configuration. Attempt a wrong passphrase and confirm no data is imported. Retain neither the test passphrase nor a plaintext key in the record.
3. Back up the complete data directory while stopped, including its encryption key, then restore to a second instance. For Turso/S3, restore both database and objects, keeping the encryption key available separately. Verify the restored attachment and chat before deleting the disposable copy.
4. With an N-1 deployment, create a chat and attachment, stop it, upgrade without deleting data, and verify both. Until an N-1 release exists, record that the lifecycle test uses the prior implementation commit rather than a published release.
5. Follow the matching uninstall page for every install target. Confirm processes, service units, or deployments are removed, preserved data survives the non-purge path, and only explicitly selected disposable data is deleted on purge.
6. On a real HTTPS deployment, inspect HSTS, secure cookies, same-origin rejection, and unbuffered streaming through the proxy. A fixture or local HTTP test is not TLS evidence; record owner-declined VPS/TLS verification as unverified.
