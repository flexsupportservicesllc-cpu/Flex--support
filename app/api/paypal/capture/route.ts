import {db,paypalAccessToken,paypalBase} from '@/lib/server';
import {errorResponse} from '@/lib/shared';
export const runtime='nodejs';
export async function POST(req:Request){try{
 const {orderId}=await req.json();if(typeof orderId!=='string'||!/^[-A-Z0-9]{8,32}$/.test(orderId))throw Error('Invalid order.');
 const {data:payment,error}=await db().from('payments').select('id,amount_cents,status').eq('provider_order_id',orderId).in('method',['paypal','venmo']).single();
 if(error||!payment)throw Error('Order not found.');
 if(payment.status==='paid')return Response.json({status:'COMPLETED'});
 const access=await paypalAccessToken();
 const res=await fetch(`${paypalBase()}/v2/checkout/orders/${orderId}/capture`,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json','PayPal-Request-Id':`capture-${payment.id}`},body:'{}'});
 const data=await res.json();if(!res.ok)throw Error('Payment was not captured.');
 const capture=data.purchase_units?.[0]?.payments?.captures?.[0];
 const paid=capture?.status==='COMPLETED'&&capture.amount?.currency_code==='USD'&&Math.round(Number(capture.amount?.value)*100)===payment.amount_cents;
 if(paid){const {error:updateError}=await db().from('payments').update({status:'paid',paid_at:new Date().toISOString(),provider_capture_id:capture.id}).eq('id',payment.id);if(updateError)throw Error('Payment processed but database update failed.');}
 return Response.json({status:paid?'COMPLETED':'PENDING'});
 }catch(e){return errorResponse(e)}}
