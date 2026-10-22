export type PaymentMethod='cashapp'|'paypal'|'venmo'|'zelle';
export type PaymentInput={amount:string;name:string;email:string;service:string;reference?:string};
export function validatePayment(raw:unknown):{input:PaymentInput;cents:number}{
 if(!raw||typeof raw!=='object')throw Error('Invalid payment information.');
 const r=raw as Record<string,unknown>;
 const amount=String(r.amount??'').trim();
 if(!/^\d{1,6}(\.\d{1,2})?$/.test(amount))throw Error('Enter a valid amount with up to two decimal places.');
 const [whole,decimal='']=amount.split('.');
 const cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<100||cents>10000000)throw Error('Payments must be between $1 and $100,000.');
 const name=String(r.name??'').trim();const email=String(r.email??'').trim();const service=String(r.service??'').trim();const reference=String(r.reference??'').trim();
 if(name.length<2||name.length>100)throw Error('Enter your name.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Enter a valid email.');
 if(service.length<2||service.length>160)throw Error('Describe the service you are paying for.');
 if(reference.length>100)throw Error('Reference is too long.');
 return {input:{amount,name,email,service,reference},cents};
}
export function errorResponse(error:unknown){return Response.json({error:error instanceof Error?error.message:'Unexpected error.'},{status:400});}
