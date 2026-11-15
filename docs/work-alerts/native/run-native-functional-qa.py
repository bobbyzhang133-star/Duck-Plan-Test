#!/usr/bin/env python3
"""Run scripted DOM cases only on the two disposable DuckPlan QA simulators."""
import argparse,json,os,subprocess,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('device',choices=['phone','ipad']);p.add_argument('modes',nargs='+');a=p.parse_args()
devices={'phone':'BE0EB000-07DE-48B6-B694-0D44CB864396','ipad':'480153F4-90AF-42F0-A703-D124E76671BA'}
command=Path('/private/tmp/duckplan-work-alert-native-command.json');results=Path('/private/tmp/duckplan-work-alert-native-results.jsonl');accounts=json.loads(Path('/private/tmp/duckplan-native-qa-accounts.json').read_text());env=os.environ.copy();env['SIMCTL_CHILD_DUCKPLAN_NATIVE_API_URL']='http://127.0.0.1:8796/api'
for mode in a.modes:
 if not mode.startswith(('local-','cloud-')):raise ValueError('Expected isolated local/cloud QA mode')
 run_id=a.device+'-'+mode+'-'+str(time.time_ns())
 c={'mode':mode,'runId':run_id,'fixtureEmail':accounts[0]['email'],'fixturePassword':accounts[0]['password'],'secondEmail':accounts[1]['email'],'secondPassword':accounts[1]['password']}
 command.write_text(json.dumps(c));command.chmod(0o600)
 subprocess.run(['xcrun','simctl','terminate',devices[a.device],'com.duckplan.app'],capture_output=True,timeout=30)
 subprocess.run(['xcrun','simctl','launch',devices[a.device],'com.duckplan.app'],env=env,capture_output=True,check=True,timeout=45)
 print('RUN '+a.device+' '+mode,flush=True);end=time.monotonic()+180
 while time.monotonic()<end:
  rows=[json.loads(s) for s in results.read_text().splitlines() if s.strip()]
  current=[r for r in rows if r.get('runId')==run_id]
  fail=next((r for r in current if r.get('stage')=='failure'),None)
  if fail:
   print('FAIL '+mode+' at '+str(fail.get('at'))+': '+str(fail.get('message')),flush=True);raise SystemExit(1)
  if any(r.get('stage')=='finished' and r.get('status')=='PASS' for r in current):
   print('PASS '+mode,flush=True);break
  time.sleep(1)
 else:
  print('BLOCKED '+mode+' timed out waiting for actual WKWebView report',flush=True);raise SystemExit(2)
