

export const flagUrl = (iso) => iso ? `https://flagcdn.com/w40/${iso}.png` : null;
export const COUNTRIES = [
  {code:"KES",name:"Kenya",iso:"ke",dialCode:"254",rails:[
    {type:"mobile",label:"Mobile money",options:["M-Pesa (Safaricom)","Airtel Money"],field:"Recipient phone number",placeholder:"0712 345 678",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["KCB Bank","Equity Bank","Co-operative Bank"],field:"Recipient account number",placeholder:"0100234567",arrival:"Arrives within minutes"},
  ]},
  {code:"NGN",name:"Nigeria",iso:"ng",dialCode:"234",rails:[
    {type:"mobile",label:"Mobile money",options:["OPay","PalmPay"],field:"Recipient phone number",placeholder:"0803 123 4567",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["GTBank","Access Bank","Zenith Bank"],field:"Recipient account number",placeholder:"0123456789",arrival:"Arrives within minutes"},
  ]},
  {code:"UGX",name:"Uganda",iso:"ug",dialCode:"256",rails:[
    {type:"mobile",label:"Mobile money",options:["MTN Mobile Money","Airtel Money"],field:"Recipient phone number",placeholder:"0772 345 678",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["Stanbic Bank","Centenary Bank"],field:"Recipient account number",placeholder:"9030012345678",arrival:"Arrives within 1 business day"},
  ]},
  {code:"GHS",name:"Ghana",iso:"gh",dialCode:"233",rails:[
    {type:"mobile",label:"Mobile money",options:["MTN MoMo","AirtelTigo Money"],field:"Recipient phone number",placeholder:"024 123 4567",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["GCB Bank","Ecobank Ghana"],field:"Recipient account number",placeholder:"1021304050",arrival:"Arrives within 1 business day"},
  ]},
  {code:"TZS",name:"Tanzania",iso:"tz",dialCode:"255",rails:[
    {type:"mobile",label:"Mobile money",options:["M-Pesa Tanzania","Tigo Pesa"],field:"Recipient phone number",placeholder:"0754 123 456",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["CRDB Bank","NMB Bank"],field:"Recipient account number",placeholder:"015200123456",arrival:"Arrives within 1 business day"},
  ]},
  {code:"ZAR",name:"South Africa",iso:"za",dialCode:"27",rails:[
    {type:"bank",label:"Bank transfer (EFT)",options:["FNB","Standard Bank","Absa"],field:"Recipient account number",placeholder:"62883910234",arrival:"Arrives same business day"},
  ]},
  {code:"EGP",name:"Egypt",iso:"eg",dialCode:"20",rails:[
    {type:"bank",label:"Bank transfer",options:["CIB Egypt","National Bank of Egypt"],field:"Recipient account number",placeholder:"100234567890",arrival:"Arrives within 1 business day"},
  ]},
  {code:"USD",name:"United States",iso:"us",dialCode:"1",rails:[
    {type:"bank",label:"Wire (ACH/SWIFT)",options:["Circle IBAN Partner"],field:"Recipient routing + account number",placeholder:"026073150 / 8811226789",arrival:"Arrives same business day"},
  ]},
  {code:"GBP",name:"United Kingdom",iso:"gb",dialCode:"44",rails:[
    {type:"bank",label:"Faster Payments",options:["ClearBank Ltd"],field:"Recipient sort code + account",placeholder:"04-00-04 / 22148890",arrival:"Arrives same business day"},
  ]},
  {code:"EUR",name:"Eurozone",iso:"de",dialCode:"49",rails:[
    {type:"bank",label:"SEPA transfer",options:["Modulr FS"],field:"Recipient IBAN",placeholder:"FR76 3000 6000 0112 3456 7890 189",arrival:"Arrives in 1-2 business days"},
  ]},
];
export const CURRENCIES = COUNTRIES;
export const MOBILE_CURRENCIES = COUNTRIES.filter(c=>c.rails.some(r=>r.type==="mobile"));
export const BANK_CURRENCIES = COUNTRIES;
export const DEPOSIT_NETWORKS = [
  {key:"base",label:"Base"},
  {key:"ethereum",label:"Ethereum"},
  {key:"polygon",label:"Polygon"},
  {key:"solana",label:"Solana"},
  {key:"stellar",label:"Stellar"},
];
export const DEPOSIT_ADDRESSES = {base:"0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4a",ethereum:"0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4a",polygon:"0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4a",solana:"8f6QeR3v2N4pXo1WkYtLc9Zb5jHs7DrMnA2VuT3xPqK"};
export const ACCOUNTS = [
  {code:"KES",iso:"ke",name:"Kenyan Shilling",balance:"2,481,300.00",rail:"Mobile money",detail:"Paybill 400200",receiveLines:[["Paybill number","400200"],["Account name","Mboka Business Ltd"]]},
  {code:"USD",iso:"us",name:"US Dollar",balance:"184,220.55",rail:"IBAN · SWIFT",detail:"DE89 3704 ·· 4210",receiveLines:[["Routing number","026073150"],["Account number","8811226789"],["SWIFT","CRESUSXX"]]},
  {code:"EUR",iso:"de",name:"Euro",balance:"92,014.30",rail:"IBAN · SEPA",detail:"FR76 3000 ·· 0189",receiveLines:[["IBAN","FR76 3000 6000 0112 3456 7890 189"],["BIC","MODRFR21"]]},
  {code:"GBP",iso:"gb",name:"British Pound",balance:"40,880.00",rail:"IBAN · Faster Pay",detail:"GB29 NWBK ·· 1608",receiveLines:[["Sort code","04-00-04"],["Account number","22148890"]]},
  {code:"USDC",iso:null,name:"USD Coin",balance:"180,860.00",rail:"Stablecoin · multi-chain",detail:"Base, Ethereum, Solana, Stellar"},
  {code:"USDT",iso:null,name:"Tether",balance:"12,900.00",rail:"Stablecoin · multi-chain",detail:"Polygon, Ethereum"},
];
export const ROLES = [  {key:"admin", label:"Admin", desc:"Full access, including team and API keys"},
  {key:"finance", label:"Finance", desc:"Move money, view all balances and reports"},
  {key:"operator", label:"Operator", desc:"Create payouts, no access to keys or team"},
  {key:"viewer", label:"Viewer", desc:"Read-only access to balances and activity"},
];
export const TEAM_MEMBERS = [
  {id:"u1", name:"Amara Nwosu", email:"amara@yourapp.com", role:"admin", status:"active"},
  {id:"u2", name:"Kwame Asante", email:"kwame@yourapp.com", role:"finance", status:"active"},
  {id:"u3", name:"Fatima Al-Sayed", email:"fatima@yourapp.com", role:"operator", status:"active"},
  {id:"u4", name:"Daniel Otieno", email:"daniel@yourapp.com", role:"viewer", status:"invited"},
];
export const API_KEYS = [
  {id:"prod", label:"Production", mode:"live", key:"ep_live_sk_9c41b2d8a7e30f56b1c2", webhookUrl:"https://api.yourapp.com/webhooks/elementpay", events:"payment.settled · payment.failed · deposit.credited", webhookSecret:"whsec_7f2a9d4e1c88b0f3a6d5"},
  {id:"sandbox", label:"Sandbox", mode:"test", key:"ep_test_sk_1a2b3c4d5e6f7081920a", webhookUrl:"https://staging.yourapp.com/webhooks/elementpay", events:"payment.settled · payment.failed", webhookSecret:"whsec_2b8e5f7a3d19c4b0e6a1"},
];
export const CORRIDORS = [
  {code:"KES",iso:"ke",label:"M-Pesa mobile money",provider:"Safaricom (priority 1)",status:"live"},
  {code:"NGN",iso:"ng",label:"Bank transfer",provider:"Wema Bank (priority 1)",status:"live"},
  {code:"GHS",iso:"gh",label:"MTN MoMo",provider:"MTN (priority 1)",status:"degraded"},
  {code:"EUR",iso:"de",label:"SEPA transfer",provider:"Modulr FS (priority 1)",status:"live"},
];
export const TRANSACTIONS = [
  {client:"Wanjiru Njeri",iso:"ke",type:"Payout",amount:"-KES 42,300",status:"done",ref:"EP-T88213"},
  {client:"Acme GmbH",iso:"de",type:"Invoice",amount:"+EUR 4,500.00",status:"done",ref:"EP-T88214"},
  {client:"Kwame Osei",iso:"gh",type:"Payout",amount:"-GHS 1,850",status:"pending",ref:"EP-T88215"},
  {client:"Lagos Freight Co",iso:"ng",type:"Payout",amount:"-NGN 960,000",status:"done",ref:"EP-T88216"},
  {client:"USDC deposit",iso:null,type:"Deposit",amount:"+USDC 12,000",status:"done",ref:"EP-T88217"},
  {client:"Kigali Roasters",iso:"rw",type:"Payout",amount:"-RWF 540,000",status:"failed",ref:"EP-T88218"},
];
export const BULK_ROWS = [
  {name:"Wanjiru Njeri",iso:"ke",rail:"M-Pesa",amount:"$318.40"},
  {name:"Kwame Osei",iso:"gh",rail:"MTN MoMo",amount:"$150.00"},
  {name:"Lagos Freight Co",iso:"ng",rail:"GTBank",amount:"$960.00"},
  {name:"Acme GmbH",iso:"de",rail:"SEPA",amount:"$1,204.00"},
  {name:"Kigali Roasters",iso:"rw",rail:"Bank transfer",amount:"$420.00"},
];
export const INVOICES = [
  {id:"INV-0231",client:"Acme GmbH",amount:"EUR 4,500.00",status:"paid"},
  {id:"INV-0232",client:"Lagos Freight Co",amount:"USD 3,200.00",status:"pending"},
  {id:"INV-0233",client:"Kigali Roasters",amount:"USD 980.00",status:"overdue"},
];
export const STATUS_MAP = {
  done:["Settled","var(--indigo-text)","var(--indigo-tint)"],
  pending:["Pending","var(--amber)","var(--amber-tint)"],
  failed:["Failed","var(--red)","var(--red-tint)"],
  paid:["Paid","var(--indigo-text)","var(--indigo-tint)"],
  overdue:["Overdue","var(--red)","var(--red-tint)"],
};

