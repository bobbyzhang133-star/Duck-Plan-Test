#!/usr/bin/env python3
"""Run only the two disposable devices; commands and credentials stay in private tmp."""
import argparse, json, os, subprocess, time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('device', choices=['phone', 'ipad'])
parser.add_argument('modes', nargs='+')
args = parser.parse_args()
devices = {'phone': 'E8481E77-386B-4C54-BE35-BC1293ECE255', 'ipad': '012D11BE-1C33-4C7C-B0F5-5242467F447F'}
root = Path('/private/tmp/duckplan-parity-native-qa')
root.mkdir(mode=0o700, parents=True, exist_ok=True)
command, results = root / f'{args.device}-command.json', root / f'{args.device}-results.jsonl'
accounts = json.loads((root / 'accounts.json').read_text())
env = os.environ.copy()
env['SIMCTL_CHILD_DUCKPLAN_NATIVE_API_URL'] = 'http://127.0.0.1:8796/api'
for mode in args.modes:
    if not mode.startswith(('local-', 'cloud-')):
        raise ValueError('Use an isolated local/cloud QA mode')
    run_id = args.device + '-' + mode + '-' + str(time.time_ns())
    data = {'mode': mode, 'runId': run_id, 'fixtureEmail': accounts[0]['email'], 'fixturePassword': accounts[0]['password'],
            'secondEmail': accounts[1]['email'], 'secondPassword': accounts[1]['password']}
    if (root / 'shared.json').exists():
        data.update(json.loads((root / 'shared.json').read_text()))
    command.write_text(json.dumps(data)); command.chmod(0o600)
    subprocess.run(['xcrun', 'simctl', 'terminate', devices[args.device], 'com.duckplan.parityqa'], capture_output=True, timeout=30)
    subprocess.run(['xcrun', 'simctl', 'launch', devices[args.device], 'com.duckplan.parityqa'], env=env, capture_output=True, check=True, timeout=45)
    print('RUN ' + args.device + ' ' + mode, flush=True)
    end = time.monotonic() + 180
    while time.monotonic() < end:
        rows = [json.loads(line) for line in results.read_text().splitlines() if line.strip()] if results.exists() else []
        current = [row for row in rows if row.get('runId') == run_id]
        failed = next((row for row in current if row.get('stage') == 'failure'), None)
        if failed:
            print('FAIL ' + mode + ' at ' + str(failed.get('at')) + ': ' + str(failed.get('message')), flush=True)
            raise SystemExit(1)
        if any(row.get('stage') == 'finished' and row.get('status') == 'PASS' for row in current):
            print('PASS ' + mode, flush=True)
            break
        time.sleep(1)
    else:
        print('BLOCKED ' + mode + ': no WKWebView completion report', flush=True)
        raise SystemExit(2)
