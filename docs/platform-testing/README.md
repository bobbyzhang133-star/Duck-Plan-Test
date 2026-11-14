# DuckPlan feature and platform testing procedure

This is the required procedure for investigating broken features, synchronizing the iPhone app and preparing releases. It defines acceptance checks; it does **not** claim any current platform or feature has passed them.

The aim is to test what the user can do in the runtime they use. Compilation proves the bundle can be built. Screenshots prove particular rendered states. A mocked native transport proves its tested request behavior. None of those alone proves that saving or scheduling a template works in an installed app against its actual backend.

## Choose a proportionate gate

For a small isolated presentation change, check the affected control/layout, its focus and input behavior, relevant asset/cache handling and existing focused tests. Do not repeat every feature merely because one border changed.

For a feature repair, first reproduce the reported action and error in the affected runtime and account mode. Test its successful path, persistence and relevant failure path after fixing it. Add coverage for shared layers it touches.

For a release, a complete web-bundle sync, or changes to storage, account handling, backend schema or the native bridge, run the full feature baseline below across the intended platform/mode combinations. Existing evidence may be reused only when its exact inputs remain unchanged and the dependency change cannot invalidate it; record that reuse explicitly.

## Establish the tested versions

Record the canonical website commit and checkout, requested release scope and expected cache/asset versions. Record each actual browser/OS/runtime version, viewport/orientation, input method and account mode.

For the bundled app, identify the existing Xcode project and expected website source. Preserve native alarm/account customizations, signing and approved assets. Compare the resulting source files with the built app's `landing/` files and list every intentional native overlay. Record the build configuration and bundle hash/manifest. Verify the simulator/device is running that build; a successful build left on disk does not update an already installed app.

For signed-in tests, identify the actual API origin, running backend version and schema/migration readiness. Check that the deployed server supports the feature endpoints used by the tested frontend. Source in GitHub, a local fixture server and the hosted backend are separate versions. An old hosted backend returning 404 or schema errors is a failed dependency, even when local API and mocked bridge tests pass.

Use fresh isolated browser contexts, simulator app data or dedicated authorized test accounts. Keep user records, settings, local storage, credentials and signing intact. Never use real user production records as disposable fixtures; any hosted mutation checks must be scoped to a dedicated authorized test account. Never include passwords, session cookies, tokens or recovery codes in screenshots, logs or committed evidence.

### Read-only server compatibility gate

From the repository root, run:

```sh
node tools/check-server-compatibility.mjs --origin https://duckplan.duckplan-cloudflare.workers.dev --cookie-file /private/test-session.cookie
```

The private file must contain one Cookie header value for a dedicated authorized test account. Obtain it through that account's normal sign-in; keep it outside the repository, do not print or commit it, and remove it after testing. The tool performs only `GET /api/planner`, refuses redirects, times out after ten seconds and prints only contract metadata. It also checks the native bridge's JSON content type, UTF-8 and8,000,000-byte response requirements. Loopback HTTP fixture origins are also supported.

Exit 0 means the authenticated snapshot contains the current classes/items, organization/library and personal-planning groups. Exit 2 means authentication is required: **BLOCKED**, not a feature pass. Exit 1 means an incompatible/failed snapshot or invalid invocation. An anonymous 401 on a protected feature URL proves only its authentication gate. A successful contract check does not establish CRUD, database ownership, native UI, synchronization or physical-device delivery; run the relevant functional cases below as well. Check tracked migration readiness separately before deploying a Worker.

## Platform and mode coverage

Maintain a release ledger containing each intended combination, with the exact tested versions rather than a blanket “mobile” label:

- **Desktop browser:** the supported browser engines available to the project, with mouse and keyboard. Record which engines actually ran. One Chromium result does not establish Safari/WebKit or Firefox behavior.
- **Phone browser:** phone layout and touch actions. Emulation can establish those particular layout/input checks; label it as emulation. Use an actual supported mobile browser runtime/device for browser-specific storage, permission and OS behavior claims.
- **iPad browser:** portrait/landscape touch flows, the task column beside the timetable, scrolling and scheduling. A narrow desktop screenshot alone does not establish iPad behavior.
- **Installed PWA:** launch from the installed app surface, navigation/relaunch, service-worker update, local persistence and the supported offline paths. A normal browser tab is a different surface.
- **Native iPhone and iPad app:** run the built application in the corresponding WKWebView simulator/device runtime. Exercise the actual UI and native transport with controlled accounts/backend fixtures, then verify the intended hosted API contract separately. Record simulator results as simulator results.
- **Physical-device capabilities:** permission prompts, actual notification/alarm delivery, sound, lock-screen presentation, Stop/Snooze and OS lifecycle behavior require the appropriate physical device. Silent simulator previews, mocked permissions and unsigned compilation do not establish delivery.

Within the platforms that offer them, cover **local signed-out**, **signed-in**, and relevant **offline/reconnect** behavior. Do not assume cloud operations work offline if no queue exists: verify honest feedback and preservation of existing data. Preserve account isolation when switching modes or users.

Use the deployment target and supported-browser policy to select version coverage. If an engine, runtime or physical device is unavailable, record that case as BLOCKED or NOT RUN and narrow the completion claim accordingly. Do not mark it passed because another runtime looks similar.

## Full feature baseline

Keep the following cases in the release ledger, with platform/mode-specific outcomes and evidence:

