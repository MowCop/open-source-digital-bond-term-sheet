import { describe, it, expect } from 'vitest';
import { splitAnnouncement, sourcedLegalNotices } from '../../supabase/functions/generate-bulletin-from-deal/format';

describe('bulletin source boundaries', () => {
  it('separates the supplied long official footer from the announcement', () => {
    const legal = 'This communication does not constitute or form part of any offer to sell or a solicitation of an offer to buy any securities in the U.S. or any other jurisdiction.\n\nSouth Africa notice.';
    expect(splitAnnouncement('Mandate facts.\n\n' + legal)).toEqual({ announcement: 'Mandate facts.', legal });
  });
  it('rejects unsourced legal wording instead of fabricating notices', () => {
    expect(sourcedLegalNotices(['Official notice.', 'Invented notice.'], [{ name: 'OM', text: 'Facts. Official notice.' }])).toEqual(['Official notice.']);
  });
});