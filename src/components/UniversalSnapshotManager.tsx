import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  Check,
  Copy,
  Crop,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  ImageDown,
  Loader2,
  MessageCircle,
  MousePointerClick,
  Scan,
  X,
} from 'lucide-react';
import {
  buildWhatsAppLink,
  captureElementToPngDataUrl,
  captureViewportCropToPng,
  copyPngDataUrlToClipboard,
  downloadPngDataUrl,
  exportDataUrlToPdf,
  exportElementToExcel,
  exportElementToPdf,
  findSnapTargetElement,
  inferElementLabel,
  prepareWhatsAppShareForCrop,
  prepareWhatsAppShareForElement,
  type CropRect,
  type WhatsAppShareResult,
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

  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);

  // WhatsApp Share modal state (for PNG, PDF, or XLSX handoff on Desktop/Windows)
  const [waShareModal, setWaShareModal] = useState<WhatsAppShareResult | null>(null);
  const [waPhone, setWaPhone] = useState('');
  const [waCustomNote, setWaCustomNote] = useState('');
  const [waMenuOpenFor, setWaMenuOpenFor] = useState<'hover' | 'pick' | 'crop' | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedEl(null);
    setSelectedRect(null);
    setCropRect(null);
    setIsDraggingCrop(false);
    setWaMenuOpenFor(null);
    dragOriginRef.current = null;
  }, []);

  useEffect(() => {
    clearSelection();
    if (mode === 'off') {
      setHoveredEl(null);
      setHoveredRect(null);
    }
  }, [mode, clearSelection]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (waShareModal) {
          setWaShareModal(null);
        } else if (selectedEl || cropRect) {
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
  }, [mode, selectedEl, cropRect, waShareModal, clearSelection, onChangeMode]);

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

  useEffect(() => {
    const shouldTrackHover =
      !waShareModal &&
      ((mode === 'pick' && !selectedEl) || (mode === 'off' && hoverQuickBarEnabled));

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
        const inMainOrDialog =
          target?.closest('main') || target?.closest('[role="dialog"]');
        if (!inMainOrDialog) {
          setHoveredEl(null);
          setHoveredRect(null);
          setWaMenuOpenFor(null);
          return;
        }
        const found = findSnapTargetElement(target);
        if (found) {
          setHoveredEl(found);
          setHoveredRect(getBoxRect(found));
        } else {
          setHoveredEl(null);
          setHoveredRect(null);
          setWaMenuOpenFor(null);
        }
      });
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [mode, selectedEl, hoverQuickBarEnabled, waShareModal]);

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

  const runElementAction = async (
    el: HTMLElement,
    action: 'copy' | 'png' | 'pdf' | 'xlsx',
  ) => {
    const label = inferElementLabel(el);
    setBusyAction(action);
    setWaMenuOpenFor(null);
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
            `"${label}" copied as PNG — press Ctrl+V in WhatsApp, Email, or PowerPoint.`,
            'success',
          );
        } else {
          onNotify(
            'Snapshot Saved as PNG',
            `Browser restricted clipboard write; downloaded "${label}.png" instead.`,
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

  const runWhatsAppElementShare = async (
    el: HTMLElement,
    format: 'png' | 'pdf' | 'xlsx',
  ) => {
    const label = inferElementLabel(el);
    setBusyAction(`wa_${format}`);
    setWaMenuOpenFor(null);
    try {
      const result = await prepareWhatsAppShareForElement(el, format, {
        label,
        isDark,
      });
      if (result.mode === 'native_share') {
        onNotify(
          'Shared via System Share Sheet',
          `${result.fileName} handed off cleanly.`,
          'success',
        );
      } else {
        setWaCustomNote(result.summaryText);
        setWaShareModal(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify('WhatsApp Share Failed', msg || 'Could not prepare file for WhatsApp.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

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
        await exportDataUrlToPdf(dataUrl, 'Commercial Credit — Custom Area Snapshot');
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

  const runWhatsAppCropShare = async (format: 'png' | 'pdf') => {
    if (!cropRect || cropRect.width < 12 || cropRect.height < 12) return;
    setBusyAction(`wa_${format}`);
    setWaMenuOpenFor(null);
    try {
      const result = await prepareWhatsAppShareForCrop(cropRect, format, { isDark });
      if (result.mode === 'native_share') {
        onNotify('Area Snapshot Shared', `${result.fileName} shared cleanly.`, 'success');
      } else {
        setWaCustomNote(result.summaryText);
        setWaShareModal(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify('WhatsApp Share Failed', msg || 'Could not prepare area capture.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const runFullPageAction = async (action: 'copy' | 'png' | 'pdf' | 'xlsx') => {
    const mainEl = document.querySelector('main');
    if (!(mainEl instanceof HTMLElement)) return;
    await runElementAction(mainEl, action);
  };

  const runFullPageWhatsApp = async (format: 'png' | 'pdf' | 'xlsx') => {
    const mainEl = document.querySelector('main');
    if (!(mainEl instanceof HTMLElement)) return;
    await runWhatsAppElementShare(mainEl, format);
  };

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
    mode === 'off' && hoverQuickBarEnabled && hoveredEl && hoveredRect && !waShareModal;

  return (
    <>
      {/* 1. AMBIENT QUICK-EXPORT & WHATSAPP BAR ON EVERY HOVERED SECTION / CARD */}
      {activeHoverInOffMode && hoveredRect && hoveredEl && (
        <div
          data-snapshot-ignore="true"
          style={{
            position: 'fixed',
            top: Math.max(8, Math.min(window.innerHeight - 44, hoveredRect.top + 6)),
            left: Math.max(
              8,
              Math.min(window.innerWidth - 298, hoveredRect.left + hoveredRect.width - 290),
            ),
            zIndex: 45,
          }}
          className="relative flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-zinc-900/92 text-white border border-red-500/40 shadow-lg backdrop-blur-md"
        >
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runElementAction(hoveredEl, 'copy')}
            title="Copy PNG Snapshot to Clipboard"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {busyAction === 'copy' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : copiedFlag ? (
              <Check className="w-3 h-3 text-emerald-400" />
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
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded hover:bg-zinc-700 transition-colors disabled:opacity-50"
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
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded hover:bg-red-700 transition-colors disabled:opacity-50"
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
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {busyAction === 'xlsx' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3 h-3" />
            )}
            XLS
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() =>
              setWaMenuOpenFor((prev) => (prev === 'hover' ? null : 'hover'))
            }
            title="Share PNG, PDF, or Excel via WhatsApp"
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            <MessageCircle className="w-3 h-3" />
            WA
          </button>

          {waMenuOpenFor === 'hover' && (
            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-zinc-950 text-white border border-emerald-500/40 shadow-2xl p-1.5 space-y-1 z-50">
              <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                Share via WhatsApp
              </div>
              <button
                type="button"
                onClick={() => runWhatsAppElementShare(hoveredEl, 'png')}
                className="w-full text-left px-2 py-1.5 text-[11px] font-medium rounded-lg hover:bg-emerald-600/30 flex items-center gap-1.5"
              >
                <ImageDown className="w-3.5 h-3.5 text-emerald-400" />
                PNG Snapshot
              </button>
              <button
                type="button"
                onClick={() => runWhatsAppElementShare(hoveredEl, 'pdf')}
                className="w-full text-left px-2 py-1.5 text-[11px] font-medium rounded-lg hover:bg-emerald-600/30 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-red-400" />
                PDF Report
              </button>
              <button
                type="button"
                onClick={() => runWhatsAppElementShare(hoveredEl, 'xlsx')}
                className="w-full text-left px-2 py-1.5 text-[11px] font-medium rounded-lg hover:bg-emerald-600/30 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                Excel (.xlsx)
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. ACTIVE SNAPSHOT STUDIO TOP CONTROL BAR */}
      {mode !== 'off' && (
        <div
          data-snapshot-ignore="true"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] max-w-[96vw] flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-2xl bg-zinc-950/95 text-white border border-red-500/50 shadow-2xl backdrop-blur-xl text-xs"
        >
          <div className="flex items-center gap-1.5 pr-2 border-r border-zinc-700">
            <Camera className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-bold whitespace-nowrap">Snapshot Studio</span>
          </div>

          <button
            type="button"
            onClick={() => onChangeMode('pick')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${
              mode === 'pick'
                ? 'bg-red-700 text-white'
                : 'bg-white/10 text-zinc-200 hover:bg-white/20'
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
                ? 'bg-zinc-700 text-white ring-1 ring-red-400'
                : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            Drag Area Crop
          </button>

          <div className="hidden md:flex items-center gap-1 pl-2 border-l border-zinc-700">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold mr-1">
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
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runFullPageWhatsApp('pdf')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold"
            >
              <MessageCircle className="w-3 h-3" />
              WA PDF
            </button>
          </div>

          <button
            type="button"
            onClick={() => onChangeMode('off')}
            aria-label="Exit Snapshot Mode"
            className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-semibold"
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
          className="rounded-xl border-2 border-red-600 bg-red-600/10 transition-all duration-75"
        >
          <div className="absolute -top-6 left-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-700 text-white text-[10px] font-mono font-semibold shadow-md max-w-[320px] truncate">
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
            className="rounded-xl border-2 border-red-600 ring-4 ring-red-600/20 bg-red-600/5"
          />

          <div
            data-snapshot-ignore="true"
            style={{
              position: 'fixed',
              top: Math.max(
                68,
                Math.min(window.innerHeight - 68, selectedRect.top + selectedRect.height + 10),
              ),
              left: Math.max(12, Math.min(window.innerWidth - 620, selectedRect.left)),
              zIndex: 82,
            }}
            className="relative flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-2xl bg-zinc-950/95 text-white border border-red-500/50 shadow-2xl backdrop-blur-xl text-xs"
          >
            <span className="font-mono text-[11px] text-red-300 max-w-[140px] truncate pr-1">
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

            <div className="h-4 w-px bg-zinc-700 mx-0.5" />

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runElementAction(selectedEl, 'copy')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 font-semibold disabled:opacity-50"
            >
              {busyAction === 'copy' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : copiedFlag ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              Copy
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => runElementAction(selectedEl, 'png')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-semibold disabled:opacity-50"
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
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 font-semibold disabled:opacity-50"
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
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 font-semibold disabled:opacity-50"
            >
              {busyAction === 'xlsx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              .xlsx
            </button>

            <div className="relative">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  setWaMenuOpenFor((prev) => (prev === 'pick' ? null : 'pick'))
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-50"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </button>

              {waMenuOpenFor === 'pick' && (
                <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl bg-zinc-950 text-white border border-emerald-500/40 shadow-2xl p-1.5 space-y-1 z-50">
                  <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                    Share to WhatsApp as:
                  </div>
                  <button
                    type="button"
                    onClick={() => runWhatsAppElementShare(selectedEl, 'png')}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-emerald-600/30 flex items-center gap-2"
                  >
                    <ImageDown className="w-3.5 h-3.5 text-emerald-400" />
                    PNG Image Snapshot
                  </button>
                  <button
                    type="button"
                    onClick={() => runWhatsAppElementShare(selectedEl, 'pdf')}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-emerald-600/30 flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-red-400" />
                    PDF Report (Charts)
                  </button>
                  <button
                    type="button"
                    onClick={() => runWhatsAppElementShare(selectedEl, 'xlsx')}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-emerald-600/30 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                    Excel (.xlsx) Data
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="p-1.5 rounded-lg hover:bg-white/15 text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}

      {/* 5. FREEFORM DRAG-TO-CROP AREA OVERLAY */}
      {mode === 'crop' && (
        <div
          data-snapshot-ignore="true"
          onMouseDown={handleCropMouseDown}
          onMouseMove={handleCropMouseMove}
          onMouseUp={handleCropMouseUp}
          className="fixed inset-0 z-[72] cursor-crosshair bg-zinc-950/25 select-none"
        >
          {!cropRect && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-zinc-950/90 text-white text-xs font-medium border border-white/15 shadow-lg pointer-events-none">
              Click and drag anywhere on screen to capture your snapshot box (Esc to cancel)
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
                className="border-2 border-red-500 bg-red-500/10 shadow-[0_0_0_9999px_rgba(9,9,11,0.45)] pointer-events-none"
              >
                <span className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-red-700 text-white text-[10px] font-mono font-semibold">
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
                    left: Math.max(12, Math.min(window.innerWidth - 460, cropRect.left)),
                    zIndex: 85,
                  }}
                  className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-2xl bg-zinc-950/95 text-white border border-red-500/50 shadow-2xl text-xs"
                >
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runCropAction('copy')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 font-semibold disabled:opacity-50"
                  >
                    {busyAction === 'copy' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : copiedFlag ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copy
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runCropAction('png')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-semibold disabled:opacity-50"
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
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 font-semibold disabled:opacity-50"
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
                    onClick={() => runWhatsAppCropShare('png')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-50"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WA PNG
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => runWhatsAppCropShare('pdf')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 font-semibold disabled:opacity-50"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WA PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropRect(null)}
                    aria-label="Reset crop area"
                    className="p-1.5 rounded-lg hover:bg-white/15 text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 6. WHATSAPP SHARE HANDOFF MODAL (PNG / PDF / XLSX) */}
      {waShareModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share Report via WhatsApp"
          data-snapshot-ignore="true"
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-zinc-950/65 backdrop-blur-xs"
          onClick={() => setWaShareModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Share {waShareModal.format.toUpperCase()} via WhatsApp
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[260px]">
                    {waShareModal.fileName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaShareModal(null)}
                aria-label="Close WhatsApp share dialog"
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 leading-relaxed">
                {waShareModal.format === 'png' && waShareModal.copiedImage ? (
                  <>
                    <strong>Ready!</strong> Your PNG snapshot has been{' '}
                    <strong>copied to your clipboard</strong> AND downloaded as{' '}
                    <span className="font-mono">{waShareModal.fileName}</span>. Open WhatsApp below and press{' '}
                    <span className="font-mono font-bold">Ctrl + V</span> to paste the image directly!
                  </>
                ) : (
                  <>
                    <strong>File Downloaded!</strong>{' '}
                    <span className="font-mono">{waShareModal.fileName}</span> is saved in your Downloads folder. Click{' '}
                    <strong>Open WhatsApp</strong> below, then attach or drag the downloaded{' '}
                    <strong>.{waShareModal.format}</strong> file into the chat.
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
                  Optional Recipient WhatsApp Number (with country code, e.g. 94771234567)
                </label>
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="Leave blank to pick any chat or group in WhatsApp"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300">
                  Message Caption
                </label>
                <textarea
                  rows={3}
                  value={waCustomNote}
                  onChange={(e) => setWaCustomNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setWaShareModal(null)}
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
                <a
                  href={buildWhatsAppLink(waCustomNote || waShareModal.summaryText, waPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWaShareModal(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Open WhatsApp
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