export const LIGHT = {
  "--bg": "#F6F4EF",
  "--surface": "rgba(255,255,255,0.55)",
  "--surface2": "rgba(19,17,38,0.045)",
  "--surface3": "rgba(19,17,38,0.09)",
  "--border": "rgba(19,17,38,0.08)",
  "--glass-border": "rgba(19,17,38,0.08)",
  "--sheen": "rgba(255,255,255,0.5)",
  "--ink": "#131126",
  "--muted": "#4C4A66",
  "--muted2": "#8B89A6",
  "--muted3": "#8B89A6",
  "--indigo": "#3B2ED3",
  "--indigo-bright": "#3B2ED3",
  "--indigo-on": "#fff",
  "--indigo-text": "#3B2ED3",
  "--indigo-tint": "#EEEDFB",
  "--red": "#E5484D",
  "--red-tint": "#FCEBEC",
  "--amber": "#B47700",
  "--amber-tint": "#FBF2DE",
  "--ink-panel": "#131126",
  "--ink-panel-text": "#8B89A6",
  "--input-bg": "rgba(255,255,255,0.6)",
  "--input-border": "rgba(19,17,38,0.11)",
  "--modal-bg": "#FFFFFF",
  "--overlay-bg": "rgba(19,17,38,0.38)",
  "--panel": "#FFFFFF",
  "--success": "#1A8A4A",
  "--success-tint": "rgba(26,138,74,0.12)",
};
export const DARK = {
  "--bg": "#000000",
  "--surface": "rgba(255,255,255,0.045)",
  "--surface2": "rgba(255,255,255,0.055)",
  "--surface3": "rgba(255,255,255,0.11)",
  "--border": "rgba(255,255,255,0.1)",
  "--glass-border": "rgba(255,255,255,0.1)",
  "--sheen": "rgba(255,255,255,0.16)",
  "--ink": "#F2F0FA",
  "--muted": "#B4B1D0",
  "--muted2": "#807D9E",
  "--muted3": "#807D9E",
  "--indigo": "#7C6FFF",
  "--indigo-bright": "#7C6FFF",
  "--indigo-on": "#0E0D1C",
  "--indigo-text": "#A79EFF",
  "--indigo-tint": "#221E4A",
  "--red": "#FF6B70",
  "--red-tint": "#3A1B22",
  "--amber": "#F5B84B",
  "--amber-tint": "#332A14",
  "--ink-panel": "#0B0A14",
  "--ink-panel-text": "#8B89A6",
  "--input-bg": "rgba(255,255,255,0.05)",
  "--input-border": "rgba(255,255,255,0.14)",
  "--modal-bg": "#121116",
  "--overlay-bg": "rgba(0,0,0,0.6)",
  "--panel": "#121116",
  "--success": "#4ADE80",
  "--success-tint": "rgba(74,222,128,0.16)",
};
export const DARK_HC_OVERRIDES = {
  "--surface2": "rgba(255,255,255,0.09)",
  "--surface3": "rgba(255,255,255,0.16)",
  "--border": "rgba(255,255,255,0.18)",
  "--glass-border": "rgba(255,255,255,0.18)",
  "--muted2": "#9E9BC0",
  "--input-bg": "rgba(255,255,255,0.09)",
  "--input-border": "rgba(255,255,255,0.28)",
  "--modal-bg": "#17161d",
  "--panel": "#17161d",
};

export function qp(k){ try { return new URLSearchParams(window.location.search).get(k) || ""; } catch(e){ return ""; } }
