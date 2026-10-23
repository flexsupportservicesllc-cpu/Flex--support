import {after} from 'next/server';
import {paypalAccessToken,paypalBase,recordBestEffort} from '@/lib/server';
import {errorResponse} from '@/lib/shared';
import {notifyProviderEvent} from '@/lib/notifications';
export const runtime='nodejs';
const ORDER_ID=/^[A-Za-z0-9-]{8,32}$/;
const FS_ID=/^FS-([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
export async function POST(req:Request){
  try{
    const {orderId}=await req.json();
    if(typeof orderId!=='string'||!ORDER_ID.test(orderId))throw Error('Invalid PayPal order.');
    const token=await paypalAccessToken();
    const base=paypalBase();
    const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
    // Verify the order belongs to our checkout and obtain its authoritative amount.
    const orderResponse=await fetch(`${base}/v2/checkout/orders/${orderId}`,{headers,cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!orderResponse.ok)throw Error('Unable to verify PayPal order.');
    const order=await orderResponse.json();
    const unit=order.purchase_units?.[0];
    const match=typeof unit?.custom_id==='string'?FS_ID.exec(unit.custom_id):null;
    if(!match||unit.reference_id!==match[1]||order.purchase_units?.length!==1)throw Error('Unrecognized PayPal order.');
    const currency=unit.amount?.currency_code;
    const expectedCents=Math.round(Number(unit.amount?.value)*100);
    if(currency!=='USD'||!Number.isSafeInteger(expectedCents)||expectedCents<100||expectedCents>10000000)throw Error('Unexpected order amount.');

    // An idempotent server capture. Customer-provided amounts are NOT trusted here.
    let captureData=order;
    if(order.status!=='COMPLETED'){
      const res=await fetch(`${base}/v2/checkout/orders/${orderId}/capture`,{
        method:'POST',headers:{...headers,'PayPal-Request-Id':`FS-${match[1]}`},body:'{}',cache:'no-store',signal:AbortSignal.timeout(15000)
      });
      captureData=await res.json();
      if(!res.ok){
        const reason=captureData?.details?.[0]?.issue;
        // Notify a provider-declined capture, not an ordinary network timeout or cancellation.
        if(res.status===422&&['INSTRUMENT_DECLINED','TRANSACTION_REFUSED','PAYER_CANNOT_PAY'].includes(reason)){
          const attemptedName=[order.payer?.name?.given_name,order.payer?.name?.surname].filter(Boolean).join(' ')||'PayPal customer';
          const attemptedEmail=order.payer?.email_address||'unknown@paypal.invalid';
          after(()=>notifyProviderEvent({id:orderId,method:'paypal',status:'failed',amountCents:expectedCents,name:attemptedName,email:attemptedEmail,
            service:unit.description||'Flexsupport service payment',reference:match[1]}).then(()=>{}));
        }
        throw Error('PayPal could not complete the payment.');
      }
    }
    const capture=captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const actualCents=Math.round(Number(capture?.amount?.value)*100);
    const paid=capture?.status==='COMPLETED'&&capture.amount?.currency_code==='USD'&&actualCents===expectedCents;
    if(!paid)return Response.json({status:'PENDING'});

    const id=match[1];
    const name=[captureData.payer?.name?.given_name||order.payer?.name?.given_name,captureData.payer?.name?.surname||order.payer?.name?.surname].filter(Boolean).join(' ')||'PayPal customer';
    const email=captureData.payer?.email_address||order.payer?.email_address||'unknown@paypal.invalid';
    const record={id,method:'paypal' as const,status:'paid' as const,amount_cents:expectedCents,currency:'USD' as const,
      customer_name:name,customer_email:email,service_description:unit.description||'Flexsupport service payment',
      reference:null,provider_order_id:orderId,provider_capture_id:capture.id,paid_at:new Date().toISOString()};
    // Payment capture is complete even if database logging is unavailable.
    // Emails use a provider-stable idempotency key and are not dependent on Supabase.
    after(async()=>{
      await recordBestEffort(record);
      await notifyProviderEvent({id:orderId,method:'paypal',status:'paid',amountCents:expectedCents,name,email,service:record.service_description,reference:match[1]});
    });
    return Response.json({status:'COMPLETED'});
  }catch(e){return errorResponse(e);}
}
