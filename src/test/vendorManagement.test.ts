import { describe, expect, it } from 'vitest';
import { VENDOR_APIS, emptyCatalogue, resolveCatalogue, saveCatalogueEntry, deleteCatalogueEntry, validateVendor, loadCatalogue, catalogueStorageKey, type VendorAPI } from '../lib/vendors';

const vendor: VendorAPI = { id: 'custom-test', name: 'Test source', category: 'News & Wires', description: 'News', status: 'available', url: 'https://example.org/news' };

describe('Bond Console catalogue management', () => {
  it('adds an entry only to its selected section', () => {
    const items = resolveCatalogue(saveCatalogueEntry(emptyCatalogue(), vendor));
    expect(items.find(v => v.id === vendor.id)?.category).toBe('News & Wires');
    expect(items.filter(v => v.category === 'Syndicate Tools').some(v => v.id === vendor.id)).toBe(false);
  });
  it('requires the exact word delete for existing entries', () => {
    for (const text of ['', 'Delete', 'DELETE', ' delete ', 'yes']) {
      expect(() => deleteCatalogueEntry(emptyCatalogue(), 'edgar', text)).toThrow();
    }
    expect(resolveCatalogue(deleteCatalogueEntry(emptyCatalogue(), 'edgar', 'delete')).some(v => v.id === 'edgar')).toBe(false);
    expect(VENDOR_APIS.some(v => v.id === 'edgar')).toBe(true);
  });
  it('updates entries without duplicating them', () => {
    const original = VENDOR_APIS[0];
    const state = saveCatalogueEntry(emptyCatalogue(), { ...original, name: 'Updated source' });
    expect(resolveCatalogue(state).filter(v => v.id === original.id)).toHaveLength(1);
    expect(resolveCatalogue(state).find(v => v.id === original.id)?.name).toBe('Updated source');
  });
  it('persists additions and removals separately for each user', () => {
    const state = deleteCatalogueEntry(saveCatalogueEntry(emptyCatalogue(), vendor), 'edgar', 'delete');
    const storage = { getItem: (key: string) => key === catalogueStorageKey('karl') ? JSON.stringify(state) : null };
    expect(resolveCatalogue(loadCatalogue(storage, 'karl')).some(v => v.id === vendor.id)).toBe(true);
    expect(resolveCatalogue(loadCatalogue(storage, 'karl')).some(v => v.id === 'edgar')).toBe(false);
    expect(resolveCatalogue(loadCatalogue(storage, 'other')).some(v => v.id === 'edgar')).toBe(true);
  });
  it('rejects unsafe URLs without treating a catalogue entry as a feed connection', () => {
    for (const url of ['javascript:alert(1)', 'http://example.org', 'https://user:pass@example.org']) expect(validateVendor({ ...vendor, url })).not.toBeNull();
    expect(validateVendor({ ...vendor, url: undefined })).toBeNull();
    expect(saveCatalogueEntry(emptyCatalogue(), vendor).entries[0].status).toBe('available');
  });
});