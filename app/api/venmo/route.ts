import {after} from 'next/server';
import {validatePayment,errorResponse} from '@/lib/shared';
import {newReference,recordFromInput,recordBestEffort} from '@/lib/server';
import {notifyManualInstructions} from '@/lib/notifications';
export const runtime='nodejs';
export async function POST(req:Request){
  try{
    const handle=process.env.VENMO_HANDLE||'@rasika-Wick';
    if(!/^@[a-zA-Z0-9_-]{2,40}$/.test(handle))throw Error('Venmo recipient is not configured.');
    const {input,cents}=validatePayment(await req.json());
    const id=newReference();
    after(async()=>{
      await recordBestEffort(recordFromInput(id,'venmo',cents,input),true);
      if(process.env.ALERT_MANUAL_REQUESTS==='true')await notifyManualInstructions(id,'venmo',cents,input);
    });
    return Response.json({reference:id,status:'pending',handle,amount:(cents/100).toFixed(2)});
  }catch(e){return errorResponse(e);}
}
