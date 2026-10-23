/* Lightweight syntax validation without running or deploying the project. */
const ts=require('typescript');const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');let checked=0;let errors=[];
function scan(folder){for(const d of fs.readdirSync(folder,{withFileTypes:true})){
  if(d.name==='node_modules'||d.name==='.next')continue;
  const p=path.join(folder,d.name);
  if(d.isDirectory())scan(p);
  else if(/\.tsx?$/.test(d.name)){
    const content=fs.readFileSync(p,'utf8');const syntax=d.name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;
    const sf=ts.createSourceFile(p,content,ts.ScriptTarget.ES2022,true,syntax);checked++;
    for(const e of sf.parseDiagnostics)errors.push({path:path.relative(base,p),message:ts.flattenDiagnosticMessageText(e.messageText,' ')});
  }
}}
scan(base);
for(const f of ['package.json','tsconfig.json','vercel.json'])JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
assert.equal(errors.length,0,JSON.stringify(errors,null,2));
console.log(`PASS: ${checked} TypeScript/TSX files parse; JSON configuration files parse.`);
