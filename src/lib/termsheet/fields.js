/* Field dictionary for the VDR digital term sheet.
   Generated from ICMA Bond Data Taxonomy 2.0. Do not hand-edit paths:
   every `p` is an element path below <ICMABondDataTaxonomy> and must match the XSD. */

/* ============================================================
   VDR Digital Term Sheet — field dictionary
   Paths are BDT 2.0 element paths below <ICMABondDataTaxonomy>.
   Fields marked ext:1 are VDR execution fields with no BDT 2.0
   home; they travel in the VDR envelope, not the BDT payload.
   ============================================================ */
export const STAGES = [
  {k:"ANNOUNCE", t:"Announcement"},
  {k:"IPT",      t:"Initial price thoughts"},
  {k:"GUIDANCE", t:"Guidance"},
  {k:"LAUNCH",   t:"Spread set / launch"},
  {k:"PRICED",   t:"Priced"},
  {k:"ALLOCATED",t:"Allocated"},
  {k:"FINAL",    t:"Final terms"}
];

export const E = {
  DocumentStatus:["PENDING","ISSUED","WITHDRAWN"],
  PartyRoleType:["ISSUER","GUARANTOR","GLOBAL_COORDINATOR","LEAD_MANAGER","JOINT_LEAD_MANAGER","JOINT_BOOKRUNNER","CO_MANAGER","ARRANGER","UNDERWRITER","PLACEMENT_AGENT","STABILISATION_MANAGER","BILLING_AND_DELIVERY_AGENT","FISCAL_AGENT","PRINCIPAL_PAYING_AGENT","PAYING_AGENT","CALCULATION_AGENT","TRUSTEE","REGISTRAR","TRANSFER_AGENT","CUSTODIAN","CSD_ICSD","LISTING_AGENT","LODGING_AGENT","ISSUE_AGENT","SETTLEMENT_AGENT","DETERMINATION_AGENT","EXCHANGE_AGENT","INFORMATION_AGENT","LEGAL_ADVISOR","LEGAL_COUNSEL","AUDITOR","PLATFORM_OPERATOR"],
  PartyType:["CORPORATION","SUPRANATIONAL","SOVEREIGN","MUNICIPAL","PROVINCE","STATE","COUNTY","PARTNERSHIP","FINANCIALINSTITUTION","NATIONAL"],
  RatingAgency:["FITCH","MOODYS","SNPG","DBRS","SCOPE"],
  RatingOutlook:["POSITIVE","STABLE","NEGATIVE","DEVELOPING","NOT_MEANINGFULL","EVOLVING","NOT_APPLICABLE"],
  IssuanceType:["STANDALONE","PROGRAMME","PROGRAMME_NOTE","GLOBAL_NOTE","SERIES","TRANCHE","CLASS","TAP"],
  AmountType:["NOMINAL","MONEY","UNIT","PERCENT"],
  PriceType:["PERCENT","ABSOLUTE","SPREAD","BASIS_POINT"],
  FeeAllocationType:["EQUAL","PROPORTIONAL"],
  DeliveryType:["DVP","FREE_OF_PAYMENT"],
  TermPeriod:["DAY","WEEK","MONTH","QUARTER","SEMI_ANNUAL","YEAR"],
  BenchmarkCode:["ESTR","EURI","SOFR","SONA","TREA","SWAP","ECBR","CORA","TIBO","BBSW","CDOR","NIBO","STBO","CIBO","HKIO","JIBA","WIBO","OTHR"],
  UseOfProceedsPrimary:["CORPORATE_PURPOSES","SOVEREIGN_FINANCING","MERGERS_ACQUISITION_FINANCING","MERGERS_ACQUISITION_SEED_FINANCING","INVESTMENT","LBO_FINANCING","DEBT_REFINANCING","REGULATORY","GENERAL_ASSET_FINANCING","SUSTAINABLE_FINANCING"],
  UseOfProceedsSub:["GENERAL_PURPOSES","STRAIGHT_BOND","TIER1_CAPITAL","TIER2_CAPITAL","TIER3_CAPITAL","BAIL_IN","COVERED_BOND","ICMA_GREEN_BOND_PRINCIPLES","ICMA_SOCIAL_BOND_PRINCIPLES","ICMA_SUSTAINABILITY_BOND_GUIDELINES","ICMA_SUSTAINABILITY_LINKED_BOND_PRINCIPLES","OTHER"],
  ListingMarket:["LONDON_STOCK_EXCHANGE","LUXEMBOURG_STOCK_EXCHANGE","EURONEXT_DUBLIN","EURONEXT_AMSTERDAM","EURONEXT_PARIS","EURONEXT_BRUSSELS","FRANKFURT_STOCK_EXCHANGE","BORSA_ITALIANA","SIX_SWISS_EXCHANGE","VIENNA_STOCK_EXCHANGE","SINGAPORE_SGX","HONGKONG_STOCK_EXCHANGE","NASDAQ_DUBAI","INTERNATIONAL_STOCK_EXCHANGE","NOT_LISTED"],
  ListingMarketType:["RMKT","RMQI","MSGM","MLTF"],
  ClearingSystem:["EUROCLEAR_BANK_SA/NV","CLEARSTREAM_BANKING_S.A.","CLEARSTREAM_BANKING_FRANKFURT","CLEARSTREAM_EUROPE_AG(CEU)","THE_DEPOSITORY_TRUST_COMPANY","CENTRAL_MONEYMARKETS_UNIT","EURONEXT_SECURITIES_MILANO","T2"],
  PlaceOfDeposit:["EUROCLEAR_BANK_SA/NV","CLEARSTREAM_BANKING_S.A.","CLEARSTREAM_BANKING_FRANKFURT","THE_DEPOSITORY_TRUST_COMPANY","CENTRAL_MONEYMARKETS_UNIT"],
  DistributionMethod:["SYNDICATED","NON-SYNDICATED"],
  TaxCode:["GROSS_UP","EXEMPT","WITHHOLDING","WITHHOLDING_PROCESSED_BY_ICSD","ITALIAN_239T","ITALIAN_239A","US_SOURCE_US_WITHHOLDING","US_TAX_SECTION_871M","US_TAX_OTHER_INCOME"],
  TefraCode:["TEFRA_C","TEFRA_D","TEFRA_NA","TEFRA_NoCode"],
  RegSCode:["REGS_CAT1","REGS_CAT2","REGS_CAT3","REGS_NA","REGS_NoCode"],
  PRIIPs:["NO_EEA","NO_UK","EEA","UK","NOT_APPLICABLE"],
  CCI:["APPLICABLE","NOT_APPLICABLE"],
  TargetMarket:["EU_MIFIDII_PROF_AND_ECPS","UK_MIFIDII_PROF_AND_ECPS","EU_MIFIR_PROF_AND_ECPS","UK_MIFIR_PROF_AND_ECPS","EU_MIFIDII_RETAIL_PROF_ECPS","UK_MIFIDII_RETAIL_PROF_ECPS","NOT_APPLICABLE"],
  Applicability:["APPLICABLE","NOT_APPLICABLE"],
  RedemptionType:["MATURITY","ISSUER_CALL","INVESTOR_PUT","SINKING_FUND","CHANGE_OF_CONTROL_PUT_EVENT","REGULATORY_REASONS","EXTRAORDINARY","CONVERTIBLE"],
  PhysicalForm:["GLOBAL_NOTE_CERTIFICATE","CERTIFICATED","DEMATERIALISED","UNCERTIFICATED"],
  LegalTitleForm:["BEARER","REGISTERED","DEMATERIALISED","BOOK_ENTRY","COLLECTIVE_DEBT_REGISTERED_CLAIM"],
  GlobalNoteType:["PERMANENT","TEMPORARY","REGISTERED"],
  SafeKeeping:["NEW_GLOBAL_NOTE","CLASSIC_GLOBAL_NOTE","NEW_SAFEKEEPING_STRUCTURE_PHYSICAL","NEW_SAFEKEEPING_STRUCTURE_ELECTRONIC","RESTRICTED","UNRESTRICTED"],
  GuaranteeType:["NO_GUARANTEE","GOVERNMENT","STATE","JOINT"],
  Seniority:["SENIOR","SUPER_SENIOR","MEZZANINE","JUNIOR"],
  Subordinated:["UNSUBORDINATED","SUBORDINATED"],
  Secured:["UNSECURED","SECURED"],
  Preferred:["PREFERRED","NON_PREFERRED"],
  AdditionalStatus:["TIER1CAPITAL","TIER2CAPITAL","TIER3CAPITAL","BAIL-IN","COVERED","STRUCTURED_COVERED"],
  MaturityType:["FIXED","PERPETUAL","EXTENDIBLE"],
  InterestType:["FIXED","FLOATING","ZERO_COUPON","RESET","INDEX_LINKED_INTEREST","VARIABLE","PAYMENT_IN_KIND"],
  Frequency:["ANNUALLY","SEMIANNUALLY","QUARTERLY","MONTHLY","BIANNUALLY","BIMONTHLY","ATMATURITY","NONE"],
  DayCount:["ICMA_ACT/ACT","ISDA_ACT/ACT","ACT/ACT","ACT/360","ACT/365","ACT/365F","30/360","30E/360","30U/360","ISMA_30/360","ISDA_30E/360","30E+/360","30/360M","30/365","ACT/365L","NL/365","BUS/252"],
  BusinessDayAdj:["FOLLOWING","MODIFIED_FOLLOWING","PRECEDING"],
  InterestCalcAdj:["UNADJUSTED","ADJUSTED"],
  BrokenDate:["SHORT","LONG"],
  Optionality:["NOT_APPLICABLE","CALL","PUT","CHANGE_OF_CONTROL_PUT_EVENT"],
  ESGLabel:["GREEN","SOCIAL","SUSTAINABILITY","SUSTAINABILITY_LINKED","CLIMATE_TRANSITION"],
  IdType:["ISIN","COMMON_CODE","TEMPORARY_ISIN","TEMPORARY_COMMON_CODE","CUSIP","FIGI","SEDOL","WKN","VALOR","DTI","CMU","SeriesIdentifier","TrancheIdentifier","OtherIdentifier"]
};

