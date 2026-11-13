// Local-only temporary result collector. The command JSON stays in /private/tmp and is not an artifact.
const http=require('node:http'),fs=require('node:fs');
const command='/private/tmp/duckplan-native-template-command.json',results='/private/tmp/duckplan-native-template-results.jsonl';
http.createServer((req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.url==='/command'){res.setHeader('Content-Type','application/json');res.end(fs.readFileSync(command));return;}
 if(req.url==='/result'&&req.method==='POST'){let body='';req.on('data',b=>body+=b);req.on('end',()=>{fs.appendFileSync(results,body+'\n');res.end('ok');});return;}
 res.writeHead(404);res.end();
}).listen(8795,'127.0.0.1',()=>console.log('QA result collector on localhost8795'));
