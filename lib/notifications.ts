import 'server-only';
import {db} from './server';
import type {PaymentInput,PaymentMethod} from './shared';

const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

async function sendEmail(subject:string,html:string,idempotencyKey:string):Promise<boolean>{
  const apiKey=process.env.RESEND_API_KEY,from=process.env.ALERT_FROM_EMAIL,to=process.env.ALERT_TO_EMAIL;
  if(!apiKey||!from||!to){console.error('Business email alert is not configured');return false;}
  try{
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
      body:JSON.stringify({from,to:to.split(',').map(x=>x.trim()).filter(Boolean),subject,html}),cache:'no-store',signal:AbortSignal.timeout(10000)
    });
    if(!response.ok){console.error('Email send failed',response.status);return false;}
    return true;
  }catch(e){console.error('Email transport failed',e instanceof Error?e.message:'unknown');return false;}
}

/** Alerts come from a provider-confirmed status, not a user clicking Continue. */
export async function notifyProviderEvent(event:{id:string;method:'cashapp'|'paypal';status:'paid'|'failed'|'refunded';amountCents:number;name:string;email:string;service:string;reference:string}):Promise<boolean>{
  const subject=`Flexsupport ${event.status.toUpperCase()}: ${money(event.amountCents)} (${event.method})`;
  const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Flexsupport Services: ${esc(event.status.toUpperCase())}</h2><p><b>Provider-confirmed status:</b> ${esc(event.status)}</p><p><b>Amount:</b> ${money(event.amountCents)}</p><p><b>Method:</b> ${esc(event.method)}</p><p><b>Customer:</b> ${esc(event.name)} (${esc(event.email)})</p><p><b>Service:</b> ${esc(event.service)}</p><p><b>Reference:</b> ${esc(event.reference)}</p><p><b>Provider reference:</b> ${esc(event.id)}</p><p>Confirm settlement in the payment-provider dashboard.</p></div>`;
  return sendEmail(subject,html,`flexsupport-provider-${event.id}-${event.status}`);
}
/** A manual transfer request is NOT a verified payment; never label it paid or failed. */
export async function notifyManualInstructions(id:string,method:'venmo'|'zelle',cents:number,input:PaymentInput):Promise<boolean>{
  const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Flexsupport: Manual payment instructions opened</h2><p>This is <b>NOT a confirmed payment</b>. Independently verify any transfer in the receiving account.</p><p><b>Method:</b> ${esc(method)}</p><p><b>Amount requested:</b> ${money(cents)}</p><p><b>Customer:</b> ${esc(input.name)} (${esc(input.email)})</p><p><b>Service:</b> ${esc(input.service)}</p><p><b>Reference:</b> ${esc(id)}</p></div>`;
  return sendEmail(`Flexsupport PENDING instructions: ${money(cents)} (${method})`,html,`flexsupport-manual-${id}`);
}
export async function sendDailyReport(date:string):Promise<boolean>{
  const start=`${date}T00:00:00.000Z`,end=new Date(new Date(start).getTime()+86400000).toISOString();
  const {data,error}=await db().from('payments').select('method,status,amount_cents,created_at').gte('created_at',start).lt('created_at',end).order('created_at');
  if(error)throw Error('Daily-report database query failed');
  const rows=data||[];
  const paid=rows.filter(p=>p.status==='paid'),failed=rows.filter(p=>p.status==='failed'),pending=rows.filter(p=>p.status==='pending');
  const paidAmount=paid.reduce((sum,p)=>sum+p.amount_cents,0);
  const html=`<div style="font-family:Arial,sans-serif;max-width:650px;margin:auto"><h2>Flexsupport Daily Report — ${esc(date)} (UTC)</h2><p>Recorded: ${rows.length} | Paid: ${paid.length} (${money(paidAmount)}) | Failed: ${failed.length} | Pending/manual: ${pending.length}</p><table border="1" cellpadding="6" cellspacing="0"><tr><th>UTC time</th><th>Method</th><th>Status</th><th>Amount</th></tr>${rows.map(p=>`<tr><td>${esc(p.created_at)}</td><td>${esc(p.method)}</td><td>${esc(p.status)}</td><td>${money(p.amount_cents)}</td></tr>`).join('')}</table><p><b>Important:</b> This is a database activity summary, not a bank settlement report. If Supabase was unavailable, some provider transactions or manual instruction requests may be missing. Reconcile Stripe, PayPal, Zelle, and Venmo independently.</p></div>`;
  return sendEmail(`Flexsupport Daily Payments — ${date}`,html,`flexsupport-daily-${date}`);
}

/** Delivery issue with the scheduled report: send a clear failure alert instead of
 * silently omitting the report or claiming a zero-transaction day. */
export async function notifyDailyReportFailure(date:string):Promise<boolean>{
  const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Flexsupport daily report unavailable</h2><p>The payments database could not be read for ${esc(date)} (UTC). This is <b>not</b> a zero-payment report.</p><p>Check Stripe and PayPal for confirmed transactions, and verify Venmo and Zelle directly. Restore database reporting before relying on daily totals.</p></div>`;
  return sendEmail(`Flexsupport REPORT UNAVAILABLE — ${date}`,html,`flexsupport-daily-unavailable-${date}`);
}
