// Loopback-only QA collector. Commands/credentials/results remain in private temporary files.
const http=require('node:http'),fs=require('node:fs');
const command='/private/tmp/duckplan-work-alert-native-command.json',results='/private/tmp/duckplan-work-alert-native-results.jsonl';
http.createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.url==='/command'){res.setHeader('Content-Type','application/json');res.end(fs.readFileSync(command));return;}
 if(req.url==='/result'&&req.method==='POST'){let body='';req.on('data',b=>{body+=b;if(body.length>100000)req.destroy();});req.on('end',()=>{fs.appendFileSync(results,body+'\n');res.end('ok');});return;}
 res.writeHead(404);res.end();
}).listen(8795,'127.0.0.1',()=>console.log('Native QA collector listening on localhost8795'));
