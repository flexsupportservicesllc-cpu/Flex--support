import type {Metadata} from 'next';import './styles.css';
export const metadata:Metadata={title:'Flexsupport Services | Secure Service Payments',description:'Pay Flexsupport Services with your preferred payment method. Choose your amount, select a payment method, and check out securely.',openGraph:{title:'Flexsupport Services — Easy Payments',description:'Easy payments. Flexible options.',type:'website'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
