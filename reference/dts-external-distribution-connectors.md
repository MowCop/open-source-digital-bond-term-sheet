# DTS External Distribution and Connectors Reference

**Project:** Digital Term Sheet (DTS) / Digital Deal Room, Lovable project "Digital Bond Term Sheet"
**Compiled:** 9 November 2026. All vendor facts were checked against public sources on that date (see Sources). Items marked **Unverified** could not be confirmed publicly.
**Scope:** The 30 connectors in `src/lib/vendors.ts` (Bond Console → External API/MCP Connectors), plus DirectBooks and Origin Markets schema notes.

---

## 1. What the DTS does and where it sits

**Workflow.** A deal starts with **New Deal**, in one of two ways:
- Upload a source document (Offering Memorandum or draft term sheet, Word or PDF), with AI-assisted field extraction.
- Build the Digital Term Sheet by hand.

The deal then moves through the board stages: Mandate → Announced → Launched → Books Open → Books Closed → Priced → Settled.

**Single source of truth.** ICMA Bond Data Taxonomy (BDT) 2.0. ICMA published BDT 2.0 on 27 April 2026. The current download pack is 2.1, updated 20 August 2026. BDT is also now Appendix C1 of the ICMA Primary Market Handbook (May 2026 amendment).

**Main use case.** Update every vendor and external stakeholder **instantly and at the same time** from one structured record, using API or MCP connectors. This replaces or augments the syndicate desk's email distribution list (see §6). Email and Bloomberg messaging stay as a backup channel.

**Positioning vs Origin Markets.**

| | DTS | Origin Markets |
|---|---|---|
| Lifecycle focus | Pre-marketing, marketing and execution up to pricing: mandate, IPTs, guidance, books, launch, pricing | Documentation and post-trade: term sheet templates, ISIN, listing, settlement integrations |
| Data standard | BDT 2.0 native | Airbrush (own spec). Per ICMA, Origin has also supported BDT 2.0 since 29 May 2026 |
| AI checking | Deal Checker / Deal Co-Pilot | Own AI tooling. Origin Intelligence (launched Nov 2024): AI term-sheet extraction of up to 79 data points on the Airbrush taxonomy, used for ISIN allocation and Bloomberg security setup |

The Airbrush spec confirms the split (§3): its trade stages are only `final_termsheet` and `post_trade_legal`, and it has no IPT, guidance, book-size or order fields.

---

## 2. Key design finding: push vs pull

Most connectors in the catalogue are **read (pull) channels**: vendors exposing *their* data to the bank's AI agents or systems. Very few vendors publicly offer an **inbound** channel where a syndicate desk can push new-deal data in.

| Direction | Connectors | Implication for the DTS |
|---|---|---|
| **Push: inbound deal data accepted today** | DirectBooks (FIX), S&P Global IssueNet / InvestorAccess (DealServices API, FIX), Clearstream PMI / D7 API (ISIN request + instrument data), CUSIP request, Symphony (bot posts to rooms), DTCC NIIDS (US munis only), Bloomberg security setup (DES page, a push route as offered by Origin) | Real API/FIX targets for "send the deal out" |
| **Pull: vendor data in** | Bloomberg Enterprise MCP, LSEG MCP, S&P/Kensho MCP, Moody's MCP, Fitch Nexus MCP, ICE MCP, FactSet MCP, Octus MCP/API, IGM API, Cbonds API, Finsight/CreditFlow API, BondCliQ feed, Origin Trades API, Dealogic feed, EDGAR | Enrich and check a deal (ratings, LEIs, comps, evaluations, prior issues) |
| **No public inbound channel; email today** | Bloomberg news desks, IFR/LSEG, GlobalCapital, IGM, 9fin/Bond Radar, Dow Jones, Octus, FT/WSJ press | Keep email as the push channel, or publish via the DTS's own API/MCP (below) |

