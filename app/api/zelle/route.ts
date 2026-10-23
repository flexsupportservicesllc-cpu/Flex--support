import {after} from 'next/server';
import {validatePayment,errorResponse} from '@/lib/shared';
import {newReference,recordFromInput,recordBestEffort} from '@/lib/server';
import {notifyManualInstructions} from '@/lib/notifications';
export const runtime='nodejs';
export async function POST(req:Request){
  try{
    const recipient=process.env.NEXT_PUBLIC_ZELLE_RECIPIENT;
    if(!recipient)throw Error('Zelle payment details are not configured.');
    const {input,cents}=validatePayment(await req.json());
    const id=newReference();
    after(async()=>{
      await recordBestEffort(recordFromInput(id,'zelle',cents,input),true);
      if(process.env.ALERT_MANUAL_REQUESTS==='true')await notifyManualInstructions(id,'zelle',cents,input);
    });
    return Response.json({reference:id,status:'pending',recipient,displayName:process.env.NEXT_PUBLIC_ZELLE_DISPLAY_NAME||'Flexsupport Services'});
  }catch(e){return errorResponse(e);}
}
