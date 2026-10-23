import 'server-only';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {PaymentInput,PaymentMethod} from './shared';

export type PaymentStatus='pending'|'paid'|'failed'|'expired'|'refunded';
export type PaymentRecord={
  id:string;method:PaymentMethod;amount_cents:number;currency:'USD';
  customer_name:string;customer_email:string;service_description:string;
  reference:string|null;status:PaymentStatus;paid_at?:string|null;
  provider_order_id?:string|null;provider_capture_id?:string|null;
};
export const newReference=()=>randomUUID();

/** Provider checkout never depends on Supabase. Provider receipts remain authoritative. */
export function db(){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw Error('Supabase credentials are not configured');
  return createClient(url,key,{
    auth:{persistSession:false},
    global:{fetch:(resource,init)=>fetch(resource,{...init,signal:AbortSignal.timeout(5000)})}
  });
}
export function recordFromInput(id:string,method:PaymentMethod,cents:number,input:PaymentInput,status:PaymentStatus='pending'):PaymentRecord{
  return {id,method,amount_cents:cents,currency:'USD',customer_name:input.name,customer_email:input.email,
    service_description:input.service,reference:input.reference||null,status};
}
/** Persist server-confirmed provider events without allowing late failure/expiry
 * events to downgrade an already-paid transaction. PostgreSQL applies the
 * conditional UPDATE atomically; duplicate provider deliveries are expected.
 * This stays best-effort: a database outage must not block checkout or capture.
 */
export async function recordBestEffort(record:PaymentRecord,onlyIfMissing=false):Promise<boolean>{
  try{
    const {error:insertError}=await db().from('payments').insert(record);
    if(!insertError)return true;
    if(insertError.code!=='23505'){
      console.error('Payment persistence rejected',{code:insertError.code,message:insertError.message});
      return false;
    }
    // A unique-constraint collision might be on provider_order_id instead of
    // payment id. Never treat that as a successful replay without checking.
    if(onlyIfMissing){
      const {data,error}=await db().from('payments').select('id').eq('id',record.id).maybeSingle();
      return !error&&Boolean(data?.id===record.id);
    }
    const allowed:PaymentStatus[]=record.status==='paid'
      ? ['pending','failed','expired','paid']
      : record.status==='refunded'
        ? ['paid','refunded']
        : ['pending','failed','expired'];
    const {data,error:updateError}=await db().from('payments').update(record)
      .eq('id',record.id).in('status',allowed).select('id');
    if(updateError){console.error('Payment status update rejected',{code:updateError.code,message:updateError.message});return false;}
    if(data?.length)return true;
    // A no-op is expected when an old event arrives after a stronger status.
    // Confirm an existing record with the same id before acknowledging.
    const {data:existing,error:lookupError}=await db().from('payments')
      .select('id,status').eq('id',record.id).maybeSingle();
    if(lookupError||!existing)return false;
    return existing.status==='paid'||existing.status==='refunded';
  }catch(e){console.error('Payment persistence unavailable',e instanceof Error?e.message:'unknown');return false;}
}

export async function paypalAccessToken():Promise<string>{
  const id=process.env.PAYPAL_CLIENT_ID,secret=process.env.PAYPAL_CLIENT_SECRET;
  if(!id||!secret)throw Error('PayPal is not configured.');
  const res=await fetch(`${paypalBase()}/v1/oauth2/token`,{
    method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials',cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  if(!res.ok)throw Error('PayPal authentication failed.');
  const data=await res.json();
  if(typeof data.access_token!=='string')throw Error('PayPal authentication failed.');
  return data.access_token;
}
export function paypalBase(){return process.env.PAYPAL_ENV==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';}
