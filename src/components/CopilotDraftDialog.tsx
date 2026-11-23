import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// AI Elements has no resizable draft-dialog primitive. Keep this presentation-only
// extension on the existing controlled draft and send callback, not a second chat.
export default function CopilotDraftDialog({
  open, onOpenChange, text, onTextChange, onSend, busy, onContract,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onTextChange: (text: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
  onContract: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="copilot-draft-dialog"
        aria-describedby={undefined}
        onPointerDownOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onContract();
        }}
      >
        <DialogTitle className="shrink-0 pr-10 text-left">Deal Co-Pilot</DialogTitle>
        <form
          className="flex min-h-0 flex-1 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim() || busy) return;
            onSend(text);
            onOpenChange(false);
          }}
        >
          <Textarea
            aria-label="Expanded message Deal Co-Pilot"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            maxLength={12000}
            placeholder="Ask a question or request a change…"
            className="min-h-0 flex-1 resize-none text-base leading-relaxed"
          />
          <div className="flex shrink-0 justify-end">
            <Button type="submit" disabled={busy || !text.trim()} className="h-9 gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}