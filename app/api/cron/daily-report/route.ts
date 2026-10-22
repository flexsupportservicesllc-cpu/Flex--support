import {sendDailyReport} from '@/lib/notifications';
export const runtime='nodejs';
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});
 try{
  const d=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const ok=await sendDailyReport(d);
  return Response.json({date:d,sent:ok},{status:ok?200:503});
 }catch(e){console.error('Daily report failed',e);return new Response('Daily report failed',{status:500});}
}
