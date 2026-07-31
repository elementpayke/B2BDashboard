"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

type Props = {
  boostDarkContrast?: boolean;
  forceMobile?: boolean;
  startInApp?: boolean;
  startScreen?: string;
  startTheme?: string;
};


const flagUrl = (iso) => iso ? `https://flagcdn.com/w40/${iso}.png` : null;
const COUNTRIES = [
  {code:"KES",name:"Kenya",iso:"ke",rails:[
    {type:"mobile",label:"Mobile money",options:["M-Pesa (Safaricom)","Airtel Money"],field:"Recipient phone number",placeholder:"0712 345 678",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["KCB Bank","Equity Bank","Co-operative Bank"],field:"Recipient account number",placeholder:"0100234567",arrival:"Arrives within minutes"},
  ]},
  {code:"NGN",name:"Nigeria",iso:"ng",rails:[
    {type:"mobile",label:"Mobile money",options:["OPay","PalmPay"],field:"Recipient phone number",placeholder:"0803 123 4567",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["GTBank","Access Bank","Zenith Bank"],field:"Recipient account number",placeholder:"0123456789",arrival:"Arrives within minutes"},
  ]},
  {code:"UGX",name:"Uganda",iso:"ug",rails:[
    {type:"mobile",label:"Mobile money",options:["MTN Mobile Money","Airtel Money"],field:"Recipient phone number",placeholder:"0772 345 678",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["Stanbic Bank","Centenary Bank"],field:"Recipient account number",placeholder:"9030012345678",arrival:"Arrives within 1 business day"},
  ]},
  {code:"GHS",name:"Ghana",iso:"gh",rails:[
    {type:"mobile",label:"Mobile money",options:["MTN MoMo","AirtelTigo Money"],field:"Recipient phone number",placeholder:"024 123 4567",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["GCB Bank","Ecobank Ghana"],field:"Recipient account number",placeholder:"1021304050",arrival:"Arrives within 1 business day"},
  ]},
  {code:"TZS",name:"Tanzania",iso:"tz",rails:[
    {type:"mobile",label:"Mobile money",options:["M-Pesa Tanzania","Tigo Pesa"],field:"Recipient phone number",placeholder:"0754 123 456",arrival:"Arrives in seconds"},
    {type:"bank",label:"Bank transfer",options:["CRDB Bank","NMB Bank"],field:"Recipient account number",placeholder:"015200123456",arrival:"Arrives within 1 business day"},
  ]},
  {code:"ZAR",name:"South Africa",iso:"za",rails:[
    {type:"bank",label:"Bank transfer (EFT)",options:["FNB","Standard Bank","Absa"],field:"Recipient account number",placeholder:"62883910234",arrival:"Arrives same business day"},
  ]},
  {code:"EGP",name:"Egypt",iso:"eg",rails:[
    {type:"bank",label:"Bank transfer",options:["CIB Egypt","National Bank of Egypt"],field:"Recipient account number",placeholder:"100234567890",arrival:"Arrives within 1 business day"},
  ]},
  {code:"USD",name:"United States",iso:"us",rails:[
    {type:"bank",label:"Wire (ACH/SWIFT)",options:["Circle IBAN Partner"],field:"Recipient routing + account number",placeholder:"026073150 / 8811226789",arrival:"Arrives same business day"},
  ]},
  {code:"GBP",name:"United Kingdom",iso:"gb",rails:[
    {type:"bank",label:"Faster Payments",options:["ClearBank Ltd"],field:"Recipient sort code + account",placeholder:"04-00-04 / 22148890",arrival:"Arrives same business day"},
  ]},
  {code:"EUR",name:"Eurozone",iso:"de",rails:[
    {type:"bank",label:"SEPA transfer",options:["Modulr FS"],field:"Recipient IBAN",placeholder:"FR76 3000 6000 0112 3456 7890 189",arrival:"Arrives in 1-2 business days"},
  ]},
];
const CURRENCIES = COUNTRIES;
const MOBILE_CURRENCIES = COUNTRIES.filter(c=>c.rails.some(r=>r.type==="mobile"));
const BANK_CURRENCIES = COUNTRIES;
const DEPOSIT_NETWORKS = [{key:"base",label:"Base"},{key:"ethereum",label:"Ethereum"},{key:"polygon",label:"Polygon"},{key:"solana",label:"Solana"}];
const DEPOSIT_ADDRESSES = {base:"0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4a",ethereum:"0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4a",polygon:"0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4a",solana:"8f6QeR3v2N4pXo1WkYtLc9Zb5jHs7DrMnA2VuT3xPqK"};
const ACCOUNTS = [
  {code:"KES",iso:"ke",name:"Kenyan Shilling",balance:"2,481,300.00",rail:"Mobile money",detail:"Paybill 400200",receiveLines:[["Paybill number","400200"],["Account name","ElementPay Business Ltd"]]},
  {code:"USD",iso:"us",name:"US Dollar",balance:"184,220.55",rail:"IBAN · SWIFT",detail:"DE89 3704 ·· 4210",receiveLines:[["Routing number","026073150"],["Account number","8811226789"],["SWIFT","CRESUSXX"]]},
  {code:"EUR",iso:"de",name:"Euro",balance:"92,014.30",rail:"IBAN · SEPA",detail:"FR76 3000 ·· 0189",receiveLines:[["IBAN","FR76 3000 6000 0112 3456 7890 189"],["BIC","MODRFR21"]]},
  {code:"GBP",iso:"gb",name:"British Pound",balance:"40,880.00",rail:"IBAN · Faster Pay",detail:"GB29 NWBK ·· 1608",receiveLines:[["Sort code","04-00-04"],["Account number","22148890"]]},
  {code:"USDC",iso:null,name:"USD Coin",balance:"180,860.00",rail:"Stablecoin · multi-chain",detail:"Base, Ethereum, Solana"},
  {code:"USDT",iso:null,name:"Tether",balance:"12,900.00",rail:"Stablecoin · multi-chain",detail:"Polygon, Ethereum"},
];
const ROLES = [  {key:"admin", label:"Admin", desc:"Full access, including team and API keys"},
  {key:"finance", label:"Finance", desc:"Move money, view all balances and reports"},
  {key:"operator", label:"Operator", desc:"Create payouts, no access to keys or team"},
  {key:"viewer", label:"Viewer", desc:"Read-only access to balances and activity"},
];
const TEAM_MEMBERS = [
  {id:"u1", name:"Amara Nwosu", email:"amara@yourapp.com", role:"admin", status:"active"},
  {id:"u2", name:"Kwame Asante", email:"kwame@yourapp.com", role:"finance", status:"active"},
  {id:"u3", name:"Fatima Al-Sayed", email:"fatima@yourapp.com", role:"operator", status:"active"},
  {id:"u4", name:"Daniel Otieno", email:"daniel@yourapp.com", role:"viewer", status:"invited"},
];
const API_KEYS = [
  {id:"prod", label:"Production", mode:"live", key:"ep_live_sk_9c41b2d8a7e30f56b1c2", webhookUrl:"https://api.yourapp.com/webhooks/elementpay", events:"payment.settled · payment.failed · deposit.credited", webhookSecret:"whsec_7f2a9d4e1c88b0f3a6d5"},
  {id:"sandbox", label:"Sandbox", mode:"test", key:"ep_test_sk_1a2b3c4d5e6f7081920a", webhookUrl:"https://staging.yourapp.com/webhooks/elementpay", events:"payment.settled · payment.failed", webhookSecret:"whsec_2b8e5f7a3d19c4b0e6a1"},
];
const CORRIDORS = [
  {code:"KES",iso:"ke",label:"M-Pesa mobile money",provider:"Safaricom (priority 1)",status:"live"},
  {code:"NGN",iso:"ng",label:"Bank transfer",provider:"Wema Bank (priority 1)",status:"live"},
  {code:"GHS",iso:"gh",label:"MTN MoMo",provider:"MTN (priority 1)",status:"degraded"},
  {code:"EUR",iso:"de",label:"SEPA transfer",provider:"Modulr FS (priority 1)",status:"live"},
];
const TRANSACTIONS = [
  {client:"Wanjiru Njeri",iso:"ke",type:"Payout",amount:"-KES 42,300",status:"done",ref:"EP-T88213"},
  {client:"Acme GmbH",iso:"de",type:"Invoice",amount:"+EUR 4,500.00",status:"done",ref:"EP-T88214"},
  {client:"Kwame Osei",iso:"gh",type:"Payout",amount:"-GHS 1,850",status:"pending",ref:"EP-T88215"},
  {client:"Lagos Freight Co",iso:"ng",type:"Payout",amount:"-NGN 960,000",status:"done",ref:"EP-T88216"},
  {client:"USDC deposit",iso:null,type:"Deposit",amount:"+USDC 12,000",status:"done",ref:"EP-T88217"},
  {client:"Kigali Roasters",iso:"rw",type:"Payout",amount:"-RWF 540,000",status:"failed",ref:"EP-T88218"},
];
const BULK_ROWS = [
  {name:"Wanjiru Njeri",iso:"ke",rail:"M-Pesa",amount:"$318.40"},
  {name:"Kwame Osei",iso:"gh",rail:"MTN MoMo",amount:"$150.00"},
  {name:"Lagos Freight Co",iso:"ng",rail:"GTBank",amount:"$960.00"},
  {name:"Acme GmbH",iso:"de",rail:"SEPA",amount:"$1,204.00"},
  {name:"Kigali Roasters",iso:"rw",rail:"Bank transfer",amount:"$420.00"},
];
const INVOICES = [
  {id:"INV-0231",client:"Acme GmbH",amount:"EUR 4,500.00",status:"paid"},
  {id:"INV-0232",client:"Lagos Freight Co",amount:"USD 3,200.00",status:"pending"},
  {id:"INV-0233",client:"Kigali Roasters",amount:"USD 980.00",status:"overdue"},
];
const CARDS = [
  {label:"Marketing Ads",last4:"4471",balance:"$1,240.00",bg:"#131126",status:"active"},
  {label:"Ops Spend",last4:"9982",balance:"$620.50",bg:"#3B2ED3",status:"active"},
  {label:"Contractor Pay",last4:"1120",balance:"$0.00",bg:"#131126",status:"frozen"},
];
const STATUS_MAP = {
  done:["Settled","var(--indigo-text)","var(--indigo-tint)"],
  pending:["Pending","var(--amber)","var(--amber-tint)"],
  failed:["Failed","var(--red)","var(--red-tint)"],
  paid:["Paid","var(--indigo-text)","var(--indigo-tint)"],
  overdue:["Overdue","var(--red)","var(--red-tint)"],
};

const LIGHT = {"--bg":"#F6F4EF","--surface":"rgba(255,255,255,0.55)","--surface2":"rgba(19,17,38,0.045)","--surface3":"rgba(19,17,38,0.09)","--border":"rgba(19,17,38,0.08)","--glass-border":"rgba(19,17,38,0.08)","--sheen":"rgba(255,255,255,0.5)","--ink":"#131126","--muted":"#4C4A66","--muted2":"#8B89A6","--muted3":"#8B89A6","--indigo":"#3B2ED3","--indigo-bright":"#3B2ED3","--indigo-on":"#fff","--indigo-text":"#3B2ED3","--indigo-tint":"#EEEDFB","--red":"#E5484D","--red-tint":"#FCEBEC","--amber":"#B47700","--amber-tint":"#FBF2DE","--ink-panel":"#131126","--ink-panel-text":"#8B89A6","--input-bg":"rgba(255,255,255,0.6)","--input-border":"rgba(19,17,38,0.11)","--modal-bg":"rgba(251,250,247,0.85)","--overlay-bg":"rgba(19,17,38,0.32)","--panel":"#FFFFFF"};
const DARK = {"--bg":"#000000","--surface":"rgba(255,255,255,0.045)","--surface2":"rgba(255,255,255,0.055)","--surface3":"rgba(255,255,255,0.11)","--border":"rgba(255,255,255,0.1)","--glass-border":"rgba(255,255,255,0.1)","--sheen":"rgba(255,255,255,0.16)","--ink":"#F2F0FA","--muted":"#B4B1D0","--muted2":"#807D9E","--muted3":"#807D9E","--indigo":"#7C6FFF","--indigo-bright":"#7C6FFF","--indigo-on":"#0E0D1C","--indigo-text":"#A79EFF","--indigo-tint":"#221E4A","--red":"#FF6B70","--red-tint":"#3A1B22","--amber":"#F5B84B","--amber-tint":"#332A14","--ink-panel":"#0B0A14","--ink-panel-text":"#8B89A6","--input-bg":"rgba(255,255,255,0.05)","--input-border":"rgba(255,255,255,0.14)","--modal-bg":"rgba(14,13,22,0.82)","--overlay-bg":"rgba(0,0,0,0.6)","--panel":"#121116"};
const DARK_HC_OVERRIDES = {"--surface2":"rgba(255,255,255,0.09)","--surface3":"rgba(255,255,255,0.16)","--border":"rgba(255,255,255,0.18)","--glass-border":"rgba(255,255,255,0.18)","--muted2":"#9E9BC0","--input-bg":"rgba(255,255,255,0.09)","--input-border":"rgba(255,255,255,0.28)","--modal-bg":"rgba(10,9,17,0.97)","--panel":"#17161d"};

function qp(k){ try { return new URLSearchParams(window.location.search).get(k) || ""; } catch(e){ return ""; } }

