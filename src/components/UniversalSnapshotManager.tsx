import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  Check,
  Copy,
  Crop,
  FileSpreadsheet,
  FileText,
  ImageDown,
  Loader2,
  MousePointerClick,
  Scan,
  X,
} from 'lucide-react';
import {
  captureElementToPngDataUrl,
  captureViewportCropToPng,
  copyPngDataUrlToClipboard,
  downloadPngDataUrl,
  exportDataUrlToPdf,
  exportElementToExcel,
  exportElementToPdf,
  findSnapTargetElement,
  inferElementLabel,
  type CropRect,
} from '../utils/snapshotExporter';

export type SnapshotMode = 'off' | 'pick' | 'crop';

interface UniversalSnapshotManagerProps {
  mode: SnapshotMode;
  hoverQuickBarEnabled: boolean;
  isDark: boolean;
  onChangeMode: (next: SnapshotMode) => void;
  onNotify: (title: string, detail: string, tone?: 'info' | 'success' | 'error') => void;
}

interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function getBoxRect(el: HTMLElement): BoxRect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
  };
}

export function UniversalSnapshotManager({
  mode,
  hoverQuickBarEnabled,
  isDark,
  onChangeMode,
  onNotify,
}: UniversalSnapshotManagerProps) {
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const [hoveredRect, setHoveredRect] = useState<BoxRect | null>(null);
  const [selectedEl, setSelectedEl] = useState<HTMLElement | null>(null);
  const [selectedRect, setSelectedRect] = useState<BoxRect | null>(null);

  // Freeform crop box state
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);

  const clearSelection = useCallback(() => {
    setSelectedEl(null);
    setSelectedRect(null);
    setCropRect(null);
    setIsDraggingCrop(false);
    dragOriginRef.current = null;
  }, []);

  // Reset states when mode changes
  useEffect(() => {
    clearSelection();
    if (mode === 'off') {
      setHoveredEl(null);
      setHoveredRect(null);
    }
  }, [mode, clearSelection]);

  // Global keyboard shortcuts: Escape closes mode, Ctrl+Shift+S toggles Pick mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedEl || cropRect) {
          clearSelection();
        } else if (mode !== 'off') {
          onChangeMode('off');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onChangeMode(mode === 'off' ? 'pick' : 'off');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, selectedEl, cropRect, clearSelection, onChangeMode]);

  // Keep highlight rectangle synced on scroll/resize
  useEffect(() => {
    const syncRects = () => {
      if (selectedEl && document.body.contains(selectedEl)) {
        setSelectedRect(getBoxRect(selectedEl));
      } else if (selectedEl) {
        setSelectedEl(null);
        setSelectedRect(null);
      }

      if (hoveredEl && document.body.contains(hoveredEl)) {
        setHoveredRect(getBoxRect(hoveredEl));
      } else if (hoveredEl) {
        setHoveredEl(null);
        setHoveredRect(null);
      }
    };

    window.addEventListener('scroll', syncRects, true);
    window.addEventListener('resize', syncRects);
    return () => {
      window.removeEventListener('scroll', syncRects, true);
      window.removeEventListener('resize', syncRects);
    };
  }, [selectedEl, hoveredEl]);

  // Track hovered card/section for BOTH ambient Quick-Hover Bar AND Pick Mode
  useEffect(() => {
    const shouldTrackHover =
      (mode === 'pick' && !selectedEl) || (mode === 'off' && hoverQuickBarEnabled);

    if (!shouldTrackHover) {
      if (mode !== 'pick') {
        setHoveredEl(null);
        setHoveredRect(null);
      }
      return;
    }

    let rafId = 0;
    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-snapshot-ignore="true"]')) {
        return;
      }

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // Only target elements inside main content or open dialog modals
        const inMainOrDialog =
          target?.closest('main') || target?.closest('[role="dialog"]');
        if (!inMainOrDialog) {
          setHoveredEl(null);
          setHoveredRect(null);
          return;
        }
        const found = findSnapTargetElement(target);
        if (found) {
          setHoveredEl(found);
          setHoveredRect(getBoxRect(found));
        } else {
          setHoveredEl(null);
          setHoveredRect(null);
        }
      });
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [mode, selectedEl, hoverQuickBarEnabled]);

  // Click capture in Pick Mode locks the hovered element
  useEffect(() => {
    if (mode !== 'pick' || selectedEl) return;

    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-snapshot-ignore="true"]')) return;

      const found = findSnapTargetElement(target) || hoveredEl;
      if (found) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedEl(found);
        setSelectedRect(getBoxRect(found));
      }
    };

    window.addEventListener('click', onClickCapture, true);
    return () => window.removeEventListener('click', onClickCapture, true);
  }, [mode, selectedEl, hoveredEl]);

  // Step Up to parent section or Step Down to child card when locked in Pick Mode
  const handleExpandParent = () => {
    if (!selectedEl || !selectedEl.parentElement) return;
    const parentTarget = findSnapTargetElement(selectedEl.parentElement);
    if (parentTarget && parentTarget !== selectedEl) {
      setSelectedEl(parentTarget);
      setSelectedRect(getBoxRect(parentTarget));
    } else {
      const mainEl = document.querySelector('main');
      if (mainEl instanceof HTMLElement && selectedEl !== mainEl) {
        setSelectedEl(mainEl);
        setSelectedRect(getBoxRect(mainEl));
      }
    }
  };

  const handleNarrowChild = () => {
    if (!selectedEl) return;
    const child = selectedEl.querySelector(
      'section, article, table, [class*="rounded-2xl"], [class*="rounded-xl"]',
    );
    if (child instanceof HTMLElement && child !== selectedEl) {
      setSelectedEl(child);
      setSelectedRect(getBoxRect(child));
    }
  };

  // Export Actions for any DOM element (large or tiny)
  const runElementAction = async (
    el: HTMLElement,
    action: 'copy' | 'png' | 'pdf' | 'xlsx',
  ) => {
    const label = inferElementLabel(el);
    setBusyAction(action);
    try {
      if (action === 'xlsx') {
        const { sheetCount, rowCount } = exportElementToExcel(el, label);
        onNotify(
          'Excel Exported (.xlsx)',
          `"${label}" saved (${sheetCount} sheet${sheetCount === 1 ? '' : 's'}, ${rowCount} rows).`,
          'success',
        );
      } else if (action === 'pdf') {
        await exportElementToPdf(el, { label, isDark });
        onNotify(
          'PDF Snapshot Exported',
          `"${label}" saved as high-resolution PDF with charts.`,
          'success',
        );
      } else if (action === 'png') {
        const url = await captureElementToPngDataUrl(el, { label, isDark });
        downloadPngDataUrl(url, label);
        onNotify(
          'PNG Snapshot Downloaded',
          `"${label}" saved as 2× high-DPI PNG.`,
          'success',
        );
      } else if (action === 'copy') {
        const url = await captureElementToPngDataUrl(el, { label, isDark });
        const result = await copyPngDataUrlToClipboard(url, label);
        setCopiedFlag(true);
        setTimeout(() => setCopiedFlag(false), 2000);
        if (result === 'copied') {
          onNotify(
            'Snapshot Copied to Clipboard',
            `"${label}" copied as PNG — press Ctrl+V to paste into WhatsApp, Email, or PowerPoint.`,
            'success',
          );
        } else {
          onNotify(
            'Snapshot Saved as PNG',
            `Browser restricted clipboard image write; downloaded "${label}.png" instead.`,
            'info',
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify('Snapshot Export Failed', msg || 'Could not capture this section.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  // Export Actions for Freeform Crop Box
  const runCropAction = async (action: 'copy' | 'png' | 'pdf') => {
    if (!cropRect || cropRect.width < 12 || cropRect.height < 12) return;
    const label = 'WG_Pulse_Custom_Area';
    setBusyAction(action);
    try {
      const dataUrl = await captureViewportCropToPng(cropRect, { isDark });
      if (action === 'png') {
        downloadPngDataUrl(dataUrl, label);
        onNotify('Area Snapshot Downloaded', 'Selected region saved as high-DPI PNG.', 'success');
      } else if (action === 'pdf') {
        await exportDataUrlToPdf(dataUrl, 'WG Pulse — Custom Area Snapshot');
        onNotify('Area PDF Exported', 'Selected region saved as PDF.', 'success');
      } else {
        const res = await copyPngDataUrlToClipboard(dataUrl, label);
        setCopiedFlag(true);
        setTimeout(() => setCopiedFlag(false), 2000);
        onNotify(
          res === 'copied' ? 'Area Snapshot Copied' : 'Area Snapshot Downloaded',
          res === 'copied'
            ? 'Selected area copied to clipboard — press Ctrl+V to paste.'
            : 'Clipboard blocked in frame; downloaded PNG instead.',
          res === 'copied' ? 'success' : 'info',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify('Area Capture Failed', msg || 'Could not capture selected area.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const runFullPageAction = async (action: 'copy' | 'png' | 'pdf' | 'xlsx') => {
    const mainEl = document.querySelector('main');
    if (!(mainEl instanceof HTMLElement)) return;
    await runElementAction(mainEl, action);
  };

  // Mouse handlers for Freeform Area Crop overlay
  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-crop-controls="true"]')) return;
    setIsDraggingCrop(true);
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    setCropRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCrop || !dragOriginRef.current) return;
    const ox = dragOriginRef.current.x;
    const oy = dragOriginRef.current.y;
    setCropRect({
      left: Math.min(ox, e.clientX),
      top: Math.min(oy, e.clientY),
      width: Math.abs(e.clientX - ox),
      height: Math.abs(e.clientY - oy),
    });
  };

  const handleCropMouseUp = () => {
    if (!isDraggingCrop) return;
    setIsDraggingCrop(false);
    if (cropRect && (cropRect.width < 16 || cropRect.height < 16)) {
      setCropRect(null);
    }
  };

  const activeHoverInOffMode =
    mode === 'off' && hoverQuickBarEnabled && hoveredEl && hoveredRect;

  return (
    <>
      {/* 1. AMBIENT QUICK-EXPORT PILL ON EVERY HOVERED SECTION / CARD (LARGE OR TINY) */}
      {activeHoverInOffMode && hoveredRect && hoveredEl && (
        <div
          data-snapshot-ignore="true"
          style={{
            position: 'fixed',
            top: Math.max(8, Math.min(window.innerHeight - 40, hoveredRect.top + 6)),
            left: Math.max(
              8,
              Math.min(window.innerWidth - 224, hoveredRect.left + hoveredRect.width - 216),
            ),
            zIndex: 45,
          }}
          className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-slate-900/90 dark:bg-slate-800/95 text-white border border-emerald-500/40 shadow-lg backdrop-blur-md"
        >
          <span
            className="text-[9px] font-mono text-emerald-300 px-1 max-w-[54px] truncate hidden sm:inline"
            title={inferElementLabel(hoveredEl)}
          >
            SNAP
          </span>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runElementAction(hoveredEl, 'copy')}
            title="Copy PNG Snapshot to Clipboard"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            {busyAction === 'copy' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : copiedFlag ? (
              <Check className="w-3 h-3 text-emerald-300" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            Copy
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runElementAction(hoveredEl, 'png')}
            title="Download PNG Snapshot"
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {busyAction === 'png' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ImageDown className="w-3 h-3" />
            )}
            PNG
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runElementAction(hoveredEl, 'pdf')}
            title="Export PDF (with Charts)"
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded hover:bg-rose-600 transition-colors disabled:opacity-50"
          >
            {busyAction === 'pdf' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileText className="w-3 h-3" />
            )}
            PDF
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runElementAction(hoveredEl, 'xlsx')}
            title="Export Excel (.xlsx)"
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            {busyAction === 'xlsx' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3 h-3" />
            )}
            XLS
          </button>
        </div>
      )}

      {/* 2. ACTIVE SNAPSHOT STUDIO TOP CONTROL BAR (WHEN PICK OR CROP MODE IS ACTIVE) */}
      {mode !== 'off' && (
        <div
          data-snapshot-ignore="true"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] max-w-[96vw] flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-950/95 text-white border border-emerald-500/50 shadow-2xl backdrop-blur-xl text-xs"
        >
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700">
            <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold whitespace-nowrap">Snapshot Studio</span>
          </div>

          <button
            type="button"
            onClick={() => onChangeMode('pick')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${
              mode === 'pick'
                ? 'bg-emerald-600 text-white'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            Pick Any Section / Card
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('crop')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${
              mode === 'crop'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            Drag Area Crop
          </button>

          <div className="hidden md:flex items-center gap-1 pl-2 border-l border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">
              Full Page:
            </span>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runFullPageAction('png')}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
            >
              PNG
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runFullPageAction('pdf')}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
            >
              PDF
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runFullPageAction('xlsx')}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
            >
              .xlsx
            </button>
          </div>

          <button
            type="button"
            onClick={() => onChangeMode('off')}
            aria-label="Exit Snapshot Mode"
            className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-semibold"
          >
            <X className="w-3.5 h-3.5" />
            Done
          </button>
        </div>
      )}

      {/* 3. PICK MODE: HOVER HIGHLIGHT BOX */}
      {mode === 'pick' && !selectedEl && hoveredEl && hoveredRect && (
        <div
          data-snapshot-ignore="true"
          style={{
            position: 'fixed',
            left: hoveredRect.left,
            top: hoveredRect.top,
            width: hoveredRect.width,
            height: hoveredRect.height,
            zIndex: 70,
            pointerEvents: 'none',
          }}
          className="rounded-xl border-2 border-emerald-500 bg-emerald-500/10 transition-all duration-75"
        >
          <div className="absolute -top-6 left-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-mono font-semibold shadow-md max-w-[320px] truncate">
            <Scan className="w-3 h-3 shrink-0" />
            <span>{inferElementLabel(hoveredEl)}</span>
            <span className="opacity-80">
              ({Math.round(hoveredRect.width)}×{Math.round(hoveredRect.height)})
            </span>
          </div>
        </div>
      )}

      {/* 4. PICK MODE: LOCKED SELECTION BOX + ACTION BAR */}
      {mode === 'pick' && selectedEl && selectedRect && (
        <>
          <div
            data-snapshot-ignore="true"
            style={{
              position: 'fixed',
              left: selectedRect.left,
              top: selectedRect.top,
              width: selectedRect.width,
              height: selectedRect.height,
              zIndex: 74,
              pointerEvents: 'none',
            }}
            className="rounded-xl border-2 border-emerald-500 ring-4 ring-emerald-500/25 bg-emerald-500/5"
          />

          <div
            data-snapshot-ignore="true"
            style={{
              position: 'fixed',
              top: Math.max(
                68,
                Math.min(window.innerHeight - 64, selectedRect.top + selectedRect.height + 10),
              ),
              left: Math.max(
                12,
                Math.min(window.innerWidth - 520, selectedRect.left),
              ),
              zIndex: 82,
            }}
            className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-950/95 text-white border border-emerald-500/50 shadow-2xl backdrop-blur-xl text-xs"
          >
            <span className="font-mono text-[11px] text-emerald-300 max-w-[160px] truncate pr-1">
              {inferElementLabel(selectedEl)}
            </span>

            <button
              type="button"
              onClick={handleExpandParent}
              title="Select larger parent section"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium"
            >
              <ArrowUpFromLine className="w-3 h-3" />
              Larger
            </button>
            <button
              type="button"
              onClick={handleNarrowChild}
              title="Select smaller card inside"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium"
            >
              <ArrowDownToLine className="w-3 h-3" />
              Smaller
            </button>

            <div className="h-4 w-px bg-slate-700 mx-0.5" />

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runElementAction(selectedEl, 'copy')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-50"
            >
              {busyAction === 'copy' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : copiedFlag ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy PNG
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runElementAction(selectedEl, 'png')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold disabled:opacity-50"
            >
              {busyAction === 'png' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageDown className="w-3.5 h-3.5" />
              )}
              PNG
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runElementAction(selectedEl, 'pdf')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold disabled:opacity-50"
            >
              {busyAction === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              PDF
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runElementAction(selectedEl, 'xlsx')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 font-semibold disabled:opacity-50"
            >
              {busyAction === 'xlsx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              .xlsx
            </button>

            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}

      {/* 5. FREEFORM DRAG-TO-CROP AREA OVERLAY (CAPTURE ANYWHERE ON SCREEN) */}
      {mode === 'crop' && (
        <div
          data-snapshot-ignore="true"
          onMouseDown={handleCropMouseDown}
          onMouseMove={handleCropMouseMove}
          onMouseUp={handleCropMouseUp}
          className="fixed inset-0 z-[72] cursor-crosshair bg-slate-950/25 select-none"
        >
          {!cropRect && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-slate-950/90 text-white text-xs font-medium border border-white/15 shadow-lg pointer-events-none">
              Click and drag anywhere on the screen to draw your snapshot box (press Esc to cancel)
            </div>
          )}

          {cropRect && cropRect.width > 4 && cropRect.height > 4 && (
            <>
              <div
                style={{
                  position: 'fixed',
                  left: cropRect.left,
                  top: cropRect.top,
                  width: cropRect.width,
                  height: cropRect.height,
                }}
                className="border-2 border-blue-400 bg-blue-500/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)] pointer-events-none"
              >
                <span className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-mono font-semibold">
                  {Math.round(cropRect.width)} × {Math.round(cropRect.height)} px
                </span>
              </div>

              {!isDraggingCrop && (
                <div
                  data-crop-controls="true"
                  style={{
                    position: 'fixed',
                    top: Math.max(
                      68,
                      Math.min(window.innerHeight - 60, cropRect.top + cropRect.height + 10),
                    ),
                    left: Math.max(12, Math.min(window.innerWidth - 360, cropRect.left)),
                    zIndex: 85,
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-950/95 text-white border border-blue-400/50 shadow-2xl text-xs"
                >
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runCropAction('copy')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-50"
                  >
                    {busyAction === 'copy' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : copiedFlag ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copy PNG
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runCropAction('png')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold disabled:opacity-50"
                  >
                    {busyAction === 'png' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageDown className="w-3.5 h-3.5" />
                    )}
                    PNG
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runCropAction('pdf')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold disabled:opacity-50"
                  >
                    {busyAction === 'pdf' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropRect(null)}
                    aria-label="Reset crop area"
                    className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
