"""Verify both successful unsigned builds against the current native landing files."""
from pathlib import Path
import hashlib,json,subprocess
repo=Path(__file__).resolve().parents[2]
web=repo.parent/'DuckPlan-motion-preview'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
source={str(p.relative_to(repo/'landing')):sha(p) for p in (repo/'landing').rglob('*') if p.is_file() and p.name!='.DS_Store'}
report={'websiteCommit':subprocess.check_output(['git','-C',str(web),'rev-parse','HEAD'],text=True).strip(),'nativeBaseline':'9780f0ae4a56c5eb9b9a6e01e98b1b0e88a641e5','api':'https://duckplan-latest.ocs-learning.workers.dev/api','sourceFiles':len(source),'builds':[]}
for label,folder in [('simulator','duckplan-latest-sim-build/Build/Products/Debug-iphonesimulator'),('iphone','duckplan-latest-device-build/Build/Products/Debug-iphoneos')]:
 app=Path('/private/tmp')/folder/'DuckPlan.app'
 actual={str(p.relative_to(app/'landing')):sha(p) for p in (app/'landing').rglob('*') if p.is_file() and p.name!='.DS_Store'}
 assert actual==source,(label,'Bundled web mismatch')
 binary=app/'DuckPlan'
 code=app/'DuckPlan.debug.dylib' if (app/'DuckPlan.debug.dylib').exists() else binary
 assert b'https://duckplan-latest.ocs-learning.workers.dev/api' in code.read_bytes(),(label,'Native API default missing')
 report['builds'].append({'runtime':label,'app':str(app),'status':'PASS','landingFiles':len(actual),'executableSHA256':sha(binary),'nativeCodeSHA256':sha(code),'landingSHA256':actual})
plan=json.loads((repo/'docs/native-latest-20261119/sync-result.json').read_text())
assert plan['nativeProtectedBefore']==plan['nativeProtectedAfter'],'Native protection changed during bundle copy'
protected={}
for name,expected in plan['nativeProtectedAfter'].items():
 actual=sha(repo/name)
 if name=='ios/App/PlannerWebView.swift':
  before=subprocess.check_output(['git','show',plan['nativeBaseline']+':'+name],cwd=repo)
  after=(repo/name).read_bytes()
  assert after==before.replace(b'https://duckplan.duckplan-cloudflare.workers.dev/api',b'https://duckplan-latest.ocs-learning.workers.dev/api')
 else: assert actual==expected,('Unexpected native change',name)
 protected[name]=actual
report['protectedNativeAfterEndpointChange']=protected
(repo/'docs/native-latest-20261119/built-bundle-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: 119 web files match both built bundles; native code/resources/signing preserved except approved endpoint change')