**Recommended architecture: publish once, then let recipients subscribe or pull.** The DTS already contains an MCP layer (`src/lib/mcp/` with `get-deal` and `list-deals` tools). The scalable model is:
1. The DTS publishes each lifecycle event as a BDT 2.0 record.
2. Recipients either receive it on a **native push connector** (DirectBooks FIX, IssueNet, Symphony, ICSD API) or **pull it** from the DTS's own MCP/REST endpoint under an entitlement.
3. Email (with the BDT XML/JSON attached) and Bloomberg MSG remain the fallback for anyone not yet connected.

This avoids depending on news and data vendors to build inbound APIs that they don't currently publish.

---

## 3. Origin Markets Airbrush schema (stored for reference)

**Repo:** github.com/OriginMarkets/Airbrush (cloned 9 Nov 2026; last commit 6 June 2022).

**Format:** OpenAPI / Swagger 2.0 YAML (`Airbrush.yaml`). The API is titled "Trades API", version **3.0.0**. Live docs: https://airbrush.originmarkets.com/v3/

**Repo also contains:**
- Jinja machine-readable term sheet template (`.docx`)
- A standardised term sheet
- Example JSON for fixed, floating and zero-coupon trades
- A Python tool that renders a term sheet from Airbrush JSON
- Contact: airbrush@originmarkets.com

**API endpoints** (authentication via `API-Key` header issued by Origin; read-only):
- `GET /trades/`
- `GET /trades/{TradeId}/termsheet-data/`
- `GET /trades/{TradeId}/post-trade-data/`

**History.**
- v1 launched Feb 2021 with Clearstream and the Luxembourg Stock Exchange.
- v2 (June 2021) powered Origin's instant-ISIN with Clearstream and LuxSE digital listing.
- v3 (Oct 2021).
- Clearstream's Primary Market Issuance API (Jan 2022) was built on Airbrush.

**Top-level trade object.** These are the groups to map from BDT:
`agents, bond_fallback_provisions, clearing, confidential, currency, dealers, denominations, ecb_eligible, form, fungible, guarantors, governing_law, identifiers, interest, issuance_category, issuance_type, is_fungible, issuers, listings, method_of_distribution, net_proceeds, other_provisions, pricing, private_placement, product_governance, programme, rating_type, ratings, redemption, security_name` (plus `security_type, seniority, selling_restrictions, series_number, series_size, settlement_date, size, tefra_category, tranche_number, trade_date, trading_method, 871m_status, use_of_proceeds` in the examples).

**Sub-objects.**
- **Pricing:** issue_price, reoffer_yield, reoffer_spread_to_benchmark, reoffer_spread_to_mid_swap, benchmark_reference, benchmark_reference_yield, mid_swap_yield, all_in_issuer_spread_vs_benchmark, commission_percentage, reoffer_coupon_spread, accrual_quotation_type.
- **Redemption:** maturity_date, perpetual, call_features, call_optional_redemption_dates and price, make_whole_margin, par call, clean-up call, change_of_control_put_required, extended_maturity_date, covered_maturity_type.
- **Identifiers:** isin, common, cusip, cins, cfi, fisn, sedol, valoren, wkn, cmu.
- **Dealer:** name, lei, country, role, is_settlement_manager, is_stabilising_manager.

**Enumerations that will need mapping or will fail for some DTS deals.**

| Airbrush enum | Values | Gap vs DTS/BDT use |
|---|---|---|
| CouponType / ISO | Fixed, Floating, Zero, Fixed-to-Floating / FIXD, FLRN, ZCPN, OTHR | No fixed-reset type (e.g. Al Rajhi T2 reset) → OTHR |
| ProductType | Covered, Senior Secured / Unsecured / Preferred / Non-Preferred, **Lower Tier 2** | No AT1 and no sukuk structure (Wakala/Murabaha) |
| GoverningLaw | AT, BE, DK, NL, GB, FI, FR, DE, HK, IE, LU, US, NO, SE, CH | No SA, AE or other GCC/EM laws; no split-law case (English law with Saudi-law subordination) |
| IssuanceCategory | General Corporate Purposes, Green, Social, Sustainable | No sustainability-linked or transition |
| SellingRestrictions | 3(c)(7), Reg S, 144A, RLS | Reg S Category not captured |
| Seniority (ISO) | SNDB, MZZD, SBOD, JUND | OK |
| StagesAvailable | final_termsheet, post_trade_legal | **No pre-pricing stages** |

