import 'server-only';
import {createClient} from '@supabase/supabase-js';
import type {PaymentInput,PaymentMethod} from './shared';
export function db(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('Supabase server configuration is missing.');return createClient(url,key,{auth:{persistSession:false}});}
export async function addPayment(method:PaymentMethod,cents:number,input:PaymentInput){
 const {data,error}=await db().from('payments').insert({method,amount_cents:cents,currency:'USD',customer_name:input.name,customer_email:input.email,service_description:input.service,reference:input.reference||null,status:'pending'}).select('id').single();
 if(error)throw Error('Unable to create payment record.');return data.id as string;
}
export async function setPayment(id:string,updates:Record<string,unknown>){const {error}=await db().from('payments').update(updates).eq('id',id);if(error)throw Error('Unable to update payment record.');}
export async function paypalAccessToken(){
 const id=process.env.PAYPAL_CLIENT_ID,secret=process.env.PAYPAL_CLIENT_SECRET;
 if(!id||!secret)throw Error('PayPal is not configured.');
 const base=paypalBase();
 const res=await fetch(`${base}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',cache:'no-store'});
 if(!res.ok)throw Error('PayPal authentication failed.');
 return (await res.json()).access_token as string;
}
export function paypalBase(){return process.env.PAYPAL_ENV==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';}
