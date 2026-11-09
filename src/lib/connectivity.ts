/**
 * Connector connectivity profiles: a record of how each vendor is connected.
 * Never opens live connections and never holds secret values — only secret NAMES.
 */
import type { ConnectorDirection } from './vendors';

export const PROTOCOLS = ['FIX', 'REST API', 'MCP', 'BLPAPI', 'SFTP', 'WebSocket/streaming', 'Bot API', 'Email', 'Web UI', 'To be confirmed'] as const;
export type ConnectivityProtocol = typeof PROTOCOLS[number];
export const AUTH_METHODS = ['OAuth', 'API key', 'token + company key', 'X.509/RSA certificate', 'FIX session logon', 'EMRS identity', 'none', 'To be confirmed'] as const;
export type AuthMethod = typeof AUTH_METHODS[number];
export const ENVIRONMENTS = ['UAT', 'Production'] as const;
export type Environment = typeof ENVIRONMENTS[number];
export const CERTIFICATIONS = ['Not started', 'UAT certified', 'Production'] as const;
export type Certification = typeof CERTIFICATIONS[number];
const DIRECTIONS: ConnectorDirection[] = ['push', 'pull', 'email'];

export interface FixSession {
  beginString: string;
  applVerId: string;
  senderCompId: string;
  targetCompId: string;
  host: string;
  port?: number;
  heartbeatSec: number;
  certification: Certification;
}

export interface ConnectivityProfile {
  id: string;
  protocol: ConnectivityProtocol;
  label: string;
  version?: string;
  direction: ConnectorDirection;
  environment: Environment;
  endpoint?: string;
  auth: AuthMethod;
  /** Name of a secret (e.g. DIRECTBOOKS_FIX_PASSWORD). Never the value. */
  secretRef?: string;
  licenceRef?: string;
  notes?: string;
  sdkVersion?: string;
  docsUrl?: string;
  fix?: FixSession;
}

export const defaultFixSession = (): FixSession => ({
  beginString: 'FIXT.1.1', applVerId: 'FIX.5.0SP2', senderCompId: '', targetCompId: '', host: '', heartbeatSec: 30, certification: 'Not started',
});

type P = Omit<ConnectivityProfile, 'id' | 'environment'> & { environment?: Environment };
const make = (vendorId: string, list: P[]): ConnectivityProfile[] =>
  list.map((p, i) => ({ environment: 'Production', ...p, id: `${vendorId}-${i + 1}` }));

const BBG_DOCS = 'https://professional.bloomberg.com/support/api-library/';
const BBG_SDK = 'BLPAPI 3.26.9.1';
const PMI_DOCS = 'https://clearstream.com/clearstream-en/securities-services/issuance-1-/issuance-services/pmiapi';
const pmi = (id: string) => make(id, [{ protocol: 'REST API', label: 'PMI / D7 Pre-Issuance API', direction: 'push', auth: 'X.509/RSA certificate', notes: 'Certificate via Xact Web Portal.', docsUrl: PMI_DOCS }]);
const mcp = (id: string, endpoint: string | undefined, label: string, docsUrl?: string, notes?: string) =>
  make(id, [{ protocol: 'MCP', label, direction: 'pull', auth: 'OAuth', endpoint, docsUrl, notes }]);
const email = (id: string) => make(id, [{ protocol: 'Email', label: 'New issue distribution email', direction: 'email', auth: 'none' }]);