**Mapping rule.** BDT 2.0 remains the master record. Generate Airbrush only from Priced onwards, when the fields it needs exist. Where Airbrush has no matching value, send `OTHR` / omit the field and keep the BDT value as the authority.

---

## 4. DirectBooks (verified)

**What it is.** A primary-issuance platform owned by a bank consortium (holding company Primary Markets LLC). It went live in late 2020 with USD IG deal announcements and added EUR and GBP IG in April 2021. It now covers IG, HY, EM, SSA and covered bonds, with **48 underwriters** as of June 2026.

**Access methods.** Per the DirectBooks FAQ and the screenshot supplied by the user:
- **Web:** DirectBooks CORE
- **FIX API:** CONNECT
- **Third-party OMS/EMS:** Aladdin, Bloomberg AIM and TSOX, Charles River, FlexTrade, MarketAxess, TS Imagine, Trumid

The FAQ page text as rendered for this research reads "COREFIX"; the user's screenshot is used as the authority for the CORE/CONNECT naming.

**Protocol.** FIX 5.0 SP2. Certifications: ISO 27001:2022 and SOC 2 Type II.

**Underwriter functions:**
- Set up deals and tranches
- Send announcements and updates
- Review orders
- Manage allocations
- Add documentation

**Investor functions:**
- Aggregated deal calendar
- Standardised terms
- Real-time guidance and pricing
- Order entry
- DART analytics

**Recent integrations:**
- **MarketAxess** (announced 24 Feb 2026, live Q2 2026): announcements, IOIs and allocation messages.
- **Bloomberg TSOX/AIM** (live 8 June 2026): order, allocation and final pricing messages, with allocations booked straight into the OMS.

**Schema.** DirectBooks publishes no formal data standard publicly. It refers to structured deal data and standardised deal stages, and doesn't mention ICMA or BDT. The FIX specification is client documentation only.

**DTS mapping implication.** The BDT → DirectBooks mapping has to be done against the FIX spec obtained at onboarding.

**Onboarding.** Through DirectBooks sales (sales@directbooks.com). Eligible users are institutional investors and underwriters.

**Relevance.** DirectBooks is the **only listed connector that takes pre-pricing deal announcements and updates from underwriters**. That matches the DTS's Announced → Priced window exactly. It is the highest-priority push connector.

---

## 5. Connector catalogue: connection instructions (30 entries)

Legend: **Push** = DTS can send deal data in. **Pull** = DTS/Co-Pilot reads vendor data. All commercial feeds need a licence or subscription; MCP access is generally on top of the existing licence.

### Market Data (8)

