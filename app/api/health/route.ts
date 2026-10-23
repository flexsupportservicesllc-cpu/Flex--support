/** Public, non-sensitive build identifier. This does not certify merchant payments. */
export const runtime='nodejs';
export async function GET(){
  return Response.json({service:'Flexsupport Services',release:'v10',application:'online',paymentVerification:'check-provider-dashboards'},
    {headers:{'Cache-Control':'no-store'}});
}
