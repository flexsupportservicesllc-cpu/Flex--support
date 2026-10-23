import {after} from 'next/server';
import {validatePayment,errorResponse} from '@/lib/shared';
import {paypalAccessToken,paypalBase,newReference,recordFromInput,recordBestEffort} from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request){
  try{
    const body=await req.json();
    if(body.method!=='paypal')throw Error('Invalid PayPal payment method.');
    const {input,cents}=validatePayment(body);
    const id=newReference();
    const access=await paypalAccessToken();
    const response=await fetch(`${paypalBase()}/v2/checkout/orders`,{
      method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json','PayPal-Request-Id':id},
      body:JSON.stringify({intent:'CAPTURE',purchase_units:[{
        reference_id:id,custom_id:`FS-${id}`,description:input.service.slice(0,127),
        amount:{currency_code:'USD',value:(cents/100).toFixed(2)}
      }]}),cache:'no-store',signal:AbortSignal.timeout(12000)
    });
    const data=await response.json();
    if(!response.ok||!data.id)throw Error('Unable to start PayPal checkout.');
    after(()=>recordBestEffort({...recordFromInput(id,'paypal',cents,input),provider_order_id:data.id},true).then(()=>{}));
    return Response.json({orderId:data.id});
  }catch(e){return errorResponse(e);}
}
