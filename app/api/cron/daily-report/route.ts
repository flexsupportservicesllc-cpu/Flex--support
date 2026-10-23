import {sendDailyReport,notifyDailyReportFailure} from '@/lib/notifications';
export const runtime='nodejs';
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});
 try{
  const d=new Date(Date.now()-86400000).toISOString().slice(0,10);
  try{
    const ok=await sendDailyReport(d);
    if(ok)return Response.json({date:d,sent:true});
  }catch(e){console.error('Daily report failed',e instanceof Error?e.message:'unknown');}
  // A warning email has independent delivery from the failing database query.
  // Never send a successful zero-payment report when the data source failed.
  const warningSent=await notifyDailyReportFailure(d);
  return Response.json({date:d,sent:false,warningSent},{status:503});
 }catch(e){console.error('Daily report handler failed',e instanceof Error?e.message:'unknown');return new Response('Daily report failed',{status:500});}
}