| Connector | Dir. | How to connect | Auth / prerequisites |
|---|---|---|---|
| **Bloomberg Terminal** | Pull (push via email/MSG and DirectBooks→TSOX) | **Bloomberg Enterprise MCP** (launched 29 Sep 2026): AI access layer over Data License Plus (DL+). Content browsable at data.bloomberg.com. **New Issues Feed** via DL Per Security tracks bonds from announcement to pricing. **B-PIPE** (Bloomberg Market Data Feed via BLPAPI 3.26.9.1, Server API; admin via Bloomberg Enterprise Console) alongside DL+, Enterprise MCP and the Desktop API (Terminal BLPAPI). **Bloomberg security setup (DES)** is a push route, as offered by Origin | DL / DL+ licence; entitlements checked per request |
| **Refinitiv Eikon / LSEG Workspace** | Pull | **LSEG MCP server**: `https://api.analytics.lseg.com/lfa/mcp/server-cl` (Streamable HTTP). In the Claude connector directory since 27 Oct 2025; also available through Copilot, ChatGPT, Gemini, Databricks and Amazon Quick. IFR New Issues Monitor content sits in Workspace | OAuth; Workspace / Financial Analytics licence |
| **ICE Data Services** | Pull | **ICE MCP connector** (29 Jul 2026): `https://fids-mcp.ice.com/mcp`. Datasets: EOD fixed income evaluations, evaluation transparency, US Treasury benchmark, TRACE/MSRB trades. Keep queries to one day or one week | OAuth via ICE SSO with MFA; ICE Data Services licence |
| **Finsight** | Pull | **CreditFlow Primary Market Data API** (paid add-on). Covers US ABS, US IG/HY and EMEA IG/HY new issues. Finsight bought Credit Flow Research in Jan 2025. API contact: support@creditflowresearch.com | Subscription + API add-on |
| **9fin (Bond Radar)** | Pull | 9fin bought Bond Radar on 24 Mar 2025, adding 20+ years of bond history. **No public API or MCP documentation found.** Contact 9fin. Bond Radar's new-issues mailbox was still on the May 2025 syndicate email list | **Unverified** API; subscription |
| **GlobalCapital** | Pull | Owned by Derivia Intelligence. Paywalled news plus the **Primary Market Monitor** pricing database. **No public API found.** Receives deal emails today | Subscription; ask about data licensing |
| **Cbonds** | Pull | Bond Data API: reference data, prices and corporate actions, in JSON or SOAP. Apply via the API page form; free test access for a few instruments | API key (account login) |
| **FactSet** | Pull | **FactSet MCP**: `https://mcp.factset.com/content/v1`. Nine datasets: fundamentals, estimates, ownership, M&A, pricing, people, events, supply chain, geographic revenue. Limited new-issue content | OAuth; FactSet licence |

### Ratings & Data (3)

| Connector | Dir. | How to connect | Auth |
|---|---|---|---|
| **S&P Global Market Intelligence** | Pull | **Kensho LLM-ready API MCP**: `https://kfinance.kensho.com/integrations/mcp`. Covers Capital IQ financials, transcripts and market data. Trials and pricing: commercial@kensho.com | OAuth; S&P licence |
| **Moody's Analytics** | Pull | **Moody's MCP**: `https://api.moodys.com/genai-ready-data/m1/mcp`. Tools: entity search, ratings and outlooks, research search. In Claude, add it as a custom connector. AI "skills" launched June 2026 | OAuth to Moody's login; request credentials from Moody's |
| **Fitch Ratings** | Pull | **Fitch Nexus MCP** (Fitch Solutions): ratings, outlooks, watches, research and financials. Listed in the Claude connector directory. Also available by API, datafeed and Snowflake | Fitch Solutions subscription |

### Trading Venue (3)

| Connector | Dir. | How to connect | Auth |
|---|---|---|---|
| **Tradeweb** | Pull / partner | Trading API, FIX and Python API. **New-issue "data shell"** with Euroclear and IGM, consumed by API or through OMS integrations. Integrated with S&P InvestorAccess (consumes DealServices deal terms) | Client onboarding; licence |
| **MarketAxess** | Pull | Developer portal: portal.marketaxess.com. Integrated with DirectBooks since Q2 2026 (announcements, IOIs, allocations) | Client credentials |
| **BondCliQ** | Pull | US corporate bond consolidated quotes and enriched TRACE, via FIX API feed, intraday SFTP files or the BondTIQ UI. US only, not Eurobonds | Subscription |

### Settlement & Custody (3)

