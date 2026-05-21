import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Maximize2 } from 'lucide-react';
import SecureChat from '@/components/SecureChat';

interface FloatingChatPanelProps {
  activeDealId: string | null;
  onClose: () => void;
  onExpandToModal: () => void;
}

/**
 * Non-modal floating chat panel pinned to the bottom-right of the viewport.
 * - Esc closes
 * - X button closes
 * - Expand button promotes the panel to a full modal dialog
 * The Issue Board underneath stays scrollable and clickable.
 */
export default function FloatingChatPanel({ activeDealId, onClose, onExpandToModal }: FloatingChatPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Don't steal Esc from open dialogs/popovers
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="complementary"
      aria-label="Deal Chat"
      className="fixed z-50 bottom-4 right-4 w-[380px] max-w-[calc(100vw-2rem)] h-[70vh] max-h-[640px] shadow-2xl rounded-lg border border-border bg-background animate-in fade-in-0 zoom-in-95 origin-bottom-right
        max-[900px]:inset-x-2 max-[900px]:bottom-2 max-[900px]:w-auto max-[900px]:h-[70vh]"
    >
      <SecureChat
        activeDealId={activeDealId}
        heightClass="h-full"
        headerActions={
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Expand to dialog"
              onClick={onExpandToModal}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Close (Esc)"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />
    </div>
  );
}