/* No-money verification for PayPal and Stripe provider webhook handlers. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(name,mocks){
 const source=fs.readFileSync(path.join(root,name),'utf8');
 const code=ts.transpileModule(source,{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)((id)=>{if(id in mocks)return mocks[id];throw Error('Unexpected import '+id);},mod,mod.exports);
 return mod.exports;
}
const reference='11111111-1111-4111-8111-111111111111';
const orderId='PAYPALORDER123';
const paypalOrder={purchase_units:[{custom_id:`FS-${reference}`,reference_id:reference,description:'Test service',amount:{currency_code:'USD',value:'45.00'}}],payer:{email_address:'payer@example.com'}};
const record=[];const notices=[];
let persistOk=true, notifyOk=true;
const store={paypalAccessToken:async()=> 'fake_token',paypalBase:()=> 'https://paypal.example',recordBestEffort:async row=>{record.push(row);return persistOk;}};
const notifications={notifyProviderEvent:async value=>{notices.push(value);return notifyOk;}};
const payPalWebhook=load('app/api/paypal/webhook/route.ts',{'@/lib/server':store,'@/lib/notifications':notifications});
process.env.PAYPAL_WEBHOOK_ID='WH-TEST-ONLY';
const headers={'paypal-transmission-id':'fake-abc','paypal-transmission-time':new Date().toISOString(),'paypal-cert-url':'https://paypal.example/cert','paypal-auth-algo':'SHA256withRSA','paypal-transmission-sig':'mock'};
const paypalRequest=(status='PAYMENT.CAPTURE.COMPLETED')=>new Request('https://example.test/api/paypal/webhook',{method:'POST',headers,body:JSON.stringify({event_type:status,resource:{id:'CAPTURE123',amount:{value:'45.00',currency_code:'USD'},supplementary_data:{related_ids:{order_id:orderId}}}})});
class StripeMock{
 constructor(secret){assert.equal(secret,'sk_test_fake');}
 webhooks={constructEvent:async()=>{throw Error('not used');}};
}
StripeMock.prototype.webhooks={constructEvent:()=>{throw Error('not configured');}};
(async()=>{
 const oldFetch=global.fetch;
 let signatureOK=true;
 global.fetch=async url=>{
   if(url.endsWith('/v1/notifications/verify-webhook-signature'))return Response.json({verification_status:signatureOK?'SUCCESS':'FAILURE'});
   if(url.endsWith(`/v2/checkout/orders/${orderId}`))return Response.json(paypalOrder);
   throw Error('Unexpected PayPal request '+url);
 };
 const paidRes=await payPalWebhook.POST(paypalRequest());
 assert.equal(paidRes.status,200);assert.equal(record[0].status,'paid');assert.equal(notices[0].status,'paid');
 signatureOK=false;
 const invalidRes=await payPalWebhook.POST(paypalRequest());
 assert.equal(invalidRes.status,401);assert.equal(record.length,1);
 signatureOK=true;persistOk=false;
 const retry=await payPalWebhook.POST(paypalRequest('PAYMENT.CAPTURE.DENIED'));
 assert.equal(retry.status,500);persistOk=true;
 // Stripe signed webhook event mock: validates event routing and retries.
 const stripeEvents=[];
 class StripeProvider{
  constructor(key){assert.equal(key,'sk_test_fake');this.webhooks={constructEvent:(body,sig,secret)=>{
    assert.equal(sig,'fake-signature');assert.equal(secret,'whsec_fake');
    return stripeEvents.shift();
  }};}
 }
 const stripeWebhook=load('app/api/stripe/webhook/route.ts',{stripe:{default:StripeProvider},'@/lib/server':store,'@/lib/notifications':notifications});
 process.env.STRIPE_SECRET_KEY='sk_test_fake';process.env.STRIPE_WEBHOOK_SECRET='whsec_fake';
 const stripeRequest=()=>new Request('https://example.test/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'fake-signature'},body:'{}'});
 stripeEvents.push({type:'payment_intent.payment_failed',data:{object:{id:'pi_test',currency:'usd',amount:4500,metadata:{reference_id:reference,customer_name:'Test',customer_email:'test@example.com',service:'Test service'}}}});
 const stripeResult=await stripeWebhook.POST(stripeRequest());
 assert.equal(stripeResult.status,200);assert.equal(notices.at(-1).status,'failed');
 notifyOk=false;
 stripeEvents.push({type:'checkout.session.completed',data:{object:{client_reference_id:reference,payment_status:'paid',amount_total:4500,currency:'usd',customer_email:'test@example.com',metadata:{customer_name:'Test',service:'Test service'},id:'cs_test'}}});
 const emailFail=await stripeWebhook.POST(stripeRequest());assert.equal(emailFail.status,500);
 global.fetch=oldFetch;
 console.log('PASS: PayPal signature rejection, paid webhook, retry on DB failure; Stripe payment failed alert and retry on email failure (mocked).');
})().catch(e=>{console.error(e);process.exitCode=1;});