| Connector | Dir. | How to connect | Auth |
|---|---|---|---|
| **Euroclear** | Pull (ISIN via lead manager) | Euroclear Bank allocates XS ISINs when the lead manager requests them. **New Issues Alert** feed gives near real-time notice of new Eurobonds (about 40 reference fields); the ESES variant is JSON over MFT. The Euroclear/Clearstream **IPT taxonomy (aligned to BDT) is not public** | Client relationship; eis@euroclear.com |
| **Clearstream** | **Push** | **PMI API / D7 Pre-Issuance API**: request ISINs and deliver instrument data for activation. Built on Airbrush. Technical spec on the Deutsche Börse API platform | ClearstreamXact subscription; API Agreement + D7 annex; credentials and digital certificate via Xact Web Portal. Contact primarymarketrelations@clearstream.com |
| **DTCC** | Push (US munis only) | **NIIDS** collects and disseminates **US municipal** new-issue data, via the web interface or "Autofeed". **Not applicable to Eurobonds or corporates** | DTC participant or authorised agent |

### Industry & Standards (3)

| Connector | Dir. | How to connect | Auth |
|---|---|---|---|
| **ICMA New Issue Process / BDT** | Standard | No API. Download the BDT pack (XSDs, enums, type restrictions, examples, reference sheet, user guide) from the ICMA BDT page. Current pack 2.1 (20 Aug 2026) | Free, members and non-members |
| **ANNA DSB** | **Not for bonds** | The DSB issues ISINs for **OTC derivatives** (and UPIs) via FIX or REST. Bond ISINs come from national numbering agencies; Eurobond XS ISINs come from Euroclear/Clearstream. **Recommend removing or relabelling** | DSB user agreement |
| **CUSIP Global Services** | Push (request) | Request CUSIP/CINS (and ISINs for US and other assigned markets) through cusip.com "Request an identifier", with supporting documents. Licensed CUSIP data API for lookup. Needed for 144A/US tranches | CGS licence / per-request fee |

### Syndicate Tools (6)

| Connector | Dir. | How to connect | Auth |
|---|---|---|---|
| **Ipreo / IHS Markit Bookbuilding** | **Push** | Now **S&P Global Market Intelligence** (IHS Markit bought Ipreo in 2018 and merged with S&P in 2022). **IssueNet** syncs deal terms, orders and allocations across 220+ syndicate banks. **InvestorAccess** handles buy-side orders. Connect via **DealServices API** and **FIX** | S&P Global client onboarding. **Rename the catalogue entry** |
| **PrimaryNexus** | — | Placeholder; removed from the catalogue. | — |
| **Dealologic** | Pull | Correct spelling: **Dealogic** (now ION Group). **DealManager** for syndicate workflow. **Primary Market Deals & Entities Feed**: XML over SFTP into MS SQL via Data Loader, hourly increments, history back to 1995 | Username/password; licence. **Fix spelling** |
| **Origin Markets** | Pull | **Trades API** (Airbrush v3, read-only) at `https://airbrush.originmarkets.com/v3`. Origin supports BDT 2.0 since May 2026 | `API-Key` header issued by Origin |
| **DirectBooks** | **Push** | See §4. FIX 5.0 SP2 (CONNECT), web (CORE) or OMS/EMS partners | Onboarding via sales@directbooks.com |
| **Edgar SEC filings** | Pull (live link) | Free REST on data.sec.gov (submissions, XBRL) and full-text search. US 424B filings only; out of scope for Reg S | No key; **declared User-Agent with contact required**; max 10 requests/s |

### Communications (1)

| Connector | Dir. | How to connect | Auth |
|---|---|---|---|
| **Symphony Messaging** | **Push** | Bot posts structured deal messages to rooms through the REST API (Pod, Agent and Key Manager). Java/Python BDK. Structured objects can be injected into chats | Bot service account; RSA or X.509 certificate auth; pod configured for the REST API |

### News & Wires (3)

