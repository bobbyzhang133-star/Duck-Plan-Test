"""Compare source, build and disposable installed QA bundles; never mutate user apps."""
from pathlib import Path
import hashlib,json,plistlib,subprocess
docs=Path(__file__).parent
web=docs.parents[1];native=web.parent/'DuckPlan-iOS'
built=Path('/private/tmp/duckplan-count-native-build/Build/Products/Debug-iphonesimulator/DuckPlan.app')
digest=lambda data:hashlib.sha256(data).hexdigest()
manifest={str(p.relative_to(native/'landing')):digest(p.read_bytes()) for p in (native/'landing').rglob('*') if p.is_file()}
assert len(manifest)==119
for name,sha in manifest.items():assert digest((built/'landing'/name).read_bytes())==sha,name
protected={}
for name in subprocess.check_output(['git','ls-files','ios'],cwd=native,text=True).splitlines():
 if name=='ios/APP-VERSION.md' or '/xcuserdata/' in name:continue
 data=(native/name).read_bytes();assert data==subprocess.check_output(['git','show','HEAD:'+name],cwd=native),name
 protected[name]=digest(data)
results=[];cases=[]
for device,uid in {'phone':'E8481E77-386B-4C54-BE35-BC1293ECE255','ipad':'10302F7C-9396-4303-BFF8-4D6B317BCB1E'}.items():
 root=Path('/Users/bobbyzhang/Library/Developer/CoreSimulator/Devices')/uid/'data/Containers/Bundle/Application'
 apps=[p.parent for p in root.glob('*/*.app/Info.plist') if plistlib.loads(p.read_bytes()).get('CFBundleIdentifier')=='com.duckplan.summaryqa20261120']
 assert len(apps)==1,(device,apps)
 app=apps[0]
 for name,sha in manifest.items():
  data=(app/'landing'/name).read_bytes()
  if name=='index.html':data=data.replace(b'<script src="summary-native-qa.js"></script>\n',b'')
  assert digest(data)==sha,(device,name)
 expected=(docs/'native-runtime.js').read_text().replace('127.0.0.1:8896','127.0.0.1:'+('8896' if device=='phone' else '8897'))
 assert (app/'landing/summary-native-qa.js').read_text()==expected
 native_sha=digest((built/'DuckPlan.debug.dylib').read_bytes())
 assert native_sha==digest((app/'DuckPlan.debug.dylib').read_bytes())
 results.append({'device':device,'status':'PASS','runtime':'iOS27.2 WKWebView','cache':99,'webFiles':len(manifest),'nativeCodeSHA256':native_sha,'instrumentation':['separate QA identifiers','one QA script/index tag']})
 rows=[json.loads(s) for s in (docs/(device+'-results.jsonl')).read_text().splitlines()]
 assert not any(r.get('stage')=='failure' for r in rows)
 cases.extend(dict(device=device,**r) for r in rows if r.get('stage')=='finished')
 assert all(any(r.get('mode')==mode and r.get('status')=='PASS' for r in rows) for mode in ['local-setup','local-persist','cloud-setup','cloud-persist'])
(docs/'native-built-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(docs/'native-verification.json').write_text(json.dumps({'status':'PASS','installedBundles':results,'cases':cases,'protectedSourceSigningArtworkSounds':protected},indent=2)+'\n')
print('PASS:',len(cases),'native runtime cases,119 source/build/installed web files; protected native source/signing')
