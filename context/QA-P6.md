# Phase 6 visual QA

Run against production static exports and the local fixture Hono server:

```powershell
pnpm build
pnpm test:visual
pnpm --filter @one-router/web e2e
pnpm budget
```

Visual baselines use Chromium on Windows, Segoe UI, en-US, UTC, and reduced
motion at 1440, 1024, and 768 pixels. The CI visual job uses Windows too.
Only update snapshots after inspecting the resulting images. Tests reject
external browser requests; the real local Hono server returns recorded content.

## Review checklist

- [x] Inspect dark and light empty workspaces at all three widths: no horizontal
  overflow, readable model names, sidebar actions, and composer.
- [x] Inspect provider drawer and form, model picker, settings, data, trash,
  confirmation, login error, and forced password change.
- [x] Inspect code, equations, and diagrams in a streamed transcript; verify
  controls remain visible on keyboard focus and virtual rows have real height.
- [x] Inspect the landing preview and compare its shell, fonts, colors, spacing,
  welcome copy, model trigger, and composer with the installed workspace.
- [x] Exercise Tab, Shift+Tab, Escape, Enter, model search arrows, and focus return
  after closing dialogs. Check visible focus and accessible control names.
- [x] Exercise system theme with both OS preferences, reload, and check the theme
  cookie. Verify reduced motion and that initial loading needs no remote assets.
- [x] Exercise offline and failed queries with retry, upload failure/retry/remove,
  editing, regeneration, prompt enhancement, temporary save/discard, and archives.
- [x] Check icons at 32, 180, 192, and 512 pixels and the social image at 1200x630.

## Results

November 27, 2026: inspected all 36 fresh reference images, the forced-password
screen captured by E2E, and the generated icons/social image. Provider actions fit
the 900-pixel viewport, dialogs retain readable controls, and the 768-pixel shell
has no horizontal overflow. Transcript snapshots mask timestamps and history.

The full local gate passed: lint (zero errors, three existing warnings), all
workspace types, 611 unit/integration tests, both static builds, smoke, budgets,
and audit (one moderate development-tool advisory; no high or critical findings).
Initial gzip: 184.4 KB JavaScript / 220 KB, 6.9 KB CSS / 50 KB. The local lazy-import
and animation boundaries pass. All 27 visual/behavior tests and 5 feature-parity
E2E tests pass against the production exports and local fixture provider.

The malformed-link regressions pass after the fix, and all 27 visual checks pass
again without updating baselines. GitHub CI runs 46033417153 and 46033417155 pass
on work commit `a8f0e26`: Node 24/26 quality, real-DB integration, feature E2E,
client budgets, and Windows visual checks. The validated budget and visual jobs
are promoted into `ci.yml`; the scratch workflow is removed before merge.
Consolidated CI run 46034187695 also passes on promotion commit `c6910c0`, including
the promoted Windows visual and client-budget jobs.

## Adversarial review

1. **High, fixed:** repeated unfinished Markdown links
   rescanned their suffixes. Reproduce with `parseInline('['.repeat(100000))` or
   `parseInline('[x]('.repeat(25000))`: 13.5 and 5.2 seconds before the fix.
   Stop link labels/URLs at a new opener; preserve the remaining literal text.
   Both reproducing cases pass a generous one-second regression ceiling; the
   complete 10-case inline suite spends about 80 ms in tests after the fix.
2. **High, fixed:** a 10,000-item list, 3,000-column table, or 200 rich blocks
   bypassed the character-only renderer limit. The parser now shares a 1,000-unit
   block/list/cell budget, caps table columns at 40 and rich blocks at 20. Inline
   formatting has 1,000 parts and 20 equations per message. Reproducing tests pass.
3. **Medium, fixed:** the diagram source filter accepted a CSS-escaped `url()`
   expression. Reproduce using the escaped paint URL in `diagram-source.test.ts`.
   Reject backslashes, directives, links, image sources, and external schemes
   before the existing strict Mermaid sanitizer. Reproducing tests pass.
4. **Medium, fixed:** Tab could leave dialog controls and closing could lose the
   trigger focus. Model search also missed initial focus. Reproduce with repeated
   Tab in Settings and Escape from Settings/Providers/model picker. Native modal
   behavior now has explicit initial focus, wrapping, and restoration; browser
   checks pass at every width.
5. **Low, fixed:** the provider form's Save action was partly below the 900-pixel
   drawer viewport. Compact spacing and a sticky action row keep the full button
   visible; all three visual projects assert full viewport intersection.
6. **Low, fixed:** a tab after heading hashes produced an invalid heading level.
   Reproduce with `parseMarkdown('###\tHeading')`. Count the opening hashes;
   the pure regression and hostile-output browser case pass.

The hostile-output browser case verifies literal HTML, script links, untrusted
math commands, and diagram images remain inert; 99,999 combining/RTL characters
leave composer controls usable. Browser requests are restricted to local hosts.
Existing real-DB/auth/CSRF/SSRF/crypto/archive suites stay green; this phase adds
no production API, authentication, encryption, or database changes.

## Bounded behavior and remaining limitations

- The rich preview limits are intentional. Copy/export retain the complete text.
  Code highlighting stops at 20,000 characters; unknown languages remain plain.
- Diagrams reject configuration directives, network/image sources, and backslashes.
  Some advanced or escaped labels therefore fall back to visible source text.
- The model picker renders 100 search results; refining the query finds the rest.
- The three lint warnings are the existing TanStack compiler boundary and native
  authenticated attachment images. Static-host script CSP remains P8 work; the
  previously recorded owner-provider DNS policy is unchanged.
- `esbuild` has one moderate development-server advisory below the severity gate.
  No development server is shipped by the static production export.

## Dependency rationale

- `katex`: local equation rendering replaces the CDN; the platform has no TeX renderer.
- `mermaid`: local diagrams replace the CDN; the platform has no diagram layout engine.
- `highlight.js`: local grammar highlighting replaces the handwritten regex highlighter.
- `sharp` (development): rasterize the approved SVG into favicon, Apple/PWA and social assets.
