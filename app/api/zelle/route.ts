import {validatePayment,errorResponse} from '@/lib/shared';
import {addPayment} from '@/lib/server';
export async function POST(req:Request){try{
 if(!process.env.NEXT_PUBLIC_ZELLE_RECIPIENT)throw Error('Zelle payment details are not configured.');
 const {input,cents}=validatePayment(await req.json());const id=await addPayment('zelle',cents,input);
 return Response.json({reference:id,status:'pending',recipient:process.env.NEXT_PUBLIC_ZELLE_RECIPIENT,displayName:process.env.NEXT_PUBLIC_ZELLE_DISPLAY_NAME||'Flexsupport Services'});
 }catch(e){return errorResponse(e)}}