- **Tasks:** create the intended task, edit its fields, complete/reopen and delete it; confirm the right task changes once, unrelated tasks remain unchanged, and saved data survives reload/relaunch. Include an invalid save and failed request so success is not reported falsely.
- **Task-list scheduling:** click task titles in both Calendar's task column and the Tasks list to open the correct editor; checkboxes still only toggle completion. Drag unscheduled work from each list onto the calendar, including holding over Calendar navigation from Tasks. Verify the same task ID/count, snapped time, class/color, due date, duration, notes and reminder preferences after reload. Check preview, Undo, cancellation/Escape, invalid drops, owner changes and failed saves. Retain visible keyboard focus without the rectangular pointer-click flash; verify the editor's work-date/time controls as a touch/keyboard alternative to dragging. Keep template copy-drag behavior distinct from moving an existing task.
- **Calendar:** open Day/Week/Month, change date/period, select scheduled work, reschedule through supported pointer/keyboard/touch paths and verify the saved date/time/duration after reload. Preserve the phone day selector and tablet side-by-side composition. Distinguish scheduled work from deadlines.
- **Assignment templates:** create/edit/save a template, reload, then use desktop drag and the visible touch/keyboard **Schedule** path. Each use must create one independent scheduled task with saved class/color/duration/notes/priority/reminder settings, retain the source template and avoid unintended deadline/alarm changes. Verify Add to tasks, management actions, cancellation, repeated use and persistence. Run this in the native app UI, not only its store mock.
- **Classes and resources:** create/edit a class, associate a task/template, add/edit/delete a resource and open an allowed resource link through the supported platform action. Verify class associations, class-colored blocks and account ownership after reload.
- **Task organization:** switch list/matrix views, change supported importance/urgency/preferences and confirm classifications and settings persist without duplicating tasks.
- **Goals:** Add Goal creates a goal rather than a task; edit progress/target, complete/reopen/delete as supported and reload. Confirm unrelated task counts and other goals remain unchanged.
- **Habits/check-ins:** Add Habit creates a habit; edit its schedule, check/uncheck the correct day, reload and confirm date-specific state. Test deletion/cascade behavior without altering unrelated habits or tasks.
- **Notes:** Add Note creates a note; save/edit/search/delete and reload/relaunch. Confirm title/body persistence, no accidental task creation and no previous owner's note content in a later account.
- **Account and synchronization:** exercise supported sign-in/sign-out, session restoration, refresh/reconnect and local import using isolated accounts. A second controlled client should receive relevant saved changes. Cover an expired/failed session and account switch while a request is pending; old-owner data must not appear or overwrite the new account. Native email/password and browser redirect authentication may intentionally differ.
- **Alarms/notifications:** verify the platform's actual capability and its honest availability/denied state. For native alarms, schedule/edit/cancel from the app and test real delivery/Stop/Snooze on a physical device before claiming those work. For browser/PWA notifications, verify permissions, registration/device targeting and actual delivery in the supported lifecycle states. Native alarms and web notifications are separate mechanisms; successful submission is not proof of visible delivery.
- **Shared navigation and access:** every retained section remains reachable; contextual Add labels/actions match their sections. Check the phone task sheet and bottom/More navigation, desktop/iPad sidebar states, keyboard focus/Enter/Escape, touch alternatives and reduced motion. Check affected long text, small/landscape viewports and themes for clipping or inaccessible controls.

An intentionally unsupported capability needs an explicit product rule and honest UI, such as a native redirect provider being hidden with a supported email/password alternative. A broken promised feature cannot be relabeled unsupported merely to pass the gate.

## Required evidence and result labels

For each case record: feature/action, platform/runtime version, mode/backend, source/build identity, expected result, actual result, status and evidence path. Include precise data assertions: for example, “Schedule created one new task at 10:00 for 45 minutes; the template and original task count are unchanged; the scheduled task remained after relaunch.” A screenshot of the button is insufficient.

- **PASS:** the stated action and persistence assertions ran successfully in the recorded runtime/mode. A fixture-backed pass must be labeled fixture-backed; it does not prove the production backend.
- **FAIL:** an assertion or supported user action failed. Record a minimal reproduction, error/response and affected versions; fix and rerun the failed path and dependent checks.
- **BLOCKED:** the required environment, backend/schema, account permission, device or capability prevented execution. State the concrete dependency and the next action needed.
- **NOT RUN:** the case was not executed. State why it is outside this change or remains outstanding.

Store compact reproducible scripts, test output and screenshots/recordings under the change's documentation directory. Screenshots and recordings support assertions; they do not substitute for them. Use explicit timeouts in UI harnesses, and close only the synthetic contexts/devices created for the check. Keep dependency/setup failures separate from application failures.

## Completion and release

Run the matching existing automated tests and relevant native boundary/build checks. Resolve required FAIL cases before claiming the feature is repaired. Surface remaining BLOCKED/NOT RUN cases and unsupported platform differences plainly; never summarize a partial matrix as “all functions work on all platforms.”

Before telling the user to Run Xcode, verify the existing project contains the intended web files and that its successful built bundle matches them. Before claiming the phone is updated, verify installation of that specific build on the phone. A GitHub push does not update either the installed phone app or the hosted backend.

Keep the existing local-first authorization boundary: prepare and verify the concrete release locally before seeking any required public-deployment or remote-migration approval. This procedure does not authorize deployment, account creation, production mutation, signing changes or broader access by itself.