| Connector | Dir. | How to connect | Auth |
|---|---|---|---|
| **IGM (Informa Global Markets)** | Pull | REST **APIHub** (Swagger at api.informagm.com). Deal terms tracked from mandate through IPTs, guidance and books to final terms. About 80 fields including NIC and books. OData queries, 100 records per call. Partner in the Tradeweb/Euroclear data shell | Secret token + company key; subscription |
| **Octus** | Pull | **Octus MCP Connector** (live 14 Jul 2026), REST API, Snowflake or Databricks share. Mainly sub-investment-grade credit | Subscriber; MCP at extra cost; credentials and endpoint from the Octus account team |
| **Dow Jones** | Pull | Factiva GenAI feed and Dow Jones Newswires GenAI feed (licensed full text). **No Dow Jones MCP server found.** Receives deal emails today | Licence |

---

## 6. Distribution-list coverage (BNP Paribas mandate example, May 2025)

The example syndicate email ("€€€ MANDATE: EUROFIMA – New Green Bond Framework and Investor calls") went to 30+ addresses. Only **organisations** are recorded here; individuals' addresses are deliberately not stored.

| Organisation on the email list | In DTS catalogue? |
|---|---|
| Bloomberg (new-issues and EMEA capital-markets desks) | Yes |
| LSEG / Refinitiv / Thomson Reuters (IFR) | Yes |
| ICE (fixed income desks, Interactive Data) | Yes |
| DirectBooks (EMEA deals desk) | Yes |
| Dealogic (DCM analytics) | Yes (spelling) |
| Informa Global Markets (IGM) | Yes |
| Dow Jones / WSJ | Yes (Dow Jones) |
| GlobalCapital | Yes |
| Bond Radar (now 9fin) | Yes |
| Origin Markets | Yes |
| Finsight / CreditFlow Research | Yes (Finsight) |
| **Debtwire (ION)** | **No** |
| **ION Group (bonds desk)** | **No** |
| **Exchange Data International (EDI)** | **No** |
| **KangaNews** | **No** |
| **MNI Market News** | **No** |
| **Prospect News** | **No** |
| **Financial Times** | **No** |
| **ITC Markets** | **No** |
| **Capital Market Daily, Bond Rumour, Intinsider** | **No** |
| Issuer-side syndicate support mailbox (bank internal) | n/a |

**Takeaway.** About 10 recipient organisations on a real list have no connector. Nearly all media recipients have **no inbound API**. The DTS therefore needs a structured-email fallback (BDT payload attached) and/or its own subscribe endpoint (§2) from day one.

---

## 7. Bond Console settings: what each connector record should hold

Implemented step 1: connectivity profiles (record only).

Implemented step 2: new-issues email distribution.
- Each connector can hold one or more organisation/desk distribution addresses (e.g. newissues@vendor.com), never individuals. Addresses are stored in the backend per organisation (`vendor_distribution`, row-level security by organisation), not in the browser. Empty by default.
- Bond Console → Recipients lists every vendor with an address and an on/off switch; only enabled vendors receive alerts.
- "Send update" on a deal (events: Mandate, Announced/IPT, Guidance, Books update, Launch, Pricing, Final terms) renders the alert from the latest saved BDT terms, keeps user intro/notes separately, appends legal notices verbatim outside AI, and attaches the BDT 2.0 XML of the saved snapshot.
- A person must preview and tick approval for every send; nothing sends automatically. The server re-checks that the saved terms still match the previewed snapshot.
- Every send is logged (`alert_sends`, `alert_send_recipients`, plus `audit_log`): deal, event, stage, time, sender, subject, snapshot version and hash, and per-recipient delivery status. Failed deliveries can be retried with the same snapshot.
- Later channels (Bloomberg MSG, DirectBooks, Symphony) plug into the same Send update step as extra recipient rows with their own `channel`, reusing the snapshot, approval and log.

To send data instantly to each recipient, the end user's settings for each connector should capture:

