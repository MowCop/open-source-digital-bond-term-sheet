import { describe, it, expect } from 'vitest';
import { splitAnnouncement, sourcedLegalNotices, bulletinTerms } from '../../supabase/functions/generate-bulletin-from-deal/format';

describe('bulletin source boundaries', () => {
  it('excludes unaccepted proposals and original file bodies from recorded terms', () => {
    const terms = bulletinTerms({ f: { currency: 'USD' }, suggestions: ['unaccepted coupon'], files: ['whole OM'], releases: ['history'] });
    expect(terms).toMatchObject({ f: { currency: 'USD' } });
    expect(terms).not.toHaveProperty('suggestions');
    expect(terms).not.toHaveProperty('files');
    expect(terms).not.toHaveProperty('releases');
  });
  it('separates the supplied long official footer from the announcement', () => {
    const legal = 'This communication does not constitute or form part of any offer to sell or a solicitation of an offer to buy any securities in the U.S. or any other jurisdiction.\n\nSouth Africa notice.';
    expect(splitAnnouncement('Mandate facts.\n\n' + legal)).toEqual({ announcement: 'Mandate facts.', legal });
  });
  it('rejects unsourced legal wording instead of fabricating notices', () => {
    expect(sourcedLegalNotices(['Official notice.', 'Invented notice.'], [{ name: 'OM', text: 'Facts. Official notice.' }])).toEqual(['Official notice.']);
  });
});