import 'server-only';
import {db} from './server';

type Payment={id:string;created_at:string;paid_at:string|null;method:string;status:string;amount_cents:number;currency:string;customer_name:string;customer_email:string;service_description:string;reference:string|null};
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

async function sendEmail(subject:string,html:string,idempotencyKey:string){
  const apiKey=process.env.RESEND_API_KEY, from=process.env.ALERT_FROM_EMAIL,to=process.env.ALERT_TO_EMAIL;
  if(!apiKey||!from||!to){console.error('Email notifications not configured');return false;}
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from,to:to.split(',').map(s=>s.trim()).filter(Boolean),subject,html}),cache:'no-store'});
  if(!res.ok){console.error('Email provider rejected alert',res.status,(await res.text()).slice(0,300));return false;}
  return true;
}

/** Send once per status transition; Resend idempotency also protects retry paths. */
export async function notifyPayment(id:string,status:'paid'|'failed'|'refunded'){
 const {data,error}=await db().from('payments').select('id,created_at,paid_at,method,status,amount_cents,currency,customer_name,customer_email,service_description,reference').eq('id',id).single();
 if(error||!data||data.status!==status)return;
 const p=data as Payment;
 const subject=`Flexsupport ${status.toUpperCase()}: ${money(p.amount_cents)} (${p.method})`;
 const html=`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Flexsupport Services — ${esc(status.toUpperCase())}</h2><p><b>Amount:</b> ${money(p.amount_cents)}</p><p><b>Method:</b> ${esc(p.method)}</p><p><b>Customer:</b> ${esc(p.customer_name)} (${esc(p.customer_email)})</p><p><b>Service:</b> ${esc(p.service_description)}</p><p><b>Reference:</b> ${esc(p.reference||p.id)}</p><p><b>Recorded:</b> ${esc(p.paid_at||p.created_at)}</p><p>Notification based on recorded provider status. Verify in payment provider for settlement.</p></div>`;
 await sendEmail(subject,html,`flexsupport-${p.id}-${status}`);
}

export async function sendDailyReport(date:string){
 const start=`${date}T00:00:00.000Z`;
 const end=new Date(new Date(start).getTime()+86400000).toISOString();
 const {data,error}=await db().from('payments').select('method,status,amount_cents,created_at,paid_at').gte('created_at',start).lt('created_at',end).order('created_at');
 if(error)throw new Error('Cannot read daily transactions');
 const rows=data||[];
 const totals={paid:0,failed:0,pending:0,refunded:0,other:0};
 for(const p of rows){const key=p.status in totals?p.status as keyof typeof totals:'other';totals[key]++;}
 const paidSum=rows.filter(p=>p.status==='paid').reduce((sum,p)=>sum+p.amount_cents,0);
 const html=`<div style="font-family:Arial,sans-serif;max-width:700px;margin:auto"><h2>Flexsupport Services — Daily Report</h2><p><b>UTC date:</b> ${esc(date)}</p><p><b>Created:</b> ${rows.length} | <b>Paid:</b> ${totals.paid} (${money(paidSum)}) | <b>Failed:</b> ${totals.failed} | <b>Pending:</b> ${totals.pending} | <b>Refunded:</b> ${totals.refunded}</p><table cellpadding="8" border="1" cellspacing="0"><tr><th>Time (UTC)</th><th>Method</th><th>Status</th><th>Amount</th></tr>${rows.map(p=>`<tr><td>${esc(p.created_at)}</td><td>${esc(p.method)}</td><td>${esc(p.status)}</td><td>${money(p.amount_cents)}</td></tr>`).join('')}</table><p>Pending transactions are not counted as received funds. Refunds, chargebacks and later status changes may affect totals.</p></div>`;
 return await sendEmail(`Flexsupport Daily Payments — ${date}`,html,`flexsupport-daily-${date}`);
}