1. **Channel type:** FIX session / REST API / MCP server / SFTP / Symphony bot / email fallback.
2. **Endpoint:** URL, FIX host:port, SFTP host, or mailbox.
3. **Authentication:** OAuth client and redirect, API key, secret token + company key, X.509 or RSA certificate, or FIX SenderCompID/TargetCompID. Stored as secrets, never in the catalogue.
4. **Environment:** UAT/certification vs production. DirectBooks, the ANNA DSB and Clearstream all require testing before production.
5. **Direction and message types:** which lifecycle events go out (Mandate, IPT, Guidance, Books update, Launch, Pricing, Allocation, Final terms) and which data comes in.
6. **Schema profile:** BDT 2.0 → target mapping (BDT XML/JSON native; Airbrush v3; DirectBooks FIX; IGM fields), with a per-field gap log.
7. **Licence / entitlement reference** and owner (commercial feeds stay "Not connected" until licensed, as the UI already says).
8. **Fallback rule:** if a push fails or the recipient isn't connected, send email plus a Bloomberg MSG with the BDT attachment, and log it in the audit trail.
9. **Recipient type:** investor platform, data vendor, news/media, infrastructure (ICSD/NNA), internal.

---

## 8. Suggested catalogue corrections (`src/lib/vendors.ts`)

1. `dealologic` → **Dealogic** (ION Group).
2. `ipreo` "Ipreo / IHS Markit Bookbuilding" → **S&P Global IssueNet / InvestorAccess** (DealServices API, FIX).
3. `anna` ANNA DSB → relabel "OTC derivatives only", or replace with the **numbering agency / ICSD ISIN** route (Euroclear/Clearstream for XS ISINs).
4. `dtcc` → note "US municipal new issues (NIIDS)"; low relevance for Eurobonds.
5. `primarynexus` → Placeholder; removed from the catalogue.
6. Add missing distribution recipients from §6 (Debtwire/ION, KangaNews, MNI, Prospect News, EDI, FT), most as **email/feed** channel type.
7. Mark the true **push** connectors (DirectBooks, S&P IssueNet, Clearstream PMI/D7, Symphony, CUSIP) separately from **pull/enrichment** connectors in the UI.

---

## Sources

