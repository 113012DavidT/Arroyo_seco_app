import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

export interface PdfSummaryItem {
  label: string;
  value: string;
}

export interface PdfChartItem {
  title: string;
  canvas?: HTMLCanvasElement | null;
}

export interface PdfSectionItem {
  title: string;
  lines: string[];
}

export interface PdfReportOptions {
  fileName: string;
  title: string;
  subtitle?: string;
  summary: PdfSummaryItem[];
  charts?: PdfChartItem[];
  sections?: PdfSectionItem[];
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  exportReport(options: PdfReportOptions): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);
    let y = 56;

    const ensureSpace = (requiredHeight: number) => {
      if (y + requiredHeight <= pageHeight - margin) {
        return;
      }

      doc.addPage();
      y = 56;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(options.title, margin, y);
    y += 24;

    if (options.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(options.subtitle, margin, y);
      y += 24;
      doc.setTextColor(20, 20, 20);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Resumen', margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const item of options.summary) {
      ensureSpace(18);
      doc.text(`${item.label}: ${item.value}`, margin, y);
      y += 16;
    }

    for (const chart of options.charts || []) {
      if (!chart.canvas) {
        continue;
      }

      ensureSpace(240);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(chart.title, margin, y + 6);
      y += 18;

      const imageData = chart.canvas.toDataURL('image/png', 1);
      const width = contentWidth;
      const height = Math.min(220, (chart.canvas.height / chart.canvas.width) * width);
      doc.addImage(imageData, 'PNG', margin, y, width, height, undefined, 'FAST');
      y += height + 18;
    }

    for (const section of options.sections || []) {
      ensureSpace(36);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(section.title, margin, y);
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      for (const line of section.lines) {
        const lines = doc.splitTextToSize(line, contentWidth);
        ensureSpace((lines.length * 12) + 6);
        doc.text(lines, margin, y);
        y += (lines.length * 12) + 4;
      }

      y += 8;
    }

    doc.save(options.fileName);
  }
}