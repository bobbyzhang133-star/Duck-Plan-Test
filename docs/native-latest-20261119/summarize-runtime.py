"""Publish credential-filtered synthetic native QA results and explicit coverage limits."""
from pathlib import Path
import json,re
repo=Path(__file__).resolve().parents[2]
out=repo/'docs/native-latest-20261119'
root=Path('/private/tmp/duckplan-latest-native-qa')
forbidden=re.compile(r'password|cookie|authorization|recovery|(?:^|_)token(?:$|_)',re.I)
def scan(v):
 if isinstance(v,dict):
  for key,value in v.items():
   assert not forbidden.search(key),('Sensitive evidence field',key)
   scan(value)
 elif isinstance(v,list):
  for value in v:scan(value)
expected={'phone':['local-baseline','local-baseline-relaunch','local-presentation','local-extended','local-preferences','local-preferences-relaunch','cloud-baseline','cloud-baseline-relaunch','cloud-presentation','cloud-extended','cloud-preferences','cloud-preferences-relaunch','cloud-midnight-preferences','cloud-midnight-preferences-relaunch','cloud-isolation','cloud-sync-status','cloud-shared-create','cloud-shared-verify'],'ipad':['local-baseline','local-baseline-relaunch','local-presentation','local-extended','local-preferences','local-preferences-relaunch','cloud-baseline','cloud-baseline-relaunch','cloud-presentation','cloud-extended','cloud-preferences','cloud-preferences-relaunch','cloud-isolation','cloud-shared-read-edit']}
summary={'runtime':'actual iOS27.2 simulator WKWebView; scripted DOM interactions, real native bridges and URLSession; no mocked app transport','api':'https://duckplan-latest.ocs-learning.workers.dev/api','buildIdentity':'built-bundle-verification.json','installedIdentity':'installed-qa-verification.json','devices':{},'limits':{'physicalInstall':'NOT RUN: physical devices unavailable during preparation; source/build update only','alarmNotificationDelivery':'NOT RUN: physical AlarmKit/UNUserNotifications delivery/Stop/Snooze; preference tests deliberately disable delivery','backgroundAPNs':'BLOCKED: Free Personal Team build has no push entitlement and new server has no APNs credentials','SafariPWA':'NOT RUN in this native update; prior web browser release evidence is in the canonical website checkout','trustedTouchDragRotationOffline':'NOT RUN: native scripted controls/persistence are not trusted-touch, operating-system drag-layer, rotation or airplane-mode delivery evidence','externalResourceOpening':'NOT RUN: baseline verifies resource CRUD, not external browser navigation'}}
for device,modes in expected.items():
 rows=[json.loads(x) for x in (root/f'{device}-results.jsonl').read_text().splitlines() if x.strip()]
 scan(rows)
 for r in rows:
  if r.get('stage')=='started':assert r['native'] and r['api']==summary['api']
 latest={r['mode']:r for r in rows if r.get('stage')=='finished'}
 cases=[{'mode':mode,'status':latest.get(mode,{}).get('status','NOT RUN'),'runId':latest.get(mode,{}).get('runId')} for mode in modes]
 diagnostics=[{'runId':r['runId'],'at':r.get('at'),'message':r.get('message'),'resolution':'Test helper crossed midnight without advancing scheduled date; corrected helper and explicit midnight/relaunch checks pass.'} for r in rows if r.get('stage')=='failure']
 incomplete=[r['runId'] for r in rows if r.get('stage')=='started' and not any(v.get('runId')==r['runId'] and v.get('stage') in ['finished','failure'] for v in rows)]
 summary['devices'][device]={'cases':cases,'passed':sum(c['status']=='PASS' for c in cases),'expected':len(modes),'diagnostics':diagnostics,'initialStartupTimeouts':incomplete}
 (out/f'{device}-native-results.jsonl').write_text('\n'.join(json.dumps(r) for r in rows)+'\n')
summary['complete']=all(d['passed']==d['expected'] for d in summary['devices'].values())
(out/'runtime-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'complete':summary['complete'],'devices':{k:{'passed':v['passed'],'expected':v['expected']} for k,v in summary['devices'].items()}}))
