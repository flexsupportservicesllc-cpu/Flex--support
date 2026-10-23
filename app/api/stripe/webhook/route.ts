import Stripe from 'stripe';
import {recordBestEffort} from '@/lib/server';
import {notifyProviderEvent} from '@/lib/notifications';
export const runtime='nodejs';

export async function POST(request:Request){
  const secret=process.env.STRIPE_SECRET_KEY,webhook=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret||!webhook)return new Response('Stripe webhook is not configured',{status:503});
  const sig=request.headers.get('stripe-signature');
  if(!sig)return new Response('Missing signature',{status:400});
  let event:Stripe.Event;
  try{event=new Stripe(secret).webhooks.constructEvent(await request.text(),sig,webhook);}
  catch{return new Response('Invalid signature',{status:400});}
  if(event.type==='payment_intent.payment_failed'){
    const intent=event.data.object as Stripe.PaymentIntent;
    const meta=intent.metadata||{};
    if(!/^[a-f0-9-]{36}$/i.test(meta.reference_id||'')||intent.currency!=='usd'||intent.amount<100||intent.amount>10000000)
      return Response.json({received:true,ignored:true});
    const failedRecord={id:meta.reference_id,method:'cashapp' as const,status:'failed' as const,amount_cents:intent.amount,currency:'USD' as const,
      customer_name:meta.customer_name||'Stripe customer',customer_email:meta.customer_email||'unknown@stripe.invalid',
      service_description:meta.service||'Flexsupport service payment',reference:meta.notes||null,provider_capture_id:intent.id};
    const saved=await recordBestEffort(failedRecord);
    const alerted=await notifyProviderEvent({id:intent.id,method:'cashapp',status:'failed',amountCents:intent.amount,
      name:failedRecord.customer_name,email:failedRecord.customer_email,service:failedRecord.service_description,reference:meta.reference_id});
    return saved&&alerted?Response.json({received:true}):new Response('Retry payment failure event',{status:500});
  }
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(event.type)){
    return Response.json({received:true});
  }
  const session=event.data.object as Stripe.Checkout.Session;
  if(!session.client_reference_id||!/^[-0-9a-f]{36}$/i.test(session.client_reference_id)||!Number.isInteger(session.amount_total)){
    return new Response('Invalid payment reference',{status:400});
  }
  let status:'paid'|'failed'|'expired'='expired';
  if(event.type==='checkout.session.completed'){
    if(session.payment_status!=='paid')return Response.json({received:true,pending:true});
    status='paid';
  }else if(event.type==='checkout.session.async_payment_succeeded'){
    if(session.payment_status!=='paid')return Response.json({received:true,pending:true});
    status='paid';
  }else if(event.type==='checkout.session.async_payment_failed')status='failed';

  const metadata=session.metadata||{};
  const cents=session.amount_total||0;
  if(cents<100||cents>10000000||session.currency!=='usd')return new Response('Invalid amount',{status:400});
  const customerEmail=session.customer_details?.email||session.customer_email||metadata.customer_email||'unknown@stripe.invalid';
  const record={id:session.client_reference_id,method:'cashapp' as const,status,amount_cents:cents,currency:'USD' as const,
    customer_name:metadata.customer_name||session.customer_details?.name||'Stripe customer',customer_email:customerEmail,
    service_description:metadata.service||'Flexsupport service payment',reference:metadata.notes||null,
    provider_order_id:session.id,provider_capture_id:typeof session.payment_intent==='string'?session.payment_intent:null,
    paid_at:status==='paid'?new Date().toISOString():null};
  const saved=await recordBestEffort(record);
  let alerted=true;
  if(status==='paid'||status==='failed'){
    alerted=await notifyProviderEvent({id:session.id,method:'cashapp',status,amountCents:cents,name:record.customer_name,email:customerEmail,
      service:record.service_description,reference:session.client_reference_id});
  }
  // Retry if EITHER durable tracking or required business alert fails. Resend uses
  // a provider-keyed idempotency key to avoid duplicate notices on retries.
  if(!saved||!alerted)return new Response('Payment event needs retry',{status:500});
  return Response.json({received:true,saved,alerted});
}