- [OriginMarkets/Airbrush (GitHub)](https://github.com/OriginMarkets/Airbrush) · [Airbrush v3 API docs](https://airbrush.originmarkets.com/v3/)
- [Clearstream: Origin instant-ISIN and Airbrush V2 (Jun 2021)](https://www.clearstream.com/clearstream-en/newsroom/210621-2690252) · [Clearstream PMI API launch (Jan 2022)](https://www.clearstream.com/clearstream-en/newsroom/220125-2918504) · [Clearstream PMI API services](https://clearstream.com/clearstream-en/securities-services/issuance-1-/issuance-services/pmiapi) · [Clearstream D7 Pre-Issuance API](https://clearstream.com/clearstream-en/securities-services/issuance-solutions/digital-issuance/d7-pre-issuance-api)
- [ICMA Bond Data Taxonomy page](https://www.icmagroup.org/fintech-and-digitalisation/fintech-advisory-committee-and-related-groups/bond-data-taxonomy) · [ICMA BDT 2.0 announcement](https://www.icmagroup.org/News/news-in-brief/icma-publishes-version-2-0-of-the-bond-data-taxonomy-reflecting-growing-market-adoption/)
- [DirectBooks FAQ](https://www.directbooks.com/faq) · [MarketAxess–DirectBooks (Business Wire)](https://www.businesswire.com/news/home/20260224240951/en) · [Bloomberg–DirectBooks (TMCnet/PRN)](https://www.tmcnet.com/usubmit/2026/06/08/10395764.htm)
- [Bloomberg Enterprise MCP (HPCwire)](https://www.hpcwire.com/bigdatawire/this-just-in/bloomberg-launches-enterprise-mcp-to-seamlessly-connect-bloomberg-data-with-clients-enterprise-ai-applications/) · [Bloomberg DL+](https://professional.bloomberg.com/products/data/data-license/dl-plus/) · [Bloomberg API library](https://professional.bloomberg.com/support/api-library/)
- [Origin documentation](https://www.originmarkets.com/product/documentation) · [Origin Intelligence press release](https://www.originmarkets.com/press-releases/origin-inteligence)
- [LSEG MCP](https://www.lseg.com/en/solutions/ai-finance-solutions/lseg-mcp) · [LSEG–Anthropic RNS](https://www.investegate.co.uk/announcement/rns/london-stock-exchange-group--lseg/lseg-announces-collaboration-with-anthropic/9197121) · [LSEG MCP endpoint (mcpservers.org)](https://mcpservers.org/remote-mcp-servers/lseg)
- [ICE MCP connector](https://www.ice.com/fixed-income-data-services/access-and-delivery/mcp-connector) · [ICE MCP endpoint (mcpservers.org)](https://mcpservers.org/remote-mcp-servers/ice-data-services)
- [S&P–Anthropic / Kensho MCP](https://press.spglobal.com/2025-07-15-S-P-Global-and-Anthropic-Announce-Integration-of-S-P-Globals-Trusted-Financial-Data-into-Claude) · [Kensho MCP endpoint](https://mcp.so/servers/sp-global)
- [Moody's MCP server](https://www.moodys.com/web/en/us/genai/model-context-protocol.html)
- [Fitch Nexus MCP (FF News)](https://ffnews.com/newsarticle/fitch-solutions-launches-fitch-nexus-mcp-to-deliver-greater-speed-to-credit-insights/) · [Fitch Solutions Claude connector](https://claude.com/connectors/fitch-solutions)
- [FactSet MCP release](https://investor.factset.com/news-releases/news-release-details/factset-meets-demand-ai-ready-data-first-announce-mcp-sans) · [FactSet MCP endpoint](https://mcpservers.org/remote-mcp-servers/factset)
- [Tradeweb/Euroclear/IGM data shell Q&A](https://tradeweb.com/newsroom/media-center/insights/blog/a-revolution-in-primary-market-data) · [S&P InvestorAccess + Tradeweb](https://www.spglobal.com/marketintelligence/en/mi/Info/0522/investoraccess-tradeweb.html)
- [MarketAxess (apis.io)](https://apis.io/providers/marketaxess/) · [BondCliQ / EDI](https://www.exchange-data.com/exchange-data-international-edi-partners-with-bondcliq-to-offer-real-time-and-historical-corporate-bond-data-product)
- [Euroclear Eurobond New Issues Alert](https://www.euroclear.com/campaigns/en/innovation/data-euroclear-information-solutions/reference_data/eurobond-new-issue-alert.html) · [DTCC NIIDS](https://www.dtcc.com/asset-services/underwriting/new-issue-information-dissemination-service)
- [ANNA DSB technical information](https://www.anna-dsb.com/technical-information/) · [S&P IssueNet](https://www.spglobal.com/market-intelligence/en/solutions/products/issuenet-data-sync-and-risk-management-for-banks)
- [Dealogic Primary Market Deals feed (ION)](https://iongroup.com/analytics/data-portal/apis-data-feeds/dealogic-origination-data-feed/) · [Symphony REST API](https://docs.developers.symphony.com/bots/overview-of-rest-api)
- [9fin acquires Bond Radar](https://fintechnews.ch/london/9fin-acquires-bond-radar/75399/) · [Octus MCP Connector](https://octus.com/products/mcp-connector/) · [IGM API onboarding FAQ](https://informaconnect.com/uploads/IGM-24-APIHub-Onboarding-FAQs-1123x794-proof3-03543ea04b56528dc278ce3b7384542e.pdf)
- [CreditFlow (Finsight)](https://creditflowresearch.com/) · [Cbonds API](https://cbonds.com/api/bonds/) · [GlobalCapital / Derivia](https://www.globalcapital.com/about-us)
- [SEC: Accessing EDGAR data](https://www.sec.gov/os/accessing-edgar-data)
