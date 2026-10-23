/* Payment route unit tests with mocked provider/network calls. No credentials, no charges. */
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(name,mocks={}){
  const source=fs.readFileSync(path.join(root,name),'utf8');
  const js=ts.transpileModule(source,{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod={exports:{}};
  const requireMock=(id)=>{
    if(id in mocks)return mocks[id];
    if(id==='next/server')return {after:(cb)=>tasks.push(cb)};
    if(id==='server-only')return {};
    if(id==='stripe')return mocks.stripe;
    if(id==='@/lib/shared')return shared;
    throw Error(`Unexpected import ${id} in ${name}`);
  };
  new Function('require','module','exports',js)(requireMock,mod,mod.exports);
  return mod.exports;
}
const tasks=[];
const shared=load('lib/shared.ts');
const data={amount:'$45.00',name:'Test Customer',email:'test@example.com',service:'Test service',reference:'INV-1'};
const normalized={...data,amount:'45.00'};
const request=(body,url='https://example.com/api/test')=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function drain(){while(tasks.length)await tasks.shift()();}
(async()=>{
  assert.equal(shared.validatePayment(normalized).cents,4500);
  assert.throws(()=>shared.validatePayment({...normalized,amount:'1000000.00'}));

  const store={newReference:()=> '11111111-1111-4111-8111-111111111111',recordFromInput:(id,method,cents,input)=>({id,method,cents,input}),
    recordBestEffort:async()=>false};
  const notify={notifyManualInstructions:async()=>false,notifyProviderEvent:async()=>true};
  process.env.NEXT_PUBLIC_ZELLE_RECIPIENT='2295467045';
  process.env.NEXT_PUBLIC_ZELLE_DISPLAY_NAME='Flexsupport Services';
  process.env.VENMO_HANDLE='@rasika-Wick';
  const zelle=load('app/api/zelle/route.ts',{'@/lib/server':store,'@/lib/notifications':notify});
  const zres=await zelle.POST(request(normalized));
  assert.equal(zres.status,200);assert.equal((await zres.json()).recipient,'2295467045');await drain();
  const venmo=load('app/api/venmo/route.ts',{'@/lib/server':store,'@/lib/notifications':notify});
  const vres=await venmo.POST(request(normalized));
  assert.equal(vres.status,200);assert.equal((await vres.json()).handle,'@rasika-Wick');await drain();

  process.env.STRIPE_SECRET_KEY='sk_test_fake';
  let stripeCreated;let cardOnly=false;
  class StripeStub{
    constructor(secret){assert.equal(secret,'sk_test_fake');}
    checkout={sessions:{create:async(obj)=>{stripeCreated=obj;return {id:'cs_test_123',url:'https://checkout.stripe.com/mock',payment_method_types:cardOnly?['card']:['cashapp']};}}};
  }
  const stripe=load('app/api/stripe/checkout/route.ts',{'@/lib/server':store,stripe:{default:StripeStub}});
  const sres=await stripe.POST(request(normalized));
  assert.equal(sres.status,200);assert.equal((await sres.json()).url,'https://checkout.stripe.com/mock');
  assert.equal(stripeCreated.line_items[0].price_data.unit_amount,4500);
  assert.equal(stripeCreated.payment_method_types,undefined); // newer Stripe API rejects this parameter
  assert.equal(stripeCreated.payment_method_configuration,undefined); // merchant dynamic defaults
  process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION='pmc_test_cash_app';
  const configured=await stripe.POST(request(normalized));
  assert.equal(configured.status,200);
  assert.equal(stripeCreated.payment_method_configuration,'pmc_test_cash_app');
  delete process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION;
  assert.equal(stripeCreated.payment_intent_data.metadata.reference_id,'11111111-1111-4111-8111-111111111111');
  assert.equal(stripeCreated.client_reference_id,'11111111-1111-4111-8111-111111111111');
  cardOnly=true;
  const deniedStripe=await stripe.POST(request(normalized));
  assert.equal(deniedStripe.status,503);
  assert.match((await deniedStripe.json()).error,/Cash App Pay is not enabled/);
  cardOnly=false;
  await drain();

  process.env.PAYPAL_CLIENT_ID='paypal_public_test';process.env.PAYPAL_CLIENT_SECRET='private_secret';process.env.PAYPAL_ENV='sandbox';
  const tokenRoute=load('app/api/paypal/token/route.ts');
  const tdata=await (await tokenRoute.GET()).json();
  assert.equal(tdata.clientId,'paypal_public_test');assert.equal(tdata.sandbox,true);
  assert.ok(!JSON.stringify(tdata).includes('private_secret'));
  const paypalStore={...store,paypalAccessToken:async()=> 'server_access_token',paypalBase:()=> 'https://paypal.example'};
  const paypalOrder=load('app/api/paypal/order/route.ts',{'@/lib/server':paypalStore});
  const originalFetch=global.fetch;
  let payPalCreated;
  global.fetch=async (url,opts)=>{
    assert.equal(url,'https://paypal.example/v2/checkout/orders');
    payPalCreated=JSON.parse(opts.body);
    return Response.json({id:'PAYPALORDER123'});
  };
  const pRes=await paypalOrder.POST(request({...normalized,method:'paypal'}));
  assert.equal(pRes.status,200);assert.equal((await pRes.json()).orderId,'PAYPALORDER123');
  assert.equal(payPalCreated.purchase_units[0].amount.value,'45.00');
  assert.ok(payPalCreated.purchase_units[0].custom_id.startsWith('FS-'));
  await drain();

  const paypalCapture=load('app/api/paypal/capture/route.ts',{'@/lib/server':paypalStore,'@/lib/notifications':notify});
  let captureCalls=0;
  global.fetch=async(url,options)=>{
    if(url.endsWith('/capture')){
      captureCalls++;
      return Response.json({payer:{email_address:'paypalpayer@example.com'},purchase_units:[{payments:{captures:[{id:'PAYCAPTURE123',status:'COMPLETED',amount:{currency_code:'USD',value:'45.00'}}]}}]});
    }
    return Response.json({status:'APPROVED',purchase_units:[{custom_id:'FS-11111111-1111-4111-8111-111111111111',reference_id:'11111111-1111-4111-8111-111111111111',description:'Test service',amount:{currency_code:'USD',value:'45.00'}}]});
  };
  const capRes=await paypalCapture.POST(request({orderId:'PAYPALORDER123'}));
  assert.equal(capRes.status,200);assert.equal((await capRes.json()).status,'COMPLETED');
  assert.equal(captureCalls,1);await drain();
  global.fetch=originalFetch;
  console.log('PASS: validation, Zelle, Venmo, Stripe creation, PayPal public SDK config, PayPal order + verified capture (mocked).');
})().catch(e=>{console.error(e);process.exitCode=1;});
