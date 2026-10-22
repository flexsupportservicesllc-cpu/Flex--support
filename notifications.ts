import Stripe from 'stripe';
import {db} from '@/lib/server';
import {notifyPayment} from '@/lib/notifications';
export const runtime='nodejs';
export async function POST(request:Request){
 const secret=process.env.STRIPE_SECRET_KEY,webhook=process.env.STRIPE_WEBHOOK_SECRET;
 if(!secret||!webhook)return new Response('Stripe not configured',{status:503});
 const sig=request.headers.get('stripe-signature');if(!sig)return new Response('Missing signature',{status:400});
 let event:Stripe.Event;
 try{event=new Stripe(secret).webhooks.constructEvent(await request.text(),sig,webhook)}catch{return new Response('Invalid signature',{status:400})}
 if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
 const session=event.data.object as Stripe.Checkout.Session;
 if(session.payment_status==='paid'&&session.client_reference_id){
 const {error}=await db().from('payments').update({status:'paid',provider_order_id:session.id,paid_at:new Date().toISOString()}).eq('id',session.client_reference_id).eq('amount_cents',session.amount_total).eq('method','cashapp');
 if(error)return new Response('Database update failed',{status:500});
 await notifyPayment(session.client_reference_id,'paid');
 }}
 if(event.type==='checkout.session.async_payment_failed'){
 const session=event.data.object as Stripe.Checkout.Session;
 if(session.client_reference_id){const {error}=await db().from('payments').update({status:'failed'}).eq('id',session.client_reference_id).eq('status','pending');if(error)return new Response('Database update failed',{status:500});await notifyPayment(session.client_reference_id,'failed');}
 }
 if(event.type==='checkout.session.expired'){
 const session=event.data.object as Stripe.Checkout.Session;
 if(session.client_reference_id)await db().from('payments').update({status:'expired'}).eq('id',session.client_reference_id).eq('status','pending');
 }
 return Response.json({received:true});
}