export const DEFAULT_CONNECTIVITY: Record<string, ConnectivityProfile[]> = {
  directbooks: make('directbooks', [
    { protocol: 'FIX', label: 'CONNECT', version: '5.0 SP2', direction: 'push', auth: 'FIX session logon', notes: 'Onboarding via DirectBooks sales.', docsUrl: 'https://www.directbooks.com/faq', fix: defaultFixSession() },
    { protocol: 'Web UI', label: 'CORE', direction: 'push', auth: 'To be confirmed', docsUrl: 'https://www.directbooks.com/faq',
      notes: 'OMS/EMS partners: Aladdin, Bloomberg AIM/TSOX, Charles River, FlexTrade, MarketAxess, TS Imagine, Trumid.' },
  ]),
  bloomberg: make('bloomberg', [
    { protocol: 'BLPAPI', label: 'B-PIPE (Bloomberg Market Data Feed)', version: 'Server API', direction: 'pull', auth: 'EMRS identity',
      endpoint: undefined, sdkVersion: BBG_SDK, docsUrl: BBG_DOCS,
      notes: 'Services //blp/mktdata and //blp/refdata; includes new-issue notifications. BLPAPI is available for C++, Java, C#/.NET and Python (Python via pip from Bloomberg\'s private index). Linux and macOS libraries work only with the Server API and B-PIPE; Terminal users use the Desktop API. The firm\'s Bloomberg administrator manages connectors and entitlements in Bloomberg Enterprise Console (Client Access).' },
    { protocol: 'REST API', label: 'Data License / DL+', direction: 'pull', auth: 'To be confirmed' },
    { protocol: 'SFTP', label: 'Data License / DL+', direction: 'pull', auth: 'To be confirmed' },
    { protocol: 'MCP', label: 'Bloomberg Enterprise MCP', direction: 'pull', auth: 'To be confirmed', notes: 'MCP over DL+.' },
    { protocol: 'BLPAPI', label: 'Desktop API', direction: 'pull', auth: 'none', endpoint: 'localhost:8194', sdkVersion: BBG_SDK, docsUrl: BBG_DOCS, notes: 'Requires a running Terminal.' },
    { protocol: 'Email', label: 'Email/MSG to Bloomberg new-issues desks', direction: 'email', auth: 'none', notes: 'The push channel today. Order and allocation flow to TSOX goes via DirectBooks.' },
    { protocol: 'To be confirmed', label: 'Bloomberg security setup (DES page)', direction: 'push', auth: 'To be confirmed', docsUrl: 'https://www.originmarkets.com/product/documentation',
      notes: "Creates the security / DES page on Bloomberg from term-sheet data. Origin Markets offers this today (Origin Intelligence, Nov 2024: drop a termsheet to create the security in the Bloomberg terminal). Bloomberg's mechanism isn't publicly documented; confirm the security-creation channel with Bloomberg during onboarding. Syndicate emails to the Bloomberg new-issues desks remain the pre-pricing channel." },
  ]),
  ipreo: make('ipreo', [
    { protocol: 'REST API', label: 'DealServices API', direction: 'push', auth: 'To be confirmed' },
    { protocol: 'FIX', label: 'IssueNet FIX', direction: 'push', auth: 'FIX session logon', fix: defaultFixSession() },
  ]),
  clearstream: pmi('clearstream'),
  'xs-isin': pmi('xs-isin'),
  symphony: make('symphony', [{ protocol: 'Bot API', label: 'Bot API (Pod/Agent/Key Manager)', direction: 'push', auth: 'X.509/RSA certificate', docsUrl: 'https://docs.developers.symphony.com/bots/overview-of-rest-api' }]),
  refinitiv: mcp('refinitiv', 'https://api.analytics.lseg.com/lfa/mcp/server-cl', 'LSEG MCP', 'https://www.lseg.com/en/solutions/ai-finance-solutions/lseg-mcp'),
  ice: mcp('ice', 'https://fids-mcp.ice.com/mcp', 'ICE MCP', 'https://www.ice.com/fixed-income-data-services/access-and-delivery/mcp-connector', 'OAuth via ICE SSO.'),
  factset: mcp('factset', 'https://mcp.factset.com/content/v1', 'FactSet MCP'),
  sp: mcp('sp', 'https://kfinance.kensho.com/integrations/mcp', 'S&P / Kensho MCP'),
  moodys: mcp('moodys', 'https://api.moodys.com/genai-ready-data/m1/mcp', "Moody's MCP", 'https://www.moodys.com/web/en/us/genai/model-context-protocol.html'),
  fitch: make('fitch', [{ protocol: 'MCP', label: 'Fitch Nexus MCP', direction: 'pull', auth: 'To be confirmed' }]),
  octus: make('octus', [
    { protocol: 'MCP', label: 'Octus MCP', direction: 'pull', auth: 'To be confirmed' },
    { protocol: 'REST API', label: 'Octus API', direction: 'pull', auth: 'To be confirmed' },
  ]),
  igm: make('igm', [{ protocol: 'REST API', label: 'IGM APIHub', direction: 'pull', auth: 'token + company key' }]),
  cbonds: make('cbonds', [{ protocol: 'REST API', label: 'Cbonds API', direction: 'pull', auth: 'API key' }]),
  finsight: make('finsight', [{ protocol: 'REST API', label: 'CreditFlow API', direction: 'pull', auth: 'To be confirmed' }]),
  bondcliq: make('bondcliq', [
    { protocol: 'FIX', label: 'BondCliQ feed', direction: 'pull', auth: 'FIX session logon', fix: defaultFixSession() },
    { protocol: 'SFTP', label: 'BondCliQ SFTP', direction: 'pull', auth: 'To be confirmed' },
  ]),
  origin: make('origin', [{ protocol: 'REST API', label: 'Trades API', version: 'v3', direction: 'pull', auth: 'API key', endpoint: 'https://airbrush.originmarkets.com/v3', notes: 'API-Key header.', docsUrl: 'https://airbrush.originmarkets.com/v3/' }]),
  dealologic: make('dealologic', [{ protocol: 'SFTP', label: 'XML feed', direction: 'pull', auth: 'To be confirmed' }]),
  tradeweb: make('tradeweb', [
    { protocol: 'FIX', label: 'Tradeweb FIX', direction: 'pull', auth: 'FIX session logon', fix: defaultFixSession() },
    { protocol: 'REST API', label: 'Tradeweb API', direction: 'pull', auth: 'To be confirmed' },
  ]),
  marketaxess: make('marketaxess', [{ protocol: 'REST API', label: 'MarketAxess API', direction: 'pull', auth: 'To be confirmed' }]),
  edgar: make('edgar', [{ protocol: 'REST API', label: 'data.sec.gov', direction: 'pull', auth: 'none', endpoint: 'https://data.sec.gov', notes: 'No key; a declared User-Agent is required.', docsUrl: 'https://www.sec.gov/os/accessing-edgar-data' }]),
  cusip: make('cusip', [{ protocol: 'Web UI', label: 'CUSIP request', direction: 'push', auth: 'To be confirmed' }]),
  debtwire: email('debtwire'), kanganews: email('kanganews'), mni: email('mni'),
  prospectnews: email('prospectnews'), edi: email('edi'), ft: email('ft'),
};

