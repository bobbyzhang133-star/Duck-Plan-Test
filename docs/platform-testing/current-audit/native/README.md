# Native Templates diagnosis — November 13, 2026

**Scripted WKWebView functional checks pass against the current local server.** The same iPhone app reproduces the reported disabled Templates warning when signed in to the old local server. This is a server capability mismatch, rather than missing Templates code or a native endpoint restriction.

The old `/api/planner` response contains only `classes` and `items`. The current client requires `templates`, `resources` and `organization` before enabling account Templates. Personal features similarly require the goals, habits, check-ins and notes arrays. The current server returns those fields and enables the controls without changing the app's business code.

## Runtime and isolation

- Existing iPhone app source: `4973cb72eeb310cdae243e9b9eaafd29d246f0fb`; compared website: `5c6134f`. Templates/library modules are identical between those versions.
- Fresh disposable iPhone 18 Pro simulator on iOS 27.2 (`24B8117`), UDID `29D8E8C4-A7F6-49C2-B8EA-0D1546E570F0`. Existing simulator and physical-phone data were not touched.
- Unsigned Debug simulator build of the checked-in Xcode project. No Swift, signing, native transport or production frontend source changes.
- The original build's 119 files remain unchanged. The temporary test copy changes only `landing/index.html` to load one additional QA script. All business JavaScript, native bridge and binaries remain identical. Exact executable, native source and build-manifest hashes are in [results.json](results.json) and [original-build-hashes.json](original-build-hashes.json).
- Real native URLSession requests went to isolated local Worker fixtures: port 8793 with migrations 1–3, port 8794 with migrations 1–5. No capability, response or transport mocks were used; no production requests, migrations or account mutations were performed.

## Results

- **Old server:** native sign-in succeeds. Calendar → Templates shows disabled New and the exact notice: “Templates and resources are not available on this server yet. Your saved local library stays safe on this device.” Organization and personal capabilities are false.
- **Local planner:** after sign-out, create/save a template and Schedule work. The editor begins with a blank deadline and creates no task before Save. Saving preserves the 20-minute duration, multiline notes and reminder; the template remains reusable. Both template and scheduled task survive terminate/relaunch with the same IDs.
- **Current server:** the same app enables Templates after native sign-in. Create, edit, full Details, canceled deletion and confirmed deletion pass. Schedule/save preserves settings; two Add to tasks actions create separate unscheduled IDs. Independent server readback confirms one retained template and three copies: one scheduled and two unscheduled, with matching duration/notes.
- **Personal samples:** Notes, Goal, Habit and today's habit check-in save through the real UI forms/native transport. Server readback confirms each row. Native terminate/relaunch restores account identity, template/task rows, note, goal and completed habit check-in.

Screenshots show the actual simulator runtime:

- [Old-server warning](old-blocked.png)
- [Local saved template](local-saved.png)
- [Current-server enabled Templates](cloud-enabled.png)
- [Restored Templates after relaunch](cloud-relaunch.png)

## Reproduction surface and limits

**Trusted touch is BLOCKED.** Device Hub CUA clicks repeatedly returned `noWindowsAvailable`; its accessibility tree was empty while screenshots remained available. The authorized fallback drove native WKWebView DOM clicks, form field events and form submission, then inspected actual native UI screenshots and real server rows. These results are explicitly **scripted WKWebView functional**, not trusted touch, physical iPhone/iPad or audible AlarmKit verification.

The [sanitized runner](native-template-ui-qa.js) and [local collector](collector.cjs) are test-only artifacts. Append the runner only to a temporary copy of the built simulator bundle. The private command file under `/private/tmp` supplies `mode`, `fixtureEmail` and `fixturePassword`; credentials and session data are not included here. Modes are `old`, `local`, `local-relaunch`, `cloud` and `cloud-relaunch`. Launch the disposable Debug simulator with `SIMCTL_CHILD_DUCKPLAN_NATIVE_API_URL` pointing to the corresponding loopback fixture. Do not install the instrumented copy on a physical phone or distribute it.

The production server must pass the separate compatibility gate before these features can work for signed-in users. Updating only the Xcode bundle cannot add missing server APIs or database migrations.

## Cleanup

The disposable QA simulator was shut down and deleted after evidence capture. The existing user simulator remained booted and unchanged. Local fixture/collector servers on 8793, 8794 and 8795 were stopped after the browser audit completed. Native checkout backend source remains unchanged; native Release uses the hosted API, and no backend copy or source workaround was applied.
