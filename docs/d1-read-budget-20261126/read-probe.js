async(page)=>{
 const browser=page.context().browser(), c=await browser.newContext(), origin='http://127.0.0.1:18814';
 const assert=(v,m)=>{if(!v)throw Error(m);};
 try{
  const signed=await c.request.post(origin+'/api/auth/sign-up',{headers:{Origin:origin},data:{email:`read-probe-${Date.now()}@fixture.test`,password:crypto.randomUUID()+'-Fixture'}});assert(signed.status()===201,'Signup');
  for(let batch=0;batch<5;batch++){
   const response=await c.request.post(origin+'/api/import',{headers:{Origin:origin},data:{itemRows:Array.from({length:2000},(_,i)=>({id:crypto.randomUUID(),title:'Synthetic task '+(batch*2000+i),due_date:'2026-11-19',notes:'Synthetic measurement only'}))}});assert(response.ok(),'Import '+batch+' '+response.status());
  }
  const measure=async path=>{await c.request.get(origin+'/__metrics');const r=await c.request.get(origin+path,{headers:{'x-qa-measure':'1'}}),data=await r.json();assert(r.ok(),JSON.stringify(data));const metrics=await(await c.request.get(origin+'/__metrics')).json();return {data,queries:metrics.length,rowsRead:metrics.reduce((n,r)=>n+(r.meta?.rows_read||0),0),rowsWritten:metrics.reduce((n,r)=>n+(r.meta?.rows_written||0),0),metaAvailable:metrics.every(r=>typeof r.meta?.rows_read==='number')};};
  const full=await measure('/api/planner');assert(full.data.items.length===10000,'Full task count');let total=0,queries=0,bytes=0;
  for(let i=0;i<50;i++){const probe=await measure('/api/planner?since='+encodeURIComponent(full.data.planner_version));assert(probe.data.unchanged===true,'Unchanged response');assert(probe.metaAvailable,'Missing D1 metadata');total+=probe.rowsRead;queries+=probe.queries;bytes+=JSON.stringify(probe.data).length;}
  const id=full.data.items[0].id,changed=await c.request.patch(origin+'/api/items/'+id,{headers:{Origin:origin},data:{completed:true}});assert(changed.ok(),'Update');
  const fresh=await measure('/api/planner?since='+encodeURIComponent(full.data.planner_version));assert(fresh.data.items.find(t=>t.id===id).completed===1&&fresh.data.planner_version!==full.data.planner_version,'Changed row/version');
  return {runtime:browser.version(),scope:'isolated loopback real Worker/D1',taskCount:10000,full:{queries:full.queries,rowsRead:full.rowsRead,rowsWritten:full.rowsWritten,bytes:JSON.stringify(full.data).length,metaAvailable:full.metaAvailable},unchanged50:{queries,rowsRead:total,rowsReadPerRequest:total/50,bytesPerRequest:bytes/50},changedReload:{taskCount:fresh.data.items.length,completed:true,versionChanged:true},productionWrites:false,status:'PASS'};
 } finally{await c.close();}
}
