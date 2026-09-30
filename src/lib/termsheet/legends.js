/* Standard legends generated from field values, so wording and data cannot drift apart.
   Drafting aids only: deal counsel signs off final wording. */
import { STAGES } from "./fields.js";

export function legendBlocks(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";

  const out = [];
  const tm = v("IssuanceDataGroup/Issuance/TargetMarket/ManufacturerTargetMarketType");
  const priips = v("IssuanceDataGroup/Issuance/SellingRestrictions/PRIIPsRestriction");
  const cci = v("IssuanceDataGroup/Issuance/SellingRestrictions/CCIRestriction");
  const regs = v("IssuanceDataGroup/Issuance/SellingRestrictions/REGS/RegSCode");
  const tefra = v("IssuanceDataGroup/Issuance/SellingRestrictions/TEFRA/TefraCode");
  const r144 = v("IssuanceDataGroup/Issuance/SellingRestrictions/RULE144A") === "true";
  const mgrs = state.parties.filter(p => (p.Roles || []).some(r => /MANAGER|BOOKRUNNER|COORDINATOR/.test(r))).map(p => p.PartyName);
  const stab = state.parties.filter(p => (p.Roles || []).includes("STABILISATION_MANAGER")).map(p => p.PartyName);
  const den = Number(v("IssuanceDataGroup/Issuance/SpecifiedDenomination/Value"));
  const cur = v("IssuanceDataGroup/Issuance/SpecifiedCurrency");
  const wholesale = tm && /PROF_AND_ECPS$/.test(tm);
  const agencies = [...new Set(state.ratings.filter(r => r.RatingAgency).map(r => r.RatingAgency))];

  if (tm) out.push(["Product governance target market",
    `Solely for the purposes of the manufacturer's product approval process, the target market assessment in respect of the notes has led to the conclusion that the target market is ${wholesale ? "eligible counterparties and professional clients only" : "retail clients, professional clients and eligible counterparties"}, each as defined in ${/^UK_/.test(tm) ? "the UK MiFIR regime as it forms part of UK domestic law" : "Directive 2014/65/EU (MiFID II)"}. All channels for distribution of the notes are appropriate. Any person subsequently offering, selling or recommending the notes is responsible for undertaking its own target market assessment and determining appropriate distribution channels. Recorded in the taxonomy as ${tm}.`]);

  if (priips && /^NO_EEA$/.test(priips)) out.push(["Prohibition of sales to EEA retail investors",
    "The notes are not intended to be offered, sold or otherwise made available to, and should not be offered, sold or otherwise made available to, any retail investor in the European Economic Area. No key information document required by Regulation (EU) No 1286/2014 has been prepared, and offering or selling the notes to any EEA retail investor may be unlawful."]);
  if (priips && /^NO_UK$/.test(priips)) out.push(["Prohibition of sales to UK retail investors",
    "The notes are not intended to be offered, sold or otherwise made available to, and should not be offered, sold or otherwise made available to, any retail investor in the United Kingdom."]);
  if (cci === "APPLICABLE") out.push(["United Kingdom consumer composite investments",
    "The UK Consumer Composite Investments regime replaced the UK PRIIPs Regulation on 6 April 2026. No product summary or other CCI disclosure has been prepared for the notes, and they are not intended for distribution to retail investors in the United Kingdom. Confirm the current wording with counsel, since transitional provisions continue to apply to legacy documentation."]);

  if (regs || tefra) out.push(["United States",
    `The notes have not been and will not be registered under the United States Securities Act of 1933. ${regs ? "They are offered outside the United States in reliance on Regulation S (" + regs.replace("REGS_", "") + ")" : "They are offered outside the United States"}${r144 ? " and within the United States to qualified institutional buyers in reliance on Rule 144A" : " and may not be offered or sold within the United States or to, or for the account or benefit of, US persons except pursuant to an exemption"}.${tefra && tefra.indexOf("TEFRA_") === 0 && tefra !== "TEFRA_NA" ? " " + tefra.replace("TEFRA_", "TEFRA ") + " rules apply." : ""}`]);

  if (v("x:stabilisation") === "APPLICABLE") out.push(["Stabilisation",
    `In connection with the issue of the notes, ${stab.length ? stab.join(", ") : "[stabilisation manager to be named]"} (or persons acting on its behalf) may over-allot the notes or effect transactions with a view to supporting the market price of the notes at a level higher than that which might otherwise prevail. There is no assurance that stabilisation will be undertaken. ${v("x:stabPeriod") ? "Stabilisation period: " + v("x:stabPeriod") + "." : ""} ${v("x:overAllot") ? "Over-allotment: " + v("x:overAllot") + "." : ""} Any stabilisation action must be conducted in accordance with all applicable laws and rules, and a pre-stabilisation notice must be published before stabilisation begins.`]);

  if (agencies.length) out.push(["Credit ratings",
    `The expected ratings above are assigned by ${agencies.join(", ")}. A credit rating is not a recommendation to buy, sell or hold securities and may be revised, suspended or withdrawn at any time. Confirm the registration status of each agency under the EU and UK CRA Regulations before the terms are circulated.${v("x:ratingsDisclaimer") ? " " + v("x:ratingsDisclaimer") : ""}`]);

  if (den && cur) out.push(["Denomination",
    `The notes are issued in denominations of ${cur} ${den.toLocaleString("en-GB")}${den >= 100000 && wholesale ? ", consistent with a wholesale offering" : ", which is a retail denomination and changes the disclosure position"}.`]);

  if (v("x:prospectusRegime")) out.push(["Offer documentation", v("x:prospectusRegime")]);
  if (v("x:costsCharges")) out.push(["Costs and charges", v("x:costsCharges")]);

  out.push(["Status of this record",
    `Indicative terms at the ${STAGES[state.stage - 1].t.toLowerCase()} stage, version ${state.ver}, released through the VDR by ${mgrs.length ? mgrs.join(", ") : "the bookrunners"}. Not an offer to sell or a solicitation of an offer to buy securities, and not for distribution where such distribution would be unlawful. The legal documentation prevails over this digital record.`]);
  return out;
}

export function legendText(state) {
  const v = p => state.f[p] ?? "";
  const has = p => String(v(p)).trim() !== "";
 return legendBlocks(state).map(([h, b]) => h.toUpperCase() + "\n" + b).join("\n\n"); }