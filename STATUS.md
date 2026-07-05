# STATUS — Field Journal

_Cycle 2 · 2026-07-05_

## Checker cycle 1 — results
Three fresh-context adversarial checkers attacked the running app:

- **Full-loop + wrong-bird checker: PASS** on all claims (cold load → capture →
  identify → confirm → celebration → collection → offline reopen intact;
  not-a-bird & blurry handled, override + manual naming work, queued offline
  capture identifies on reconnect). Found 3 defects → **all fixed**:
  double-tap confirm corrupted life-list counts (now idempotent recount),
  double-tap identify filed phantom duplicates (debounced), orphaned
  not-a-bird records leaked storage (purged on load).
- **Flip-through checker: PASS** ("reads as a hand-painted keepsake").
  Found 5 defects → **all fixed**: share-card text clipping (wrapped +
  truncated), fixed-height notes textarea (auto-grows), map pin pile-ups
  (collision-relaxed layout + species legend), demo photos not matching
  species shape/time (shape- and time-aware), tablet map emptiness (legend).
- **Design/screenshot checker: FAIL** with 6 violations → **all fixed**:
  native webkit search-clear X (suppressed), default orange focus rings
  (hand-dashed sepia focus language + pigment underline on inputs), camera
  feed escaping the painted viewfinder (organic corners, snug frame),
  tablet capture layout collision (viewport-capped viewfinder), content
  bleeding through bottom nav (opaque paper shelf), delete dialog surviving
  navigation (Escape/backdrop/route cleanup for all overlays).

All fixes verified on real pixels (`test/shots/fix-*.png`) and the scripted
suites still pass (`fullloop.js` ALL PASS, `identify-core.test.js` 8/8).

## Current gap
Design checker must re-attack from fresh context — it FAILED cycle 1, so its
verdict needs to flip to PASS on the fixed app. Regression checker re-runs
the functional attacks.

## Latest screenshots
`test/shots/` — `phone-*`, `tablet-*`, `loop-*`, `fix-*`, `checker*-*`.

## What's next
1. Checker cycle 2: fresh design checker + regression checker.
2. Fix anything found; repeat until nothing fails.
