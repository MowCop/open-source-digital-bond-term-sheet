import { describe, expect, it } from 'vitest';
import { VENDOR_APIS, connectorDirection, emptyCatalogue, loadCatalogue, resolveCatalogue, saveCatalogueEntry, validateVendor } from '../lib/vendors';
import { connectivityFor, protocolChip, validateProfile, defaultFixSession, type ConnectivityProfile } from '../lib/connectivity';

const v = (id: string) => VENDOR_APIS.find(x => x.id === id)!;
const fix = (over: Partial<ConnectivityProfile['fix']> = {}): ConnectivityProfile => ({ id: 'f', protocol: 'FIX', label: 'Test FIX', version: '5.0 SP2', direction: 'push', environment: 'UAT', auth: 'FIX session logon', fix: { ...defaultFixSession(), ...over } });

describe('Connectivity defaults', () => {
  it('DirectBooks has FIX CONNECT 5.0 SP2 push with FIXT.1.1 / FIX.5.0SP2', () => {
    const p = connectivityFor(v('directbooks')).find(x => x.protocol === 'FIX')!;
    expect(p.label).toBe('CONNECT'); expect(p.version).toBe('5.0 SP2'); expect(p.direction).toBe('push'); expect(p.auth).toBe('FIX session logon');
    expect(p.fix?.beginString).toBe('FIXT.1.1'); expect(p.fix?.applVerId).toBe('FIX.5.0SP2');
  });
  it('Bloomberg has B-PIPE (BLPAPI, EMRS, pull) and Desktop API on localhost:8194', () => {
    const list = connectivityFor(v('bloomberg'));
    const b = list.find(x => protocolChip(x) === 'B-PIPE')!;
    expect(b.protocol).toBe('BLPAPI'); expect(b.auth).toBe('EMRS identity'); expect(b.direction).toBe('pull');
    expect(b.notes).toContain('//blp/mktdata'); expect(b.notes).toContain('//blp/refdata');
    expect(b.sdkVersion).toBe('BLPAPI 3.26.9.1'); expect(b.docsUrl).toBe('https://professional.bloomberg.com/support/api-library/');
    expect(list.some(x => x.label === 'Desktop API' && x.endpoint === 'localhost:8194')).toBe(true);
  });
  it('Bloomberg includes a push security setup profile while the row stays pull', () => {
    const list = connectivityFor(v('bloomberg'));
    const s = list.find(x => /security setup/i.test(x.label))!;
    expect(s.direction).toBe('push'); expect(s.protocol).toBe('To be confirmed');
    expect(connectorDirection(v('bloomberg'))).toBe('pull');
    const chips = list.map(protocolChip);
    expect(chips).toContain('B-PIPE'); expect(chips).toContain('Security setup');
  });
  it('carries known docs links', () => {
    const docs: Record<string, string> = {
      directbooks: 'https://www.directbooks.com/faq', refinitiv: 'https://www.lseg.com/en/solutions/ai-finance-solutions/lseg-mcp',
      moodys: 'https://www.moodys.com/web/en/us/genai/model-context-protocol.html', ice: 'https://www.ice.com/fixed-income-data-services/access-and-delivery/mcp-connector',
      clearstream: 'https://clearstream.com/clearstream-en/securities-services/issuance-1-/issuance-services/pmiapi', origin: 'https://airbrush.originmarkets.com/v3/',
      symphony: 'https://docs.developers.symphony.com/bots/overview-of-rest-api', edgar: 'https://www.sec.gov/os/accessing-edgar-data',
    };
    for (const [id, url] of Object.entries(docs)) expect(connectivityFor(v(id)).some(p => p.docsUrl === url)).toBe(true);
  });
  it('rejects non-https or credentialed docs links', () => {
    const base = connectivityFor(v('edgar'))[0];
    expect(validateProfile({ ...base, docsUrl: 'http://x.org' })).not.toBeNull();
    expect(validateProfile({ ...base, docsUrl: 'https://u:p@x.org' })).not.toBeNull();
  });
  it('unknown connectors get one "To be confirmed" profile', () => {
    expect(connectivityFor(v('euroclear'))).toHaveLength(1);
    expect(connectivityFor(v('euroclear'))[0].protocol).toBe('To be confirmed');
  });
  it('old saved entries without connectivity get defaults and keep the user name', () => {
    const saved = { entries: [{ id: 'dealologic', name: 'My Dealogic', category: 'Syndicate Tools', description: 'x', status: 'available' }], deletedIds: [] };
    const row = resolveCatalogue(loadCatalogue({ getItem: () => JSON.stringify(saved) }, 'u')).find(x => x.id === 'dealologic')!;
    expect(row.name).toBe('My Dealogic');
    expect(connectivityFor(row)[0].protocol).toBe('SFTP');
  });
  it('protocol chips', () => {
    expect(protocolChip(fix())).toBe('FIX 5.0 SP2');
    expect(connectivityFor(v('ice')).map(protocolChip)).toContain('MCP');
  });
});

describe('No secret values persisted', () => {
  it('drops password/token/apiKey fields on save and load', () => {
    const dirty = { ...connectivityFor(v('cbonds'))[0], password: 'hunter2', token: 'abc', apiKey: 'sk-live-123' } as ConnectivityProfile;
    const state = saveCatalogueEntry(emptyCatalogue(), { ...v('cbonds'), connectivity: [dirty] });
    const json = JSON.stringify(state);
    for (const s of ['hunter2', 'sk-live-123', '"token"']) expect(json).not.toContain(s);
    const loaded = loadCatalogue({ getItem: () => JSON.stringify({ entries: [{ ...v('cbonds'), connectivity: [dirty] }], deletedIds: [] }) }, 'u');
    expect(JSON.stringify(loaded)).not.toContain('hunter2');
  });
  it('rejects a secretRef that looks like a key', () => {
    const p = connectivityFor(v('cbonds'))[0];
    expect(validateProfile({ ...p, secretRef: 'sk-abc123xyz' })).not.toBeNull();
    expect(validateProfile({ ...p, secretRef: 'CBONDS_API_KEY' })).toBeNull();
  });
});

describe('FIX validation', () => {
  it('port range', () => {
    expect(validateProfile(fix({ port: 0 }))).not.toBeNull();
    expect(validateProfile(fix({ port: 70000 }))).not.toBeNull();
    expect(validateProfile(fix({ port: 443 }))).toBeNull();
  });
  it('CompIDs required once certified', () => {
    for (const c of ['UAT certified', 'Production'] as const) {
      expect(validateProfile(fix({ certification: c }))).not.toBeNull();
      expect(validateProfile(fix({ certification: c, senderCompId: 'BANK', targetCompId: 'DB' }))).toBeNull();
    }
    expect(validateProfile(fix({ certification: 'Not started' }))).toBeNull();
    expect(validateVendor({ ...v('directbooks'), connectivity: [fix({ certification: 'Production' })] })).not.toBeNull();
  });
});
