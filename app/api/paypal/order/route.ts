import {validatePayment,errorResponse} from '@/lib/shared';
import {paypalAccessToken,paypalBase,addPayment,setPayment} from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request){try{
 const body=await req.json();const {input,cents}=validatePayment(body);
 const method=body.method;if(method!=='paypal'&&method!=='venmo')throw Error('Invalid PayPal payment type.');
 const id=await addPayment(method,cents,input);const access=await paypalAccessToken();
 const response=await fetch(`${paypalBase()}/v2/checkout/orders`,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json','PayPal-Request-Id':id},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:id,custom_id:id,description:input.service.slice(0,127),amount:{currency_code:'USD',value:(cents/100).toFixed(2)}}],payment_source:undefined})});
 const data=await response.json();if(!response.ok||!data.id)throw Error('Unable to create PayPal order.');
 await setPayment(id,{provider_order_id:data.id});return Response.json({orderId:data.id});
 }catch(e){return errorResponse(e)}}
