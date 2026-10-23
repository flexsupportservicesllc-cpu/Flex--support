import {after} from 'next/server';
import Stripe from 'stripe';
import {validatePayment,errorResponse} from '@/lib/shared';
import {newReference,recordBestEffort,recordFromInput} from '@/lib/server';
export const runtime='nodejs';
export async function POST(request:Request){
  try{
    const {input,cents}=validatePayment(await request.json());
    if(!process.env.STRIPE_SECRET_KEY)throw Error('Stripe is not configured.');
    const id=newReference();
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const site=(process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin).replace(/\/$/,'');
    // API 2026-09-30.endive+ rejects payment_method_types on new sessions.
    // A dedicated Stripe Payment Method Configuration may restrict checkout to Cash App Pay.
    // If no dedicated configuration is supplied, verify that Cash App is actually
    // offered by the merchant's default dynamic payment methods before redirecting.
    const methodConfiguration=process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION?.trim();
    const session=await stripe.checkout.sessions.create({
      mode:'payment',customer_email:input.email,client_reference_id:id,
      line_items:[{price_data:{currency:'usd',unit_amount:cents,product_data:{name:`Flexsupport Services — ${input.service.slice(0,100)}`}},quantity:1}],
      ...(methodConfiguration?{payment_method_configuration:methodConfiguration}:{}),
      success_url:`${site}/complete?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${site}/?cancelled=1`,
      payment_intent_data:{metadata:{reference_id:id,customer_name:input.name,customer_email:input.email,service:input.service,notes:input.reference||''}},
      metadata:{reference_id:id,customer_name:input.name,customer_email:input.email,service:input.service,notes:input.reference||''}
    });
    if(!session.url)throw Error('Stripe checkout is unavailable.');
    // Never direct customers into a card-only session labelled Cash App Pay.
    if(!session.payment_method_types?.includes('cashapp')){
      console.error('Cash App Pay is not offered by this Stripe checkout configuration');
      return Response.json({error:'Cash App Pay is not enabled for this merchant. Please contact Flexsupport Services.'},{status:503});
    }
    // A failing Supabase connection does NOT prevent a customer opening Stripe Checkout.
    after(()=>recordBestEffort({...recordFromInput(id,'cashapp',cents,input),provider_order_id:session.id},true).then(()=>{}));
    return Response.json({url:session.url,reference:id});
  }catch(e){return errorResponse(e);}
}