export const SECTIONS = [
  {id:"doc",     t:"Document control",              n:"Identity, version and status of this record. The deal reference and version are what let every downstream consumer tell which message supersedes which."},
  {id:"parties", t:"Parties",                       n:"One entry per party, each with its own roles. A party may hold several roles, which is how a bookrunner that is also stabilisation manager is expressed."},
  {id:"deal",    t:"Deal and format",               n:"Whether this is a standalone issue or a drawdown under a programme, and the documentation route it follows."},
  {id:"size",    t:"Size, currency and denominations", n:"Indicative maximum size can be carried from announcement; final size is required once the deal is priced."},
  {id:"time",    t:"Timetable",                     n:"Execution and settlement dates. Ordering is checked: pricing on or before issue, issue on or before settlement, maturity after settlement."},
  {id:"price",   t:"Pricing",                       n:"Reoffer levels, benchmark and mid-swap reference. Fields here become mandatory at spread set and pricing."},
  {id:"exec",    t:"Execution messaging",           n:"Fields the market uses during execution that BDT 2.0 does not model. These travel in the VDR envelope alongside the BDT payload, never inside it."},
  {id:"prod",    t:"Security identification",       n:"Names and codes. Temporary codes can be used before the ISIN is confirmed, then replaced without breaking the deal reference."},
  {id:"form",    t:"Form, safekeeping and eligibility", n:"Form of note drives TEFRA treatment, ICSD safekeeping structure and central bank eligibility."},
  {id:"status",  t:"Status and ranking",            n:"Seniority, subordination, security and any regulatory capital label."},
  {id:"interest",t:"Interest and maturity",         n:"Fixed rate single tranche. Floating, reset and zero coupon exist in BDT and are switched on in later iterations of this template."},
  {id:"red",     t:"Redemption",                    n:"Vanilla redemption at par on the maturity date. Call and put structures are the subject of the next iteration."},
  {id:"listing", t:"Listing, clearing and settlement", n:"Where the notes are admitted to trading and how they clear and settle."},
  {id:"legal",   t:"Governing law, tax and covenants", n:"Law, withholding treatment and the standard covenant set."},
  {id:"restrict",t:"Selling restrictions and target market", n:"Legends and product governance. The UK POATRs regime took effect on 19 January 2026 and the UK CCI regime replaced UK PRIIPs on 6 April 2026, so UK wording differs from pre-2026 precedents."},
  {id:"docs",    t:"Documentation",                 n:"Every document the deal relies on, including each supplement on file. Attach or link the offering memorandum, base prospectus, supplements and the signed final terms."},
  {id:"esg",     t:"Labels and digital issuance",   n:"ESG label, Shariah compliance and DLT flags."}
];

