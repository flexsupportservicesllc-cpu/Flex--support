import {paypalAccessToken,paypalBase} from '@/lib/server';
export const runtime='nodejs';
export async function GET(){
 try{
 const token=await paypalAccessToken();
 const response=await fetch(`${paypalBase()}/v1/identity/generate-token`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
 if(!response.ok)throw Error('Unable to prepare PayPal checkout.');
 const body=await response.json();return Response.json({clientToken:body.client_token,clientId:process.env.PAYPAL_CLIENT_ID});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'PayPal error'},{status:503})}
}
