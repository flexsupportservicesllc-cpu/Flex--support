import {validatePayment,errorResponse} from '@/lib/shared';
import {addPayment} from '@/lib/server';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const handle=process.env.VENMO_HANDLE||'@rasika-Wick';
  if(!/^@[a-zA-Z0-9_-]{2,40}$/.test(handle))throw Error('Venmo payment details are not configured.');
  const {input,cents}=validatePayment(await req.json());
  const id=await addPayment('venmo',cents,input);
  return Response.json({reference:id,status:'pending',handle,amount:(cents/100).toFixed(2)});
 }catch(e){return errorResponse(e)}
}
