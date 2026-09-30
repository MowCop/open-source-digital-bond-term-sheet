/**
 * Renders ONE field from the ICMA BDT 2.0 dictionary.
 * The definition (label, type, options, hint, placeholder, requirement) always
 * comes from the FIELDS entry passed in — there is no second field list.
 */
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { E } from '@/lib/termsheet/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FieldDef = any;

const NONE = '__none__';

export function optionsFor(fd: FieldDef): string[] {
  if (!fd?.e) return [];
  if (Array.isArray(fd.e)) return fd.e as string[];
  return ((E as Record<string, string[]>)[fd.e] ?? []);
}

export const prettyEnum = (v: string) =>
  v.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

interface Props {
  fd: FieldDef;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: string | null;
  proposed?: boolean;
}

export default function TermSheetField({ fd, value, onChange, disabled, required, invalid, proposed }: Props) {
  const id = `f-${fd.p}`;
  const auto = !!fd.auto || !!fd.fixed;
  const ro = disabled || auto;

  const ring = invalid
    ? 'border-destructive/70 focus-visible:ring-destructive/40'
    : proposed
      ? 'border-[hsl(var(--primary))] focus-visible:ring-[hsl(var(--primary))]/40'
      : '';

  return (
    <div className="space-y-1.5 min-w-0">
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="truncate">{fd.l}</span>
        {required && <span className="text-destructive text-[10px] leading-none">required</span>}
        {fd.ext && (
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60 border border-border/60 rounded px-1">
            envelope
          </span>
        )}
      </label>

      {fd.t === 'ta' ? (
        <Textarea
          id={id}
          value={value}
          disabled={ro}
          rows={3}
          placeholder={fd.ph}
          onChange={e => onChange(e.target.value)}
          className={`text-sm ${ring}`}
        />
      ) : fd.t === 'sel' ? (
        <Select value={value || NONE} disabled={ro} onValueChange={v => onChange(v === NONE ? '' : v)}>
          <SelectTrigger id={id} className={`h-9 text-sm ${ring}`}>
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={NONE}>Not set</SelectItem>
            {optionsFor(fd).map(o => (
              <SelectItem key={o} value={o}>{prettyEnum(o)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : fd.t === 'bool' ? (
        <div className="flex h-9 items-center gap-2">
          <Switch
            id={id}
            checked={value === 'true'}
            disabled={ro}
            onCheckedChange={c => onChange(c ? 'true' : 'false')}
          />
          <span className="text-sm text-muted-foreground">{value === 'true' ? 'Yes' : 'No'}</span>
        </div>
      ) : (
        <Input
          id={id}
          type={fd.t === 'date' ? 'date' : fd.t === 'num' ? 'number' : 'text'}
          step={fd.step}
          value={value}
          disabled={ro}
          placeholder={fd.ph}
          onChange={e => onChange(e.target.value)}
          className={`h-9 text-sm ${ring}`}
        />
      )}

      {invalid ? (
        <p className="text-[11px] text-destructive">{invalid}</p>
      ) : fd.hint ? (
        <p className="text-[11px] leading-snug text-muted-foreground/70">{fd.hint}</p>
      ) : auto ? (
        <p className="text-[11px] text-muted-foreground/60">Maintained automatically.</p>
      ) : null}
    </div>
  );
}
