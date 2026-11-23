# Smiling thumbs-up duck

November 22: only the thumbs-up mascot uses happy curved eyes, hidden stern brows and an upward-curving smile inside its orange bill. Preserve the approved v11 head pixels/silhouette and other poses; profile/icon assets are unchanged. Keep the complete body, raised wing and existing reaction timing. Local original preview only, cache v132, mascot/CSS query versions refreshed.

PASS: Playwright MCP Chromium 157.0.8103.79, isolated local Calendar at 1156×1000 and 390×1000. Completed a sample task and inspected its actual delayed reaction: smile and curved eyes visible, stern brows/open eyes hidden, raised wing/full body retained, v11 head artwork retained. Reaction cleans up on its existing timing with no page errors. Default happy pose keeps its existing eyes/brows and hides the smile. Rendered comparison screenshot visually inspected; mascot JavaScript syntax, both existing cache tests and git diff --check pass.

Reproduce by completing Sample: Calculus practice at `?demo=completion-20261122-9#calendar`, waiting for `.completion-duck-reaction`, then checking the display of its `.duck-smile`, `.duck-closed-eyes`, `.duck-brows` and `.duck-open-eyes`. Verification results recorded alongside this file. Native/PWA/physical devices and hosted checks are NOT RUN for this local presentation change; no app sync/public deployment.
