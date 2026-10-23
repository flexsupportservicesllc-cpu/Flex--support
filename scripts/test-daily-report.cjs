/* Isolated daily-report HTTP test. No email, DB or provider network traffic. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const ts=require('typescript');
const name=path.resolve(__dirname,'../app/api/cron/daily-report/route.ts');
const js=ts.transpileModule(fs.readFileSync(name,'utf8'),{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
let reportOK=true,warnings=0;
const notify={
  sendDailyReport:async()=>reportOK,
  notifyDailyReportFailure:async()=>{warnings++;return true;}
};
const mod={exports:{}};
new Function('require','module','exports',js)((id)=>{
  if(id==='@/lib/notifications')return notify;
  throw Error('Unexpected import '+id);
},mod,mod.exports);
process.env.CRON_SECRET='cron-secret-for-tests';
const request=token=>new Request('https://example.test/api/cron/daily-report',{headers:{authorization:token}});
(async()=>{
  const bad=await mod.exports.GET(request('Bearer incorrect'));
  assert.equal(bad.status,401);assert.equal(warnings,0);
  const good=await mod.exports.GET(request('Bearer cron-secret-for-tests'));
  assert.equal(good.status,200);assert.equal(warnings,0);
  reportOK=false;
  const outage=await mod.exports.GET(request('Bearer cron-secret-for-tests'));
  assert.equal(outage.status,503);
  assert.equal((await outage.json()).warningSent,true);
  assert.equal(warnings,1);
  console.log('PASS: daily-report auth, successful delivery, visible outage warning (mocked).');
})().catch(e=>{console.error(e);process.exitCode=1;});
