import Stripe from 'stripe';
import {validatePayment,errorResponse} from '@/lib/shared';
import {addPayment,setPayment} from '@/lib/server';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
 const {input,cents}=validatePayment(await request.json());
 if(!process.env.STRIPE_SECRET_KEY)throw Error('Stripe is not configured.');
 const id=await addPayment('cashapp',cents,input);
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
 const site=process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
 // Dynamic payment methods are configured in Stripe Dashboard. Cash App Pay must be enabled and merchant eligible.
 const session=await stripe.checkout.sessions.create({mode:'payment',customer_email:input.email,client_reference_id:id,
 line_items:[{price_data:{currency:'usd',unit_amount:cents,product_data:{name:`Flexsupport Services — ${input.service.slice(0,100)}`}},quantity:1}],
 payment_method_configuration:process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION||undefined,
 success_url:`${site}/complete?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${site}/?cancelled=1`,
 metadata:{payment_id:id,service:input.service.slice(0,160)}});
 await setPayment(id,{provider_order_id:session.id});
 return Response.json({url:session.url});
 }catch(error){return errorResponse(error)}
}