/* f: path | label | type | options */
export function f(sec,p,l,t,o){return Object.assign({sec:sec,p:p,l:l,t:t,from:1,req:0},o||{});}

export const FIELDS = [
  /* ---- DocumentInformation ---- */
  f("doc","DocumentInformation/BDTVersion","BDT version","text",{req:1,fixed:1}),
  f("doc","DocumentInformation/DocumentId","Document id","text",{req:1,auto:1,hint:"Immutable id for this message. Auto-generated."}),
  f("doc","DocumentInformation/DigitalDocumentIdentifier","Digital document identifier","text",{hint:"Hash or DLT reference once the record is anchored."}),
  f("doc","DocumentInformation/DocumentVersion","Version","text",{req:1,auto:1,hint:"Increments on each release."}),
  f("doc","DocumentInformation/DocumentDescription","Description","text",{req:1,auto:1,plain:1}),
  f("doc","DocumentInformation/DocumentDate","Document date","date",{req:1}),
  f("doc","DocumentInformation/DocumentStatus","Status","sel",{e:"DocumentStatus",req:1,hint:"BDT offers three values only. The execution stage is carried in the envelope."}),
  f("doc","@contacts","Contacts","group",{g:"contacts",req:1}),
  f("doc","DocumentInformation/Disclaimer","Disclaimer","ta",{req:1}),
  f("doc","IssuanceDataGroup/IssuanceDescription","Issuance description","text",{plain:1}),

  /* ---- Parties ---- */
  f("parties","@parties","Parties","group",{g:"parties",req:1}),

  /* ---- Issuance: deal and format ---- */
  f("deal","IssuanceDataGroup/Issuance/IssuanceType","Issuance type","sel",{e:"IssuanceType",req:1}),
  f("deal","IssuanceDataGroup/Issuance/IssuanceDescription","Issue description","text",{plain:1,req:4,hint:"The one-line description used on the final terms cover."}),
  f("deal","IssuanceDataGroup/Issuance/DealIdentifier","Deal identifier","text",{req:1,hint:"The key that binds every message on this deal together. Set once, never changed."}),
  f("deal","IssuanceDataGroup/Issuance/Programme/ProgrammeIdentifier","Programme identifier","text"),
  f("deal","IssuanceDataGroup/Issuance/Programme/ProgrammeDescription","Programme description","text",{plain:1}),
  f("deal","IssuanceDataGroup/Issuance/ReOpen","Reopening of an existing series","bool"),
  f("deal","IssuanceDataGroup/Issuance/PrivatePlacement/PrivatePlacement","Private placement","bool"),
  f("deal","IssuanceDataGroup/Issuance/PrivatePlacement/Jurisdiction","Private placement jurisdiction","text",{ph:"GB"}),

  /* ---- Size ---- */
  f("size","IssuanceDataGroup/Issuance/SpecifiedDenomination/Value","Specified denomination","num",{req:1}),
  f("size","IssuanceDataGroup/Issuance/SpecifiedDenomination/AmountType","Denomination amount type","sel",{e:"AmountType",req:1}),
  f("size","IssuanceDataGroup/Issuance/MinimumDenomination/Value","Minimum denomination","num"),
  f("size","IssuanceDataGroup/Issuance/MinimumDenomination/AmountType","Minimum denomination type","sel",{e:"AmountType"}),
  f("size","IssuanceDataGroup/Issuance/IntegralMultiples/Value","Integral multiples","num"),
  f("size","IssuanceDataGroup/Issuance/IntegralMultiples/AmountType","Integral multiples type","sel",{e:"AmountType"}),
  f("size","IssuanceDataGroup/Issuance/CalculationAmount/Value","Calculation amount","num"),
  f("size","IssuanceDataGroup/Issuance/CalculationAmount/AmountType","Calculation amount type","sel",{e:"AmountType"}),
  f("size","IssuanceDataGroup/Issuance/TotalAggregateAmount/Value","Total aggregate amount","num",{req:5,hint:"Final size. Leave empty while the deal is still \u201cbenchmark\u201d."}),
  f("size","IssuanceDataGroup/Issuance/TotalAggregateAmount/AmountType","Total aggregate amount type","sel",{e:"AmountType",req:5}),
  f("size","IssuanceDataGroup/Issuance/MaximumAmount/Value","Maximum size","num",{from:2,hint:"Indicative cap communicated at IPT, e.g. 500m max."}),
  f("size","IssuanceDataGroup/Issuance/MaximumAmount/AmountType","Maximum size type","sel",{e:"AmountType",from:2}),
  f("size","IssuanceDataGroup/Issuance/SpecifiedCurrency","Specified currency","text",{req:1,ph:"EUR",cur:1}),
  f("size","IssuanceDataGroup/Issuance/PaymentCurrency","Payment currency","text",{cur:1}),
  f("size","IssuanceDataGroup/Issuance/SettlementCurrency","Settlement currency","text",{cur:1}),

  /* ---- Timetable ---- */
  f("time","IssuanceDataGroup/Issuance/PricingDate","Pricing date","date",{req:5}),
  f("time","IssuanceDataGroup/Issuance/IssueDate","Issue date","date",{req:4}),
  f("time","IssuanceDataGroup/Issuance/SettlementDate","Settlement date","date",{req:5}),
  f("time","IssuanceDataGroup/Issuance/ClosingDate","Closing date","date"),
  f("time","IssuanceDataGroup/Issuance/Delivery","Delivery","sel",{e:"DeliveryType",req:5}),

  /* ---- Pricing ---- */
  f("price","IssuanceDataGroup/Issuance/IssuePrice/Value","Issue price","num",{req:5,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/IssuePrice/PriceType","Issue price type","sel",{e:"PriceType",req:5}),
  f("price","IssuanceDataGroup/Issuance/IndicationOfYield/Value","Indication of yield","num",{req:5,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/ReofferPrice/Value","Reoffer price","num",{from:4,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/ReofferYield/Value","Reoffer yield","num",{from:4,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/Benchmark/Ticker/Ticker","Benchmark security","text",{from:2,ph:"DBR 0 08/15/31"}),
  f("price","IssuanceDataGroup/Issuance/Benchmark/Ticker/Source","Benchmark source","text",{from:2,ph:"BLOOMBERG"}),
  f("price","IssuanceDataGroup/Issuance/Benchmark/Maturity/MaturityDate","Benchmark maturity","date",{from:2}),
  f("price","IssuanceDataGroup/Issuance/Benchmark/InterestRate","Benchmark coupon","num",{from:2,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/Benchmark/Price/Price/Value","Benchmark price","num",{from:4,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/Benchmark/Price/Yield/Value","Benchmark yield","num",{from:4,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/ReofferSpreadToBenchmark/Value","Spread to benchmark","num",{from:4,step:"0.1"}),
  f("price","IssuanceDataGroup/Issuance/ReofferSpreadToBenchmark/PriceType","Spread to benchmark type","sel",{e:"PriceType",from:4}),
  f("price","IssuanceDataGroup/Issuance/MidSwapRate/Rate/Value","Mid-swap rate","num",{from:4,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/MidSwapRate/Term/TermUnit","Mid-swap term","num",{from:4}),
  f("price","IssuanceDataGroup/Issuance/MidSwapRate/Term/TermPeriod","Mid-swap term period","sel",{e:"TermPeriod",from:4}),
  f("price","IssuanceDataGroup/Issuance/MidSwapRate/SwapDescription","Mid-swap description","text",{from:4,plain:1}),
  f("price","IssuanceDataGroup/Issuance/ReofferSpreadtoMidSwapRate/Value","Spread to mid-swaps","num",{from:3,step:"0.1"}),
  f("price","IssuanceDataGroup/Issuance/ReofferSpreadtoMidSwapRate/PriceType","Spread to mid-swaps type","sel",{e:"PriceType",from:3}),
  f("price","IssuanceDataGroup/Issuance/Fee/Percentage","Combined management and underwriting fee","num",{req:5,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/Fee/FeeAllocationType","Fee allocation","sel",{e:"FeeAllocationType",req:5}),
  f("price","IssuanceDataGroup/Issuance/Proceeds/Gross/Value","Gross proceeds","num",{from:5}),
  f("price","IssuanceDataGroup/Issuance/Proceeds/Gross/AmountType","Gross proceeds type","sel",{e:"AmountType",from:5}),
  f("price","IssuanceDataGroup/Issuance/Proceeds/Net/Value","Net proceeds","num",{from:5}),
  f("price","IssuanceDataGroup/Issuance/Proceeds/Net/AmountType","Net proceeds type","sel",{e:"AmountType",from:5}),
  f("price","IssuanceDataGroup/Issuance/Proceeds/ProceedsCurrency","Proceeds currency","text",{from:5,cur:1}),
  f("price","IssuanceDataGroup/Issuance/Proceeds/UseOfProceeds/UseOfProceedsPrimaryCategory","Use of proceeds","sel",{e:"UseOfProceedsPrimary",req:1}),
  f("price","IssuanceDataGroup/Issuance/Proceeds/UseOfProceeds/UseOfProceedsSubCategory","Use of proceeds sub-category","sel",{e:"UseOfProceedsSub"}),
  f("price","IssuanceDataGroup/Issuance/Proceeds/UseOfProceeds/UseOfProceedsDescription","Use of proceeds description","ta"),

  /* ---- Listing, clearing ---- */
  f("listing","IssuanceDataGroup/Issuance/Listing/Listed","Listed","bool",{req:1}),
  f("listing","IssuanceDataGroup/Issuance/Listing/ListingVenue/MIC","Listing venue MIC","text",{ph:"XLON"}),
  f("listing","IssuanceDataGroup/Issuance/Listing/ListingVenue/Market","Listing venue","sel",{e:"ListingMarket",req:4}),
  f("listing","IssuanceDataGroup/Issuance/Listing/ListingVenue/MarketType","Market type","sel",{e:"ListingMarketType",req:4}),
  f("listing","IssuanceDataGroup/Issuance/SecuritiesClearingSystem/Code","Clearing system","sel",{e:"ClearingSystem",req:1}),
  f("listing","IssuanceDataGroup/Issuance/SecuritiesSettlementSystem/Code","Settlement system","sel",{e:"ClearingSystem"}),
  f("listing","IssuanceDataGroup/Issuance/PlaceOfDeposit","Place of deposit","sel",{e:"PlaceOfDeposit",req:4}),
  f("listing","IssuanceDataGroup/Issuance/MethodOfDistribution/DistributionMethod","Method of distribution","sel",{e:"DistributionMethod",req:1}),

  /* ---- Law, tax, covenants ---- */
  f("legal","IssuanceDataGroup/Issuance/GoverningLaw/CountryCode","Governing law","text",{req:1,ph:"GB",hint:"ISO country code, e.g. GB for English law."}),
  f("legal","IssuanceDataGroup/Issuance/Expenses/Value","Estimated expenses","num"),
  f("legal","IssuanceDataGroup/Issuance/Expenses/AmountType","Expenses type","sel",{e:"AmountType"}),
  f("legal","IssuanceDataGroup/Issuance/Tax/TaxCode","Withholding treatment","sel",{e:"TaxCode",req:4}),
  f("legal","IssuanceDataGroup/Issuance/Tax/WithHoldingTaxCountry","Withholding tax country","text",{ph:"NL"}),
  f("legal","IssuanceDataGroup/Issuance/NegativePledge","Negative pledge","sel",{e:"Applicability",req:4}),
  f("legal","IssuanceDataGroup/Issuance/GrossUp","Gross-up","sel",{e:"Applicability",req:4}),
  f("legal","IssuanceDataGroup/Issuance/CrossDefault","Cross default","sel",{e:"Applicability",req:4}),
  f("legal","IssuanceDataGroup/Issuance/SubstitutionOrVariation","Substitution or variation","sel",{e:"Applicability"}),

  /* ---- Documentation ---- */
  f("docs","@docs","Deal documents","group",{g:"docs",req:1}),

  /* ---- Selling restrictions ---- */
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraCode","TEFRA","sel",{e:"TefraCode",req:1}),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraExchangeDate","TEFRA D exchange date","date"),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode","Regulation S category","sel",{e:"RegSCode",req:1}),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/RULE144A","Rule 144A tranche","bool"),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/SEC_Registered","SEC registered","bool"),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction","PRIIPs restriction","sel",{e:"PRIIPs",req:1}),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/CCIRestriction","UK CCI restriction","sel",{e:"CCI",req:1,hint:"The UK Consumer Composite Investments regime replaced UK PRIIPs on 6 April 2026."}),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/CountryRestrictions","Country restrictions","text",{ph:"US, CA, AU",hint:"Comma separated ISO country codes."}),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/AdditionalSellingRestrictions","Additional selling restrictions","ta"),
  f("restrict","IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType","Manufacturer target market","sel",{e:"TargetMarket",req:1}),

  /* ---- Redemption ---- */
  f("red","IssuanceDataGroup/Issuance/Redemption/RedemptionType","Redemption type","sel",{e:"RedemptionType",req:1}),
  f("red","IssuanceDataGroup/Issuance/Redemption/FinalRedemptionPercentage","Final redemption percentage","num",{req:1,step:"0.001"}),
  f("red","IssuanceDataGroup/Issuance/Redemption/FinalRedemptionDate","Final redemption date","date",{req:4}),
  f("red","IssuanceDataGroup/Issuance/AdditionalIssuanceInformation","Additional issuance information","ta",{auto:1,hint:"Execution fields with no BDT home are mirrored here as text so the payload stays self-describing."}),

  /* ---- Product: identification ---- */
  f("prod","IssuanceDataGroup/Product/SecurityShortName","Security short name","text",{plain:1,req:4}),
  f("prod","IssuanceDataGroup/Product/SecurityLongName","Security long name","text",{plain:1,req:4}),
  f("prod","@ids","Security identifiers","group",{g:"ids",req:4}),

  /* ---- Product: form ---- */
  f("form","IssuanceDataGroup/Product/InitialFormOfNote/PhysicalFormOfNote","Initial physical form","sel",{e:"PhysicalForm",req:1}),
  f("form","IssuanceDataGroup/Product/InitialFormOfNote/LegalTitleFormOfNote","Initial legal title form","sel",{e:"LegalTitleForm",req:1}),
  f("form","IssuanceDataGroup/Product/InitialFormOfNote/GlobalNote/GlobalNoteType","Initial global note","sel",{e:"GlobalNoteType"}),
  f("form","IssuanceDataGroup/Product/InitialFormOfNote/GlobalNote/ExchangeableNoticeDays","Exchange notice days","num"),
  f("form","IssuanceDataGroup/Product/InitialFormOfNote/ExchangeableForDefinitiveNote","Exchangeable for definitive notes","bool"),
  f("form","IssuanceDataGroup/Product/FinalFormOfNote/PhysicalFormOfNote","Final physical form","sel",{e:"PhysicalForm"}),
  f("form","IssuanceDataGroup/Product/FinalFormOfNote/LegalTitleFormOfNote","Final legal title form","sel",{e:"LegalTitleForm"}),
  f("form","IssuanceDataGroup/Product/FinalFormOfNote/GlobalNote/GlobalNoteType","Final global note","sel",{e:"GlobalNoteType"}),
  f("form","IssuanceDataGroup/Product/SafeKeepingStructure","Safekeeping structure","sel",{e:"SafeKeeping",req:4}),
  f("form","IssuanceDataGroup/Product/CentralBankEligibility/Eligible","Intended to be held in a manner allowing Eurosystem eligibility","bool",{req:4}),
  f("form","IssuanceDataGroup/Product/CentralBankEligibility/CentralBankCountryCode","Central bank country","text",{ph:"EU"}),
  f("form","IssuanceDataGroup/Product/GuaranteeType","Guarantee type","sel",{e:"GuaranteeType"}),

  /* ---- Product: status ---- */
  f("status","IssuanceDataGroup/Product/StatusOfNote/Seniority","Seniority","sel",{e:"Seniority",req:1}),
  f("status","IssuanceDataGroup/Product/StatusOfNote/Subordinated","Subordination","sel",{e:"Subordinated",req:1}),
  f("status","IssuanceDataGroup/Product/StatusOfNote/Secured","Security","sel",{e:"Secured",req:1}),
  f("status","IssuanceDataGroup/Product/StatusOfNote/Preferred","Preference","sel",{e:"Preferred"}),
  f("status","IssuanceDataGroup/Product/StatusOfNote/AdditionalStatusOfNote","Regulatory capital label","sel",{e:"AdditionalStatus"}),
  f("status","@ratings","Expected issue ratings","group",{g:"ratings",req:1}),

  /* ---- Interest ---- */
  f("interest","IssuanceDataGroup/Product/AggregateNominalAmount/Value","Aggregate nominal amount","num",{req:5}),
  f("interest","IssuanceDataGroup/Product/AggregateNominalAmount/AmountType","Aggregate nominal amount type","sel",{e:"AmountType",req:5}),
  f("interest","IssuanceDataGroup/Product/AggregateNominalAmount/Currency","Aggregate nominal currency","text",{req:5,cur:1}),
  f("interest","IssuanceDataGroup/Product/Maturity/MaturityType","Maturity type","sel",{e:"MaturityType",req:1}),
  f("interest","IssuanceDataGroup/Product/Maturity/MaturityDate","Maturity date","date",{req:1}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/InterestType","Interest type","sel",{e:"InterestType",req:1,hint:"This iteration covers FIXED. Other values are reserved for later iterations."}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate","Coupon","num",{req:5,step:"0.001"}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/InterestPaymentFrequency","Coupon frequency","sel",{e:"Frequency",req:1}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/PayableDate/Day","Coupon payable day","num",{req:4}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/PayableDate/Month","Coupon payable month","num",{req:4}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/FirstPayment/PaymentDate","First coupon date","date",{req:4}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/FirstPayment/BrokenDateProvision/BrokenDateType","First coupon broken date","sel",{e:"BrokenDate"}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/FirstPayment/Amount/Value","First coupon amount","num",{from:5}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/FirstPayment/Amount/AmountType","First coupon amount type","sel",{e:"AmountType",from:5}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestCommencementDate","Interest commencement date","date",{req:4}),
  f("interest","IssuanceDataGroup/Product/DayCountFraction","Day count fraction","sel",{e:"DayCount",req:1}),
  f("interest","IssuanceDataGroup/Product/BusinessDayConvention/BusinessDayAdjustment","Business day convention","sel",{e:"BusinessDayAdj",req:1}),
  f("interest","IssuanceDataGroup/Product/BusinessDayConvention/InterestCalculationAdjustment","Interest calculation","sel",{e:"InterestCalcAdj",req:1}),
  f("interest","IssuanceDataGroup/Product/BusinessDayCenter/CityCalendar","Business day centres","text",{ph:"LON, TARGET",hint:"Comma separated."}),
  f("interest","IssuanceDataGroup/Product/Optionality","Optionality","sel",{e:"Optionality",req:1}),

  /* ---- Labels ---- */
  f("esg","IssuanceDataGroup/Product/DLTBondIndicator","DLT-issued bond","bool"),
  f("esg","IssuanceDataGroup/Product/ESGLabel","ESG label","sel",{e:"ESGLabel"}),
  f("esg","IssuanceDataGroup/Product/SukukShariahCompliantIndicator","Shariah compliant","bool"),

  /* ---- Execution messaging: VDR envelope only ---- */
  f("exec","x:iptSpread","Initial price thoughts","text",{ext:1,from:2,req:2,ph:"MS + 110 area",plain:1}),
  f("exec","x:guidance","Guidance","text",{ext:1,from:3,req:3,ph:"MS + 85 area (+/- 3)",plain:1}),
  f("exec","x:spreadSet","Spread set","text",{ext:1,from:4,req:4,ph:"MS + 82",plain:1}),
  f("exec","x:sizeMsg","Size message","text",{ext:1,from:2,ph:"EUR benchmark, 500m max",plain:1}),
  f("exec","x:bookSize","Order book excluding joint lead manager interest","text",{ext:1,from:3,ph:"EUR 2.3bn, 118 accounts",plain:1}),
  f("exec","x:nic","New issue concession","text",{ext:1,from:4,ph:"3bp",plain:1}),
  f("exec","x:booksOpen","Books open","text",{ext:1,from:2,ph:"08:45 London",plain:1}),
  f("exec","x:booksSubject","Books subject","text",{ext:1,from:4,ph:"11:20 London",plain:1}),
  f("exec","x:stabilisation","Stabilisation","sel",{ext:1,e:"Applicability",from:2,req:2}),
  f("exec","x:stabPeriod","Stabilisation period","text",{ext:1,from:4,ph:"From pricing to 30 days after the issue date",plain:1}),
  f("exec","x:overAllot","Over-allotment","text",{ext:1,from:4,ph:"Up to 5 per cent of the issue size",plain:1}),
  f("exec","x:pot","Order book basis","text",{ext:1,from:2,ph:"Pot, full disclosure",plain:1}),
  f("exec","x:retention","Retention","text",{ext:1,from:4,ph:"None",plain:1}),
  f("exec","x:syndDesk","Syndicate contact","text",{ext:1,req:1,ph:"Name, desk, telephone",plain:1}),
  f("exec","x:pricingCall","Pricing call","text",{ext:1,from:4,plain:1}),
  f("exec","x:notes","Execution notes","ta",{ext:1})
];

export const GROUPS = {
  contacts:{t:"Contact",  fields:[["Name","Name","text"],["Email","Email","text"]], init:()=>({Name:"",Email:""})},
  parties:{t:"Party", fields:[
      ["PartyName","Legal name","text"],["LEIIdentifier","LEI","text"],["BICIdentifier","BIC","text"],
      ["CountryOfIncorporation","Country of incorporation","text"],["PartyType","Party type","sel","PartyType"],
      ["Roles","Roles","roles"],["Ratings","Ratings","ratings"]],
      init:()=>({PartyName:"",LEIIdentifier:"",BICIdentifier:"",CountryOfIncorporation:"",PartyType:"",Roles:["JOINT_LEAD_MANAGER"],Ratings:[]})},
  ids:{t:"Identifier", fields:[["Type","Type","sel","IdType"],["Value","Value","text"]], init:()=>({Type:"ISIN",Value:""})},
  ratings:{t:"Rating", fields:[["RatingAgency","Agency","sel","RatingAgency"],["RatingValue","Rating","text"],["RatingOutlook","Outlook","sel","RatingOutlook"]], init:()=>({RatingAgency:"",RatingValue:"",RatingOutlook:""})},
  docs:{t:"Document", fields:[["DocumentName","Name","text"],["DocumentDate","Date","date"],["DocumentLink","Link","text"],["DocumentVersion","Version","text"]], init:()=>({DocumentName:"",DocumentDate:"",DocumentLink:"",DocumentVersion:""})}
};

/* ---- fields added in refinement pass 2 ---- */
const FIELDS2 = [
  f("size","IssuanceDataGroup/Issuance/MaximumDenomination/Value","Maximum denomination","num"),
  f("size","IssuanceDataGroup/Issuance/MaximumDenomination/AmountType","Maximum denomination type","sel",{e:"AmountType"}),
  f("size","IssuanceDataGroup/Issuance/InitialAggregateAmount/Value","Initial aggregate amount","num",{hint:"Where the series is expected to be tapped later."}),
  f("size","IssuanceDataGroup/Issuance/InitialAggregateAmount/AmountType","Initial aggregate amount type","sel",{e:"AmountType"}),
  f("size","IssuanceDataGroup/Issuance/TotalOutstandingAmount/Value","Total outstanding amount","num"),
  f("size","IssuanceDataGroup/Issuance/TotalOutstandingAmount/AmountType","Total outstanding amount type","sel",{e:"AmountType"}),
  f("size","IssuanceDataGroup/Issuance/MaximumProgrammeAmount/Value","Maximum programme amount","num"),
  f("size","IssuanceDataGroup/Issuance/MaximumProgrammeAmount/AmountType","Maximum programme amount type","sel",{e:"AmountType"}),
  f("time","IssuanceDataGroup/Issuance/CutOffDate","Cut-off date","date"),
  f("time","x:settlementBasis","Settlement basis","text",{ext:1,from:4,ph:"T+5, delivery versus payment",plain:1}),
  f("time","x:preStabNotice","Pre-stabilisation notice","text",{ext:1,from:2,ph:"Published 2026-10-05",plain:1,hint:"Required before stabilisation begins."}),
  f("price","IssuanceDataGroup/Issuance/AllIn/Price/Value","All-in price","num",{from:5,step:"0.001"}),
  f("price","IssuanceDataGroup/Issuance/AllIn/Yield/Value","All-in yield","num",{from:5,step:"0.001"}),
  f("price","x:mgmtFee","Management and underwriting commission","text",{ext:1,from:4,ph:"0.075 per cent.",plain:1}),
  f("price","x:concession","Selling concession","text",{ext:1,from:4,ph:"0.125 per cent.",plain:1}),
  f("price","x:costsCharges","Costs and charges disclosure","ta",{ext:1,from:4,hint:"MiFID II costs and charges statement given to distributors."}),
  f("legal","x:jurisdiction","Jurisdiction of courts","text",{ext:1,plain:1,ph:"Courts of England and Wales",req:4,hint:"BDT models governing law as a choice: an ISO country code, a subdivision code, or free text, never more than one. Since the country code carries the governing law, the courts clause travels in the envelope."}),
  f("legal","IssuanceDataGroup/Issuance/Tax/TaxDescription","Withholding description","ta"),
  f("legal","IssuanceDataGroup/Issuance/RecordDate/ReferenceDateDescription","Record date reference","text",{plain:1,ph:"Business days before the relevant payment date"}),
  f("legal","IssuanceDataGroup/Issuance/RecordDate/NumberOfDays","Record date days","num"),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/Rule3C7","Section 3(c)(7) restriction","bool"),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/Accredited_Investor","Accredited investors only","bool"),
  f("restrict","IssuanceDataGroup/Issuance/SellingRestrictions/RiskLinkedSecurity","Risk linked security","bool"),
  f("restrict","x:prospectusRegime","Offer documentation regime","text",{ext:1,req:4,ph:"Exempt offer under the UK POATRs and the EU Prospectus Regulation",plain:1,hint:"The UK POATRs regime took effect on 19 January 2026."}),
  f("prod","IssuanceDataGroup/Product/ProgrammeReference/ProgrammeIdentifier","Programme reference","text"),
  f("form","IssuanceDataGroup/Product/InitialFormOfNote/GlobalNote/GlobalNoteIdentifier","Initial global note identifier","text"),
  f("form","IssuanceDataGroup/Product/AfterExchangeFormOfNote/PhysicalFormOfNote","Form after exchange","sel",{e:"PhysicalForm",hint:"Where a temporary global note is exchanged after the distribution compliance period."}),
  f("form","IssuanceDataGroup/Product/AfterExchangeFormOfNote/LegalTitleFormOfNote","Legal title after exchange","sel",{e:"LegalTitleForm"}),
  f("form","IssuanceDataGroup/Product/AfterExchangeFormOfNote/GlobalNote/GlobalNoteType","Global note after exchange","sel",{e:"GlobalNoteType"}),
  f("form","IssuanceDataGroup/Product/CentralBankEligibility/Description","Eligibility description","ta"),
  f("interest","IssuanceDataGroup/Product/InterestPayment/IsdaDetermination","ISDA definitions","sel",{e:["2006","2021"]}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestPayments/LastPayment/PaymentDate","Final coupon date","date",{req:4}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/RatingStepUpStepDown","Rating step-up or step-down","sel",{e:"Applicability"}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/StepUpStepDownMargin","Step-up margin","num",{step:"0.001"}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/MinimumRate","Minimum rate of interest","num",{step:"0.001"}),
  f("interest","IssuanceDataGroup/Product/InterestPayment/MaximumRate","Maximum rate of interest","num",{step:"0.001"}),
  f("exec","x:ratingsDisclaimer","Ratings disclosure","ta",{ext:1,hint:"Credit rating agency status under the EU and UK CRA Regulations."})
];
FIELDS.push.apply(FIELDS, FIELDS2);
