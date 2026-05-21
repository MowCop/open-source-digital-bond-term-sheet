import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minimize2 } from 'lucide-react';
import SecureChat from '@/components/SecureChat';

interface ChatModalDialogProps {
  open: boolean;
  activeDealId: string | null;
  onClose: () => void;
  onCollapseToPanel: () => void;
}

/**
 * Full Modal Dialog shell for the Deal Chat. Larger surface, dimmed backdrop,
 * focus-trapped, closes on backdrop click, Esc, or the built-in X. A Collapse
 * action returns the user to the floating panel without losing context.
 */
export default function ChatModalDialog({ open, activeDealId, onClose, onCollapseToPanel }: ChatModalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="p-0 max-w-3xl w-[min(900px,95vw)] h-[min(80vh,720px)] overflow-hidden">
        <SecureChat
          activeDealId={activeDealId}
          heightClass="h-full"
          headerActions={
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Collapse to floating panel"
              onClick={onCollapseToPanel}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  );
}