"""Build a disposable bundle copy; test only its synthetic local/QA-server data."""
from pathlib import Path
import json,os,plistlib,secrets,shutil,subprocess,sys,time,urllib.request
repo=Path(__file__).resolve().parents[2];docs=Path(__file__).parent
root=Path('/private/tmp/duckplan-summary-native-qa');root.mkdir(mode=0o700,exist_ok=True)
built=Path('/private/tmp/duckplan-count-native-build/Build/Products/Debug-iphonesimulator/DuckPlan.app')
uidmap={'phone':'E8481E77-386B-4C54-BE35-BC1293ECE255','ipad':'10302F7C-9396-4303-BFF8-4D6B317BCB1E'}
origin='http://127.0.0.1:8798';bundle='com.duckplan.summaryqa20261120'
layout_only='--layout-only' in sys.argv
local_only='--local-only' in sys.argv
def cmd(args,**kw):return subprocess.run(args,capture_output=True,check=True,timeout=90,**kw)
def post(path,data):
 request=urllib.request.Request(origin+path,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(request,timeout=30) as response:return json.load(response)
for device,uid in uidmap.items():
 app=root/(device+'-DuckPlan.app');shutil.copytree(built,app,dirs_exist_ok=True)
 for folder,suffix in [(app,''),(app/'PlugIns/DuckPlanAlarmWidget.appex','.alarms')]:
  p=folder/'Info.plist';info=plistlib.loads(p.read_bytes());info['CFBundleIdentifier']=bundle+suffix;info['CFBundleDisplayName']='DuckPlan Summary QA';p.write_bytes(plistlib.dumps(info))
 (app/'landing/summary-native-qa.js').write_text((docs/'native-runtime.js').read_text().replace('127.0.0.1:8896','127.0.0.1:'+('8896' if device=='phone' else '8897')))
 p=app/'landing/index.html';s=p.read_text();assert s.count('</body>')==1;p.write_text(s.replace('</body>','<script src="summary-native-qa.js"></script>\n</body>'))
 cmd(['codesign','--force','--deep','--sign','-',str(app)])
 subprocess.run(['xcrun','simctl','boot',uid],capture_output=True,timeout=60)
 cmd(['xcrun','simctl','bootstatus',uid,'-b']);cmd(['xcrun','simctl','install',uid,str(app)])
 user={} if layout_only or local_only else {'email':f'count-{device}-{time.time_ns()}@counts.test','password':secrets.token_urlsafe(30)}
 if user:post('/api/auth/sign-up',user)
 env=os.environ.copy();env['SIMCTL_CHILD_DUCKPLAN_NATIVE_API_URL']=origin+'/api'
 for mode in (['local-persist'] if local_only else ['cloud-persist','local-persist'] if layout_only else ['local-setup','local-persist','cloud-setup','cloud-persist']):
  run_id=device+'-'+mode+'-'+str(time.time_ns());command=root/(device+'-command.json')
  command.write_text(json.dumps({'runId':run_id,'mode':mode,**({'fixtureEmail':user['email'],'fixturePassword':user['password']} if user else {})}));command.chmod(0o600)
  subprocess.run(['xcrun','simctl','terminate',uid,bundle],capture_output=True,timeout=45)
  cmd(['xcrun','simctl','launch',uid,bundle],env=env);print('RUN '+device+' '+mode,flush=True)
  end=time.monotonic()+140
  while time.monotonic()<end:
   file=root/(device+'-results.jsonl');rows=[json.loads(s) for s in file.read_text().splitlines()] if file.exists() else []
   rows=[r for r in rows if r.get('runId')==run_id]
   failure=next((r for r in rows if r.get('stage')=='failure'),None)
   if failure:raise RuntimeError(failure['at']+': '+failure['message'])
   if any(r.get('stage')=='finished' and r.get('status')=='PASS' for r in rows):break
   time.sleep(1)
  else:raise RuntimeError('No native result')
  print('PASS '+device+' '+mode,flush=True)
  cmd(['xcrun','simctl','io',uid,'screenshot',str(docs/(device+'-'+mode+'.png'))])
 command.unlink(missing_ok=True)
 subprocess.run(['xcrun','simctl','terminate',uid,bundle],capture_output=True,timeout=45)
 cmd(['xcrun','simctl','shutdown',uid])
 shutil.copyfile(root/(device+'-results.jsonl'),docs/(device+'-results.jsonl'))
