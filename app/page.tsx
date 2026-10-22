'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,ChevronLeft,CircleHelp,Copy,Headphones,LockKeyhole,ShieldCheck,Wallet} from 'lucide-react';
import type {PaymentMethod} from '@/lib/shared';

type Form={amount:string;name:string;email:string;service:string;reference:string};
type PaypalSdk={createInstance:(opts:Record<string,unknown>)=>Promise<any>};
declare global{interface Window{paypal?:PaypalSdk}}
const methods:{id:PaymentMethod;label:string;note:string;className:string;letter:string}[]=[
 {id:'cashapp',label:'Cash App Pay',note:'Checkout with Stripe',className:'cash',letter:'$'},
 {id:'zelle',label:'Zelle',note:'Bank transfer',className:'zelle',letter:'Z'},
 {id:'venmo',label:'Venmo',note:'Pay with Venmo',className:'venmo',letter:'V'},
 {id:'paypal',label:'PayPal',note:'Pay with PayPal',className:'paypal',letter:'P'},
];
const initial:Form={amount:'',name:'',email:'',service:'',reference:''};
async function jsonPost(url:string,body:unknown){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to process payment.');return data;}
function loadPaypalScript(sandbox:boolean):Promise<void>{return new Promise((resolve,reject)=>{if(window.paypal){resolve();return;}const script=document.createElement('script');script.src=`https://www.${sandbox?'sandbox.':''}paypal.com/web-sdk/v6/core`;script.async=true;script.onload=()=>resolve();script.onerror=()=>reject(Error('PayPal checkout could not load.'));document.head.appendChild(script);});}
export default function Home(){
 const [form,setForm]=useState<Form>(initial);const [method,setMethod]=useState<PaymentMethod>('cashapp');const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');const [step,setStep]=useState<'form'|'zelle'|'success'>('form');const [zelle,setZelle]=useState<{reference:string;recipient:string;displayName:string}|null>(null);
 const [ready,setReady]=useState<{paypal:boolean;venmo:boolean}>({paypal:false,venmo:false});const [paypalError,setPaypalError]=useState('');
 const sessions=useRef<Record<string,any>>({});const paypalActive=useRef(false);const formRef=useRef(form);useEffect(()=>{formRef.current=form},[form]);
 const amountNumber=Number(form.amount);const validAmount=/^\d{1,6}(\.\d{1,2})?$/.test(form.amount)&&amountNumber>=1&&amountNumber<=100000;
 const update=(key:keyof Form,value:string)=>setForm(prev=>({...prev,[key]:value}));
 const configuredPaypal=useCallback(async()=>{
 if(paypalActive.current)return;paypalActive.current=true;
 try{
 const tokenResponse=await fetch('/api/paypal/token',{cache:'no-store'});const creds=await tokenResponse.json();if(!tokenResponse.ok)throw Error(creds.error||'PayPal not configured');
 await loadPaypalScript(process.env.NEXT_PUBLIC_PAYPAL_ENV!=='live');
 const sdk=await window.paypal!.createInstance({clientToken:creds.clientToken,components:['paypal-payments','venmo-payments'],pageType:'checkout'});
 const eligibility=await sdk.findEligibleMethods({currencyCode:'USD'});
 for(const m of ['paypal','venmo'] as const){
 if(!eligibility.isEligible(m))continue;
 const callbacks={onApprove:async ({orderId}:{orderId:string})=>{try{const response=await jsonPost('/api/paypal/capture',{orderId});if(response.status!=='COMPLETED')throw Error('Payment not yet completed.');setStep('success');}catch(e){setError(e instanceof Error?e.message:'Unable to confirm payment.');}},onCancel:()=>{setError('Checkout was cancelled. You have not been charged by this page.');},onError:()=>setError('Payment provider reported an error. Please try again.')};
 sessions.current[m]=m==='paypal'?sdk.createPayPalOneTimePaymentSession(callbacks):sdk.createVenmoOneTimePaymentSession(callbacks);
 setReady(prev=>({...prev,[m]:true}));
 }
 }catch(e){setPaypalError(e instanceof Error?e.message:'PayPal unavailable');}finally{paypalActive.current=false;}
 },[]);
 useEffect(()=>{configuredPaypal();},[configuredPaypal]);
 async function submit(){setError('');if(!validAmount){setError('Enter an amount from $1 to $100,000.');return;}
 if(form.name.trim().length<2){setError('Please enter your name.');return;}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)){setError('Please enter a valid email address.');return;}if(form.service.trim().length<2){setError('Please tell us which service you are paying for.');return;}
 setLoading(true);
 try{
 if(method==='cashapp') {const data=await jsonPost('/api/stripe/checkout',form);if(!data.url)throw Error('Stripe checkout link unavailable.');window.location.assign(data.url);return;}
 if(method==='zelle'){const data=await jsonPost('/api/zelle',form);setZelle(data);setStep('zelle');return;}
 if(!ready[method]||!sessions.current[method])throw Error(method==='venmo'?'Venmo is not currently available for this account/device.':'PayPal is not yet available.');
 // Use the live form values exactly as validated by server when an order is created.
 await sessions.current[method].start({presentationMode:'auto'},jsonPost('/api/paypal/order',{...form,method}).then(({orderId})=>({orderId})));
 }catch(e){setError(e instanceof Error?e.message:'Payment could not be started.');}finally{setLoading(false)}
 }
 return <main className="site"><header className="nav"><div className="brand"><span className="brand-icon"><Headphones size={23} strokeWidth={2.5}/></span><div className="brand-words"><strong>FLEXSUPPORT</strong><span>SERVICES</span></div></div><span className="nav-secure"><LockKeyhole size={14}/> Secure payments</span></header>
 <div className="wrap"><section className="intro"><span className="eyebrow"><span className="dot"/> SIMPLE & SECURE PAYMENTS</span><h1>Pay your way.<br/><span>We make it easy.</span></h1><p>Quick, convenient payments for Flexsupport Services. Enter your amount, choose how you’d like to pay, and you’re all set.</p><div className="benefits"><span><Check size={15}/> Flexible payment options</span><span><Check size={15}/> No account needed</span></div></section>
 <section className="payment-card" aria-label="Make a payment">
 {step==='success'?<div className="state-content"><span className="big-icon success-icon"><Check size={29}/></span><h2>Payment completed</h2><p>Thank you for choosing Flexsupport Services. Your payment was captured by PayPal. Save your provider receipt for your records.</p><button className="primary" onClick={()=>{setStep('form');setForm(initial);}}>Make another payment <ArrowRight size={18}/></button></div>:
 step==='zelle'&&zelle?<div className="state-content"><button className="back" onClick={()=>setStep('form')}><ChevronLeft size={18}/> Back</button><span className="big-icon zelle-icon">Z</span><h2>Pay with Zelle</h2><p>Open your bank’s app and send the exact amount below to the verified business recipient.</p><div className="zelle-instructions"><span>Amount to send</span><strong>${amountNumber.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><span>Business recipient</span><strong>{zelle.displayName}</strong><div className="copyline"><strong>{zelle.recipient}</strong><button aria-label="Copy recipient" onClick={()=>navigator.clipboard?.writeText(zelle.recipient)}><Copy size={17}/></button></div><span>Reference (include with payment)</span><code>{zelle.reference}</code><button className="copyref" onClick={()=>navigator.clipboard?.writeText(zelle.reference)}>Copy reference <Copy size={15}/></button></div><div className="pending-note"><CircleHelp size={18}/> This payment is pending. We verify Zelle transfers from bank records. Submitting this form does not confirm payment.</div></div>:
 <><div className="card-title"><div><span className="card-kicker">PAYMENT PORTAL</span><h2>Make a payment</h2><p>Fill in the details below to get started.</p></div><span className="card-decor"><Wallet size={21}/></span></div>
 <div className="field"><label htmlFor="amount">Payment amount <b>*</b></label><div className="amount-input"><span>$</span><input id="amount" type="text" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={e=>update('amount',e.target.value)} maxLength={10}/><span className="usd">USD</span></div></div>
 <div className="presets">{[25,50,100,250].map(n=><button key={n} type="button" className={amountNumber===n?'selected':''} onClick={()=>update('amount',String(n))}>${n}</button>)}</div>
 <div className="fields-two"><div className="field"><label htmlFor="name">Full name <b>*</b></label><input id="name" autoComplete="name" placeholder="Your name" value={form.name} onChange={e=>update('name',e.target.value)}/></div><div className="field"><label htmlFor="email">Email address <b>*</b></label><input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={e=>update('email',e.target.value)}/></div></div>
 <div className="field"><label htmlFor="service">Service you're paying for <b>*</b></label><input id="service" placeholder="e.g. Technical support services" value={form.service} onChange={e=>update('service',e.target.value)} maxLength={160}/></div>
 <div className="field"><label htmlFor="reference">Reference or note <span className="optional">(optional)</span></label><input id="reference" placeholder="Add a reference if needed" value={form.reference} onChange={e=>update('reference',e.target.value)} maxLength={100}/></div>
 <div className="select-title"><span>Choose payment method</span><span className="optional">Select one</span></div><div className="methods">{methods.map(item=><button key={item.id} type="button" className={`method ${method===item.id?'active':''}`} onClick={()=>{setMethod(item.id);setError('')}} aria-pressed={method===item.id}><span className={`pay-icon ${item.className}`}>{item.letter}</span><span className="method-text"><strong>{item.label}</strong><small>{item.note}</small></span><span className="radio"><span/></span></button>)}</div>
 {error&&<div className="error" role="alert">{error}</div>}
 <button className="primary" disabled={loading} onClick={submit}>{loading?'Opening checkout…':`Continue with ${methods.find(m=>m.id===method)?.label}`}<ArrowRight size={18}/></button>
 {['paypal','venmo'].includes(method)&&paypalError&&<p className="wallet-hint">{paypalError}. Configure the client's PayPal business credentials to activate checkout.</p>}
 <p className="fineprint"><LockKeyhole size={13}/> Checkout handled by the selected payment provider. Zelle requires separate payment verification.</p></>}
 </section></div>
 <footer><div className="footer-inner"><span>© {new Date().getFullYear()} Flexsupport Services. All rights reserved.</span><span className="footer-right"><ShieldCheck size={16}/> Payments made simple</span></div></footer>
 </main>;
}
