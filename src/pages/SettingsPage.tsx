import { Link } from 'react-router-dom';
import { Settings, ClipboardList, ChevronRight } from 'lucide-react';
import AiModelPicker from '@/components/AiModelPicker';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="rounded-lg border divide-y">
        {[
          { to: '/bond-console', label: 'Bond Console', desc: 'Market data, connectors, vendors and syndicate tools.', icon: Settings },
          { to: '/audit-log', label: 'Audit Log', desc: 'Record of all platform actions.', icon: ClipboardList },
        ].map(({ to, label, desc, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{label}</div>
              <div className="text-sm text-muted-foreground">{desc}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </section>
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">AI model</h2>
        <p className="text-sm text-muted-foreground">
          Used for document extraction, chat extraction (AI DataParse) and New Issue Bulletin generation.
          You can also switch it from inside each AI tool.
        </p>
        <AiModelPicker />
      </section>
    </div>
  );
}
