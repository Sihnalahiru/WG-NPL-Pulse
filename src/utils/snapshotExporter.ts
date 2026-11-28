import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export interface SnapshotExportOptions {
  label?: string;
  isDark?: boolean;
  pixelRatio?: number;
}

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WhatsAppShareResult {
  mode: 'native_share' | 'whatsapp_ready';
  format: 'png' | 'pdf' | 'xlsx';
  fileName: string;
  summaryText: string;
  copiedImage?: boolean;
}

function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9\u0D80-\u0DFF\u0B80-\u0BFF\s_-]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 64);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${cleaned || 'WG_Pulse_Snapshot'}_${stamp}`;
}

function shouldIncludeNode(node: Node): boolean {
  if (node instanceof HTMLElement) {
    if (node.dataset?.snapshotIgnore === 'true') return false;
    if (node.getAttribute('data-snapshot-ignore') === 'true') return false;
  }
  return true;
}

export function inferElementLabel(el: HTMLElement): string {
  const explicit =
    el.dataset?.snapshotTitle ||
    el.getAttribute('aria-label') ||
    el.getAttribute('title');
  if (explicit && explicit.trim().length > 1) {
    return explicit.trim().slice(0, 64);
  }

  const heading = el.querySelector('h1, h2, h3, h4, caption');
  if (heading?.textContent?.trim()) {
    return heading.textContent.trim().replace(/\s+/g, ' ').slice(0, 64);
  }

  const firstText = (el.textContent || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48);
  return firstText || 'Commercial Credit Section';
}

export function findSnapTargetElement(
  rawTarget: EventTarget | null,
  rootBoundary?: HTMLElement | null,
): HTMLElement | null {
  if (!(rawTarget instanceof HTMLElement)) return null;
  if (rawTarget.closest('[data-snapshot-ignore="true"]')) return null;

  let curr: HTMLElement | null = rawTarget;
  const minWidth = 110;
  const minHeight = 46;

  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (rootBoundary && curr === rootBoundary) return null;
    if (curr.dataset?.snapshotIgnore === 'true') return null;

    const tag = curr.tagName.toLowerCase();
    const cls = typeof curr.className === 'string' ? curr.className : '';
    const rect = curr.getBoundingClientRect();

    const isSemanticContainer =
      tag === 'section' ||
      tag === 'article' ||
      tag === 'table' ||
      curr.getAttribute('role') === 'dialog' ||
      curr.hasAttribute('data-snapshot-target') ||
      /\brounded-(xl|2xl|3xl)\b/.test(cls);

    const hasVisualFrame =
      /\bborder\b/.test(cls) ||
      /\bbg-(white|slate|zinc|stone|emerald|blue|amber|rose|red|gradient)/.test(cls) ||
      tag === 'section' ||
      tag === 'article' ||
      tag === 'table' ||
      curr.getAttribute('role') === 'dialog';

    if (
      isSemanticContainer &&
      hasVisualFrame &&
      rect.width >= minWidth &&
      rect.height >= minHeight &&
      rect.width <= window.innerWidth * 0.99
    ) {
      if (tag === 'button' && rect.height < 64 && rect.width < 180) {
        curr = curr.parentElement;
        continue;
      }
      return curr;
    }

    curr = curr.parentElement;
  }

  return null;
}

export async function captureElementToPngDataUrl(
  element: HTMLElement,
  options: SnapshotExportOptions = {},
): Promise<string> {
  const isDark =
    options.isDark ?? document.documentElement.classList.contains('dark');
  const computedBg = window.getComputedStyle(element).backgroundColor;
  const hasOpaqueBg =
    computedBg &&
    computedBg !== 'rgba(0, 0, 0, 0)' &&
    computedBg !== 'transparent';
  const backgroundColor = hasOpaqueBg
    ? computedBg
    : isDark
      ? '#14171f'
      : '#ffffff';

  const baseConfig = {
    pixelRatio: options.pixelRatio ?? 2,
    cacheBust: false,
    backgroundColor,
    filter: shouldIncludeNode,
  };

  try {
    return await toPng(element, baseConfig);
  } catch {
    return await toPng(element, {
      ...baseConfig,
      skipFonts: true,
    });
  }
}

export async function captureViewportCropToPng(
  cropRect: CropRect,
  options: SnapshotExportOptions = {},
): Promise<string> {
  const isDark =
    options.isDark ?? document.documentElement.classList.contains('dark');
  const rootEl = document.getElementById('root') || document.body;
  const pixelRatio = options.pixelRatio ?? 2;

  const fullDataUrl = await captureElementToPngDataUrl(rootEl, {
    isDark,
    pixelRatio,
  });

  const rootRect = rootEl.getBoundingClientRect();
  const img = await loadImage(fullDataUrl);

  const scaleX = img.naturalWidth / Math.max(1, rootEl.scrollWidth || rootRect.width);
  const scaleY = img.naturalHeight / Math.max(1, rootEl.scrollHeight || rootRect.height);

  const srcX = Math.max(0, Math.round((cropRect.left - rootRect.left) * scaleX));
  const srcY = Math.max(0, Math.round((cropRect.top - rootRect.top) * scaleY));
  const srcW = Math.max(
    1,
    Math.min(img.naturalWidth - srcX, Math.round(cropRect.width * scaleX)),
  );
  const srcH = Math.max(
    1,
    Math.min(img.naturalHeight - srcY, Math.round(cropRect.height * scaleY)),
  );

  const canvas = document.createElement('canvas');
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize snapshot canvas context.');
  }
  ctx.fillStyle = isDark ? '#0f1115' : '#f7f6f4';
  ctx.fillRect(0, 0, srcW, srcH);
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode snapshot image.'));
    img.src = src;
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadPngDataUrl(dataUrl: string, label = 'WG_Pulse_Snapshot'): string {
  const fileName = `${sanitizeFileName(label)}.png`;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return fileName;
}

export async function copyPngDataUrlToClipboard(
  dataUrl: string,
  fallbackLabel = 'WG_Pulse_Snapshot',
): Promise<'copied' | 'downloaded'> {
  const blob = dataUrlToBlob(dataUrl);
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    } catch {
      // Fallback if iframe blocks clipboard image write
    }
  }
  downloadPngDataUrl(dataUrl, fallbackLabel);
  return 'downloaded';
}

async function buildPdfDocumentFromDataUrl(
  dataUrl: string,
  label = 'Commercial Credit Snapshot',
): Promise<{ pdf: jsPDF; fileName: string }> {
  const img = await loadImage(dataUrl);
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const orientation = imgW >= imgH ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const headerH = 15;
  const footerH = 7;

  const drawHeaderFooter = (pageNum: number, totalPages: number) => {
    // Commercial Credit deep charcoal header + crimson accent bar
    pdf.setFillColor(24, 24, 27);
    pdf.rect(0, 0, pageW, headerH, 'F');
    pdf.setFillColor(200, 30, 30);
    pdf.rect(0, headerH - 1.2, pageW, 1.2, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('COMMERCIAL CREDIT · WG PULSE RECOVERY CONTROL', margin, 6.2);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(252, 165, 165);
    pdf.text(label.slice(0, 84), margin, 11.4);

    const timestamp = new Date().toLocaleString();
    pdf.setTextColor(212, 212, 216);
    pdf.text(timestamp, pageW - margin, 6.2, { align: 'right' });

    pdf.setTextColor(113, 113, 122);
    pdf.setFontSize(7.5);
    pdf.text(
      `Page ${pageNum} of ${totalPages} · Commercial Credit WG Pulse`,
      pageW - margin,
      pageH - 3.5,
      { align: 'right' },
    );
  };

  const availW = pageW - margin * 2;
  const availH = pageH - headerH - footerH - 8;

  const renderW = availW;
  const renderH = (imgH / Math.max(1, imgW)) * renderW;

  if (renderH <= availH) {
    drawHeaderFooter(1, 1);
    pdf.addImage(dataUrl, 'PNG', margin, headerH + 4, renderW, renderH, undefined, 'FAST');
  } else {
    const slicePixelH = Math.floor((availH / renderH) * imgH);
    const totalPages = Math.max(1, Math.ceil(imgH / Math.max(1, slicePixelH)));

    for (let page = 0; page < totalPages; page += 1) {
      if (page > 0) pdf.addPage();
      drawHeaderFooter(page + 1, totalPages);

      const srcY = page * slicePixelH;
      const currSliceH = Math.min(slicePixelH, imgH - srcY);
      const canvas = document.createElement('canvas');
      canvas.width = imgW;
      canvas.height = currSliceH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, srcY, imgW, currSliceH, 0, 0, imgW, currSliceH);
        const sliceUrl = canvas.toDataURL('image/png');
        const sliceRenderH = (currSliceH / imgW) * renderW;
        pdf.addImage(
          sliceUrl,
          'PNG',
          margin,
          headerH + 4,
          renderW,
          sliceRenderH,
          undefined,
          'FAST',
        );
      }
    }
  }

  return { pdf, fileName: `${sanitizeFileName(label)}.pdf` };
}

export async function exportDataUrlToPdf(
  dataUrl: string,
  label = 'Commercial Credit Snapshot',
): Promise<string> {
  const { pdf, fileName } = await buildPdfDocumentFromDataUrl(dataUrl, label);
  pdf.save(fileName);
  return fileName;
}

export async function exportElementToPdf(
  element: HTMLElement,
  options: SnapshotExportOptions = {},
): Promise<string> {
  const label = options.label || inferElementLabel(element);
  const dataUrl = await captureElementToPngDataUrl(element, options);
  return exportDataUrlToPdf(dataUrl, label);
}

function cleanCellText(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('[data-snapshot-ignore="true"], svg, script, style')
    .forEach((n) => n.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

function autoSizeSheet(ws: XLSX.WorkSheet, rows: (string | number)[][]): void {
  const colWidths: number[] = [];
  rows.forEach((row) => {
    row.forEach((cell, idx) => {
      const len = String(cell ?? '').length;
      colWidths[idx] = Math.min(48, Math.max(colWidths[idx] || 10, len + 3));
    });
  });
  ws['!cols'] = colWidths.map((wch) => ({ wch }));
}

function safeSheetName(raw: string, index: number, used: Set<string>): string {
  const base =
    raw
      .replace(/[\\/?*[\]:]/g, '')
      .trim()
      .slice(0, 26) || `Sheet_${index + 1}`;
  let name = base;
  let suffix = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base.slice(0, 22)}_${suffix}`;
    suffix += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function buildWorkbookForElement(
  element: HTMLElement,
  label?: string,
): { wb: XLSX.WorkBook; fileName: string; sheetCount: number; rowCount: number } {
  const sectionLabel = label || inferElementLabel(element);
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  let totalRows = 0;

  const tables = Array.from(element.querySelectorAll('table')).filter(
    (tbl) => !tbl.closest('[data-snapshot-ignore="true"]'),
  );

  if (tables.length > 0) {
    tables.forEach((tbl, idx) => {
      const aoa: (string | number)[][] = [];
      const rows = Array.from(tbl.querySelectorAll('tr'));
      rows.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) =>
          cleanCellText(cell as HTMLElement),
        );
        if (cells.some((c) => c.length > 0)) {
          aoa.push(cells);
        }
      });

      if (aoa.length > 0) {
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        autoSizeSheet(ws, aoa);
        const heading =
          tbl.getAttribute('aria-label') ||
          tbl.closest('section')?.querySelector('h2, h3')?.textContent?.trim() ||
          `${sectionLabel}_${idx + 1}`;
        XLSX.utils.book_append_sheet(
          wb,
          ws,
          safeSheetName(heading, idx, usedNames),
        );
        totalRows += aoa.length;
      }
    });
  }

  if (totalRows === 0) {
    const aoa: (string | number)[][] = [
      ['Organization', 'Commercial Credit — WG Pulse'],
      ['Section', sectionLabel],
      ['Exported At', new Date().toLocaleString()],
      [],
      ['Item / Metric', 'Details / Values'],
    ];

    const blocks = Array.from(
      element.querySelectorAll(
        'article, section, [class*="rounded-xl"], [class*="rounded-2xl"], li',
      ),
    ).filter((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.closest('[data-snapshot-ignore="true"]')) return false;
      const hasInnerCards =
        htmlEl.querySelectorAll('[class*="rounded-xl"], [class*="rounded-2xl"]').length > 2;
      return !hasInnerCards;
    });

    const seenLines = new Set<string>();
    const sourceNodes = blocks.length > 0 ? blocks : [element];

    sourceNodes.forEach((node) => {
      const htmlNode = node as HTMLElement;
      const lines = (htmlNode.innerText || '')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) return;
      const signature = lines.join(' | ');
      if (seenLines.has(signature)) return;
      seenLines.add(signature);

      if (lines.length === 1) {
        aoa.push([lines[0], '']);
      } else {
        aoa.push([lines[0], lines.slice(1).join(' · ')]);
      }
    });

    if (aoa.length <= 5) {
      const fallbackText = cleanCellText(element);
      aoa.push([sectionLabel, fallbackText || 'No tabular data in selection']);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    autoSizeSheet(ws, aoa);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sectionLabel, 0, usedNames));
    totalRows = Math.max(1, aoa.length - 5);
  }

  return {
    wb,
    fileName: `${sanitizeFileName(sectionLabel)}.xlsx`,
    sheetCount: wb.SheetNames.length,
    rowCount: totalRows,
  };
}

