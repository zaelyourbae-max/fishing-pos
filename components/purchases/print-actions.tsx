"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";

type Item = {
  productName: string;
  sku: string | null;
  qty: number;
  costPrice: number;
  subtotal: number;
};

type PurchaseData = {
  purchaseNumber: string;
  supplierName: string;
  createdBy: string | null;
  createdAt: string;
  notes: string | null;
  total: number;
  items: Item[];
};

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function PrintActions({ purchase }: { purchase: PurchaseData }) {
  const [loading, setLoading] = useState(false);

  async function downloadPdf() {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = 20;

      const gray = (v: number): [number, number, number] => [v, v, v];

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...gray(15));
      doc.text("MEIJRVERSE°", pageW - margin, y, { align: "right" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray(120));
      doc.text("Retail System", pageW - margin, y + 5, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...gray(120));
      doc.text("PURCHASE ORDER", margin, y);
      doc.setFontSize(14);
      doc.setTextColor(...gray(15));
      doc.text(purchase.purchaseNumber, margin, y + 6);

      y += 16;
      doc.setDrawColor(...gray(15));
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      // Info grid
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...gray(140));
      doc.text("KEPADA (SUPPLIER)", margin, y);
      doc.text("TANGGAL", pageW / 2 + 5, y);

      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...gray(15));
      doc.text(purchase.supplierName, margin, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...gray(60));
      doc.text(purchase.createdAt, pageW / 2 + 5, y);

      if (purchase.createdBy) {
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...gray(140));
        doc.text("DICATAT OLEH", pageW / 2 + 5, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...gray(60));
        doc.text(purchase.createdBy, pageW / 2 + 5, y);
      }

      if (purchase.notes) {
        y += 8;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...gray(220));
        doc.roundedRect(margin, y, contentW, 12, 2, 2, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...gray(140));
        doc.text("CATATAN", margin + 3, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...gray(60));
        doc.text(purchase.notes, margin + 3, y + 9);
        y += 18;
      } else {
        y += 12;
      }

      // Tabel header
      const colX = [margin, margin + 62, margin + 90, margin + 120, margin + 152];
      doc.setFillColor(...gray(15));
      doc.rect(margin, y, contentW, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("Produk", colX[0] + 2, y + 5.5);
      doc.text("SKU", colX[1] + 2, y + 5.5);
      doc.text("Qty", colX[2] + 2, y + 5.5);
      doc.text("Harga Beli", colX[3] + 2, y + 5.5);
      doc.text("Subtotal", colX[4] + 2, y + 5.5);
      y += 8;

      // Tabel rows
      purchase.items.forEach((item, i) => {
        const rowH = 8;
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentW, rowH, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...gray(30));
        doc.text(item.productName.slice(0, 28), colX[0] + 2, y + 5.5);
        doc.setTextColor(...gray(100));
        doc.text(item.sku ?? "-", colX[1] + 2, y + 5.5);
        doc.setTextColor(...gray(30));
        doc.text(String(item.qty), colX[2] + 2, y + 5.5);
        doc.text(rupiah(item.costPrice), colX[3] + 2, y + 5.5);
        doc.setFont("helvetica", "bold");
        doc.text(rupiah(item.subtotal), colX[4] + 2, y + 5.5);
        y += rowH;
      });

      // Garis bawah tabel
      doc.setDrawColor(...gray(15));
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      // Total
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...gray(100));
      doc.text("Total Pembelian", pageW - margin, y, { align: "right" });
      y += 6;
      doc.setFontSize(16);
      doc.setTextColor(...gray(15));
      doc.text(rupiah(purchase.total), pageW - margin, y, { align: "right" });
      y += 18;

      // TTD
      const halfW = contentW / 2 - 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...gray(140));
      doc.text("Penerima", margin, y);
      doc.text("Dibuat oleh", margin + halfW + 12, y);
      y += 18;
      doc.setDrawColor(...gray(180));
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + halfW, y);
      doc.line(margin + halfW + 12, y, margin + contentW, y);
      y += 4;
      doc.setFontSize(7);
      doc.setTextColor(...gray(160));
      if (purchase.createdBy) {
        doc.text(purchase.createdBy, margin + halfW + 12, y);
      }

      // Footer
      y = 280;
      doc.setFontSize(7);
      doc.setTextColor(...gray(180));
      doc.text(
        `Dokumen digenerate otomatis oleh sistem MEIJRVERSE° — ${purchase.createdAt}`,
        pageW / 2,
        y,
        { align: "center" }
      );

      doc.save(`${purchase.purchaseNumber}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="no-print fixed right-4 top-4 flex gap-2 z-50">
      <button
        onClick={downloadPdf}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
      >
        <Download size={15} />
        {loading ? "Membuat..." : "Download PDF"}
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Printer size={15} />
        Print
      </button>
      <button
        onClick={() => window.close()}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
      >
        Tutup
      </button>
    </div>
  );
}