export default function ElementPayDashboard(props: Props = {}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const [state, setStateRaw] = useState<any>(() => ({
    theme: qp("theme") || props.startTheme || "light", appEntered: (props.startInApp === true) || (qp("app") === "1"), screen: qp("screen") || props.startScreen || "home",
    isMobile: props.forceMobile || (typeof window !== "undefined" && window.innerWidth < 900), sidebarOpen: false,
    modal: qp("modal") || null,
    sendStep: 1, sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0, sendRecipient: "", sendAmount: "", sendDone: false, sendAsset: "usdc", sendChain: "base",
    depositStep: 1, depositGroup: "country", depositCountryIdx: 0, depositRailIdx: 0, depositProviderIdx: 0, depositPhone: "", depositPromptSent: false, depositAsset: "usdc", depositNetwork: "base",
    receiveGroup: "fiat", receiveAcctIdx: 0, receiveAsset: "usdc", receiveNetwork: "base", copiedKey: "",
    bulkSelected: [0,3,6], bulkLoaded: false, bulkDone: false,
    onrampDir: "onramp", quoteSeconds: 87, swapAccepted: false,
    stableSel: "USDC", txFilter: "all",
    lcAmt: "1,000", lcCountryIdx: 0,
    selectedTxIdx: 0, selectedAcctIdx: 0, selectedCardIdx: 0,
    apiKeyRevealed: {}, secretRevealed: {}, copiedField: "",
    teamMembers: TEAM_MEMBERS, inviteOpen: false, inviteName: "", inviteEmail: "", inviteRole: "operator",
    newCardLabel: "", newCardDone: false,
    invClient: "", invAmount: "", invoiceDone: false,
    cardFrozen: false, tierDone: false,
    fundAmount: "250.00", fundCardDone: false,
    balanceView: "all", sendGroup: "country",
  }));
  const setState = useCallback((update: any) => {
    setStateRaw((prev: any) => ({ ...prev, ...(typeof update === "function" ? update(prev) : update) }));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setState((s: any) => ({ quoteSeconds: Math.max(0, s.quoteSeconds - 1) })), 1000);
    const onResize = () => { if (props.forceMobile) return; const m = window.innerWidth < 900; setState((s: any) => s.isMobile === m ? null : { isMobile: m, sidebarOpen: false }); };
    window.addEventListener("resize", onResize);
    return () => { clearInterval(timer); window.removeEventListener("resize", onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const enterApp = () => setState({ appEntered: true });
  const exitApp = () => setState({ appEntered: false });
  const toggleTheme = () => setState(s => ({ theme: s.theme === "light" ? "dark" : "light" }));
  const toggleSidebar = () => setState(s => ({ sidebarOpen: !s.sidebarOpen }));
  const closeSidebar = () => setState({ sidebarOpen: false });
  const setScreen = (s) => () => setState({ screen: s, sidebarOpen: false });
  const goTransactions = () => setState({ screen: "transactions" });
  const setLcAmt = (e) => setState({ lcAmt: e.target.value });
  const selectLcCountry = (i) => () => setState({ lcCountryIdx: i });

  const openModal = (name) => () => setState({
    modal: name, sendStep: 1, sendDone: false, sendRecipient: "", sendAmount: "", sendCountryIdx: 0, sendRailIdx: 0, sendProviderIdx: 0, sendGroup: "country",
    bulkLoaded: false, bulkDone: false, depositStep: 1, depositPromptSent: false, depositCountryIdx: 0, depositRailIdx: 0, depositProviderIdx: 0, depositGroup: "country",
    receiveGroup: "fiat", receiveAcctIdx: 0, receiveAsset: "usdc", receiveNetwork: "base", copiedKey: "",
    swapAccepted: false, onrampDir: "onramp", quoteSeconds: 87,
    newCardLabel: "", newCardDone: false, invClient: "", invAmount: "", invoiceDone: false,
  });
  const sendNext = () => setState(s => ({ sendStep: Math.min(3, s.sendStep + 1) }));
  const sendBack = () => setState(s => ({ sendStep: Math.max(1, s.sendStep - 1) }));
  const depositNext = () => setState(s => ({ depositStep: Math.min(2, s.depositStep + 1) }));
  const depositBack = () => setState(s => ({ depositStep: Math.max(1, s.depositStep - 1) }));
  const closeModal = () => setState({ modal: null });
  const stopClick = (e) => e.stopPropagation();
  const openTxDetail = (i) => () => setState({ modal: "txDetail", selectedTxIdx: i });
  const openAcctDetail = (i) => () => setState({ modal: "acctDetail", selectedAcctIdx: i });
  const openCardDetail = (i) => () => setState({ modal: "cardDetail", selectedCardIdx: i });
  const openNewCard = () => setState({ modal: "newCard", newCardLabel: "", newCardDone: false });
  const openModalInvoice = () => setState({ modal: "invoice", invClient: "", invAmount: "", invoiceDone: false });
  const openModalTier = () => setState({ modal: "tier", tierDone: false });
  const openModalSwapFromAcct = () => setState({ modal: "swap", swapAccepted: false, onrampDir: "onramp", quoteSeconds: 87 });

  const selectSendCountry = (i) => () => setState({ sendCountryIdx: i, sendRailIdx: 0, sendProviderIdx: 0 });
  const selectSendRail = (i) => () => setState({ sendRailIdx: i, sendProviderIdx: 0 });
  const selectSendProvider = (i) => () => setState({ sendProviderIdx: i });
  const setSendRecipient = (e) => setState({ sendRecipient: e.target.value });
  const setSendAmount = (e) => setState({ sendAmount: e.target.value });
  const submitSend = () => { if (state.sendRecipient.trim() && state.sendAmount.trim()) setState({ sendDone: true }); };

  const setDepositGroup = (g) => () => setState({ depositGroup: g, depositCountryIdx: 0, depositRailIdx: 0, depositProviderIdx: 0, depositPromptSent: false });
  const selectDepositCountry = (i) => () => setState({ depositCountryIdx: i, depositRailIdx: 0, depositProviderIdx: 0, depositPromptSent: false });
  const selectDepositRail = (i) => () => setState({ depositRailIdx: i, depositProviderIdx: 0, depositPromptSent: false });
  const selectDepositProvider = (i) => () => setState({ depositProviderIdx: i, depositPromptSent: false });
  const setDepositPhone = (e) => setState({ depositPhone: e.target.value });
  const sendDepositPrompt = () => { if (state.depositPhone.trim()) setState({ depositPromptSent: true }); };
  const setSendAsset = (k) => () => setState({ sendAsset: k });
  const setSendChain = (k) => () => setState({ sendChain: k });
  const setDepositAsset = (k) => () => setState({ depositAsset: k });
  const setDepositNetwork = (k) => () => setState({ depositNetwork: k });

  const setReceiveGroup = (g) => () => setState({ receiveGroup: g, copiedKey: "" });
  const selectReceiveAcct = (i) => () => setState({ receiveAcctIdx: i, copiedKey: "" });
  const setReceiveAsset = (k) => () => setState({ receiveAsset: k, copiedKey: "" });
  const setReceiveNetwork = (k) => () => setState({ receiveNetwork: k, copiedKey: "" });
  const copyReceiveField = (key, val) => () => { if (navigator.clipboard) navigator.clipboard.writeText(val).catch(()=>{}); setState({ copiedKey: key }); };

  const toggleBulkCountry = (i) => () => setState(s => ({ bulkSelected: s.bulkSelected.includes(i) ? s.bulkSelected.filter(x => x !== i) : [...s.bulkSelected, i] }));
  const simulateBulkUpload = () => setState({ bulkLoaded: true });
  const runBulkPayout = () => setState({ bulkDone: true });

  const setStable = (k) => () => setState({ stableSel: k });
  const setOnramp = () => setState({ onrampDir: "onramp" });
  const setOfframp = () => setState({ onrampDir: "offramp" });
  const refreshQuote = () => setState({ quoteSeconds: 87 });
  const acceptQuote = () => { if (state.quoteSeconds > 0) setState({ swapAccepted: true }); };
  const setTxFilter = (f) => () => setState({ txFilter: f });
  const openCreateAccount = () => setState({ modal: "deposit", depositGroup: "mobile", depositCountryIdx: 0 });

  const toggleRevealKey = (id) => () => setState(s => ({ apiKeyRevealed: { ...s.apiKeyRevealed, [id]: !s.apiKeyRevealed[id] } }));
  const toggleRevealSecret = (id) => () => setState(s => ({ secretRevealed: { ...s.secretRevealed, [id]: !s.secretRevealed[id] } }));
  const copyField = (fieldKey, val) => () => { if (navigator.clipboard) navigator.clipboard.writeText(val).catch(()=>{}); setState({ copiedField: fieldKey }); };
  const createApiKey = () => {};
  const revokeApiKey = (id) => () => {};

  const openInvite = () => setState({ inviteOpen: true, inviteName: "", inviteEmail: "", inviteRole: "operator" });
  const closeInvite = () => setState({ inviteOpen: false });
  const setInviteName = (e) => setState({ inviteName: e.target.value });
  const setInviteEmail = (e) => setState({ inviteEmail: e.target.value });
  const setInviteRole = (k) => () => setState({ inviteRole: k });
  const submitInvite = () => {
    const { inviteName, inviteEmail, inviteRole, teamMembers } = state;
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const id = "u" + (teamMembers.length + 1) + "_" + Date.now();
    setState({
      teamMembers: [...teamMembers, { id, name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole, status: "invited" }],
      inviteOpen: false,
    });
  };
  const setMemberRole = (id) => (e) => {
    const role = e.target.value;
    setState(s => ({ teamMembers: s.teamMembers.map(m => m.id === id ? { ...m, role } : m) }));
  };
  const removeMember = (id) => () => setState(s => ({ teamMembers: s.teamMembers.filter(m => m.id !== id) }));
  const setNewCardLabel = (e) => setState({ newCardLabel: e.target.value });
  const issueCard = () => { if (state.newCardLabel.trim()) setState({ newCardDone: true }); };
  const setInvClient = (e) => setState({ invClient: e.target.value });
  const setInvAmount = (e) => setState({ invAmount: e.target.value });
  const submitInvoice = () => { if (state.invClient.trim() && state.invAmount.trim()) setState({ invoiceDone: true }); };
  const toggleFreezeCard = () => setState(s => ({ cardFrozen: !s.cardFrozen }));
  const uploadTierDoc = () => {};
  const submitTier = () => setState({ tierDone: true });
  const fundCard = () => setState({ modal: "fundCard", fundCardDone: false });
  const withdrawCard = () => setState({ modal: "fundCard", fundCardDone: false });
  const openFundCardDirect = (i) => (e) => { e.stopPropagation(); setState({ modal: "fundCard", fundCardDone: false, selectedCardIdx: i }); };
  const openWithdrawDirect = (i) => (e) => { e.stopPropagation(); setState({ modal: "fundCard", fundCardDone: false, selectedCardIdx: i }); };
  const terminateCard = () => setState({ modal: null });
  const setFundAmount = (e) => setState({ fundAmount: e.target.value });
  const submitFundCard = () => { if (state.fundAmount.trim()) setState({ fundCardDone: true }); };
  const setBalanceView = (v) => () => setState({ balanceView: v });
  const setSendGroup = (g) => () => setState({ sendGroup: g, sendCountryIdx: 0 });


    const s = state;
    const boostDark = props.boostDarkContrast ?? true;
    const vars = s.theme === "dark" ? (boostDark ? { ...DARK, ...DARK_HC_OVERRIDES } : DARK) : LIGHT;

    const navMap = [
      { key: "home", label: "Home", group: "Overview" },
      { key: "wallets", label: "Wallets", group: null },
      { key: "cards", label: "Cards", group: null },
      { key: "transactions", label: "Transactions", group: "Money" },
      { key: "invoices", label: "Invoices", group: null },
      { key: "reports", label: "Reports", group: null },
      { key: "verification", label: "Verification", group: "Account" },
      { key: "team", label: "Team", group: null },
      { key: "developer", label: "Developer", group: null },
    ];
    const titles = {
      home: ["Home", "Your balances, actions, and activity at a glance"],
      wallets: ["Wallets", "One main stablecoin wallet, currency accounts around it"],
      cards: ["Cards", "Virtual USD cards for team spend"],
      transactions: ["Transactions", "Every payout, deposit, and swap across rails"],
      invoices: ["Invoices", "Request and track incoming payments"],
      reports: ["Reports", "Volume, corridors, and settlement performance"],
      verification: ["Verification", "Higher tiers unlock higher limits"],
      team: ["Team", "Invite teammates and manage their access"],
      developer: ["Developer", "API keys and webhooks"],
    };
    const [currentTitle, currentSubtitle] = titles[s.screen];

    const allCountryChips = (selIdx, selectFn) => COUNTRIES.map((c, i) => ({
      flagUrl: flagUrl(c.iso), name: c.name, code: c.code, select: selectFn(i),
      bg: i === selIdx ? "var(--indigo-tint)" : "var(--surface2)", border: i === selIdx ? "var(--indigo)" : "transparent",
    }));
    const sendCountryChips = allCountryChips(s.sendCountryIdx, selectSendCountry).map(c => ({ ...c, selectSend: c.select, sendBg: c.bg, sendBorder: c.border }));
    const sendCountry = COUNTRIES[s.sendCountryIdx];
    const sendRailChips = sendCountry.rails.map((r, i) => ({ label: r.label, select: selectSendRail(i), bg: i === s.sendRailIdx ? "var(--ink)" : "var(--surface2)", color: i === s.sendRailIdx ? "var(--bg)" : "var(--ink)" }));
    const sendRail = sendCountry.rails[s.sendRailIdx] || sendCountry.rails[0];
    const sendProvider = sendRail.options[s.sendProviderIdx] || sendRail.options[0];
    const sendProviderChips = sendRail.options.map((name, i) => ({ name, select: selectSendProvider(i), bg: i === s.sendProviderIdx ? "var(--indigo-tint)" : "var(--surface2)", border: i === s.sendProviderIdx ? "var(--indigo)" : "transparent" }));

    const depositCountryChips = allCountryChips(s.depositCountryIdx, selectDepositCountry).map(c => ({ ...c, selectDeposit: c.select, depositBg: c.bg, depositBorder: c.border }));
    const depositCountry = COUNTRIES[s.depositCountryIdx];
    const depositRailChips = depositCountry.rails.map((r, i) => ({ label: r.label, select: selectDepositRail(i), bg: i === s.depositRailIdx ? "var(--ink)" : "var(--surface2)", color: i === s.depositRailIdx ? "var(--bg)" : "var(--ink)" }));
    const depositRail = depositCountry.rails[s.depositRailIdx] || depositCountry.rails[0];
    const depositProvider = depositRail.options[s.depositProviderIdx] || depositRail.options[0];
    const depositProviderChips = depositRail.options.map((name, i) => ({ name, select: selectDepositProvider(i), bg: i === s.depositProviderIdx ? "var(--indigo-tint)" : "var(--surface2)", border: i === s.depositProviderIdx ? "var(--indigo)" : "transparent" }));

    const bulkCountryChips = COUNTRIES.slice(0, 10).map((c, i) => ({
      flagUrl: flagUrl(c.iso), code: c.code, toggleBulk: toggleBulkCountry(i),
      bulkBg: s.bulkSelected.includes(i) ? "var(--indigo-tint)" : "var(--surface2)",
      bulkBorder: s.bulkSelected.includes(i) ? "var(--indigo)" : "transparent",
    }));

    const quoteExpired = s.quoteSeconds <= 0;
    const isOnrampDir = s.onrampDir === "onramp";
    const decorateTx = (t, i) => {
      const [label, color, soft] = STATUS_MAP[t.status];
      return { ...t, flagUrl: flagUrl(t.iso), statusLabel: label, statusColor: color, statusSoft: soft, amountColor: t.amount.startsWith("+") ? "var(--indigo-text)" : "var(--ink)", openDetail: openTxDetail(i) };
    };
    const decoratedAll = TRANSACTIONS.map(decorateTx);
    const filteredTransactions = s.txFilter === "all" ? decoratedAll : decoratedAll.filter(t => t.status === s.txFilter);
    const txDetail = decoratedAll[s.selectedTxIdx];
    const acctDetail = { ...ACCOUNTS[s.selectedAcctIdx], flagUrl: flagUrl(ACCOUNTS[s.selectedAcctIdx].iso) };
    const cardSel = CARDS[s.selectedCardIdx];
  const rootStyle: React.CSSProperties = { minHeight: "100vh", position: "relative", background: "var(--bg)", color: "var(--ink)", fontFamily: "'DM Sans',sans-serif", ...vars };
  const themeIcon = s.theme === "dark" ? "☀" : "☾";
  const isLanding = !s.appEntered;
  const isApp = s.appEntered;
  const lcAmt = s.lcAmt;
  const lcCountryChips = CURRENCIES.slice(0,6).map((c,i) => ({ flagUrl: flagUrl(c.iso), code: c.code, select: selectLcCountry(i), bg: i === s.lcCountryIdx ? "var(--indigo-tint)" : "var(--surface2)", border: i === s.lcCountryIdx ? "var(--indigo)" : "transparent" }));
  const lcOut = (parseFloat(s.lcAmt.replace(/,/g,"")||"0") * 131.64).toLocaleString(undefined,{maximumFractionDigits:0}) + " " + CURRENCIES[s.lcCountryIdx % 6].code;
  const lcRate = "1 USD = 131.64 " + CURRENCIES[s.lcCountryIdx % 6].code;
  const allCountryFlags = CURRENCIES.map(c => ({ flagUrl: flagUrl(c.iso), code: c.code }));
  const landingFeatures = [
        { letter: "A", title: "Global accounts & IBANs", desc: "Get a EUR IBAN, UK sort code and US ACH details in your business name." },
        { letter: "P", title: "Instant payouts", desc: "Pay vendors and teams to mobile money, banks and wallets across 20+ countries in minutes." },
        { letter: "S", title: "Stablecoin engine", desc: "USDC and USDT on Base and Polygon power settlement under the hood." },
        { letter: "T", title: "Multi-currency treasury", desc: "Hold and swap between fiat and digital assets with a 90-second rate lock." },
        { letter: "C", title: "Virtual cards", desc: "USD virtual cards for team spend with limits and freeze controls." },
        { letter: "E", title: "Enterprise controls", desc: "Role-based access, approval workflows, tiered KYB limits, full audit trail." },
      ];
  const engineRails = [
        { dot: "var(--indigo)", label: "Collect", tag: "fiat in" },
        { dot: "#2151F5", label: "Settle", tag: "~seconds" },
        { dot: "#8247E5", label: "Convert", tag: "mid-market" },
        { dot: "#fff", label: "Payout", tag: "fiat out" },
      ];
  const engineStats = [
        { value: "20+", label: "countries live" },
        { value: "3m 41s", label: "avg settlement" },
        { value: "98.6%", label: "success rate" },
        { value: "2", label: "chains" },
      ];
  const isMobile = s.isMobile;
  const overlayStyle: React.CSSProperties = { display: s.isMobile && s.sidebarOpen ? "block" : "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 30 };
  const asideStyle: React.CSSProperties = {
        background: "var(--surface)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderRight: "1px solid var(--glass-border)", display: "flex", flexDirection: "column", padding: "18px 14px", gap: "0",
        ...(s.isMobile
          ? { position: "fixed", top: 0, left: 0, bottom: 0, width: "250px", zIndex: 40, overflowY: "auto", transform: s.sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.2s ease" }
          : { position: "relative", width: "250px", flexShrink: 0, zIndex: 1 }),
      };
  const headerPad = s.isMobile ? "18px 16px 12px" : "28px 32px 18px";
  const contentPad = s.isMobile ? "16px 14px 40px" : "24px 32px 48px";
  const titleSize = s.isMobile ? "20px" : "26px";
  const mainNavItems = navMap.map(n => {
        const active = s.screen === n.key;
        return { label: n.label, groupLabel: n.group, select: setScreen(n.key), bg: active ? "var(--indigo)" : "transparent", color: active ? "var(--indigo-on)" : "var(--muted)", weight: active ? 700 : 600, shadow: active ? "0 8px 18px -8px rgba(59,46,211,0.5)" : "none" };
      });
  const isHome = s.screen === "home";
  const isWallets = s.screen === "wallets";
  const isCards = s.screen === "cards";
  const isTransactions = s.screen === "transactions";
  const isInvoices = s.screen === "invoices";
  const isReports = s.screen === "reports";
  const isVerification = s.screen === "verification";
  const isTeam = s.screen === "team";
  const isDeveloper = s.screen === "developer";
  const bottomNavItems = [
        { key: "home", label: "Home", icon: "⌂" },
        { key: "wallets", label: "Accounts", icon: "▦" },
        { key: "__send", label: "Send", icon: "↗" },
        { key: "transactions", label: "Activity", icon: "≣" },
        { key: "__more", label: "More", icon: "⋯" },
      ].map(n => {
        const active = s.screen === n.key;
        const select = n.key === "__send" ? openModal("send") : n.key === "__more" ? toggleSidebar : setScreen(n.key);
        return { label: n.label, icon: n.icon, select, color: active ? "var(--indigo-text)" : "var(--muted2)", weight: active ? 700 : 600 };
      });
  const balanceViewTabs = ["all","fiat","stablecoin"].map(v => ({ key: v, label: v === "all" ? "All" : v === "fiat" ? "Fiat" : "Stablecoin", select: setBalanceView(v), bg: s.balanceView === v ? "#fff" : "transparent", color: s.balanceView === v ? "var(--indigo)" : "var(--indigo-on)" }));
  const homeTotalBalance = s.balanceView === "stablecoin" ? "≈ $193,760.00" : s.balanceView === "fiat" ? "≈ $355,070.55" : "≈ $548,830.55";
  const balanceViewSub = s.balanceView === "stablecoin" ? "USDC + USDT across chains" : s.balanceView === "fiat" ? "KES, USD, EUR, GBP accounts" : "Across all wallets and accounts";
  const homeCurrencyChips = ACCOUNTS.filter(a => s.balanceView === "all" || (s.balanceView === "stablecoin" ? a.rail.includes("Stablecoin") : !a.rail.includes("Stablecoin"))).map(a => ({ flagUrl: flagUrl(a.iso), code: a.code, balance: a.balance }));
  const quickActionTiles = [
        { label: "Send", icon: "↗", desc: "Mobile money, bank, SEPA or stablecoin.", open: openModal("send"), iconBg: "var(--indigo)", iconColor: "var(--indigo-on)" },
        { label: "Bulk payouts", icon: "⇉", desc: "Pay up to 1,000 recipients from a CSV.", open: openModal("bulk"), iconBg: "var(--ink-panel)", iconColor: "#fff" },
        { label: "Receive globally", icon: "↙", desc: "Share your IBAN, Paybill or wallet details.", open: openModal("receive"), iconBg: "var(--amber)", iconColor: "#fff" },
        { label: "Top up", icon: "＋", desc: "Fund your balance from any rail.", open: openModal("deposit"), iconBg: "var(--indigo-tint)", iconColor: "var(--indigo-text)" },
      ];
  const homeStats = [
        { label: "Money in · 30 days", value: "$284,510", icon: "↑", iconBg: "var(--indigo-tint)", iconColor: "var(--indigo-text)" },
        { label: "Money out · 30 days", value: "$127,790", icon: "↓", iconBg: "var(--surface2)", iconColor: "var(--muted)" },
        { label: "Awaiting settlement", value: "$18,340", icon: "◔", iconBg: "var(--amber-tint)", iconColor: "var(--amber)" },
      ];
  const homeRecent = decoratedAll.slice(0, 4);
  const mainWalletBalance = "USDC 180,860.00";
  const mainWalletSub = "Settlement layer · Base & Polygon";
  const stableTabs = ["USDC","USDT"].map(k => ({ label: k, select: setStable(k), bg: s.stableSel === k ? "var(--indigo)" : "transparent", color: s.stableSel === k ? "var(--indigo-on)" : "var(--muted)" }));
  const accounts = ACCOUNTS.map((a,i) => ({ ...a, flagUrl: flagUrl(a.iso), openDetail: openAcctDetail(i) }));
  const accountsCount = ACCOUNTS.length;
  const walletsRecent = decoratedAll.slice(0, 5);
  const cardsRecent = decoratedAll.slice(0, 5);
  const corridors = CORRIDORS.map(c => ({
        ...c,
        flagUrl: flagUrl(c.iso),
        statusLabel: c.status === "live" ? "Live" : "Degraded",
        statusColor: c.status === "live" ? "var(--indigo-text)" : "var(--amber)",
        statusSoft: c.status === "live" ? "var(--indigo-tint)" : "var(--amber-tint)",
      }));
  const cards = CARDS.map((c,i) => ({ ...c, openDetail: openCardDetail(i), statusLabel: c.status === "active" ? "Active" : "Frozen", filter: c.status === "frozen" ? "saturate(0.2) opacity(0.7)" : "none", fund: openFundCardDirect(i), withdraw: openWithdrawDirect(i), freeze: openCardDetail(i) }));
  const txFilters = ["all","done","pending","failed"].map(f => ({ label: f === "all" ? "All" : f === "done" ? "Settled" : f === "pending" ? "Pending" : "Failed", select: setTxFilter(f), bg: s.txFilter === f ? "var(--indigo)" : "var(--surface2)", color: s.txFilter === f ? "var(--indigo-on)" : "var(--muted)" }));
  const invoices = INVOICES.map(inv => { const [l,c,soft] = STATUS_MAP[inv.status]; return { ...inv, statusLabel: l, statusColor: c, statusSoft: soft }; });
  const reportStats = [
        { label: "Total volume · 30d", value: "$142,806", color: "var(--ink)" },
        { label: "Avg settlement time", value: "3m 41s", color: "var(--ink)" },
        { label: "Success rate", value: "98.6%", color: "var(--indigo-text)" },
      ];
  const reportBars = [40,65,50,80,45,90,60,75,55,70].map(h => ({ h }));
  const coverageChips = CURRENCIES.map(c => ({ flagUrl: flagUrl(c.iso), code: c.code }));
  const tiers = [
        { num: "TIER 1", title: "Basic", reqs: ["Business email verified","Director ID verified","Phone linked"], limit: "Limit · $1,000 / day", statusLabel: "Complete", statusColor: "var(--indigo-text)", statusSoft: "var(--indigo-tint)", locked: false },
        { num: "TIER 2", title: "Registered Business", reqs: ["Certificate of incorporation","Tax registration","Proof of address"], limit: "Limit · $25,000 / day", statusLabel: "Complete", statusColor: "var(--indigo-text)", statusSoft: "var(--indigo-tint)", locked: false },
        { num: "TIER 3", title: "Institutional", reqs: ["Audited financials","AML/CFT policy","Beneficial ownership"], limit: "Limit · $250,000 / day", statusLabel: s.tierDone ? "In review" : "Locked", statusColor: s.tierDone ? "var(--amber)" : "var(--muted)", statusSoft: s.tierDone ? "var(--amber-tint)" : "var(--surface2)", locked: !s.tierDone },
      ];
  const apiKeys = API_KEYS.map(k => ({
        ...k,
        modeLabel: k.mode === "live" ? "Live" : "Test",
        modeBg: k.mode === "live" ? "var(--indigo-tint)" : "var(--surface2)",
        modeColor: k.mode === "live" ? "var(--indigo-text)" : "var(--muted)",
        keyDisplay: s.apiKeyRevealed[k.id] ? k.key : k.key.slice(0, k.key.indexOf("_", k.key.indexOf("_")+1)+1) + "••••••••••••••••",
        revealLabel: s.apiKeyRevealed[k.id] ? "Hide" : "Reveal",
        toggleReveal: toggleRevealKey(k.id),
        copyKey: copyField("key:"+k.id, k.key),
        copyKeyLabel: s.copiedField === "key:"+k.id ? "Copied" : "Copy",
        copyWebhook: copyField("wh:"+k.id, k.webhookUrl),
        copyWebhookLabel: s.copiedField === "wh:"+k.id ? "Copied" : "Copy",
        webhookSecretDisplay: s.secretRevealed[k.id] ? k.webhookSecret : "whsec_••••••••••••••••",
        revealSecretLabel: s.secretRevealed[k.id] ? "Hide" : "Reveal",
        toggleRevealSecret: toggleRevealSecret(k.id),
        revoke: revokeApiKey(k.id),
      }));
  const roleOptions = ROLES;
  const teamCount = s.teamMembers.length;
  const inviteOpen = s.inviteOpen;
  const inviteName = s.inviteName;
  const inviteEmail = s.inviteEmail;
  const inviteRoleChips = ROLES.map(r => ({ key: r.key, label: r.label, desc: r.desc, select: setInviteRole(r.key), bg: s.inviteRole === r.key ? "var(--indigo)" : "var(--surface2)", color: s.inviteRole === r.key ? "var(--indigo-on)" : "var(--ink)" }));
  const inviteCanSubmit = !!(s.inviteName.trim() && s.inviteEmail.trim());
  const inviteCannotSubmit = !(s.inviteName.trim() && s.inviteEmail.trim());
  const teamRows = s.teamMembers.map(m => ({
        ...m,
        initials: m.name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase(),
        statusLabel: m.status === "active" ? "Active" : "Invited",
        statusColor: m.status === "active" ? "var(--indigo-text)" : "var(--amber)",
        statusSoft: m.status === "active" ? "var(--indigo-tint)" : "var(--amber-tint)",
        roleOptions: ROLES,
        setRole: setMemberRole(m.id),
        remove: removeMember(m.id),
      }));
  const modalOpen = !!s.modal;
  const modalTitle = { send: "Send money", deposit: "Top up balance", receive: "Receive globally", bulk: "Bulk payouts", swap: "Convert", txDetail: "Transaction", acctDetail: "Account", cardDetail: "Card", newCard: "Create virtual card", invoice: "Create invoice", tier: "Upgrade to Tier 3", fundCard: "Fund card" }[s.modal] || "";
  const isModalSend = s.modal === "send";
  const isModalDeposit = s.modal === "deposit";
  const isModalReceive = s.modal === "receive";
  const isModalBulk = s.modal === "bulk";
  const isModalSwap = s.modal === "swap";
  const isModalTxDetail = s.modal === "txDetail";
  const isModalAcctDetail = s.modal === "acctDetail";
  const isModalCardDetail = s.modal === "cardDetail";
  const isModalNewCard = s.modal === "newCard";
  const isModalInvoice = s.modal === "invoice";
  const isModalTier = s.modal === "tier";
  const isModalFundCard = s.modal === "fundCard";
  const fundAmount = s.fundAmount;
  const fundCardNotDone = !s.fundCardDone;
  const fundCardDone = s.fundCardDone;
  const sendGroups = ["country","crypto"].map(g => ({ key: g, label: g === "country" ? "By country" : "Stablecoin", select: setSendGroup(g), bg: s.sendGroup === g ? "var(--ink)" : "var(--surface2)", color: s.sendGroup === g ? "var(--bg)" : "var(--muted)" }));
  const sendIsCountry = s.sendGroup === "country";
  const sendIsCrypto = s.sendGroup === "crypto";
  const sendRailHasChoice = sendCountry.rails.length > 1;
  const sendRecipient = s.sendRecipient;
  const sendAmount = s.sendAmount;
  const sendDone = s.sendDone;
  const sendNotDone = !s.sendDone;
  const sendRecipientLabel = s.sendGroup === "crypto" ? "Recipient wallet address" : sendRail.field;
  const sendRecipientPlaceholder = s.sendGroup === "crypto" ? "e.g. 0x9F2c... or .eth" : sendRail.placeholder;
  const sendCorridorText = s.sendGroup === "crypto" ? "Sends USDC directly on Base — no FX conversion." : `${sendCountry.name} via ${sendProvider} · ${sendRail.arrival}`;
  const sendProviderHasChoice = sendRail.options.length > 1;
  const depositMethods = ["country","crypto"].map(g => ({ key: g, label: g === "country" ? "By country" : "Stablecoin", select: setDepositGroup(g), bg: s.depositGroup === g ? "var(--ink)" : "var(--surface2)", color: s.depositGroup === g ? "var(--bg)" : "var(--muted)" }));
  const depositIsCountry = s.depositGroup === "country";
  const depositIsCrypto = s.depositGroup === "crypto";
  const depositRailHasChoice = depositCountry.rails.length > 1;
  const depositIsMobileRail = depositRail.type === "mobile";
  const depositIsBankRail = depositRail.type === "bank";
  const depositOperator = depositProvider;
  const depositMobileCode = depositCountry.code;
  const depositProviderHasChoice = depositRail.options.length > 1;
  const depositPhone = s.depositPhone;
  const depositPromptSent = s.depositPromptSent;
  const depositPromptNotSent = !s.depositPromptSent;
  const depositBankLabel = depositRail.label;
  const depositBankArrival = depositRail.arrival;
  const depositBankLines = depositRail.type === "bank" ? [{ k: "Account number", v: depositRail.placeholder }, { k: "Bank", v: depositProvider }] : [];
  const depositAssets = ["usdc","usdt"].map(k => ({ key: k, label: k.toUpperCase(), select: setDepositAsset(k), bg: s.depositAsset === k ? "var(--ink)" : "var(--surface2)", color: s.depositAsset === k ? "var(--bg)" : "var(--ink)" }));
  const depositAssetCode = s.depositAsset.toUpperCase();
  const depositNetworks = DEPOSIT_NETWORKS.map(n => ({ key: n.key, label: n.label, select: setDepositNetwork(n.key), bg: s.depositNetwork === n.key ? "var(--indigo-tint)" : "var(--surface2)", border: s.depositNetwork === n.key ? "var(--indigo)" : "transparent", color: s.depositNetwork === n.key ? "var(--indigo-text)" : "var(--ink)" }));
  const depositNetworkLabel = DEPOSIT_NETWORKS.find(n => n.key === s.depositNetwork).label;
  const depositAddress = DEPOSIT_ADDRESSES[s.depositNetwork];
  const sendStep = s.sendStep;
  const sendStepDots = [1,2,3].map(n => ({ on: n <= s.sendStep }));
  const sendStepIs1 = s.sendStep === 1;
  const sendStepIs2 = s.sendStep === 2;
  const sendStepIs3 = s.sendStep === 3;
  const sendAssets = ["usdc","usdt"].map(k => ({ key: k, label: k.toUpperCase(), select: setSendAsset(k), bg: s.sendAsset === k ? "var(--ink)" : "var(--surface2)", color: s.sendAsset === k ? "var(--bg)" : "var(--ink)" }));
  const sendChains = DEPOSIT_NETWORKS.map(n => ({ key: n.key, label: n.label, select: setSendChain(n.key), bg: s.sendChain === n.key ? "var(--indigo-tint)" : "var(--surface2)", border: s.sendChain === n.key ? "var(--indigo)" : "transparent", color: s.sendChain === n.key ? "var(--indigo-text)" : "var(--ink)" }));
  const sendAssetCode = s.sendAsset.toUpperCase();
  const sendChainLabel = DEPOSIT_NETWORKS.find(n => n.key === s.sendChain).label;
  const sendDestinationSummary = s.sendGroup === "crypto" ? `${s.sendAsset.toUpperCase()} · ${DEPOSIT_NETWORKS.find(n => n.key === s.sendChain).label}` : `${sendCountry.name} · ${sendProvider}`;
  const sendFeeText = s.sendGroup === "crypto" ? "Network fee ≈ $0.85" : (sendRail.type === "mobile" ? "No fee · instant local transfer" : "Fee ≈ $1.20 · bank transfer");
  const sendArrivalText = s.sendGroup === "crypto" ? "Arrives in ~30 seconds" : sendRail.arrival;
  const depositStep = s.depositStep;
  const depositStepDots = [1,2].map(n => ({ on: n <= s.depositStep }));
  const depositStepIs1 = s.depositStep === 1;
  const depositStepIs2 = s.depositStep === 2;
  const depositDestinationSummary = s.depositGroup === "crypto" ? `${s.depositAsset.toUpperCase()} · ${DEPOSIT_NETWORKS.find(n=>n.key===s.depositNetwork).label}` : `${depositCountry.name} · ${depositProvider}`;
  const receiveGroups = ["fiat","crypto"].map(g => ({ key: g, label: g === "fiat" ? "Fiat account" : "Stablecoin", select: setReceiveGroup(g), bg: s.receiveGroup === g ? "var(--ink)" : "var(--surface2)", color: s.receiveGroup === g ? "var(--bg)" : "var(--muted)" }));
  const receiveIsFiat = s.receiveGroup === "fiat";
  const receiveIsCrypto = s.receiveGroup === "crypto";
  const receiveAcctChips = ACCOUNTS.filter(a => !a.rail.includes("Stablecoin")).map((a,i) => ({ flagUrl: flagUrl(a.iso), code: a.code, select: selectReceiveAcct(i), bg: i === s.receiveAcctIdx ? "var(--indigo-tint)" : "var(--surface2)", border: i === s.receiveAcctIdx ? "var(--indigo)" : "transparent" }));
  const receiveAcctLines = (() => { const a = ACCOUNTS.filter(x => !x.rail.includes("Stablecoin"))[s.receiveAcctIdx] || ACCOUNTS[0]; return (a.receiveLines||[]).map(([k,v]) => ({ k, v, copy: copyReceiveField(k, v), copied: s.copiedKey === k })); })();
  const receiveAcctRail = (ACCOUNTS.filter(x => !x.rail.includes("Stablecoin"))[s.receiveAcctIdx] || ACCOUNTS[0]).rail;
  const receiveAssets = ["usdc","usdt"].map(k => ({ key: k, label: k.toUpperCase(), select: setReceiveAsset(k), bg: s.receiveAsset === k ? "var(--ink)" : "var(--surface2)", color: s.receiveAsset === k ? "var(--bg)" : "var(--ink)" }));
  const receiveNetworks = DEPOSIT_NETWORKS.map(n => ({ key: n.key, label: n.label, select: setReceiveNetwork(n.key), bg: s.receiveNetwork === n.key ? "var(--indigo-tint)" : "var(--surface2)", border: s.receiveNetwork === n.key ? "var(--indigo)" : "transparent", color: s.receiveNetwork === n.key ? "var(--indigo-text)" : "var(--ink)" }));
  const receiveNetworkLabel = DEPOSIT_NETWORKS.find(n => n.key === s.receiveNetwork).label;
  const receiveAssetCode = s.receiveAsset.toUpperCase();
  const receiveAddress = DEPOSIT_ADDRESSES[s.receiveNetwork];
  const copyReceiveAddress = copyReceiveField("addr", DEPOSIT_ADDRESSES[s.receiveNetwork]);
  const receiveAddressCopied = s.copiedKey === "addr";
  const bulkRows = BULK_ROWS.map(r => ({ ...r, flagUrl: flagUrl(r.iso) }));
  const bulkCountryLabel = "KE, GH, NG, DE, RW";
  const bulkNotLoaded = !s.bulkLoaded;
  const bulkLoaded = s.bulkLoaded;
  const bulkNotDone = !s.bulkDone;
  const bulkDone = s.bulkDone;
  const onrampTabBg = isOnrampDir ? "var(--indigo-tint)" : "transparent";
  const onrampTabBorder = isOnrampDir ? "var(--indigo)" : "var(--border)";
  const onrampTabColor = isOnrampDir ? "var(--indigo-text)" : "var(--muted)";
  const offrampTabBg = !isOnrampDir ? "var(--indigo-tint)" : "transparent";
  const offrampTabBorder = !isOnrampDir ? "var(--indigo)" : "var(--border)";
  const offrampTabColor = !isOnrampDir ? "var(--indigo-text)" : "var(--muted)";
  const swapAmountFrom = isOnrampDir ? "10,000.00" : "5,000.00";
  const swapFromCcy = isOnrampDir ? "KES" : "USDC";
  const swapAmountTo = isOnrampDir ? "77.34" : "645,300.00";
  const swapToCcy = isOnrampDir ? "USDC" : "KES";
  const swapRate = "1 USDC = 129.32 KES";
  const swapSettle = isOnrampDir ? "Base · USDC" : "M-Pesa (Safaricom)";
  const quoteLive = !quoteExpired;
  const quoteProgress = Math.round((s.quoteSeconds / 90) * 100);
  const acceptBg = quoteExpired ? "var(--surface3)" : "var(--indigo)";
  const acceptColor = quoteExpired ? "var(--muted)" : "var(--indigo-on)";
  const acceptCursor = quoteExpired ? "not-allowed" : "pointer";
  const swapNotAccepted = !s.swapAccepted;
  const swapAccepted = s.swapAccepted;
  const cardDetail: any = cardSel ? { ...cardSel, freezeTrack: s.cardFrozen ? "var(--indigo)" : "var(--surface3)", freezeKnobLeft: s.cardFrozen ? "23px" : "3px" } : {};
  const newCardLabel = s.newCardLabel;
  const newCardNotDone = !s.newCardDone;
  const newCardDone = s.newCardDone;
  const invClient = s.invClient;
  const invAmount = s.invAmount;
  const invoiceNotDone = !s.invoiceDone;
  const invoiceDone = s.invoiceDone;
  const tierDocs = ["Audited financial statements","AML/CFT policy document","Beneficial ownership register"];
  const tierNotDone = !s.tierDone;
  const tierDone = s.tierDone;

  return (
    <div ref={rootRef} style={rootStyle}>
{isLanding ? (<>
<div data-screen-label="Landing" style={{minHeight: "100vh"}}>
<header style={{position: "sticky", top: "0", zIndex: "20", background: "var(--surface)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid var(--glass-border)"}}>
<div style={{maxWidth: "1140px", margin: "0 auto", padding: "0 24px", height: "66px", display: "flex", alignItems: "center", gap: "26px"}}>
<div style={{display: "flex", alignItems: "center", gap: "10px", fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "16px"}}>
<span style={{width: "32px", height: "32px", borderRadius: "10px", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: "14px"}}>E</span>ElementPay
</div>
<nav style={{display: "flex", gap: "22px", fontSize: "13px", fontWeight: "600", color: "var(--muted)", marginLeft: "8px"}}>
<span>Features</span><span>Stablecoin engine</span><span>Coverage</span>
</nav>
<div style={{marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center"}}>
<button onClick={toggleTheme} style={{width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: "14px"}}>{themeIcon}</button>
<button onClick={enterApp} style={{padding: "11px 22px", borderRadius: "999px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "13px", cursor: "pointer"}}>Open dashboard</button>
</div>
</div>
</header>

<section style={{maxWidth: "1140px", margin: "0 auto", padding: "76px 24px 40px", display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: "44px", alignItems: "center"}}>
<div>
<span style={{display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", padding: "8px 16px", borderRadius: "999px", background: "var(--indigo-tint)", color: "var(--indigo-text)", marginBottom: "20px"}}><span style={{width: "7px", height: "7px", borderRadius: "50%", background: "var(--indigo)"}} />Now in Private Beta</span>
<h1 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,4.6vw,52px)", fontWeight: "800", letterSpacing: "-0.03em", lineHeight: "1.08"}}>Move business money<br />at <span style={{background: "var(--indigo)", color: "var(--indigo-on)", padding: "1px 16px 5px", borderRadius: "14px", display: "inline-block"}}>internet speed</span></h1>
<p style={{fontSize: "16px", color: "var(--muted)", margin: "20px 0 28px", maxWidth: "460px", lineHeight: "1.6"}}>IBANs, stablecoin settlement, payouts to 20+ countries, and treasury in one platform for businesses across Africa and beyond.</p>
<div style={{display: "flex", gap: "12px", flexWrap: "wrap"}}>
<button onClick={enterApp} style={{padding: "15px 28px", borderRadius: "999px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "14.5px", cursor: "pointer"}}>Open the dashboard</button>
<button style={{padding: "15px 28px", borderRadius: "999px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "14.5px", cursor: "pointer"}}>See how it works</button>
</div>
<div style={{fontSize: "11.5px", color: "var(--muted2)", marginTop: "16px"}}>No credit card required · SOC 2 in progress · 256-bit encryption</div>
</div>

<div style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "24px", padding: "26px"}}>
<h3 style={{margin: "0 0 4px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "16px"}}>See what your money becomes</h3>
<div style={{fontSize: "12px", color: "var(--muted)", marginBottom: "16px"}}>Live mid-market rates, updated every 30 seconds.</div>
<div style={{display: "flex", gap: "8px", marginBottom: "10px"}}>
<input value={lcAmt} onChange={setLcAmt} style={{flex: "1", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", fontFamily: "'DM Mono',monospace", fontSize: "13.5px", color: "var(--ink)", outline: "none", boxSizing: "border-box"}} />
<span style={{padding: "12px 14px", borderRadius: "14px", background: "var(--surface2)", fontFamily: "'DM Mono',monospace", fontSize: "12.5px", fontWeight: "700"}}>USD</span>
</div>
<div style={{display: "flex", gap: "6px", overflowX: "auto", marginBottom: "14px"}}>
{(lcCountryChips || []).map((lc: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={lc.select} style={{display: "flex", alignItems: "center", gap: "6px", padding: "7px 11px", borderRadius: "999px", border: `1.5px solid ${(lc.border)}`, background: (lc.bg), color: "var(--ink)", cursor: "pointer", flexShrink: "0"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(lc.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontSize: "11px", fontWeight: "700"}}>{lc.code}</span></button>
</React.Fragment>
))}
</div>
<div style={{background: "var(--indigo)", color: "var(--indigo-on)", borderRadius: "16px", padding: "18px", textAlign: "center"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "26px", fontWeight: "500", display: "block"}}>{lcOut}</span>
<span style={{fontSize: "11px", opacity: "0.75", fontFamily: "'DM Mono',monospace"}}>{lcRate}</span>
</div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "var(--muted2)", marginTop: "10px", fontFamily: "'DM Mono',monospace"}}><span>Fee 0.20%</span><span>Arrives ~2 min</span><span>Rate lock 90s</span></div>
</div>
</section>

<div style={{borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "26px 24px", background: "var(--surface2)"}}>
<div style={{textAlign: "center", fontSize: "11px", fontWeight: "800", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: "14px"}}>Payouts live in 20+ countries</div>
<div style={{display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", maxWidth: "1000px", margin: "0 auto"}}>
{(allCountryFlags || []).map((f: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "8px", padding: "9px 16px", borderRadius: "999px", background: "var(--surface)", border: "1.5px solid var(--glass-border)", fontSize: "13px", fontWeight: "700"}}><div style={{width: "20px", height: "15px", borderRadius: "2px", backgroundImage: `url(${(f.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} />{f.code}</div>
</React.Fragment>
))}
</div>
</div>

<section style={{maxWidth: "1140px", margin: "0 auto", padding: "60px 24px"}}>
<span style={{display: "inline-block", fontSize: "11px", fontWeight: "800", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--indigo-text)", background: "var(--indigo-tint)", padding: "6px 14px", borderRadius: "999px"}}>Features</span>
<h2 style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(24px,3.2vw,34px)", fontWeight: "800", letterSpacing: "-0.03em", margin: "14px 0 8px"}}>Everything your finance team needs</h2>
<p style={{color: "var(--muted)", fontSize: "15px", maxWidth: "560px"}}>One platform to replace your patchwork of banking portals, payment processors and spreadsheets.</p>
<div style={{display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginTop: "28px"}}>
{(landingFeatures || []).map((ft: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "20px", padding: "24px", display: "flex", flexDirection: "column", gap: "10px"}}>
<span style={{width: "44px", height: "44px", borderRadius: "14px", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk',sans-serif", fontWeight: "800", fontSize: "16px"}}>{ft.letter}</span>
<b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "15px"}}>{ft.title}</b>
<span style={{fontSize: "13px", color: "var(--muted)", lineHeight: "1.6"}}>{ft.desc}</span>
</div>
</React.Fragment>
))}
</div>
</section>

<section style={{maxWidth: "1140px", margin: "0 auto", padding: "20px 24px 60px"}}>
<span style={{display: "inline-block", fontSize: "11px", fontWeight: "800", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--indigo-text)", background: "var(--indigo-tint)", padding: "6px 14px", borderRadius: "999px"}}>The core engine</span>
<h2 style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(24px,3.2vw,34px)", fontWeight: "800", letterSpacing: "-0.03em", margin: "14px 0 20px"}}>Stablecoins under the hood.<br />Fiat at the edges.</h2>
<div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", alignItems: "center"}}>
<p style={{color: "var(--muted)", fontSize: "15px", lineHeight: "1.7", margin: "0"}}>Every cross-border payment routes through our stablecoin settlement layer. Money enters as KES, NGN, EUR or USD, moves as USDC or USDT, and lands as local currency on the other side.</p>
<div style={{background: "var(--ink-panel)", borderRadius: "22px", padding: "24px", color: "#fff"}}>
{(engineRails || []).map((rl: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "10px", padding: "12px 0", borderBottom: "1px dashed rgba(255,255,255,0.15)", fontSize: "12.5px"}}>
<span style={{width: "9px", height: "9px", borderRadius: "50%", background: (rl.dot)}} /><b>{rl.label}</b><span style={{marginLeft: "auto", color: "var(--ink-panel-text)", fontFamily: "'DM Mono',monospace", fontSize: "11px"}}>{rl.tag}</span>
</div>
</React.Fragment>
))}
</div>
</div>
<div style={{display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginTop: "28px"}}>
{(engineStats || []).map((es: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{background: "var(--surface)", border: "1px solid var(--glass-border)", borderRadius: "18px", padding: "22px", textAlign: "center"}}><b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "32px", fontWeight: "800", color: "var(--indigo-text)", display: "block"}}>{es.value}</b><span style={{fontSize: "11.5px", color: "var(--muted2)", fontWeight: "600"}}>{es.label}</span></div>
</React.Fragment>
))}
</div>
</section>

<section style={{maxWidth: "1092px", margin: "0 auto 60px", padding: "64px 24px", background: "var(--ink-panel)", borderRadius: "32px", color: "#fff", textAlign: "center"}}>
<h2 style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(24px,3.4vw,36px)", fontWeight: "800", letterSpacing: "-0.03em", margin: "0"}}>Ready to modernize your<br />business payments?</h2>
<p style={{color: "var(--ink-panel-text)", margin: "12px 0 26px"}}>Join the businesses already moving money faster, cheaper and more securely.</p>
<button onClick={enterApp} style={{padding: "15px 28px", borderRadius: "999px", border: "none", background: "var(--indigo-bright)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "14.5px", cursor: "pointer"}}>Open the dashboard</button>
</section>

<footer style={{borderTop: "1px solid var(--border)", padding: "24px", textAlign: "center", fontSize: "12px", color: "var(--muted2)"}}>© 2026 ElementPay · Move business money at internet speed</footer>
</div>
</>) : null}
{isApp ? (<>
<div data-screen-label="App" style={{display: "flex", minHeight: "100vh", position: "relative"}}>

<div onClick={closeSidebar} style={overlayStyle} />
<aside style={asideStyle}>
<button onClick={exitApp} style={{display: "flex", alignItems: "center", gap: "10px", padding: "6px 8px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left"}}>
<span style={{width: "32px", height: "32px", borderRadius: "10px", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: "14px", fontWeight: "700", flexShrink: "0"}}>E</span>
<div><div style={{fontFamily: "'Space Grotesk',sans-serif", fontWeight: "700", fontSize: "14.5px", letterSpacing: "-0.01em", color: "var(--ink)"}}>ElementPay</div><div style={{fontSize: "10.5px", color: "var(--muted2)", fontWeight: "600"}}>Business</div></div>
</button>

<nav style={{display: "flex", flexDirection: "column", gap: "2px", flex: "1"}}>
{(mainNavItems || []).map((item: any, __i1: number) => (
<React.Fragment key={__i1}>
{(item.groupLabel) ? (<>
<div style={{fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)", fontWeight: "700", padding: "14px 12px 6px"}}>{item.groupLabel}</div>
</>) : null}
<button onClick={item.select} style={{display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "12px", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", textAlign: "left", background: (item.bg), color: (item.color), boxShadow: (item.shadow)}}>
<span style={{fontSize: "13.5px", fontWeight: (item.weight)}}>{item.label}</span>
</button>
</React.Fragment>
))}
</nav>

<div style={{marginTop: "auto", padding: "13px 14px", borderRadius: "16px", background: "var(--ink-panel)", color: "var(--ink-panel-text)", fontFamily: "'DM Mono',monospace", fontSize: "11px"}}>
<div style={{display: "flex", alignItems: "center", gap: "6px", fontFamily: "'DM Sans',sans-serif", fontWeight: "700", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted3)", marginBottom: "8px"}}><span style={{width: "6px", height: "6px", borderRadius: "50%", background: "var(--indigo-bright)"}} />Live rates</div>
<div style={{display: "flex", justifyContent: "space-between", padding: "2px 0"}}><span>USD/KES</span><b style={{color: "#fff", fontWeight: "500"}}>131.64</b></div>
<div style={{display: "flex", justifyContent: "space-between", padding: "2px 0"}}><span>USD/NGN</span><b style={{color: "#fff", fontWeight: "500"}}>1,382.84</b></div>
<div style={{display: "flex", justifyContent: "space-between", padding: "2px 0"}}><span>USDC/USD</span><b style={{color: "#fff", fontWeight: "500"}}>1.0001</b></div>
</div>

<div style={{display: "flex", alignItems: "center", gap: "10px", padding: "14px 6px 4px"}}>
<span style={{width: "32px", height: "32px", borderRadius: "50%", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: "11.5px", fontWeight: "700", flexShrink: "0"}}>TE</span>
<div style={{minWidth: "0"}}><div style={{fontSize: "12px", fontWeight: "700"}}>Test Element</div><div style={{fontSize: "10.5px", color: "var(--indigo-text)", fontWeight: "700"}}>Tier 2 verified</div></div>
<button onClick={toggleTheme} style={{marginLeft: "auto", width: "32px", height: "32px", borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: "14px", flexShrink: "0"}}>{themeIcon}</button>
</div>
</aside>

<main style={{flex: "1", minWidth: "0", display: "flex", flexDirection: "column", position: "relative", zIndex: "1"}}>
<header style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: (headerPad), gap: "12px", background: "var(--surface)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid var(--glass-border)", position: "sticky", top: "0", zIndex: "5"}}>
<div style={{display: "flex", alignItems: "center", gap: "12px", minWidth: "0"}}>
{(isMobile) ? (<>
<button onClick={toggleSidebar} style={{flexShrink: "0", width: "36px", height: "36px", borderRadius: "10px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "16px", cursor: "pointer"}}>☰</button>
</>) : null}
<div style={{minWidth: "0"}}>
<h1 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: (titleSize), fontWeight: "800", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{currentTitle}</h1>
<p style={{margin: "4px 0 0", fontSize: "13px", color: "var(--muted)"}}>{currentSubtitle}</p>
</div>
</div>
</header>

<div style={{flex: "1", overflow: "auto", padding: (contentPad)}}>

{(isHome) ? (<>
<div data-screen-label="Home" style={{display: "flex", flexDirection: "column", gap: "22px"}}>

<div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))", gap: "14px", alignItems: "stretch"}}>
<div style={{borderRadius: "24px", padding: "22px 26px", color: "var(--indigo-on)", background: "var(--indigo)", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: "0 22px 48px -20px rgba(59,46,211,0.4)"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", position: "relative"}}>
<span style={{fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", opacity: "0.75", fontWeight: "700"}}>Total balance</span>
<div style={{display: "flex", gap: "4px", background: "rgba(255,255,255,0.14)", padding: "3px", borderRadius: "999px"}}>
{(balanceViewTabs || []).map((bv: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={bv.select} style={{padding: "5px 11px", borderRadius: "999px", border: "none", background: (bv.bg), color: (bv.color), fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>{bv.label}</button>
</React.Fragment>
))}
</div>
</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "clamp(26px,3.4vw,36px)", fontWeight: "500", margin: "8px 0 2px", letterSpacing: "-0.02em", position: "relative"}}>{homeTotalBalance}</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "12px", opacity: "0.7", position: "relative"}}>{balanceViewSub}</div>
</div>
<div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
{(homeStats || []).map((hs: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{flex: "1", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "16px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px"}}>
<span style={{width: "34px", height: "34px", borderRadius: "50%", background: (hs.iconBg), color: (hs.iconColor), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: "0"}}>{hs.icon}</span>
<div><div style={{fontSize: "10.5px", fontWeight: "700", color: "var(--muted)"}}>{hs.label}</div><div style={{fontFamily: "'DM Mono',monospace", fontSize: "17px", fontWeight: "500"}}>{hs.value}</div></div>
</div>
</React.Fragment>
))}
</div>
</div>

<div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px"}}>
{(quickActionTiles || []).map((qa: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={qa.open} style={{textAlign: "left", border: "1px solid var(--border)", background: "var(--panel)", borderRadius: "20px", padding: "18px", display: "flex", flexDirection: "column", gap: "10px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", position: "relative"}}>
<span style={{width: "40px", height: "40px", borderRadius: "13px", background: (qa.iconBg), color: (qa.iconColor), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px"}}>{qa.icon}</span>
<div><b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700", color: "var(--ink)", display: "block"}}>{qa.label}</b><span style={{fontSize: "11.5px", color: "var(--muted)", lineHeight: "1.5"}}>{qa.desc}</span></div>
</button>
</React.Fragment>
))}
</div>

<div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
{(homeCurrencyChips || []).map((hc: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "999px", background: "var(--surface2)", border: "1px solid var(--glass-border)"}}>
<div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(hc.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} />
<span style={{fontSize: "12px", fontWeight: "700"}}>{hc.code}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "11.5px", color: "var(--muted)"}}>{hc.balance}</span>
</div>
</React.Fragment>
))}
</div>

<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", overflowX: "auto"}}>
<div style={{padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: "600px"}}>
<h2 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700"}}>Recent activity</h2>
<button onClick={goTransactions} style={{background: "none", border: "none", padding: "0", color: "var(--indigo-text)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>View all →</button>
</div>
{(homeRecent || []).map((tx: any, __i2: number) => (
<React.Fragment key={__i2}>
<div onClick={tx.openDetail} style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "13px 20px", fontSize: "12.5px", borderBottom: "1px solid var(--border)", minWidth: "600px", cursor: "pointer"}}>
<div style={{display: "flex", alignItems: "center", gap: "8px"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(tx.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontWeight: "600"}}>{tx.client}</span></div>
<span style={{color: "var(--muted)"}}>{tx.type}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600", color: (tx.amountColor)}}>{tx.amount}</span>
<span style={{display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: (tx.statusSoft), color: (tx.statusColor)}}><span style={{width: "6px", height: "6px", borderRadius: "50%", background: "currentColor"}} />{tx.statusLabel}</span>
</div>
</React.Fragment>
))}
</section>

</div>
</>) : null}

{(isWallets) ? (<>
<div data-screen-label="Wallets" style={{display: "flex", flexDirection: "column", gap: "24px"}}>

<div style={{borderRadius: "24px", padding: "26px 30px", background: "var(--panel)", border: "1px solid var(--border)", position: "relative", overflow: "hidden", display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center"}}>
<div style={{flex: "1", minWidth: "220px", position: "relative"}}>
<span style={{display: "inline-flex", fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--indigo-on)", background: "var(--indigo)", padding: "6px 14px", borderRadius: "999px", marginBottom: "12px"}}>Main wallet · settlement layer</span>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "34px", fontWeight: "500", letterSpacing: "-0.02em"}}>{mainWalletBalance}</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "var(--muted)", marginTop: "2px"}}>{mainWalletSub}</div>
</div>
<div style={{display: "flex", gap: "6px", background: "var(--surface2)", padding: "4px", borderRadius: "999px", border: "1px solid var(--glass-border)", position: "relative"}}>
{(stableTabs || []).map((st: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={st.select} style={{padding: "8px 18px", borderRadius: "999px", border: "none", background: (st.bg), color: (st.color), fontFamily: "'DM Mono',monospace", fontSize: "12.5px", fontWeight: "500", cursor: "pointer"}}>{st.label}</button>
</React.Fragment>
))}
</div>
</div>

<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<h2 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "0.02em", color: "var(--muted)", textTransform: "uppercase"}}>Currency accounts · {accountsCount}</h2>
<button onClick={openCreateAccount} style={{background: "none", border: "none", padding: "0", color: "var(--indigo-text)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ New account</button>
</div>

<div style={{display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "6px", scrollSnapType: "x proximity"}}>
{(accounts || []).map((acc: any, __i1: number) => (
<React.Fragment key={__i1}>
<div onClick={acc.openDetail} style={{flex: "0 0 230px", scrollSnapAlign: "start", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "20px", padding: "18px", display: "flex", flexDirection: "column", gap: "8px", cursor: "pointer"}}>
<div style={{display: "flex", alignItems: "center", gap: "10px"}}>
<span style={{width: "38px", height: "38px", borderRadius: "12px", background: "var(--indigo-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", color: "var(--indigo-text)", overflow: "hidden"}}>{(acc.flagUrl) ? (<><div style={{width: "100%", height: "100%", backgroundImage: `url(${(acc.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center"}} /></>) : (<>$</>)}</span>
<div><div style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700"}}>{acc.name}</div><div style={{fontSize: "10.5px", color: "var(--muted2)", fontWeight: "600"}}>{acc.rail}</div></div>
</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "21px", fontWeight: "500", marginTop: "2px"}}>{acc.balance}</div>
<div style={{fontSize: "11.5px", color: "var(--muted)", fontFamily: "'DM Mono',monospace"}}>{acc.detail}</div>
</div>
</React.Fragment>
))}
<button onClick={openCreateAccount} style={{flex: "0 0 150px", scrollSnapAlign: "start", border: "2px dashed var(--border)", background: "none", borderRadius: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "9px", color: "var(--muted)", cursor: "pointer", fontFamily: "'DM Sans',sans-serif"}}>
<span style={{width: "38px", height: "38px", borderRadius: "50%", background: "var(--indigo)", color: "var(--indigo-on)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px"}}>+</span>
<b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "13px", color: "var(--ink)"}}>New account</b>
</button>
</div>

<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", overflowX: "auto"}}>
<div style={{padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: "600px"}}>
<h2 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700"}}>Recent activity</h2>
<button onClick={goTransactions} style={{background: "none", border: "none", padding: "0", color: "var(--indigo-text)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>View all →</button>
</div>
{(walletsRecent || []).map((tx: any, __i2: number) => (
<React.Fragment key={__i2}>
<div onClick={tx.openDetail} style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "13px 20px", fontSize: "12.5px", borderBottom: "1px solid var(--border)", minWidth: "600px", cursor: "pointer"}}>
<div style={{display: "flex", alignItems: "center", gap: "8px"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(tx.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontWeight: "600"}}>{tx.client}</span></div>
<span style={{color: "var(--muted)"}}>{tx.type}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600", color: (tx.amountColor)}}>{tx.amount}</span>
<span style={{display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: (tx.statusSoft), color: (tx.statusColor)}}><span style={{width: "6px", height: "6px", borderRadius: "50%", background: "currentColor"}} />{tx.statusLabel}</span>
</div>
</React.Fragment>
))}
</section>

</div>
</>) : null}

{(isCards) ? (<>
<div data-screen-label="Cards" style={{display: "flex", flexDirection: "column", gap: "16px"}}>
<div style={{display: "flex", justifyContent: "flex-end"}}>
<button onClick={openNewCard} style={{padding: "10px 18px", borderRadius: "999px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ New card</button>
</div>
<div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "16px"}}>
{(cards || []).map((c: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
<div onClick={c.openDetail} style={{aspectRatio: "1.586", borderRadius: "22px", position: "relative", overflow: "hidden", padding: "20px", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer", background: (c.bg), filter: (c.filter)}}>
<div style={{display: "flex", justifyContent: "space-between", position: "relative"}}><b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px"}}>{c.label}</b><span style={{fontSize: "9px", fontWeight: "800", letterSpacing: "0.1em", padding: "4px 10px", borderRadius: "999px", background: "rgba(255,255,255,0.2)"}}>{c.statusLabel}</span></div>
<div style={{position: "relative"}}><span style={{display: "block", fontSize: "9.5px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", opacity: "0.6"}}>Available</span><span style={{fontFamily: "'DM Mono',monospace", fontSize: "19px", fontWeight: "500"}}>{c.balance}</span><div style={{fontFamily: "'DM Mono',monospace", fontSize: "14px", letterSpacing: "0.14em", marginTop: "10px"}}>•••• •••• •••• {c.last4}</div></div>
</div>
<div style={{display: "flex", gap: "6px"}}>
<button onClick={c.fund} style={{flex: "1", padding: "8px", borderRadius: "10px", border: "1px solid var(--glass-border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "11.5px", fontWeight: "700", cursor: "pointer"}}>Fund</button>
<button onClick={c.withdraw} style={{flex: "1", padding: "8px", borderRadius: "10px", border: "1px solid var(--glass-border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "11.5px", fontWeight: "700", cursor: "pointer"}}>Withdraw</button>
<button onClick={c.freeze} style={{flex: "1", padding: "8px", borderRadius: "10px", border: "1px solid var(--glass-border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "11.5px", fontWeight: "700", cursor: "pointer"}}>Freeze</button>
</div>
</div>
</React.Fragment>
))}
</div>

<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", overflowX: "auto"}}>
<div style={{padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: "600px"}}>
<h2 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700"}}>Recent transactions</h2>
<button onClick={goTransactions} style={{background: "none", border: "none", padding: "0", color: "var(--indigo-text)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>View all →</button>
</div>
{(cardsRecent || []).map((tx: any, __i2: number) => (
<React.Fragment key={__i2}>
<div onClick={tx.openDetail} style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "13px 20px", fontSize: "12.5px", borderBottom: "1px solid var(--border)", minWidth: "600px", cursor: "pointer"}}>
<div style={{display: "flex", alignItems: "center", gap: "8px"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(tx.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontWeight: "600"}}>{tx.client}</span></div>
<span style={{color: "var(--muted)"}}>{tx.type}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600", color: (tx.amountColor)}}>{tx.amount}</span>
<span style={{display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: (tx.statusSoft), color: (tx.statusColor)}}><span style={{width: "6px", height: "6px", borderRadius: "50%", background: "currentColor"}} />{tx.statusLabel}</span>
</div>
</React.Fragment>
))}
</section>
</div>
</>) : null}

{(isTransactions) ? (<>
<div data-screen-label="Transactions" style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", gap: "6px", flexWrap: "wrap"}}>
{(txFilters || []).map((tf: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={tf.select} style={{fontSize: "12px", fontWeight: "700", padding: "7px 15px", borderRadius: "999px", background: (tf.bg), color: (tf.color), border: "1px solid var(--glass-border)", cursor: "pointer"}}>{tf.label}</button>
</React.Fragment>
))}
</div>
<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", overflowX: "auto"}}>
<div style={{display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", padding: "10px 20px", fontSize: "10.5px", fontWeight: "700", color: "var(--muted2)", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid var(--border)", minWidth: "600px"}}>
<span>Counterparty</span><span>Rail</span><span>Status</span><span style={{textAlign: "right"}}>Amount</span>
</div>
{(filteredTransactions || []).map((tx: any, __i2: number) => (
<React.Fragment key={__i2}>
<div onClick={tx.openDetail} style={{display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", padding: "13px 20px", fontSize: "12.5px", borderBottom: "1px solid var(--border)", alignItems: "center", minWidth: "600px", cursor: "pointer"}}>
<div style={{display: "flex", alignItems: "center", gap: "8px"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(tx.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontWeight: "600"}}>{tx.client}</span></div>
<span style={{color: "var(--muted)"}}>{tx.type}</span>
<span style={{display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: (tx.statusSoft), color: (tx.statusColor), width: "fit-content"}}><span style={{width: "6px", height: "6px", borderRadius: "50%", background: "currentColor"}} />{tx.statusLabel}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600", textAlign: "right", color: (tx.amountColor)}}>{tx.amount}</span>
</div>
</React.Fragment>
))}
</section>
</div>
</>) : null}

{(isInvoices) ? (<>
<div data-screen-label="Invoices" style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", justifyContent: "flex-end"}}>
<button onClick={openModalInvoice} style={{padding: "10px 18px", borderRadius: "999px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ New invoice</button>
</div>
<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", overflowX: "auto"}}>
<div style={{display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr 1fr", padding: "10px 20px", fontSize: "10.5px", fontWeight: "700", color: "var(--muted2)", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid var(--border)", minWidth: "560px"}}>
<span>Invoice</span><span>Client</span><span>Status</span><span style={{textAlign: "right"}}>Amount</span>
</div>
{(invoices || []).map((inv: any, __i2: number) => (
<React.Fragment key={__i2}>
<div style={{display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr 1fr", padding: "13px 20px", fontSize: "12.5px", borderBottom: "1px solid var(--border)", alignItems: "center", minWidth: "560px"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600"}}>{inv.id}</span>
<span>{inv.client}</span>
<span style={{display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: (inv.statusSoft), color: (inv.statusColor), width: "fit-content"}}>{inv.statusLabel}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600", textAlign: "right"}}>{inv.amount}</span>
</div>
</React.Fragment>
))}
</section>
</div>
</>) : null}

{(isReports) ? (<>
<div data-screen-label="Reports" style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px"}}>
{(reportStats || []).map((rs: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "18px", padding: "18px 20px"}}>
<div style={{fontSize: "11px", fontWeight: "700", color: "var(--muted)"}}>{rs.label}</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "23px", fontWeight: "500", marginTop: "4px", color: (rs.color)}}>{rs.value}</div>
</div>
</React.Fragment>
))}
</div>
<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", padding: "20px"}}>
<h2 style={{margin: "0 0 14px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700"}}>Daily volume · last 10 days</h2>
<div style={{display: "flex", alignItems: "flex-end", gap: "8px", height: "130px"}}>
{(reportBars || []).map((b: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{flex: "1", background: "var(--surface3)", borderRadius: "8px 8px 3px 3px", minHeight: "4px", height: "100%", position: "relative"}}>
<div style={{position: "absolute", bottom: "0", left: "0", right: "0", height: `${(b.h)}%`, background: "var(--indigo)", borderRadius: "8px 8px 3px 3px"}} />
</div>
</React.Fragment>
))}
</div>
</section>
<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", padding: "20px"}}>
<h2 style={{margin: "0 0 14px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700"}}>Payout coverage</h2>
<div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
{(coverageChips || []).map((cc: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "12px", background: "var(--surface2)"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(cc.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontSize: "12px", fontWeight: "700"}}>{cc.code}</span></div>
</React.Fragment>
))}
</div>
</section>
</div>
</>) : null}

{(isVerification) ? (<>
<div data-screen-label="Verification" style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px"}}>
{(tiers || []).map((t: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "20px", padding: "22px", position: "relative"}}>
<span style={{position: "absolute", top: "20px", right: "20px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: (t.statusSoft), color: (t.statusColor)}}>{t.statusLabel}</span>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "var(--indigo-text)", letterSpacing: "0.1em"}}>{t.num}</div>
<h3 style={{margin: "5px 0 8px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "16px"}}>{t.title}</h3>
<div style={{display: "flex", flexDirection: "column", gap: "7px", fontSize: "12.5px", color: "var(--muted)", margin: "10px 0 14px"}}>
{(t.reqs || []).map((r: any, __i1: number) => (
<React.Fragment key={__i1}><div>✓ {r}</div></React.Fragment>
))}
</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "12px", color: "var(--muted)", padding: "9px 13px", borderRadius: "12px", background: "var(--surface2)"}}>{t.limit}</div>
{(t.locked) ? (<>
<button onClick={openModalTier} style={{width: "100%", marginTop: "14px", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>Upgrade to Tier 3</button>
</>) : null}
</div>
</React.Fragment>
))}
</div>
</div>
</>) : null}

{(isTeam) ? (<>
<div data-screen-label="Team" style={{display: "flex", flexDirection: "column", gap: "14px", maxWidth: "760px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<h2 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "0.02em", color: "var(--muted)", textTransform: "uppercase"}}>Members · {teamCount}</h2>
<button onClick={openInvite} style={{padding: "9px 16px", borderRadius: "999px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Sora',sans-serif", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ Invite person</button>
</div>

<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", overflow: "hidden"}}>
{(teamRows || []).map((m: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "14px", padding: "14px 20px", borderBottom: "1px solid var(--border)"}}>
<span style={{width: "38px", height: "38px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", flexShrink: "0"}}>{m.initials}</span>
<div style={{flex: "1", minWidth: "0"}}>
<div style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700"}}>{m.name}</div>
<div style={{fontSize: "11.5px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{m.email}</div>
</div>
<span style={{display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: (m.statusSoft), color: (m.statusColor), flexShrink: "0"}}><span style={{width: "6px", height: "6px", borderRadius: "50%", background: "currentColor"}} />{m.statusLabel}</span>
<select value={m.role} onChange={m.setRole} style={{flexShrink: "0", padding: "7px 10px", borderRadius: "10px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", color: "var(--ink)", fontFamily: "'DM Sans',sans-serif", fontSize: "12px", fontWeight: "600", cursor: "pointer"}}>
{(m.roleOptions || []).map((ro: any, __i1: number) => (
<React.Fragment key={__i1}>
<option value={ro.key}>{ro.label}</option>
</React.Fragment>
))}
</select>
<button onClick={m.remove} style={{flexShrink: "0", background: "none", border: "none", padding: "6px", color: "var(--muted2)", fontSize: "15px", cursor: "pointer", lineHeight: "1"}}>✕</button>
</div>
</React.Fragment>
))}
</section>

{(inviteOpen) ? (<>
<div onClick={closeInvite} style={{position: "fixed", inset: "0", background: "var(--overlay-bg)", backdropFilter: "blur(6px)", zIndex: "60", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"}}>
<div onClick={stopClick} style={{background: "var(--modal-bg)", border: "1px solid var(--border)", borderRadius: "22px", padding: "24px", width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<h3 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "17px", fontWeight: "700"}}>Invite a teammate</h3>
<button onClick={closeInvite} style={{background: "none", border: "none", color: "var(--muted2)", fontSize: "17px", cursor: "pointer", lineHeight: "1"}}>✕</button>
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Full name</span>
<input value={inviteName} onChange={setInviteName} placeholder="e.g. Amina Bello" style={{width: "100%", marginTop: "6px", padding: "11px 13px", borderRadius: "12px", background: "var(--input-bg)", border: "1.5px solid var(--input-border)", outline: "none", fontSize: "13px", fontWeight: "600", color: "var(--ink)", boxSizing: "border-box"}} />
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Email address</span>
<input value={inviteEmail} onChange={setInviteEmail} placeholder="name@company.com" style={{width: "100%", marginTop: "6px", padding: "11px 13px", borderRadius: "12px", background: "var(--input-bg)", border: "1.5px solid var(--input-border)", outline: "none", fontSize: "13px", fontWeight: "600", color: "var(--ink)", boxSizing: "border-box"}} />
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Role</span>
<div style={{display: "flex", flexDirection: "column", gap: "7px", marginTop: "8px"}}>
{(inviteRoleChips || []).map((r: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={r.select} style={{textAlign: "left", display: "flex", flexDirection: "column", gap: "2px", padding: "10px 13px", borderRadius: "12px", border: "none", background: (r.bg), color: (r.color), cursor: "pointer"}}>
<b style={{fontFamily: "'Sora',sans-serif", fontSize: "12.5px"}}>{r.label}</b><span style={{fontSize: "11px", opacity: "0.8"}}>{r.desc}</span>
</button>
</React.Fragment>
))}
</div>
</div>
<button onClick={submitInvite} disabled={inviteCannotSubmit} style={{marginTop: "4px", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Sora',sans-serif", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>Send invite</button>
</div>
</div>
</>) : null}
</div>
</>) : null}

{(isDeveloper) ? (<>
<div data-screen-label="Developer" style={{display: "flex", flexDirection: "column", gap: "14px", maxWidth: "720px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<h2 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "0.02em", color: "var(--muted)", textTransform: "uppercase"}}>API keys</h2>
<button onClick={createApiKey} style={{background: "none", border: "none", padding: "0", color: "var(--indigo-text)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>+ Create key</button>
</div>
{(apiKeys || []).map((k: any, __i2: number) => (
<React.Fragment key={__i2}>
<section style={{background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "22px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px"}}>
<div style={{display: "flex", alignItems: "center", gap: "10px"}}><b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14px"}}>{k.label}</b><span style={{fontFamily: "'DM Mono',monospace", fontSize: "10.5px", fontWeight: "700", background: (k.modeBg), color: (k.modeColor), padding: "4px 10px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.04em"}}>{k.modeLabel}</span></div>
<button onClick={k.revoke} style={{background: "none", border: "none", padding: "0", color: "var(--red)", fontSize: "11.5px", fontWeight: "700", cursor: "pointer"}}>Revoke</button>
</div>

<div>
<span style={{fontSize: "10.5px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Secret key</span>
<div style={{display: "flex", alignItems: "center", gap: "10px", marginTop: "6px", padding: "10px 14px", borderRadius: "12px", background: "var(--surface2)", fontFamily: "'DM Mono',monospace", fontSize: "12px"}}>
<span style={{flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{k.keyDisplay}</span>
<button onClick={k.toggleReveal} style={{flexShrink: "0", padding: "6px 12px", borderRadius: "999px", border: "none", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>{k.revealLabel}</button>
<button onClick={k.copyKey} style={{flexShrink: "0", padding: "6px 12px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--bg)", fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>{k.copyKeyLabel}</button>
</div>
</div>

<div>
<span style={{fontSize: "10.5px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Webhook URL</span>
<div style={{display: "flex", alignItems: "center", gap: "10px", marginTop: "6px", padding: "10px 14px", borderRadius: "12px", background: "var(--surface2)", fontFamily: "'DM Mono',monospace", fontSize: "12px"}}>
<span style={{flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{k.webhookUrl}</span>
<button onClick={k.copyWebhook} style={{flexShrink: "0", padding: "6px 12px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--bg)", fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>{k.copyWebhookLabel}</button>
</div>
<span style={{display: "block", marginTop: "6px", fontSize: "11px", color: "var(--muted)"}}>{k.events}</span>
</div>

<div>
<span style={{fontSize: "10.5px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Webhook signing secret</span>
<div style={{display: "flex", alignItems: "center", gap: "10px", marginTop: "6px", padding: "10px 14px", borderRadius: "12px", background: "var(--surface2)", fontFamily: "'DM Mono',monospace", fontSize: "12px"}}>
<span style={{flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{k.webhookSecretDisplay}</span>
<button onClick={k.toggleRevealSecret} style={{flexShrink: "0", padding: "6px 12px", borderRadius: "999px", border: "none", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>{k.revealSecretLabel}</button>
</div>
</div>
</section>
</React.Fragment>
))}
</div>
</>) : null}

</div>

{(isMobile) ? (<>
<nav style={{flexShrink: "0", display: "flex", alignItems: "stretch", background: "var(--surface)", backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)", borderTop: "1px solid var(--glass-border)", padding: "8px 6px calc(8px + env(safe-area-inset-bottom))", position: "sticky", bottom: "0", zIndex: "6"}}>
{(bottomNavItems || []).map((bn: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={bn.select} style={{flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "6px 2px", background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", color: (bn.color)}}>
<span style={{fontSize: "18px", lineHeight: "1"}}>{bn.icon}</span>
<span style={{fontSize: "10px", fontWeight: (bn.weight)}}>{bn.label}</span>
</button>
</React.Fragment>
))}
</nav>
</>) : null}
</main>
</div>
</>) : null}
{modalOpen ? (<>
<div onClick={closeModal} style={{position: "fixed", inset: "0", background: "var(--overlay-bg)", backdropFilter: "blur(14px) saturate(1.2)", WebkitBackdropFilter: "blur(14px) saturate(1.2)", zIndex: "100", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"}}>
<div onClick={stopClick} style={{width: "100%", maxWidth: "440px", maxHeight: "88vh", overflow: "auto", background: "var(--modal-bg)", backdropFilter: "blur(36px) saturate(1.8)", WebkitBackdropFilter: "blur(36px) saturate(1.8)", border: "1px solid var(--glass-border)", borderRadius: "28px", boxShadow: "0 34px 90px -22px rgba(19,17,38,0.5)", padding: "22px", display: "flex", flexDirection: "column", gap: "16px", fontFamily: "'DM Sans',sans-serif"}}>

<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<h3 style={{margin: "0", fontFamily: "'Space Grotesk',sans-serif", fontSize: "16px", fontWeight: "700"}}>{modalTitle}</h3>
<button onClick={closeModal} style={{width: "30px", height: "30px", borderRadius: "50%", border: "none", background: "var(--surface2)", color: "var(--muted)", fontSize: "14px", cursor: "pointer", flexShrink: "0"}}>✕</button>
</div>

{(isModalSend) ? (<>
{(sendNotDone) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", gap: "6px"}}>
{(sendStepDots || []).map((d: any, __i1: number) => (
<React.Fragment key={__i1}>
<span style={{height: "4px", flex: "1", borderRadius: "999px", background: (d.on)}} />
</React.Fragment>
))}
</div>

{(sendStepIs1) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 1 · Where is this going?</span>
<div style={{display: "flex", gap: "6px"}}>
{(sendGroups || []).map((g: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={g.select} style={{padding: "9px 13px", borderRadius: "999px", border: "none", background: (g.bg), color: (g.color), fontSize: "11.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}>{g.label}</button>
</React.Fragment>
))}
</div>
{(sendIsCountry) ? (<>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Recipient's country</span>
<div style={{display: "flex", gap: "6px", overflowX: "auto", padding: "8px 0 2px"}}>
{(sendCountryChips || []).map((c: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={c.selectSend} style={{display: "flex", alignItems: "center", gap: "6px", padding: "7px 11px", borderRadius: "999px", border: `1.5px solid ${(c.sendBorder)}`, background: (c.sendBg), color: "var(--ink)", cursor: "pointer", flexShrink: "0"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(c.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontSize: "11.5px", fontWeight: "700"}}>{c.code}</span></button>
</React.Fragment>
))}
</div>
</div>
{(sendRailHasChoice) ? (<>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Payout rail</span>
<div style={{display: "flex", gap: "6px", marginTop: "6px"}}>
{(sendRailChips || []).map((r: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={r.select} style={{padding: "8px 13px", borderRadius: "12px", border: "none", background: (r.bg), color: (r.color), fontSize: "12px", fontWeight: "700", cursor: "pointer"}}>{r.label}</button>
</React.Fragment>
))}
</div>
</div>
</>) : null}
{(sendProviderHasChoice) ? (<>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Choose provider</span>
<div style={{display: "flex", gap: "6px", overflowX: "auto", padding: "6px 0 2px"}}>
{(sendProviderChips || []).map((p: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={p.select} style={{padding: "8px 13px", borderRadius: "12px", border: `1.5px solid ${(p.border)}`, background: (p.bg), color: "var(--ink)", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}>{p.name}</button>
</React.Fragment>
))}
</div>
</div>
</>) : null}
</>) : null}
{(sendIsCrypto) ? (<>
<p style={{margin: "0", fontSize: "12.5px", color: "var(--muted)"}}>Sends stablecoin directly on-chain — no bank or mobile money involved.</p>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Asset</span>
<div style={{display: "flex", gap: "4px", background: "var(--surface2)", padding: "3px", borderRadius: "10px", marginTop: "6px", width: "fit-content"}}>
{(sendAssets || []).map((as: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={as.select} style={{padding: "6px 12px", borderRadius: "8px", border: "none", background: (as.bg), color: (as.color), fontSize: "11.5px", fontWeight: "700", cursor: "pointer"}}>{as.label}</button>
</React.Fragment>
))}
</div>
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Confirm the chain you're sending to</span>
<div style={{display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px"}}>
{(sendChains || []).map((ch: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={ch.select} style={{padding: "9px 14px", borderRadius: "12px", border: `1.5px solid ${(ch.border)}`, background: (ch.bg), color: (ch.color), fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>{ch.label}</button>
</React.Fragment>
))}
</div>
<div style={{marginTop: "8px", padding: "10px 12px", borderRadius: "12px", background: "var(--amber-tint)", color: "var(--amber)", fontSize: "11.5px", fontWeight: "600", lineHeight: "1.5"}}>Double-check the recipient accepts {sendAssetCode} on {sendChainLabel} — sending to the wrong network can lose funds.</div>
</div>
</>) : null}
<button onClick={sendNext} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Continue</button>
</div>
</>) : null}

{(sendStepIs2) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 2 · Recipient & amount</span>
<div style={{padding: "10px 12px", borderRadius: "12px", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontSize: "12px", fontWeight: "600"}}>{sendDestinationSummary}</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>{sendRecipientLabel}</span>
<input value={sendRecipient} onChange={setSendRecipient} placeholder={sendRecipientPlaceholder} style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} />
</div>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Amount (USD)</span>
<input value={sendAmount} onChange={setSendAmount} placeholder="0.00" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} />
</div>
<div style={{display: "flex", gap: "8px"}}>
<button onClick={sendBack} style={{flex: "1", padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>Back</button>
<button onClick={sendNext} style={{flex: "2", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Review</button>
</div>
</div>
</>) : null}

{(sendStepIs3) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 3 · Review & confirm</span>
<div style={{display: "flex", flexDirection: "column", gap: "8px", padding: "14px", borderRadius: "14px", background: "var(--surface2)"}}>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>To</span><b>{sendRecipient}</b></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Via</span><b>{sendDestinationSummary}</b></div>
{(sendIsCrypto) ? (<>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Network</span><b>{sendChainLabel}</b></div>
</>) : null}
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Amount</span><b style={{fontFamily: "'DM Mono',monospace"}}>${sendAmount}</b></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Fee</span><b>{sendFeeText}</b></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Arrival</span><b>{sendArrivalText}</b></div>
</div>
<div style={{display: "flex", gap: "8px"}}>
<button onClick={sendBack} style={{flex: "1", padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>Back</button>
<button onClick={submitSend} style={{flex: "2", padding: "12px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Confirm & send ↗</button>
</div>
</div>
</>) : null}
</div>
</>) : null}
{(sendDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Payment on its way</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>${sendAmount} to {sendRecipient} · {sendArrivalText}</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}


{(isModalDeposit) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", gap: "6px"}}>
{(depositStepDots || []).map((d: any, __i1: number) => (
<React.Fragment key={__i1}>
<span style={{height: "4px", flex: "1", borderRadius: "999px", background: (d.on)}} />
</React.Fragment>
))}
</div>

{(depositStepIs1) ? (<>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 1 · How are you topping up?</span>
<div style={{display: "flex", gap: "6px"}}>
{(depositMethods || []).map((dm: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={dm.select} style={{padding: "9px 14px", borderRadius: "999px", border: "none", background: (dm.bg), color: (dm.color), fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}>{dm.label}</button>
</React.Fragment>
))}
</div>

{(depositIsCountry) ? (<>
<div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
{(depositCountryChips || []).map((c: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={c.selectDeposit} style={{display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px 7px 7px", borderRadius: "999px", border: `1.5px solid ${(c.depositBorder)}`, background: (c.depositBg), color: "var(--ink)", cursor: "pointer"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(c.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap"}}>{c.name}</span></button>
</React.Fragment>
))}
</div>
{(depositRailHasChoice) ? (<>
<div style={{display: "flex", gap: "6px"}}>
{(depositRailChips || []).map((r: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={r.select} style={{padding: "8px 13px", borderRadius: "12px", border: "none", background: (r.bg), color: (r.color), fontSize: "12px", fontWeight: "700", cursor: "pointer"}}>{r.label}</button>
</React.Fragment>
))}
</div>
</>) : null}
{(depositProviderHasChoice) ? (<>
<div>
<span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.06em"}}>Choose provider</span>
<div style={{display: "flex", gap: "6px", overflowX: "auto", padding: "6px 0 2px"}}>
{(depositProviderChips || []).map((p: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={p.select} style={{padding: "8px 13px", borderRadius: "12px", border: `1.5px solid ${(p.border)}`, background: (p.bg), color: "var(--ink)", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}>{p.name}</button>
</React.Fragment>
))}
</div>
</div>
</>) : null}
</>) : null}

{(depositIsCrypto) ? (<>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Asset</span>
<div style={{display: "flex", gap: "4px", background: "var(--surface2)", padding: "3px", borderRadius: "10px"}}>
{(depositAssets || []).map((as: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={as.select} style={{padding: "5px 10px", borderRadius: "8px", border: "none", background: (as.bg), color: (as.color), fontSize: "11.5px", fontWeight: "700", cursor: "pointer"}}>{as.label}</button>
</React.Fragment>
))}
</div>
</div>
<div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
{(depositNetworks || []).map((net: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={net.select} style={{padding: "8px 12px", borderRadius: "12px", border: `1.5px solid ${(net.border)}`, background: (net.bg), color: (net.color), fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}>{net.label}</button>
</React.Fragment>
))}
</div>
</>) : null}

<button onClick={depositNext} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Continue</button>
</>) : null}

{(depositStepIs2) ? (<>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 2 · {depositDestinationSummary}</span>

{(depositIsMobileRail) ? (<>
{(depositPromptNotSent) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
<p style={{margin: "0", fontSize: "12.5px", color: "var(--muted)"}}>We'll push a {depositOperator} prompt to your phone.</p>
<div style={{display: "flex", gap: "8px"}}>
<div style={{flex: "1", display: "flex", alignItems: "center", gap: "8px", padding: "11px 13px", borderRadius: "14px", background: "var(--input-bg)", border: "1.5px solid var(--input-border)"}}>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>{depositMobileCode}</span>
<input value={depositPhone} onChange={setDepositPhone} placeholder="712 345 678" style={{flex: "1", border: "none", background: "none", outline: "none", fontSize: "13px", fontWeight: "600", color: "var(--ink)", minWidth: "0"}} />
</div>
<button onClick={sendDepositPrompt} style={{padding: "0 16px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}>Send</button>
</div>
</div>
</>) : null}
{(depositPromptSent) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
<div style={{display: "flex", alignItems: "center", gap: "8px"}}><span style={{width: "8px", height: "8px", borderRadius: "50%", background: "var(--indigo)", animation: "pulse-dot 1.2s ease-in-out infinite"}} /><span style={{fontSize: "13px", fontWeight: "700"}}>Check your phone</span></div>
<p style={{margin: "0", fontSize: "12px", color: "var(--muted)"}}>Enter your PIN to approve the {depositOperator} prompt sent to {depositMobileCode} {depositPhone}.</p>
</div>
</>) : null}
</>) : null}

{(depositIsBankRail) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
<p style={{margin: "0", fontSize: "12.5px", color: "var(--muted)"}}>{depositBankLabel} via {depositOperator} · {depositBankArrival}</p>
<div style={{display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", borderRadius: "14px", background: "var(--surface2)"}}>
{(depositBankLines || []).map((ln: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "12px", fontSize: "12.5px"}}><span style={{color: "var(--muted)", whiteSpace: "nowrap", flexShrink: "0"}}>{ln.k}</span><span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600", textAlign: "right", flex: "1"}}>{ln.v}</span></div>
</React.Fragment>
))}
</div>
</div>
</>) : null}

{(depositIsCrypto) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
<div style={{padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: "600"}}>Only send {depositAssetCode} on {depositNetworkLabel} — other networks cannot be recovered.</div>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "11px 13px", borderRadius: "12px", background: "var(--surface2)"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "12px", fontWeight: "600", wordBreak: "break-all"}}>{depositAddress}</span>
<button style={{flexShrink: "0", padding: "6px 11px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--surface)", fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>Copy</button>
</div>
</div>
</>) : null}

<button onClick={depositBack} style={{marginTop: "6px", padding: "11px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Back</button>
</>) : null}
</div>
</>) : null}


{(isModalReceive) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<p style={{margin: "0", fontSize: "12.5px", color: "var(--muted)"}}>Share these coordinates with whoever is paying you — no action needed on your end until funds land.</p>
<div style={{display: "flex", gap: "6px"}}>
{(receiveGroups || []).map((rg: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={rg.select} style={{padding: "9px 14px", borderRadius: "999px", border: "none", background: (rg.bg), color: (rg.color), fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}>{rg.label}</button>
</React.Fragment>
))}
</div>

{(receiveIsFiat) ? (<>
<div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
{(receiveAcctChips || []).map((c: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={c.select} style={{display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px 7px 7px", borderRadius: "999px", border: `1.5px solid ${(c.border)}`, background: (c.bg), color: "var(--ink)", cursor: "pointer"}}><div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(c.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} /><span style={{fontSize: "12px", fontWeight: "700"}}>{c.code}</span></button>
</React.Fragment>
))}
</div>
<p style={{margin: "0", fontSize: "11.5px", color: "var(--muted2)"}}>{receiveAcctRail}</p>
<div style={{display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", borderRadius: "14px", background: "var(--surface2)"}}>
{(receiveAcctLines || []).map((ln: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px"}}>
<span style={{color: "var(--muted)", whiteSpace: "nowrap", flexShrink: "0", width: "120px"}}>{ln.k}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600", flex: "1", wordBreak: "break-all"}}>{ln.v}</span>
<button onClick={ln.copy} style={{flexShrink: "0", padding: "5px 10px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--surface)", fontSize: "10.5px", fontWeight: "700", cursor: "pointer"}}>{(ln.copied) ? (<>Copied</>) : (<>Copy</>)}</button>
</div>
</React.Fragment>
))}
</div>
</>) : null}

{(receiveIsCrypto) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Asset</span>
<div style={{display: "flex", gap: "4px", background: "var(--surface2)", padding: "3px", borderRadius: "10px"}}>
{(receiveAssets || []).map((as: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={as.select} style={{padding: "5px 10px", borderRadius: "8px", border: "none", background: (as.bg), color: (as.color), fontSize: "11.5px", fontWeight: "700", cursor: "pointer"}}>{as.label}</button>
</React.Fragment>
))}
</div>
</div>
<div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
{(receiveNetworks || []).map((net: any, __i1: number) => (
<React.Fragment key={__i1}>
<button onClick={net.select} style={{padding: "8px 12px", borderRadius: "12px", border: `1.5px solid ${(net.border)}`, background: (net.bg), color: (net.color), fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}>{net.label}</button>
</React.Fragment>
))}
</div>
<div style={{padding: "10px 12px", borderRadius: "12px", background: "var(--amber-tint)", color: "var(--amber)", fontSize: "12px", fontWeight: "600", lineHeight: "1.5"}}>Only accept {receiveAssetCode} on {receiveNetworkLabel} — funds sent on other networks cannot be recovered.</div>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 10px 10px 16px", borderRadius: "14px", background: "var(--surface2)", border: "1.5px solid var(--glass-border)"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "14.5px", fontWeight: "600", letterSpacing: "0.02em", wordBreak: "break-all", lineHeight: "1.5"}}>{receiveAddress}</span>
<button onClick={copyReceiveAddress} style={{flexShrink: "0", display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--bg)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap"}}><span style={{fontSize: "14px"}}>⧉</span>{(receiveAddressCopied) ? (<>Copied</>) : (<>Copy</>)}</button>
</div>
</div>
</>) : null}
</div>
</>) : null}

{(isModalBulk) ? (<>
{(bulkNotDone) ? (<>
{(bulkNotLoaded) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 1 · Upload recipients</span>
<p style={{margin: "0", fontSize: "12.5px", color: "var(--muted)"}}>Upload a CSV with recipient name, country, phone/account and amount. We detect the country and rail per row automatically.</p>
<button onClick={simulateBulkUpload} style={{padding: "14px 20px", borderRadius: "14px", border: "1.5px dashed var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>⬆ Simulate CSV upload</button>
</div>
</>) : null}
{(bulkLoaded) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)"}}>Step 2 · Review & confirm</span>
<div style={{display: "flex", flexDirection: "column", gap: "6px"}}>
{(bulkRows || []).map((row: any, __i1: number) => (
<React.Fragment key={__i1}>
<div style={{display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "12px", background: "var(--surface2)", fontSize: "12px"}}>
<div style={{width: "18px", height: "13px", borderRadius: "2px", backgroundImage: `url(${(row.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} />
<span style={{flex: "1", fontWeight: "600"}}>{row.name}</span>
<span style={{color: "var(--muted)"}}>{row.rail}</span>
<span style={{fontFamily: "'DM Mono',monospace", fontWeight: "700"}}>{row.amount}</span>
</div>
</React.Fragment>
))}
</div>
<div style={{display: "flex", flexDirection: "column", gap: "8px", padding: "14px", borderRadius: "14px", background: "var(--surface2)"}}>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Recipients</span><span style={{fontWeight: "700"}}>143</span></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Countries detected</span><span style={{fontWeight: "700"}}>{bulkCountryLabel}</span></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: "var(--muted)"}}>Total value</span><span style={{fontFamily: "'DM Mono',monospace", fontWeight: "700"}}>≈ $84,210</span></div>
</div>
<button onClick={runBulkPayout} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Confirm & run bulk payout ↗</button>
</div>
</>) : null}
</>) : null}
{(bulkDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>143 payouts queued</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Routing across live corridors now.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalSwap) ? (<>
{(swapNotAccepted) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "14px"}}>
<div style={{display: "flex", gap: "8px"}}>
<button onClick={setOnramp} style={{flex: "1", padding: "10px", borderRadius: "12px", border: `1.5px solid ${(onrampTabBorder)}`, background: (onrampTabBg), color: (onrampTabColor), fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Fiat → Stablecoin</button>
<button onClick={setOfframp} style={{flex: "1", padding: "10px", borderRadius: "12px", border: `1.5px solid ${(offrampTabBorder)}`, background: (offrampTabBg), color: (offrampTabColor), fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Stablecoin → Fiat</button>
</div>
<div style={{background: "var(--surface2)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "6px"}}>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "24px", fontWeight: "500"}}>{swapAmountFrom}</span>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)", padding: "5px 10px", background: "var(--surface3)", borderRadius: "8px"}}>{swapFromCcy}</span>
</div>
<div style={{textAlign: "center", color: "var(--muted2)", fontSize: "13px"}}>↓</div>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "24px", fontWeight: "500", color: "var(--indigo-text)"}}>{swapAmountTo}</span>
<span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--muted)", padding: "5px 10px", background: "var(--surface3)", borderRadius: "8px"}}>{swapToCcy}</span>
</div>
</div>
<div style={{display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px"}}>
<div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--muted)"}}>Rate</span><span style={{fontFamily: "'DM Mono',monospace", fontWeight: "600"}}>{swapRate}</span></div>
<div style={{display: "flex", justifyContent: "space-between"}}><span style={{color: "var(--muted)"}}>Settles via</span><span style={{fontWeight: "600"}}>{swapSettle}</span></div>
</div>
{(quoteExpired) ? (<>
<div style={{padding: "12px 14px", borderRadius: "12px", background: "var(--red-tint)", display: "flex", flexDirection: "column", gap: "2px"}}><span style={{fontSize: "12.5px", fontWeight: "700", color: "var(--red)"}}>Rate expired</span><span style={{fontSize: "11.5px", color: "var(--muted)"}}>Refresh to fetch an up-to-date rate.</span></div>
</>) : null}
{(quoteLive) ? (<>
<div style={{height: "4px", borderRadius: "2px", background: "var(--surface3)", overflow: "hidden"}}><div style={{height: "100%", background: "var(--indigo)", width: `${(quoteProgress)}%`, transition: "width 1s linear"}} /></div>
</>) : null}
<div style={{display: "flex", gap: "8px"}}>
<button onClick={refreshQuote} style={{flex: "1", padding: "10px", borderRadius: "12px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Refresh quote</button>
<button onClick={acceptQuote} disabled={quoteExpired} style={{flex: "1", padding: "10px", borderRadius: "12px", border: "none", background: (acceptBg), color: (acceptColor), fontSize: "12.5px", fontWeight: "700", cursor: (acceptCursor)}}>Accept & settle</button>
</div>
</div>
</>) : null}
{(swapAccepted) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Swap complete</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Settled via {swapSettle}.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalTxDetail) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div style={{textAlign: "center", padding: "6px 0 4px"}}>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "28px", fontWeight: "500", color: (txDetail.amountColor)}}>{txDetail.amount}</div>
<div style={{fontSize: "12.5px", color: "var(--muted)", marginTop: "2px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"}}><div style={{width: "16px", height: "12px", borderRadius: "2px", backgroundImage: `url(${(txDetail.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: "0"}} />{txDetail.client}</div>
<span style={{display: "inline-flex", marginTop: "8px", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", padding: "4px 11px", borderRadius: "999px", background: (txDetail.statusSoft), color: (txDetail.statusColor)}}>{txDetail.statusLabel}</span>
</div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "9px 0", borderBottom: "1px dashed var(--border)"}}><span style={{color: "var(--muted)"}}>Reference</span><b style={{fontFamily: "'DM Mono',monospace", fontWeight: "600"}}>{txDetail.ref}</b></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "9px 0", borderBottom: "1px dashed var(--border)"}}><span style={{color: "var(--muted)"}}>Rail</span><b>{txDetail.type}</b></div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "9px 0"}}><span style={{color: "var(--muted)"}}>Settlement layer</span><b>USDC · Base</b></div>
</div>
</>) : null}

{(isModalAcctDetail) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div style={{textAlign: "center", padding: "2px 0 8px"}}>
<div style={{display: "flex", justifyContent: "center"}}>{(acctDetail.flagUrl) ? (<><div style={{width: "36px", height: "27px", borderRadius: "4px", backgroundImage: `url(${(acctDetail.flagUrl)})`, backgroundSize: "cover", backgroundPosition: "center"}} /></>) : (<><span style={{width: "36px", height: "36px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px"}}>$</span></>)}</div>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "26px", fontWeight: "500", marginTop: "4px"}}>{acctDetail.balance}</div>
<div style={{fontSize: "12px", color: "var(--muted)"}}>{acctDetail.name} · {acctDetail.rail}</div>
</div>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "12px 14px", borderRadius: "12px", background: "var(--surface2)"}}>
<span style={{fontFamily: "'DM Mono',monospace", fontSize: "12.5px", fontWeight: "600"}}>{acctDetail.detail}</span>
<button style={{flexShrink: "0", padding: "6px 12px", borderRadius: "999px", border: "none", background: "var(--ink)", color: "var(--surface)", fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>Copy</button>
</div>
<button onClick={openModalSwapFromAcct} style={{padding: "12px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "13px", fontWeight: "700", cursor: "pointer"}}>Convert</button>
</div>
</>) : null}

{(isModalCardDetail) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div style={{aspectRatio: "1.586", maxWidth: "280px", margin: "0 auto", borderRadius: "20px", background: (cardDetail.bg), color: "#fff", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
<b style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "12.5px"}}>{cardDetail.label}</b>
<div style={{fontFamily: "'DM Mono',monospace", fontSize: "13px", letterSpacing: "0.1em"}}>•••• •••• •••• {cardDetail.last4}</div>
</div>
<div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px", padding: "9px 0", borderBottom: "1px dashed var(--border)"}}><span style={{color: "var(--muted)"}}>Available to spend</span><b style={{fontFamily: "'DM Mono',monospace"}}>{cardDetail.balance}</b></div>
<div style={{display: "flex", gap: "8px"}}>
<button onClick={fundCard} style={{flex: "1", padding: "11px", borderRadius: "12px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Fund card</button>
<button onClick={withdrawCard} style={{flex: "1", padding: "11px", borderRadius: "12px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Withdraw</button>
</div>
<div style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0"}}><span style={{fontSize: "12.5px", fontWeight: "700"}}>Freeze card</span><button onClick={toggleFreezeCard} style={{width: "44px", height: "24px", borderRadius: "999px", border: "none", background: (cardDetail.freezeTrack), position: "relative", cursor: "pointer"}}><span style={{position: "absolute", top: "3px", left: (cardDetail.freezeKnobLeft), width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s"}} /></button></div>
<button onClick={terminateCard} style={{padding: "10px", borderRadius: "12px", border: "1.5px solid var(--red-tint)", background: "none", color: "var(--red)", fontSize: "12px", fontWeight: "700", cursor: "pointer"}}>Terminate card</button>
</div>
</>) : null}

{(isModalFundCard) ? (<>
{(fundCardNotDone) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div><span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Amount (USD)</span><input value={fundAmount} onChange={setFundAmount} placeholder="250.00" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} /></div>
<div style={{padding: "10px 12px", borderRadius: "12px", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontSize: "12px", fontWeight: "600"}}>Funded from your main USDC wallet.</div>
<button onClick={submitFundCard} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Load funds</button>
</div>
</>) : null}
{(fundCardDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Card funded</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>${fundAmount} loaded, available immediately.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalNewCard) ? (<>
{(newCardNotDone) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div><span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Card label</span><input value={newCardLabel} onChange={setNewCardLabel} placeholder="e.g. Marketing Ads" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} /></div>
<button onClick={issueCard} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Issue card</button>
</div>
</>) : null}
{(newCardDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Card issued</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Ready to use immediately.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalInvoice) ? (<>
{(invoiceNotDone) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "12px"}}>
<div><span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Client name</span><input value={invClient} onChange={setInvClient} placeholder="e.g. Acme GmbH" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} /></div>
<div><span style={{fontSize: "11px", fontWeight: "700", color: "var(--muted2)", textTransform: "uppercase"}}>Amount (USD)</span><input value={invAmount} onChange={setInvAmount} placeholder="0.00" style={{width: "100%", marginTop: "6px", padding: "12px 14px", borderRadius: "14px", border: "1.5px solid var(--input-border)", background: "var(--input-bg)", outline: "none", fontSize: "13.5px", color: "var(--ink)", boxSizing: "border-box"}} /></div>
<button onClick={submitInvoice} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Create & get link</button>
</div>
</>) : null}
{(invoiceDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Invoice created</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>{invClient} will get a payment link by email.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

{(isModalTier) ? (<>
{(tierNotDone) ? (<>
<div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
<p style={{margin: "0", fontSize: "12.5px", color: "var(--muted)"}}>Upload three documents. Review usually takes 1-2 business days.</p>
{(tierDocs || []).map((d: any, __i2: number) => (
<React.Fragment key={__i2}>
<div style={{display: "flex", alignItems: "center", gap: "12px", padding: "14px", borderRadius: "14px", background: "var(--surface2)"}}><div style={{flex: "1"}}><b style={{fontSize: "13px"}}>{d}</b></div><button onClick={uploadTierDoc} style={{padding: "6px 13px", borderRadius: "999px", border: "none", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontSize: "11px", fontWeight: "700", cursor: "pointer"}}>Upload</button></div>
</React.Fragment>
))}
<button onClick={submitTier} style={{padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}}>Submit for review</button>
</div>
</>) : null}
{(tierDone) ? (<>
<div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center"}}>
<span style={{width: "48px", height: "48px", borderRadius: "50%", background: "var(--indigo-tint)", color: "var(--indigo-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"}}>✓</span>
<span style={{fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700"}}>Documents submitted</span>
<span style={{fontSize: "12.5px", color: "var(--muted)"}}>Compliance will follow up within 1-2 business days.</span>
<button onClick={closeModal} style={{marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}}>Done</button>
</div>
</>) : null}
</>) : null}

</div>
</div>
</>) : null}
    </div>
  );
}
