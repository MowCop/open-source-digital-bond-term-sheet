import { useEffect, useState } from 'react';

export const AI_MODELS = [
  { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Fastest' },
  { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Balanced (default)' },
  { id: 'anthropic/claude-opus-5', label: 'Claude Opus 5', note: 'Deep reasoning' },
  { id: 'anthropic/claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Most capable' },
  { id: 'anthropic/claude-fable-5-1', label: 'Claude Fable 5.1', note: 'Writing-focused' },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]['id'];
export const DEFAULT_AI_MODEL: AiModelId = 'anthropic/claude-sonnet-5';
const KEY = 'vdr.aiModel';
const EVT = 'vdr-ai-model-change';

export function getAiModel(): AiModelId {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  return AI_MODELS.some(m => m.id === v) ? (v as AiModelId) : DEFAULT_AI_MODEL;
}

export function setAiModel(id: AiModelId) {
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new Event(EVT));
}

export function useAiModel(): [AiModelId, (id: AiModelId) => void] {
  const [model, setModel] = useState<AiModelId>(getAiModel);
  useEffect(() => {
    const sync = () => setModel(getAiModel());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return [model, setAiModel];
}
