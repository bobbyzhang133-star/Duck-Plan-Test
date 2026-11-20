"""Run only the separate Axis QA app; keep fixture credentials private."""
import argparse,json,os,subprocess,time,secrets,urllib.request
from pathlib import Path
args=argparse.ArgumentParser();args.add_argument('device',choices=['phone','ipad']);options=args.parse_args()
root=Path('/private/tmp/duckplan-axis-native-qa');root.mkdir(mode=0o700,exist_ok=True)
devices={'phone':'E8481E77-386B-4C54-BE35-BC1293ECE255','ipad':'10302F7C-9396-4303-BFF8-4D6B317BCB1E'}
origin='http://127.0.0.1:8798'
def post(path,data):
 r=urllib.request.Request(origin+path,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(r,timeout=30) as response:return json.load(response)
accounts_file=root/'accounts.json'
accounts=json.loads(accounts_file.read_text()) if accounts_file.exists() else {}
# Every full run uses a new isolated account, including after a failed harness attempt.
user={'email':f'axis-native-{options.device}-{time.time_ns()}@axis.test','password':secrets.token_urlsafe(30)}
post('/api/auth/sign-up',user)
accounts[options.device]=user;accounts_file.write_text(json.dumps(accounts));accounts_file.chmod(0o600)
env=os.environ.copy();env['SIMCTL_CHILD_DUCKPLAN_NATIVE_API_URL']=origin+'/api'
for mode,fixture_stage in [('initial','initial'),('later','later')]:
 post('/__axis-qa',{'stage':fixture_stage})
 run_id=options.device+'-'+mode+'-'+str(time.time_ns())
 command={'runId':run_id,'mode':mode,'fixtureEmail':user['email'],'fixturePassword':user['password'],'feed':'https://fixture.myschoolapp.com/podium/feed/iCal.aspx?z=synthetic-axis-fixture'}
 p=root/(options.device+'-command.json');p.write_text(json.dumps(command));p.chmod(0o600)
 subprocess.run(['xcrun','simctl','terminate',devices[options.device],'com.duckplan.axisqa20261120'],capture_output=True,timeout=45)
 subprocess.run(['xcrun','simctl','launch',devices[options.device],'com.duckplan.axisqa20261120'],capture_output=True,check=True,env=env,timeout=60)
 print('RUN '+options.device+' '+mode,flush=True)
 end=time.monotonic()+160
 while time.monotonic()<end:
  file=root/(options.device+'-results.jsonl');rows=[json.loads(s) for s in file.read_text().splitlines()] if file.exists() else []
  rows=[r for r in rows if r.get('runId')==run_id]
  failure=next((r for r in rows if r.get('stage')=='failure'),None)
  if failure:
   print('FAIL '+str(failure.get('at'))+': '+str(failure.get('message')),flush=True);raise SystemExit(1)
  if any(r.get('stage')=='finished' and r.get('status')=='PASS' for r in rows):print('PASS '+options.device+' '+mode,flush=True);break
  time.sleep(1)
 else:print('BLOCKED: no native completion',flush=True);raise SystemExit(2)
