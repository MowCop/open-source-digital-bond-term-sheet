/**
 * Document ingest panel — drop a term sheet, final terms or BDT XML file, or
 * pick one with "Choose file". It only collects the files; the caller parses
 * them and queues proposed values for review. Nothing is applied without
 * acceptance, so this component holds no deal state of its own.
 */
import { useRef, useState } from 'react';
import { FileUp, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** Called with the dropped/picked files. Resolves when parsing finishes. */
  onFiles: (files: FileList) => void | Promise<unknown>;
  disabled?: boolean;
  className?: string;
}

const ACCEPT = '.pdf,.docx,.xml,.html,.htm,.txt';
const HINT = 'Drop a term sheet, final terms or BDT XML file here to propose values';

export default function IngestDropzone({ onFiles, disabled, className }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      await onFiles(files);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); void run(e.dataTransfer.files); }}
      title={HINT}
      className={[
        'flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors',
        dragOver ? 'border-primary bg-primary/10' : 'border-input bg-background',
        className ?? '',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={ACCEPT}
        onChange={e => { void run(e.target.files); e.target.value = ''; }}
      />
      {busy
        ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        : <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className="hidden max-w-[300px] truncate text-xs text-muted-foreground lg:inline">{HINT}</span>
      <span className="text-xs text-muted-foreground lg:hidden">Drop document</span>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => inputRef.current?.click()} disabled={busy || disabled}>
        <Sparkles className="h-3.5 w-3.5 mr-1" /> Choose file
      </Button>
    </div>
  );
}
