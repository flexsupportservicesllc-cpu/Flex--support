export const runtime='nodejs';
// PayPal v6 standard checkout authenticates with a public Client ID.
// NEVER return the server OAuth access token to the browser.
export async function GET(){
  const clientId=process.env.PAYPAL_CLIENT_ID;
  if(!clientId||!process.env.PAYPAL_CLIENT_SECRET)return Response.json({error:'PayPal is not configured.'},{status:503});
  return Response.json({clientId,sandbox:process.env.PAYPAL_ENV!=='live'},{headers:{'Cache-Control':'no-store'}});
}
