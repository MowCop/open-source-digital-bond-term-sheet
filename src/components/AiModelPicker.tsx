import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AI_MODELS, AiModelId, useAiModel } from '@/lib/aiModel';
import { Sparkles } from 'lucide-react';

export default function AiModelPicker({ compact = false }: { compact?: boolean }) {
  const [model, setModel] = useAiModel();
  return (
    <Select value={model} onValueChange={v => setModel(v as AiModelId)}>
      <SelectTrigger aria-label="AI model" className={compact ? 'h-8 w-[170px] text-xs' : 'w-full max-w-sm'}>
        <Sparkles className="h-3.5 w-3.5 mr-1 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AI_MODELS.map(m => (
          <SelectItem key={m.id} value={m.id}>
            {m.label}{!compact && <span className="ml-2 text-muted-foreground text-xs">{m.note}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
