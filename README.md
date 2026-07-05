# Field Journal 🐦

A mobile-first, installable, offline-capable bird watching PWA that looks and
feels like a hand-painted naturalist's field journal. Every screen, icon,
button, and empty state is procedurally painted — watercolor washes with
turbulence-displaced edges, paper grain, pigment blooms, and ink-line accents.
No component library, no stock art, no hotlinked images.

## The loop

Spot a bird → capture a photo (live camera, or seamless upload fallback) →
the Anthropic vision API identifies the species → you confirm (or override,
or pick from candidates when confidence is low) → the sighting lands in your
journal as an illustrated entry with your photo, a watercolor rendering of
the species, date/time/location, and your field notes. New species get a
celebration. The journal grows into a life list, a painted sighting map,
streaks, badges, a seasonal almanac, and shareable journal-page cards.

Everything except the identification round-trip works fully offline;
offline captures queue and identify themselves when a connection returns.

## Run it

```bash
# demo mode (no key): identification is mocked and labeled "demo" in the UI
node server.js

# real identification via the Anthropic vision API (claude-sonnet-4-6)
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Open http://localhost:8787. Add `?seed=demo` to fill the journal with sample
sightings, `?seed=clear` to empty it.

**Where the key goes:** the `ANTHROPIC_API_KEY` environment variable, read by
`server.js` (or by `api/identify.js` on Vercel-style hosts — set it in the
deployment's environment settings). The key never reaches the browser; the
client only ever calls `/api/identify` on its own origin.

## Deploy as an installable phone app

Any static host + one serverless function:

- **Vercel:** push this repo, set `ANTHROPIC_API_KEY` in Project → Settings →
  Environment Variables. The `api/` directory provides `/api/identify` and
  `/api/health`; everything else is static.
- **Any Node box:** `ANTHROPIC_API_KEY=... node server.js` behind HTTPS.

HTTPS is required for camera access and PWA install. On iOS Safari use
Share → *Add to Home Screen*; on Android Chrome accept the install prompt.

## Stack

No build step, no runtime dependencies. Vanilla ES modules, IndexedDB for
local-first storage, a hand-rolled service worker for offline, and a
procedural watercolor engine (`js/art/`) that paints every visual, including
per-species bird illustrations for ~35 species (unknown species are painted
from plumage colors and traits the vision model reports).

## Tests

```bash
npm install            # playwright-core only (uses the preinstalled Chromium)
node test/shots.js     # screenshots of every screen, phone + tablet
node test/fullloop.js  # scripted full-loop + offline + wrong-bird tests
node test/gen-icons.js # regenerate PWA PNG icons from icons/icon.svg
```

See `STATUS.md` for the current build/verify cycle status.
