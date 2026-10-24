import { bdtToDealCache, P, type BdtState } from '@/lib/bdt-bridge';

/** Read-only projection of the working term sheet, never the saved flat cache. */
export function termSheetView(state: BdtState) {
  const cache = bdtToDealCache(state);
  const value = (path: string) => state.f[path]?.trim() ?? '';
  return {
    issuerName: cache.issuerName ?? '',
    issuerLEI: cache.issuerLEI ?? '',
    issuerRating: cache.issuerRating || (state.ratings ?? []).map(r => [r.RatingAgency === 'SNPG' ? 'S&P' : r.RatingAgency === 'MOODYS' ? "Moody's" : r.RatingAgency, r.RatingValue].filter(Boolean).join(' ')).join(' / '),
    ratingOutlook: cache.ratingOutlook ?? '',
    bookrunners: cache.bookrunners ?? [],
    issuanceType: value(P.issuanceType),
    currency: cache.currency ?? '',
    size: cache.size ?? '',
    specifiedDenomination: cache.specifiedDenomination ?? '',
    coupon: cache.coupon ?? '',
    issuePrice: cache.issuePrice ?? '',
    reofferPrice: cache.reofferPrice ?? '',
    reofferYield: cache.reofferYield ?? '',
    reofferSpread: cache.reofferSpread ?? '',
    midSwapRate: cache.midSwapRate ?? '',
    benchmark: cache.benchmark ?? '',
    pricingDate: cache.pricingDate ?? '',
    issueDate: cache.issueDate ?? '',
    settlementDate: cache.settlementDate ?? '',
    governingLaw: cache.governingLaw ?? value(P.governingLaw),
    sellingRestrictions: cache.sellingRestrictions ?? '',
    listingVenue: cache.listingVenue ?? '',
    isin: cache.isin ?? '',
    cusip: cache.cusip ?? '',
    commonCode: cache.commonCode ?? '',
    formOfNote: value(P.legalTitleForm),
    statusOfNote: [value(P.seniority), value(P.subordinated), value(P.secured)].filter(Boolean).join(' / '),
    tenor: cache.tenor ?? '',
    maturityDate: cache.maturityDate ?? '',
    interestType: value(P.interestType),
    interestRate: value(P.coupon),
    interestPaymentFrequency: cache.interestPaymentFrequency ?? value(P.couponFreq),
    dayCountFraction: value(P.dayCount),
    businessDayConvention: value(P.bizDay),
    optionality: value(P.optionality),
    taxonomy: value('IssuanceDataGroup/Product/ESGLabel'),
  };
}