export function exportElementToExcel(
  element: HTMLElement,
  label?: string,
): { sheetCount: number; rowCount: number; fileName: string } {
  const { wb, fileName, sheetCount, rowCount } = buildWorkbookForElement(element, label);
  XLSX.writeFile(wb, fileName);
  return { sheetCount, rowCount, fileName };
}

async function tryNativeFileShare(
  file: File,
  title: string,
  text: string,
): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return true;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return true;
      }
    }
  }
  return false;
}

export async function prepareWhatsAppShareForElement(
  element: HTMLElement,
  format: 'png' | 'pdf' | 'xlsx',
  options: SnapshotExportOptions = {},
): Promise<WhatsAppShareResult> {
  const label = options.label || inferElementLabel(element);
  const stamp = new Date().toLocaleString();
  const summaryText = `*Commercial Credit · WG Pulse Report*\nSection: ${label}\nFormat: ${format.toUpperCase()}\nGenerated: ${stamp}`;

  if (format === 'png') {
    const dataUrl = await captureElementToPngDataUrl(element, options);
    const blob = dataUrlToBlob(dataUrl);
    const fileName = `${sanitizeFileName(label)}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (await tryNativeFileShare(file, label, summaryText)) {
      return { mode: 'native_share', format, fileName, summaryText };
    }

    let copiedImage = false;
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copiedImage = true;
      } catch {
        copiedImage = false;
      }
    }
    downloadBlob(blob, fileName);
    return { mode: 'whatsapp_ready', format, fileName, summaryText, copiedImage };
  }

  if (format === 'pdf') {
    const dataUrl = await captureElementToPngDataUrl(element, options);
    const { pdf, fileName } = await buildPdfDocumentFromDataUrl(dataUrl, label);
    const blob = pdf.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (await tryNativeFileShare(file, label, summaryText)) {
      return { mode: 'native_share', format, fileName, summaryText };
    }

    downloadBlob(blob, fileName);
    return { mode: 'whatsapp_ready', format, fileName, summaryText };
  }

  // Excel (.xlsx)
  const { wb, fileName } = buildWorkbookForElement(element, label);
  const arrayBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const file = new File([blob], fileName, { type: blob.type });

  if (await tryNativeFileShare(file, label, summaryText)) {
    return { mode: 'native_share', format, fileName, summaryText };
  }

  downloadBlob(blob, fileName);
  return { mode: 'whatsapp_ready', format, fileName, summaryText };
}

export async function prepareWhatsAppShareForCrop(
  cropRect: CropRect,
  format: 'png' | 'pdf',
  options: SnapshotExportOptions = {},
): Promise<WhatsAppShareResult> {
  const label = 'WG_Pulse_Custom_Area';
  const stamp = new Date().toLocaleString();
  const summaryText = `*Commercial Credit · WG Pulse Area Snapshot*\nFormat: ${format.toUpperCase()}\nGenerated: ${stamp}`;
  const dataUrl = await captureViewportCropToPng(cropRect, options);

  if (format === 'png') {
    const blob = dataUrlToBlob(dataUrl);
    const fileName = `${sanitizeFileName(label)}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (await tryNativeFileShare(file, label, summaryText)) {
      return { mode: 'native_share', format, fileName, summaryText };
    }

    let copiedImage = false;
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copiedImage = true;
      } catch {
        copiedImage = false;
      }
    }
    downloadBlob(blob, fileName);
    return { mode: 'whatsapp_ready', format, fileName, summaryText, copiedImage };
  }

  const { pdf, fileName } = await buildPdfDocumentFromDataUrl(
    dataUrl,
    'Commercial Credit — Custom Area Snapshot',
  );
  const blob = pdf.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (await tryNativeFileShare(file, label, summaryText)) {
    return { mode: 'native_share', format, fileName, summaryText };
  }

  downloadBlob(blob, fileName);
  return { mode: 'whatsapp_ready', format, fileName, summaryText };
}

export function buildWhatsAppLink(text: string, rawPhone?: string): string {
  const digits = (rawPhone || '').replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(text);
  return digits.length >= 9
    ? `https://wa.me/${digits}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
