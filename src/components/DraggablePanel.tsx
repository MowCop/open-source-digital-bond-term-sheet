import { useCallback, useRef, useState, type ReactNode } from 'react';

interface DraggablePanelProps {
  title: string;
  headerActions?: ReactNode;
  /** Centered header content, e.g. a logo placed beside the title. */
  headerCenter?: ReactNode;
  children: ReactNode;
  /** Collapse the body, leaving only the title bar. */
  collapsed?: boolean;
  initialWidth?: number;
  initialHeight?: number;
  className?: string;
}

const MIN_W = 300;
const MIN_H = 240;

/**
 * A fixed-position floating panel that can be dragged by its title bar and
 * resized from any edge or corner. Rendered with `position: fixed` so it is
 * never clipped by the surrounding dialog/overflow containers.
 */
export default function DraggablePanel({
  title,
  headerActions,
  children,
  collapsed = false,
  initialWidth = 400,
  initialHeight = 460,
  className = '',
}: DraggablePanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: initialWidth, h: initialHeight });
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest('button')) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    dragState.current = { pointerId: e.pointerId, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    setPos({ top: rect.top, left: rect.left });
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(e.clientX - s.offsetX, 80 - size.w), vw - 80);
    const top = Math.min(Math.max(e.clientY - s.offsetY, 0), vh - 60);
    setPos({ top, left });
  }, [size.w]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (!s || s.pointerId !== e.pointerId) return;
    dragState.current = null;
    setDragging(false);
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }, []);

  const startResize = (dir: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = node.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { top: rect.top, left: rect.left, w: rect.width, h: rect.height };
    setPos({ top: rect.top, left: rect.left });
    setSize({ w: rect.width, h: rect.height });

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let { top, left, w, h } = start;
      if (dir.includes('e')) w = start.w + dx;
      if (dir.includes('s')) h = start.h + dy;
      if (dir.includes('w')) { w = start.w - dx; left = start.left + dx; }
      if (dir.includes('n')) { h = start.h - dy; top = start.top + dy; }
      if (w < MIN_W) { if (dir.includes('w')) left = start.left + (start.w - MIN_W); w = MIN_W; }
      if (h < MIN_H) { if (dir.includes('n')) top = start.top + (start.h - MIN_H); h = MIN_H; }
      w = Math.min(w, window.innerWidth - 16);
      h = Math.min(h, window.innerHeight - 16);
      setSize({ w, h });
      setPos({ top: Math.max(0, top), left });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handles: { dir: string; cls: string }[] = [
    { dir: 'n', cls: 'top-0 left-3 right-3 h-1.5 cursor-ns-resize' },
    { dir: 's', cls: 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize' },
    { dir: 'w', cls: 'left-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
    { dir: 'e', cls: 'right-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
    { dir: 'nw', cls: 'top-0 left-0 h-3 w-3 cursor-nwse-resize' },
    { dir: 'ne', cls: 'top-0 right-0 h-3 w-3 cursor-nesw-resize' },
    { dir: 'sw', cls: 'bottom-0 left-0 h-3 w-3 cursor-nesw-resize' },
    { dir: 'se', cls: 'bottom-0 right-0 h-3 w-3 cursor-nwse-resize' },
  ];

  const positioned = pos !== null;

  return (
    <div
      ref={ref}
      role="complementary"
      aria-label={title}
      style={{
        width: size.w,
        height: collapsed ? undefined : size.h,
        ...(positioned ? { top: pos!.top, left: pos!.left } : {}),
      }}
      className={`fixed z-[60] max-w-[calc(100vw-1rem)] rounded-lg bg-card shadow-2xl flex flex-col overflow-hidden
        ${positioned ? '' : 'bottom-6 right-6'} ${className}`}
    >
      {!collapsed && handles.map(h => (
        <div key={h.dir} aria-hidden onPointerDown={startResize(h.dir)} className={`absolute z-20 ${h.cls}`} />
      ))}

      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`flex items-center justify-between gap-2 px-3 py-2 shrink-0 border-b border-border/50 bg-muted/40 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {title}
        </span>
        <div className="flex items-center gap-1">{headerActions}</div>
      </div>

      {!collapsed && <div className="flex-1 min-h-0 flex flex-col">{children}</div>}
    </div>
  );
}
