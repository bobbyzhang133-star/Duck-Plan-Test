#!/usr/bin/env python3
"""Inject a Simulator-only invalidation; never represents APNs or physical delivery."""
import argparse, http.cookiejar, json, subprocess, time, urllib.request
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('device', choices=['phone', 'ipad'])
p.add_argument('--terminated', action='store_true')
a = p.parse_args()
ids = {'phone': '919D2D60-8576-4327-A978-9D02456A9A28', 'ipad': '012D11BE-1C33-4C7C-B0F5-5242467F447F'}
device = ids[a.device]
root = Path('/private/tmp/duckplan-account-device-qa-20261115/native')
account = json.loads((root / 'accounts.json').read_text())[0]
shared = json.loads((root / 'shared.json').read_text())
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def api(path, method='GET', data=None):
    request = urllib.request.Request('http://127.0.0.1:8796/api' + path,
        method=method, data=None if data is None else json.dumps(data).encode(),
        headers={'Origin': 'http://127.0.0.1:8796', 'Content-Type': 'application/json'})
    with opener.open(request, timeout=15) as response:
        return json.loads(response.read())
api('/auth/sign-in', 'POST', account)
container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', device, 'com.duckplan.app', 'data'], text=True, timeout=20).strip()
snapshot = Path(container) / 'Library/Application Support/DuckPlan/planner-snapshot.json'
if a.terminated:
    subprocess.run(['xcrun', 'simctl', 'terminate', device, 'com.duckplan.app'], capture_output=True, timeout=20)
task = next(t for t in api('/planner')['items'] if t['title'] == shared['sharedTitle'])
marker = 'Simulator invalidation fixture ' + str(time.time_ns())
task['notes'] = marker
api('/items/' + task['id'], 'PUT', task)
payload = root / 'invalidation.apns'
payload.write_text(json.dumps({'aps': {'content-available': 1}, 'duckplan_sync': 1}))
result = subprocess.run(['xcrun', 'simctl', 'push', device, 'com.duckplan.app', str(payload)], capture_output=True, text=True, timeout=20)
matched = False
end = time.monotonic() + 12
while result.returncode == 0 and time.monotonic() < end:
    try:
        envelope = json.loads(snapshot.read_text())
        matched = any(t['id'] == task['id'] and t['notes'] == marker for t in envelope['planner']['items'])
        if matched: break
    except (OSError, ValueError, KeyError):
        pass
    time.sleep(.25)
output = {'device': a.device, 'applicationState': 'terminated' if a.terminated else 'running',
    'status': 'PASS' if matched else 'BLOCKED', 'simctlPushExit': result.returncode,
    'nativeSnapshotReceivedChangedTask': matched,
    'scope': 'Simulator injected invalidation and native snapshot fetch only; not APNs delivery or OS alarm/notification delivery',
    'defaultFreeTeamBuildPushEnabled': False,
    'permissionDependentCancellation': 'NOT RUN — no authorized OS-scheduled requests available'}
if not matched:
    output['reason'] = ('Simulator rejected the injected invalidation.' if result.returncode else 'Simulator did not update the native snapshot within 12 seconds.')
    if result.stderr.strip(): output['simulatorDiagnostic'] = result.stderr.strip()[:1600]
name = 'simulated-push-' + a.device + ('-terminated' if a.terminated else '-running') + '.json'
Path('docs/account-device-sync/native', name).write_text(json.dumps(output, indent=2) + '\n')
print(json.dumps(output))
