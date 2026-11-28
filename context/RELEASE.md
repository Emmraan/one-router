# MVP release checklist

Status: Phase 10 in progress on `phase-10-hardening`. **Release blocked.**
No MVP tag, npm publication, or GitHub release has been created.

## Required evidence

| Check | Evidence / remaining work |
|---|---|
| Full phase gate | Baseline green: 641 tests, JS 184.4 KB gzip, CSS 7.1 KB; rerun after hardening. |
| Shared target suite | Built CLI passed locally: bootstrap, auth, headers, chat/message persistence, encrypted upload, archive export/import, restart. Clean Node 24 tarball, Docker, and preview CI pending. |
| OS conformance | Phase 9 CI passed Windows, macOS, Ubuntu, Alpine; Phase 10 rerun pending. |
| Docker lifecycle and image | Scratch job added; Docker is unavailable on this Windows host. N-1 uses Phase 7 source until a previous image tag exists. |
| systemd lifecycle | Scratch job added; Ubuntu CI pending. Real VPS/TLS remains owner-declined and unverified. |
| Vercel + Turso + S3 | Dedicated preview and secrets required. Missing credentials must fail, not skip. Preview verification pending. |
| Runtime budgets | Local CLI: about 89 MiB idle RSS; warm authenticated API p95 6.7 ms over 50 samples after 10 warmups. Fresh local bootstrap 1.90 s is diagnostic only. Ubuntu measurements pending; Vercel cold start <=2 s still unverified. |
| Audit / supply chain | Zero high/critical before freshness updates; one moderate esbuild development-server advisory, previously accepted. Lockfile changes accompany manifests. Installed lifecycle inventory found esbuild/unrs-resolver postinstall scripts; remaining entries are prepare scripts, which registry installs do not execute. Final frozen install and audit pending. |
| Security pass | Three high findings reproduced and fixed below. Remaining adversarial areas still need final review. |
| Release automation | Tested CLI-only semantic-release configuration; npm publish depends on NPM_TOKEN. Required-check release workflow and scratch-job promotion pending CI evidence. |
| Live providers | Owner-run only, no live network in tests. OpenAI, Anthropic, Gemini, and Ollama smoke pending. |
| Backup/restore | Shared suite checks portable encrypted archive merge restore. Whole-data-directory/Turso/S3 disaster recovery still needs owner sign-off. |
| Upgrade / uninstall | Existing Docker and CLI scripts cover lifecycle, preserved data, and uninstall; Phase 10 CI pending. |
| Landing | No layout or preview changes in Phase 10 so far. Final copy/claim review pending. |

## Success criteria

Prior phase evidence is not a substitute for final release verification.

| Criterion | Current evidence / release gap |
|---|---|
| SC-1 | CLI smoke and browser owner flow; registry install waits for publication. |
| SC-2 | DB encryption tests and persistence smoke; final CI pending. |
| SC-3 | Web cutover tests; final browser rerun pending. |
| SC-4 | Four provider fixtures and gateway tests; owner-run live provider smoke pending. |
| SC-5 | Vercel artifact previously verified; hosted Turso/S3 preview unverified. |
| SC-6 | Docker volume lifecycle previously verified; Phase 10 rerun pending. |
| SC-7 | Archive tests and local shared-suite export/merge restore passed. |
| SC-8 | Upload/storage fixtures; local text upload passed. Real S3 and final target matrix pending. |
| SC-9 | Enhance fixture/browser tests; final rerun pending. |
| SC-10 | Chat/temp-mode tests; final rerun pending. |
| SC-11 | Phase 9 Windows visual baselines; final rerun pending. |
| SC-12 | Network O assets shipped and previously checked. |
| SC-13 | Baseline full gate passed; final hardening gate pending. |
| SC-14 | Existing source-length gate; final lint pending. |
| SC-15 | CLI release configuration tested; release workflow and actual release pending. |
| SC-16 | Audit reports all severities and blocks high/critical; current audit passes. |
| SC-17 | Minimal README and local SVG preview unchanged; final build checks pending. |
| SC-18 | Registry freshness reviewed; compatible patch/minor updates selected. TypeScript 7 is outside typescript-eslint's supported range (<6.1); eslint-plugin-react excludes ESLint 10; Node types follow the Node 24 target. Compatibility exceptions require an owner decision. |
| SC-20 | Uninstall docs and CLI/Docker/systemd smoke exist; final CI pending. |
| SC-21 | Shared HTTP suite wired to tarball/Docker/preview; clean-container and hosted runs pending. Full browser suite currently runs on local fixtures only. |
| SC-22 | Docker lifecycle script retained; scratch CI pending. |
| SC-23 | 19 registered command blocks previously verified; final docs build/check pending. |

