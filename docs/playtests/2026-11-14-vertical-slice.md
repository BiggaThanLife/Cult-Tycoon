# Playtest report — vertical slice (automated)

Run: `npm run build && npm run e2e` (Playwright, Chromium, real mouse taps and drags). Result: **29/29 checks passed.**

Verified, in order: welcome → place Sermon Hall → collect → ritual 1 with a real swipe → rotate to landscape mid-ritual (board identical) →
second swipe in landscape → draft 1 of 3 → ritual 2 → two more drafts (3 followers, all with traits) → Suspicion rose →
Greenhouse → plant 2 crops → merge by drag to Manifesto → rotate mid-merge (grid identical) → harvest → Alchemy Lab → brew →
reporter event → Suspicion fell → ritual 3 → Mothman intro → both orders → Compound Lv 2 → reload one hour later → Welcome Back summary →
clock rollback grants nothing → Ascension preview → debug panel. Each tab screenshotted at 390×844, 844×390 and 1280×720; integer pixel scale at all three.

Not verified by automation: real touch devices, notch safe areas on hardware, 60fps on a mid-range phone, audio (none yet),
winning rituals by play alone (rituals 1–3 are completed via the debug win after real swipes; solvability is covered by the validator).
