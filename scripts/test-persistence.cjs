/* Simulated Supabase responses: no real records, money, or network calls. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ts=require('typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../lib/server.ts'),'utf8');
const js=ts.transpileModule(source,{fileName:'lib/server.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let stored;
let collisionOnProvider=false;
let unavailable=false;
const unique={code:'23505',message:'duplicate key value'};
const select=(field)=>({
 eq(k,v){this.where={k,v};return this;},
 async maybeSingle(){
  if(unavailable)throw Error('fetch failed');
  return {data:stored?.id===this.where.v?{id:stored.id,status:stored.status}:null,error:null};
 }});
const from=()=>({
 insert:async record=>{
  if(unavailable)throw Error('fetch failed');
  if(collisionOnProvider||stored)return {error:unique};
  stored={...record};return {error:null};
 },
 update:record=>({
  eq(k,v){this.id=v;return this;},
  in(k,allowed){this.allowed=allowed;return this;},
  async select(){
   if(unavailable)throw Error('fetch failed');
   if(stored?.id===this.id&&this.allowed.includes(stored.status)){
     stored={...record};return {data:[{id:stored.id}],error:null};
   }
   return {data:[],error:null};
  }
 }),
 select
});
const mocks={'server-only':{},'node:crypto':require('node:crypto'),'@supabase/supabase-js':{createClient:()=>({from})}};
const mod={exports:{}};
new Function('require','module','exports',js)((id)=>{if(id in mocks)return mocks[id];throw Error('unexpected '+id);},mod,mod.exports);
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fake_server_key';
const id='11111111-1111-4111-8111-111111111111';
const row=(status)=>({id,method:'cashapp',amount_cents:500,currency:'USD',customer_name:'Test Customer',customer_email:'test@example.com',service_description:'Test service',reference:null,status});
(async()=>{
 const save=mod.exports.recordBestEffort;
 assert.equal(await save(row('pending'),true),true);
 assert.equal(stored.status,'pending');
 assert.equal(await save(row('paid')),true);
 assert.equal(stored.status,'paid');
 assert.equal(await save(row('expired')),true);
 assert.equal(stored.status,'paid','late expiry cannot overwrite paid');
 assert.equal(await save(row('failed')),true);
 assert.equal(stored.status,'paid','late failure cannot overwrite paid');
 assert.equal(await save(row('refunded')),true);
 assert.equal(stored.status,'refunded');
 assert.equal(await save(row('paid')),true);
 assert.equal(stored.status,'refunded','replayed paid cannot overwrite refund');
 assert.equal(await save(row('pending'),true),true);
 assert.equal(stored.status,'refunded','duplicate pending insert cannot reset status');
 collisionOnProvider=true;stored=undefined;
 assert.equal(await save(row('pending'),true),false,'other unique key collision must fail');
 collisionOnProvider=false;unavailable=true;
 assert.equal(await save(row('paid')),false,'database outage remains visible for retries');
 console.log('PASS: pending→paid, late failure/expiry, refund, duplicate start, unique key collision, DB outage (mocked).');
})().catch(e=>{console.error(e);process.exitCode=1;});
