import { NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const receiptsStr = searchParams.get("receipts");

    if (!receiptsStr) {
      return new Response("Missing receipts data", { status: 400 });
    }

    let savedReceipts: any[] = [];
    try {
      savedReceipts = JSON.parse(receiptsStr);
    } catch (e) {
      return new Response("Invalid receipts format", { status: 400 });
    }

    const doc = new jsPDF();
    doc.setProperties({
      title: "receipt-summary"
    });

    doc.setFontSize(20);
    doc.text("Receipt Summary", 14, 22);
    
    let total = 0;
    savedReceipts.forEach(r => {
      const amountStr = r.totalAmount || "0";
      const val = parseFloat(amountStr.replace(/[^0-9.-]/g, ""));
      if (!isNaN(val)) {
        total += val;
      }
    });

    const tableData = savedReceipts.map(r => [
      r.merchantName || "N/A",
      r.date || "N/A",
      r.category || "Others",
      r.currency || "",
      r.totalAmount || "0.00"
    ]);

    autoTable(doc, {
      startY: 30,
      head: [["Merchant", "Date", "Category", "Currency", "Amount"]],
      body: tableData,
      foot: [["", "", "", "Total", total.toFixed(2)]],
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [16, 185, 129] }
    });

    const pdfArrayBuffer = doc.output("arraybuffer");

    return new Response(pdfArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="receipt-summary.pdf"',
        "Content-Length": pdfArrayBuffer.byteLength.toString(),
      },
    });
  } catch (err: any) {
    console.error("Download API error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