export const tbcProfile = (vendorId: string): ConnectivityProfile => ({
  id: `${vendorId}-tbc`, protocol: 'To be confirmed', label: 'To be confirmed', direction: 'pull', environment: 'Production', auth: 'To be confirmed',
});

export function connectivityFor(v: { id: string; connectivity?: ConnectivityProfile[] }): ConnectivityProfile[] {
  if (v.connectivity && v.connectivity.length) return v.connectivity;
  if (!v.connectivity && DEFAULT_CONNECTIVITY[v.id]) return DEFAULT_CONNECTIVITY[v.id];
  return [tbcProfile(v.id)];
}

export function protocolChip(p: ConnectivityProfile): string {
  if (/security setup/i.test(p.label)) return 'Security setup';
  if (p.protocol === 'FIX') return p.version ? `FIX ${p.version}` : 'FIX';
  if (p.protocol === 'BLPAPI' && /b-pipe/i.test(p.label)) return 'B-PIPE';
  return p.protocol;
}

const SECRET_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;
function httpsError(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol !== 'https:' || u.username || u.password ? 'bad' : null;
  } catch { return 'bad'; }
}
function endpointOk(raw: string): boolean {
  if (/^https:\/\//i.test(raw)) return !httpsError(raw);
  if (/^sftp:\/\//i.test(raw)) { try { const u = new URL(raw); return !u.password; } catch { return false; } }
  const m = /^([A-Za-z0-9.-]+):(\d{1,5})$/.exec(raw);
  return Boolean(m && +m[2] >= 1 && +m[2] <= 65535);
}

export function validateProfile(p: ConnectivityProfile): string | null {
  const where = p.label?.trim() ? `"${p.label}"` : 'a connectivity profile';
  if (!p.label?.trim()) return 'Give each connectivity profile a label.';
  if (!PROTOCOLS.includes(p.protocol)) return `Choose a protocol for ${where}.`;
  if (!AUTH_METHODS.includes(p.auth)) return `Choose an auth method for ${where}.`;
  if (!DIRECTIONS.includes(p.direction)) return `Choose a direction for ${where}.`;
  if (!ENVIRONMENTS.includes(p.environment)) return `Choose UAT or Production for ${where}.`;
  if (p.endpoint && !endpointOk(p.endpoint)) return `Endpoint for ${where} must be an https URL, sftp:// address or host:port.`;
  if (p.docsUrl && httpsError(p.docsUrl)) return `Docs link for ${where} must be a public https URL.`;
  if (p.secretRef && !SECRET_NAME.test(p.secretRef)) return `Secret for ${where} must be a secret NAME like MY_VENDOR_KEY, never the value.`;
  if (p.protocol === 'FIX' && p.fix) {
    const f = p.fix;
    if (f.port !== undefined && (!Number.isInteger(f.port) || f.port < 1 || f.port > 65535)) return `FIX port for ${where} must be 1–65535.`;
    if (!Number.isInteger(f.heartbeatSec) || f.heartbeatSec < 1 || f.heartbeatSec > 300) return `FIX heartbeat for ${where} must be 1–300 seconds.`;
    if (!CERTIFICATIONS.includes(f.certification)) return `Choose a certification status for ${where}.`;
    if (f.certification !== 'Not started' && (!f.senderCompId.trim() || !f.targetCompId.trim())) return `SenderCompID and TargetCompID are required for ${where} once certified.`;
  }
  return null;
}

export function validateConnectivity(list: ConnectivityProfile[] | undefined): string | null {
  for (const p of list || []) { const e = validateProfile(p); if (e) return e; }
  return null;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);

/** Copy only known fields, so stray password/token/key fields are never persisted. */
export function sanitizeProfile(raw: unknown): ConnectivityProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const p: ConnectivityProfile = {
    id: str(r.id) || `p-${Math.random().toString(36).slice(2, 10)}`,
    protocol: r.protocol as ConnectivityProtocol,
    label: typeof r.label === 'string' ? r.label : '',
    direction: r.direction as ConnectorDirection,
    environment: r.environment as Environment,
    auth: r.auth as AuthMethod,
  };
  for (const k of ['version', 'endpoint', 'secretRef', 'licenceRef', 'notes', 'sdkVersion', 'docsUrl'] as const) {
    const v = str(r[k]); if (v) p[k] = v;
  }
  if (p.protocol === 'FIX' && r.fix && typeof r.fix === 'object') {
    const f = r.fix as Record<string, unknown>;
    const d = defaultFixSession();
    p.fix = {
      beginString: str(f.beginString) || d.beginString, applVerId: str(f.applVerId) || d.applVerId,
      senderCompId: typeof f.senderCompId === 'string' ? f.senderCompId : '', targetCompId: typeof f.targetCompId === 'string' ? f.targetCompId : '',
      host: typeof f.host === 'string' ? f.host : '',
      ...(typeof f.port === 'number' ? { port: f.port } : {}),
      heartbeatSec: typeof f.heartbeatSec === 'number' ? f.heartbeatSec : d.heartbeatSec,
      certification: (f.certification as Certification) || d.certification,
    };
  }
  return validateProfile(p) ? null : p;
}

export function sanitizeConnectivity(raw: unknown): ConnectivityProfile[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map(sanitizeProfile).filter((p): p is ConnectivityProfile => p !== null);
}
