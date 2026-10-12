# Al Rajhi Bank – Tier 2 US$ Reg S 10.5NC5.5 Social Sukuk (demo deal flow)

The standard demonstration deal for NewIssueVault. The real syndicate message blasts (Bloomberg / Outlook) are numbered in the order they were sent.

| # | File | Stage | Key terms |
|---|------|-------|-----------|
| 1.1 | `1.1_AL_RAJHI_BANK_-_TIER_2_US$_REG_S_10.5NC5.5_SOCIAL_SUKUK_-_IPTs_T_200bp.txt` | Initial price thoughts | IPTs T+200bps area, size Benchmark, USD, 10.5NC5.5, pricing 3 Sep 2026, issue 10 Sep 2026, dissolution 10 Mar 2037, reset 10 Mar 2032 |
| 1.2 | Offering Circular (PDF, attachment to 1.1) | – | Offering circular dated 17 June 2026, U.S.$10bn Trust Certificate Issuance Programme |
| 1.3 | Supplement (PDF, attachment to 1.1) | – | Supplement to the offering circular |
| 2.0 | `2.0_..._Books_Over_$_1.6bn_ex_JLM_Interest.txt` | Guidance / books | Books over US$1.6bn (ex JLM interest) |
| 3.0 | `3.0_..._Launched.txt` | Spread set / launch | Size US$600mn, spread T+170bps, books in excess of 1.35bn, books subject |
| 4.0 | `4.0_..._PRICED.txt` | Priced | US$600,000,000, T+170bps, reoffer price 100, yield/profit rate 6.232%, ISIN XS3489932593, Common Code 348993259 |

Parties: Issuer Al Rajhi Sukuk Limited (LEI 549300FHETHK3XGY8N60); Obligor Al Rajhi Banking and Investment Corporation (LEI 558600BQZS4Y1DTU8589). Expected issue rating Baa2 / BBB+. Wakala/Murabaha structure, Social certificates, Reg S Cat 2. English law (subordination: Saudi law). Listing: LSE International Securities Market. JLMs/JBRs: Al Rajhi Capital, Arqaam Capital, BBVA, Citi, IMI-Intesa Sanpaolo, Morgan Stanley, Standard Chartered Bank, SMBC, Warba. SCB Sole Sustainability Structurer.

Note: the 2.0 and 3.0 files carry the sender's (Intesa Sanpaolo London Branch) disclaimer. Message 1.1 is dated 16 Sep 2026 in the forward header, but the terms state a 3 Sep 2026 pricing date; the demo uses 3 Sep 2026.

## Where the files live
- Message text: this folder (`*.txt`, extracted from the original Word files).
- PDFs: stored as file links in `src/assets/al-rajhi/*.asset.json`.
- Demo script (chat replay + term sheet stages): `src/data/alRajhiDemo.ts`. Pre-marketing chat messages in it are illustrative, not from the real files.