SC-19 is post-MVP and is not a release requirement.

## Numbered security findings

1. **High, fixed: concurrent password-check memory exhaustion.** Send simultaneous `POST /api/auth/login` requests with different forged `X-Forwarded-For` values. Each previously started a 128 MiB scrypt operation; three requests all reached password verification. Smallest fix: one shared in-flight admission slot for login/password-change work per server instance, released in `finally`, with `429` and `Retry-After: 1` for concurrent work. Admission happens after bounded body parsing: a regression test also reproduced and prevents a slow body from reserving the slot. Real-libSQL regression tests proved red before the fixes. Distributed account lockout remains database-backed; this is not a global serverless concurrency guarantee.

2. **High, fixed: arbitrary credential reflection in provider failures.** A fixture upstream returns a bare key without a known prefix in a 502 response, throws it during stream reads, or includes it in a discovery connection error. The server previously returned that exact string despite pattern-based redaction. Smallest fix: never expose upstream-controlled error text; return a fixed public error while retaining HTTP status/code where available. Regression tests cover HTTP, streams, discovery, and gateway failures without network access. Existing redaction tests now assert the stronger fixed-message contract.

3. **Low, previously accepted in Phase 7: inline styles.** HTML `style-src` retains `unsafe-inline` for React, KaTeX, and Mermaid. Script execution uses per-page hashes and does not permit `unsafe-inline` or `unsafe-eval`. Documented in the security page and guarded by static-host tests.

4. **Medium, previously recorded: DNS resolution is not pinned.** Configure a public provider hostname whose DNS resolves to a private address. Literal URL checks alone cannot prevent this. The owner controls provider configuration; use outbound network restrictions. Resolver pinning remains unresolved and requires a release decision, not an implied claim of complete SSRF protection.

5. **Medium, pending decision: address throttle trusts forwarding headers.** Direct backend access allows rotating `X-Forwarded-For` values to bypass address counters and grow their map. Account lockout and password-work admission still apply. Smallest deployment mitigation: loopback/private binding and a proxy that replaces forwarding headers. A bounded map and trusted-proxy policy should be considered before release.

6. **Low, pending decision: stream cache directive.** Global API middleware replaces route-level `no-cache, no-transform` with `no-store`. Reproduce with a fixture chat stream and inspect `Cache-Control`. Data is not cached, but `no-transform` is lost. Smallest fix: preserve `no-transform` for SSE while enforcing `no-store`.

7. **High, fixed: configured session expiry was extended silently.** Set `ONE_ROUTER_SESSION_DAYS=1`, log in, access an authenticated route after 61 minutes, then replay the cookie two days later. The database touch used a fixed 30-day lifetime, so the policy-expired credential still returned `200` instead of `401`. A real-libSQL regression proved this red. Smallest fix: pass the configured lifetime to the session touch, validate it like session creation, and keep database and cookie expiry aligned.

## Dependency justification

`semantic-release` and its changelog, commit-analyzer, git, GitHub, npm, and release-notes plugins implement the planned version/tag/changelog/artifact publication lifecycle. The stdlib and installed build tools do not provide that release protocol. All are development-only and pinned; no runtime dependency was added.

## Final sign-off

- Required jobs must pass for the release revision. A skipped job is not green.
- Promote proven scratch jobs into permanent CI and remove the scratch workflow.
- Record the owner-run provider, backup/restore, upgrade, uninstall, and deployment outcomes without storing credentials.
- Discuss and decide the non-high findings above before implementing further fixes.
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
