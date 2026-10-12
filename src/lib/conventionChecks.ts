// Floating-rate convention and ESG disclosure checks. Read-only over the BDT state;
// appended to unifiedChecks (src 'vdr'). See reference/deal-checker-capabilities.md.
import type { CheckItem } from './bdt-bridge';

type State = { f?: Record<string, unknown>; docs?: { DocumentName?: string }[] };
const P = 'IssuanceDataGroup/';
const get = (s: State, p: string) => String(s.f?.[P + p] ?? '').trim();

const FRN_DAYCOUNT: Record<string, string[]> = {
  EUR: ['ACT/360'], USD: ['ACT/360'], CHF: ['ACT/360'], JPY: ['ACT/360', 'ACT/365F'],
  GBP: ['ACT/365F', 'ACT/365'], CAD: ['ACT/365F', 'ACT/365'], AUD: ['ACT/365F', 'ACT/365'],
};

export function floatingRateChecks(s: State): CheckItem[] {
  if (get(s, 'Product/InterestPayment/InterestType') !== 'FLOATING') return [];
  const out: CheckItem[] = [];
  const ccy = get(s, 'Issuance/TotalAggregateAmount/Currency') || get(s, 'Product/AggregateNominalAmount/Currency');
  const dc = get(s, 'Product/DayCountFraction');
  const want = FRN_DAYCOUNT[ccy.toUpperCase()];
  if (dc && want) out.push(want.includes(dc)
    ? { l: 'pass', t: `Floating rate day count ${dc} matches ${ccy} money-market convention` }
    : { l: 'warn', t: `Floating rate day count ${dc} is unusual for ${ccy}`, d: `${ccy} FRNs normally accrue on ${want.join(' or ')}.` });
  const bdc = get(s, 'Product/BusinessDayConvention/BusinessDayAdjustment');
  if (bdc && bdc !== 'MODIFIED_FOLLOWING') out.push({ l: 'warn', t: `Floating rate note uses ${bdc} business day convention`, d: 'FRN interest periods are normally adjusted Modified Following.' });
  if (get(s, 'Product/BusinessDayConvention/InterestCalculationAdjustment') === 'UNADJUSTED')
    out.push({ l: 'warn', t: 'Floating rate interest periods are unadjusted', d: 'FRN accrual periods are normally adjusted to business days.' });
  const freq = get(s, 'Product/InterestPayment/FixedRatePayment/InterestPayments/InterestPaymentFrequency');
  if (['ANNUALLY', 'ATMATURITY', 'BIANNUALLY'].includes(freq))
    out.push({ l: 'warn', t: `Floating rate coupon frequency ${freq} is unusual`, d: 'FRNs normally pay quarterly or semi-annually, in line with the reference rate tenor.' });
  const isda = get(s, 'Product/InterestPayment/IsdaDetermination');
  if (!isda) out.push({ l: 'warn', t: 'Floating rate note without ISDA definitions', d: 'State the ISDA definitions (2021 recommended) so rate determination and fallbacks are clear.' });
  else if (isda === '2006') out.push({ l: 'warn', t: 'Floating rate note references the 2006 ISDA definitions', d: 'The 2021 ISDA Definitions carry the risk-free-rate fallbacks (SOFR, €STR, SONIA) now market standard.' });
  else out.push({ l: 'pass', t: `ISDA ${isda} definitions referenced` });
  const minR = get(s, 'Product/InterestPayment/MinimumRate'), maxR = get(s, 'Product/InterestPayment/MaximumRate');
  if (minR && maxR && Number(minR) > Number(maxR)) out.push({ l: 'fail', t: 'Minimum rate of interest exceeds the maximum rate', d: `Floor ${minR}% is above cap ${maxR}%.` });
  if (!minR) out.push({ l: 'warn', t: 'No minimum rate of interest on the floating rate note', d: 'Most FRNs carry a zero floor so the coupon cannot turn negative.' });
  if (get(s, 'Product/InterestPayment/FixedRatePayment/InterestRate'))
    out.push({ l: 'warn', t: 'Fixed coupon entered on a floating rate note', d: 'Clear the fixed coupon or change the interest type.' });
  return out;
}

const docNames = (s: State) => (s.docs ?? []).map(d => (d.DocumentName ?? '').toLowerCase());

export function esgChecks(s: State): CheckItem[] {
  const label = get(s, 'Product/ESGLabel');
  const docs = docNames(s);
  const has = (re: RegExp) => docs.some(n => re.test(n));
  if (!label) {
    return has(/green|social|sustainab/)
      ? [{ l: 'warn', t: 'ESG documents cited but no ESG label set', d: 'A green, social or sustainability document is on file; set the ESG label or remove the citation.' }]
      : [];
  }
  const out: CheckItem[] = [];
  const name = label.replace(/_/g, ' ').toLowerCase();
  out.push(has(/framework/)
    ? { l: 'pass', t: `${name} framework cited` }
    : { l: 'warn', t: `${name} bond without a cited framework`, d: 'ICMA Principles expect the issuer framework to be published and cited in the documentation list.' });
  out.push(has(/second.party|\bspo\b|opinion|external review|verification/)
    ? { l: 'pass', t: 'External review cited' }
    : { l: 'warn', t: `${name} bond without an external review`, d: 'ICMA Principles recommend a second party opinion or other external review.' });
  const stepUp = get(s, 'Product/InterestPayment/FixedRatePayment/StepUpStepDownMargin');
  if (label === 'SUSTAINABILITY_LINKED') {
    out.push(stepUp
      ? { l: 'pass', t: 'Sustainability-linked coupon step-up set' }
      : { l: 'fail', t: 'Sustainability-linked bond with no coupon step-up', d: 'SLB Principles require a financial characteristic (usually a step-up) tied to the KPI/SPT outcome.' });
  } else if (['GREEN', 'SOCIAL', 'SUSTAINABILITY'].includes(label)) {
    if (!has(/allocation|impact|report/)) out.push({ l: 'warn', t: `No allocation or impact reporting commitment cited for the ${name} bond`, d: 'Use-of-proceeds bonds commit to annual allocation and impact reporting.' });
  }
  return out;
}
