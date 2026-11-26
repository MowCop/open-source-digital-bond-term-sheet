import { useRef } from "react";
import { Grip, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// AI Elements has no resizable draft-dialog primitive. Keep this presentation-only
// extension on the existing controlled draft and send callback, not a second chat.
export default function CopilotDraftDialog({
  open, onOpenChange, text, onTextChange, onSend, busy, onContract, borrowerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  onTextChange: (text: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
  onContract: () => void;
  borrowerName: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; width: number; height: number }>();
  const move = useRef<{ x: number; y: number; left: number; top: number }>();
  const position = (left: number, top: number, width: number, height: number) => {
    const element = dialog.current;
    if (!element) return;
    element.style.left = `${Math.max(16, Math.min(window.innerWidth - width - 16, left)) + width / 2}px`;
    element.style.top = `${Math.max(16, Math.min(window.innerHeight - height - 16, top)) + height / 2}px`;
  };
  const resize = (width: number, height: number) => {
    const element = dialog.current;
    if (!element) return;
    const maxWidth = window.innerWidth - 32;
    const maxHeight = window.innerHeight - 32;
    const bounds = element.getBoundingClientRect();
    const nextWidth = Math.min(maxWidth, Math.max(Math.min(320, maxWidth), width));
    const nextHeight = Math.min(maxHeight, Math.max(Math.min(240, maxHeight), height));
    element.style.width = `${nextWidth}px`;
    element.style.height = `${nextHeight}px`;
    position(bounds.x + (bounds.width - nextWidth) / 2, bounds.y + (bounds.height - nextHeight) / 2, nextWidth, nextHeight);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialog}
        className="copilot-draft-dialog"
        aria-describedby={undefined}
        onPointerDownOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onContract();
        }}
      >
        <DialogTitle
          className="shrink-0 touch-none select-none cursor-grab break-words pr-10 text-left leading-snug active:cursor-grabbing"
          title="Move window"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const bounds = dialog.current?.getBoundingClientRect();
            if (!bounds) return;
            event.preventDefault();
            move.current = { x: event.clientX, y: event.clientY, left: bounds.x, top: bounds.y };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = move.current;
            const bounds = dialog.current?.getBoundingClientRect();
            if (!start || !bounds) return;
            position(start.left + event.clientX - start.x, start.top + event.clientY - start.y, bounds.width, bounds.height);
          }}
          onPointerUp={() => { move.current = undefined; }}
          onPointerCancel={() => { move.current = undefined; }}
          onLostPointerCapture={() => { move.current = undefined; }}
        >
          Deal Co-Pilot{borrowerName ? ` Focus on ‘${borrowerName}’` : ""}
        </DialogTitle>
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
            <Button type="submit" size="icon" disabled={busy || !text.trim()} className="h-8 w-8" aria-label="Send" title="Send">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Resize Deal Co-Pilot window"
          title="Resize window"
          className="absolute bottom-0 right-0 h-6 w-6 touch-none cursor-nwse-resize p-0"
          onPointerDown={(event) => {
            const element = dialog.current;
            if (!element) return;
            event.preventDefault();
            const bounds = element.getBoundingClientRect();
            drag.current = { x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start) return;
            // The dialog stays centered: each dragged edge moves half the size delta.
            resize(start.width + 2 * (event.clientX - start.x), start.height + 2 * (event.clientY - start.y));
          }}
          onPointerUp={() => { drag.current = undefined; }}
          onPointerCancel={() => { drag.current = undefined; }}
          onLostPointerCapture={() => { drag.current = undefined; }}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const bounds = dialog.current?.getBoundingClientRect();
            if (!bounds) return;
            resize(bounds.width + (event.key === "ArrowRight" ? 20 : event.key === "ArrowLeft" ? -20 : 0),
              bounds.height + (event.key === "ArrowDown" ? 20 : event.key === "ArrowUp" ? -20 : 0));
          }}
        >
          <Grip className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}