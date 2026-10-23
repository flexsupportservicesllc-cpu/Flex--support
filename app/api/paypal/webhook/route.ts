import {paypalAccessToken,paypalBase,recordBestEffort} from '@/lib/server';
import {notifyProviderEvent} from '@/lib/notifications';

export const runtime='nodejs';
const ID=/^FS-([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const allowed=new Map<string,'paid'|'failed'>([
  ['PAYMENT.CAPTURE.COMPLETED','paid'],
  ['PAYMENT.CAPTURE.DENIED','failed'],
  ['PAYMENT.CAPTURE.DECLINED','failed']
]);

/** Authenticated asynchronous PayPal payment events. All data is independently
 *  verified against our original server-created order before alerting. */
export async function POST(req:Request){
  const webhookId=process.env.PAYPAL_WEBHOOK_ID;
  if(!webhookId)return new Response('PayPal webhook not configured',{status:503});
  let event:any;
  try{event=JSON.parse(await req.text());}catch{return new Response('Invalid JSON',{status:400});}
  const transmission_id=req.headers.get('paypal-transmission-id');
  const transmission_time=req.headers.get('paypal-transmission-time');
  const cert_url=req.headers.get('paypal-cert-url');
  const auth_algo=req.headers.get('paypal-auth-algo');
  const transmission_sig=req.headers.get('paypal-transmission-sig');
  if(!transmission_id||!transmission_time||!cert_url||!auth_algo||!transmission_sig)return new Response('Missing PayPal signature headers',{status:400});
  try{
    const token=await paypalAccessToken();
    const base=paypalBase();
    const auth={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
    const verified=await fetch(`${base}/v1/notifications/verify-webhook-signature`,{
      method:'POST',headers:auth,body:JSON.stringify({transmission_id,transmission_time,cert_url,auth_algo,transmission_sig,webhook_id:webhookId,webhook_event:event}),
      cache:'no-store',signal:AbortSignal.timeout(12000)
    });
    if(!verified.ok)return new Response('Unable to verify PayPal signature',{status:503});
    if((await verified.json()).verification_status!=='SUCCESS')return new Response('Invalid PayPal signature',{status:401});
    const status=allowed.get(String(event.event_type));
    if(!status)return Response.json({received:true,ignored:true});
    const capture=event.resource;
    const orderId=capture?.supplementary_data?.related_ids?.order_id;
    if(typeof orderId!=='string'||!/^[A-Za-z0-9-]{8,32}$/.test(orderId))return Response.json({received:true,ignored:true});
    const orderRes=await fetch(`${base}/v2/checkout/orders/${orderId}`,{headers:auth,cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!orderRes.ok)return new Response('Unable to verify PayPal order',{status:503});
    const order=await orderRes.json();const unit=order.purchase_units?.[0];
    const match=typeof unit?.custom_id==='string'?ID.exec(unit.custom_id):null;
    if(!match||unit.reference_id!==match[1]||order.purchase_units.length!==1)return Response.json({received:true,ignored:true});
    const cents=Math.round(Number(capture?.amount?.value)*100);
    const orderCents=Math.round(Number(unit.amount?.value)*100);
    if(!Number.isSafeInteger(cents)||cents<100||cents>10000000||cents!==orderCents||capture.amount?.currency_code!=='USD'||unit.amount?.currency_code!=='USD')
      return new Response('PayPal payment amount does not match original order',{status:400});
    const payer=order.payer||{};
    const name=[payer.name?.given_name,payer.name?.surname].filter(Boolean).join(' ')||'PayPal customer';
    const email=payer.email_address||'unknown@paypal.invalid';
    const record={id:match[1],method:'paypal' as const,status,amount_cents:cents,currency:'USD' as const,
      customer_name:name,customer_email:email,service_description:unit.description||'Flexsupport service payment',reference:null,
      provider_order_id:orderId,provider_capture_id:capture.id||null,paid_at:status==='paid'?new Date().toISOString():null};
    const saved=await recordBestEffort(record);
    const alerted=await notifyProviderEvent({id:orderId,method:'paypal',status,amountCents:cents,name,email,service:record.service_description,reference:match[1]});
    if(!saved||!alerted)return new Response('Retry payment recording/alert',{status:500});
    return Response.json({received:true});
  }catch(e){console.error('PayPal webhook processing failed',e instanceof Error?e.message:'unknown');return new Response('Retry event',{status:503});}
}
