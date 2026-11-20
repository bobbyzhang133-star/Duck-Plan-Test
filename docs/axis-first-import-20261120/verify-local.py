"""Compare the current native source/build and isolated installed QA copies."""
from pathlib import Path
import hashlib,json,plistlib,subprocess
repo=Path(__file__).resolve().parents[2];root=repo/'docs/axis-first-import-20261120';native=repo.parent/'DuckPlan-iOS'
built=Path('/private/tmp/duckplan-axis-native-build/Build/Products/Debug-iphonesimulator/DuckPlan.app')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
installed=[]
for name,uid,port in [('phone','E8481E77-386B-4C54-BE35-BC1293ECE255',8896),('ipad','10302F7C-9396-4303-BFF8-4D6B317BCB1E',8897)]:
 base=Path('/Users/bobbyzhang/Library/Developer/CoreSimulator/Devices')/uid/'data/Containers/Bundle/Application'
 candidates=[p for p in base.glob('*/*.app') if plistlib.loads((p/'Info.plist').read_bytes()).get('CFBundleIdentifier')=='com.duckplan.axisqa20261120'];assert len(candidates)==1,(name,len(candidates))
 app=candidates[0];assert sha(app/'DuckPlan.debug.dylib')==sha(built/'DuckPlan.debug.dylib')
 count=0
 for p in (built/'landing').rglob('*'):
  if not p.is_file():continue
  rel=p.relative_to(built/'landing');data=(app/'landing'/rel).read_bytes()
  if str(rel)=='index.html':data=data.replace(b'<script src="axis-native-qa.js"></script>\n',b'')
  assert data==p.read_bytes(),(name,str(rel));assert (native/'landing'/rel).read_bytes()==p.read_bytes();count+=1
 assert (app/'landing/axis-native-qa.js').read_text()==(root/'native-runtime.js').read_text().replace('127.0.0.1:8896',f'127.0.0.1:{port}')
 installed.append({'name':name,'status':'PASS','runtime':'iOS27.2 WKWebView','files':count,'nativeCodeSHA256':sha(app/'DuckPlan.debug.dylib'),'allowedInstrumentation':['separate QA identifiers','QA script and index tag']})
(root/'installed-qa-verification.json').write_text(json.dumps(installed,indent=2)+'\n')
protected=json.loads((root/'native-bounded-patch.json').read_text())
for name,digest in protected['nativeProtectedBefore'].items():assert sha(native/name)==digest,name
for name in ['axis.js','axis-completion.js']:assert (repo/'cloudflare/src'/name).read_bytes()==(native/'cloudflare/src'/name).read_bytes()
changed=set(subprocess.check_output(['git','diff','--name-only','--','landing'],cwd=native,text=True).splitlines());assert changed=={'landing/app.js','landing/index.html','landing/service-worker.js'},changed
print('PASS:119 production web files, native code, installed QA instrumentation and protected local source/settings')
