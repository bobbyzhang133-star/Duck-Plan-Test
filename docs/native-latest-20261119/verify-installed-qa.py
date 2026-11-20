"""Verify isolated installed QA apps contain production code/assets plus test instrumentation."""
from pathlib import Path
import subprocess,json,hashlib,plistlib,sys
repo=Path(__file__).resolve().parents[2]
root=Path('/private/tmp/duckplan-latest-native-qa')
production=Path('/private/tmp/duckplan-latest-sim-build/Build/Products/Debug-iphonesimulator/DuckPlan.app')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
output=repo/'docs/native-latest-20261119/installed-qa-verification.json'
rows=json.loads(output.read_text()) if output.exists() else []
selected=sys.argv[1] if len(sys.argv)>1 else None
for device,udid in json.loads((root/'devices.json').read_text()).items():
 if selected and selected!=device:continue
 rows=[r for r in rows if r['device']!=device]
 app=Path(subprocess.check_output(['xcrun','simctl','get_app_container',udid,'com.duckplan.latestqa20261119','app'],text=True,timeout=45).strip())
 assert plistlib.loads((app/'Info.plist').read_bytes())['CFBundleIdentifier']=='com.duckplan.latestqa20261119'
 native='DuckPlan.debug.dylib'
 assert sha(app/native)==sha(production/native)
 checked=[]
 for p in (production/'landing').rglob('*'):
  if not p.is_file() or p.name=='.DS_Store':continue
  relative=p.relative_to(production/'landing');data=(app/'landing'/relative).read_bytes()
  if str(relative)=='index.html':data=data.replace(b'<script src="native-functional-qa.js"></script>\n',b'')
  assert data==p.read_bytes(),(device,str(relative))
  checked.append(str(relative))
 harness=(repo/'docs/native-latest-20261119/native-functional-qa.js').read_text()
 if device=='ipad':harness=harness.replace('127.0.0.1:8894','127.0.0.1:8895')
 assert (app/'landing/native-functional-qa.js').read_text()==harness
 rows.append({'device':device,'udid':udid,'appID':'com.duckplan.latestqa20261119','nativeCodeSHA256':sha(app/native),'landingFiles':len(checked),'allowedChanges':['QA bundle identifiers','index.html QA script tag','native-functional-qa.js'],'status':'PASS'})
output.write_text(json.dumps(rows,indent=2)+'\n')
print('PASS: '+str(len(rows))+' isolated installed apps match the native code and119 production web files in the successful simulator build')
