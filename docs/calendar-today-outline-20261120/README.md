# Due outline only on today

November 20, 2026, following 468d371. Local website only. Due count tabs retain their red tint on every date, but the decorative red border appears only on the actual current date. This uses the existing aria-current=date marker on timetable headings and phone date buttons, independently of the selected day. A transparent border reserves the same geometry elsewhere. Keyboard focus remains visible in DuckPlan's gold, avoiding a red focus outline on other dates. Cache v111; CSS today-due-outline-20261120.

PASS: Playwright MCP Chromium 157.0.8103.79, isolated local fixtures, Los Angeles timezone, 1156×746 desktop and touch-emulated 390×844 phone. Twenty light/dark cases covered today, selected yesterday/tomorrow, mixed Week headings, a next week without today, and phone selection of tomorrow while today stays outlined in the selector. All other-date decorative borders stayed transparent; tints and 2px reserved geometry stayed intact. See results.json and screenshots. Existing calendar-selection/PWA suites: six passed; git diff --check passed.

PASS: actual keyboard Tab navigation to a future Due tab keeps its decorative border transparent and shows the gold focus outline. Programmatic focus after a pointer click does not require a focus-visible ring; the check uses keyboard navigation. focus-results.json.

No data/API changes, public deployment, native sync or installation. Native/physical devices, other browser engines and installed-PWA surface NOT RUN for this CSS adjustment.
