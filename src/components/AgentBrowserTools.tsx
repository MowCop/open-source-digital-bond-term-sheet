import { useNavigate } from 'react-router-dom';
import { useWebMCP } from 'use-webmcp-tool';
import { useApp } from '@/context/AppContext';
import { runWebMCPTool } from '@/lib/webmcp-telemetry';

const PAGES: Record<string, string> = {
  board: '/messages', term_sheet: '/deals', bond_console: '/bond-console', settings: '/settings',
};

/** Browser-local agent tools: read the deals the user can see, and open main pages. */
export default function AgentBrowserTools() {
  const { deals } = useApp();
  const navigate = useNavigate();

  useWebMCP({
    name: 'list_visible_deals',
    description: 'List the deals the signed-in user can currently see (issuer, currency, stage).',
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => runWebMCPTool('list_visible_deals', () =>
      deals.length === 0
        ? 'No deals shown.'
        : deals.slice(0, 100).map((d) => `${d.id}: ${d.issuerName} — ${d.currency ?? ''} — ${d.stage}`).join('\n')),
  });

  useWebMCP({
    name: 'open_page',
    description: 'Open a main page: board (New Issue Board), term_sheet (Digital Term Sheet), bond_console or settings.',
    inputSchema: {
      type: 'object',
      properties: { page: { type: 'string', enum: Object.keys(PAGES), description: 'Which page to open.' } },
      required: ['page'],
    },
    execute: ({ page }: { page: string }) => runWebMCPTool('open_page', () => {
      const path = PAGES[page];
      if (typeof page !== 'string' || !path) throw new Error('Unknown page.');
      navigate(path);
      return `Opened ${page}.`;
    }),
  });

  return null;
}
