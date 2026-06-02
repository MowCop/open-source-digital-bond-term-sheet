import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Maximize2, GripHorizontal } from 'lucide-react';
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
const DRAG_HANDLE_HEIGHT = 64; // px from top of panel that act as drag region
const EDGE_MARGIN = 80; // keep at least this much of the panel on-screen

export default function FloatingChatPanel({ activeDealId, onClose, onExpandToModal }: FloatingChatPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

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

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;

  const isInteractive = (el: EventTarget | null) => {
    if (!(el instanceof Element)) return false;
    return !!el.closest('button, a, input, textarea, select, [role="listbox"], [role="option"], [role="combobox"], [role="menu"], [role="menuitem"]');
  };

  const inDragRegion = (e: React.PointerEvent) => {
    const node = ref.current;
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    return e.clientY - rect.top <= DRAG_HANDLE_HEIGHT;
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile) return;
    if (isInteractive(e.target)) return;
    if (!inDragRegion(e)) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    dragState.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    // Lock current position so the panel doesn't jump from bottom-right anchor
    setPos({ top: rect.top, left: rect.left });
    setDragging(true);
    node.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [isMobile]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = e.clientX - s.offsetX;
    let top = e.clientY - s.offsetY;
    left = Math.min(Math.max(left, EDGE_MARGIN - rect.width), vw - EDGE_MARGIN);
    top = Math.min(Math.max(top, 0), vh - EDGE_MARGIN);
    setPos({ top, left });
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (!s || s.pointerId !== e.pointerId) return;
    dragState.current = null;
    setDragging(false);
    const node = ref.current;
    if (node && node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
  }, []);

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInteractive(e.target)) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (e.clientY - rect.top > DRAG_HANDLE_HEIGHT) return;
    setPos(null);
  };

  const positioned = pos !== null;

  return (
    <div
      ref={ref}
      role="complementary"
      aria-label="Deal Chat"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      style={positioned ? { top: pos!.top, left: pos!.left, bottom: 'auto', right: 'auto' } : undefined}
      className={`fixed z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[70vh] max-h-[640px] rounded-lg border border-border bg-background animate-in fade-in-0 zoom-in-95 origin-bottom-right
        ${dragging ? 'shadow-[0_30px_80px_-10px_rgba(0,0,0,0.6)] select-none' : 'shadow-2xl'}
        ${positioned ? '' : 'bottom-4 right-4'}
        max-[900px]:inset-x-2 max-[900px]:bottom-2 max-[900px]:top-auto max-[900px]:left-auto max-[900px]:w-auto max-[900px]:h-[70vh]`}
    >
      {!isMobile && (
        <div
          aria-hidden
          title="Drag to move · double-click to reset"
          className={`absolute top-1.5 left-2 z-10 text-muted-foreground/60 pointer-events-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <GripHorizontal className="h-3.5 w-3.5" />
        </div>
      )}
      <SecureChat
        key={activeDealId || 'all-chats'}
        activeDealId={activeDealId}
        heightClass="h-full"
        allowDealAccess
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