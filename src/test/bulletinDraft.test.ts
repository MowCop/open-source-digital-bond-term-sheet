import { describe, expect, it } from 'vitest';
import { buildDealBulletin, findBulletinDraft, isDtsBulletinDraft } from '@/lib/bulletinDraft';

describe('DTS bulletin drafts', () => {
  const content = { subject: 'Sasol mandate', body: '<p>Announcement</p><table></table><p>Legal notices</p>' };
  it('saves the generated content as a draft, not a published bulletin', () => {
    const draft = buildDealBulletin('sasol', content, 'karl', 'draft');
    expect(draft.status).toBe('draft');
    expect(draft.sentAt).toBeUndefined();
    expect(draft.body).toBe(content.body);
    expect(isDtsBulletinDraft(draft)).toBe(true);
  });
  it('reopens only the matching deal draft', () => {
    const draft = buildDealBulletin('sasol', content, 'karl', 'draft');
    expect(findBulletinDraft([draft], 'sasol')).toBe(draft);
    expect(findBulletinDraft([draft], 'other')).toBeUndefined();
  });
  it('updates and publishes the same draft rather than creating duplicates', () => {
    const draft = buildDealBulletin('sasol', content, 'karl', 'draft');
    const saved = buildDealBulletin('sasol', { ...content, subject: 'Edited mandate' }, 'karl', 'draft', draft);
    const published = buildDealBulletin('sasol', { subject: saved.subject, body: saved.body }, 'karl', 'sent', saved);
    expect(published.id).toBe(draft.id);
    expect(published.subject).toBe('Edited mandate');
    expect(published.sentAt).toBeInstanceOf(Date);
    expect(isDtsBulletinDraft(published)).toBe(false);
    expect(findBulletinDraft([published], 'sasol')).toBeUndefined();
  });
  it('cannot overwrite an already published bulletin as a draft', () => {
    const published = buildDealBulletin('sasol', content, 'karl', 'sent');
    expect(() => buildDealBulletin('sasol', content, 'karl', 'draft', published)).toThrow('no longer a draft');
  });
});