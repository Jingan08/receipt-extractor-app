"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, Receipt, Loader2, CheckCircle2, Save, Trash2, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExtractedData {
  merchantName: string;
  date: string;
  totalAmount: string;
  currency: string;
  category: string;
}

interface SavedReceipt extends ExtractedData {
  id: string;
  timestamp: number;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<ExtractedData>({
    merchantName: "",
    date: "",
    totalAmount: "",
    currency: "",
    category: "",
  });
  const [savedReceipts, setSavedReceipts] = useState<SavedReceipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load from local storage on mount
    const saved = localStorage.getItem("receipts");
    if (saved) {
      try {
        setSavedReceipts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved receipts");
      }
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    
    // Auto-analyze when file is selected
    await analyzeReceipt(selectedFile);
  };

  const analyzeReceipt = async (selectedFile: File) => {
    setIsAnalyzing(true);
    setError(null);

    const data = new FormData();
    data.append("file", selectedFile);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: data,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to analyze receipt");
      }

      const result: ExtractedData = await response.json();
      setFormData({
        merchantName: result.merchantName || "",
        date: result.date || "",
        totalAmount: result.totalAmount || "",
        currency: result.currency || "",
        category: result.category || "Others",
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while analyzing the receipt.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.merchantName && !formData.totalAmount) {
      setError("Please ensure at least Merchant Name or Total Amount is filled.");
      return;
    }

    const newReceipt: SavedReceipt = {
      ...formData,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };

    const updated = [newReceipt, ...savedReceipts];
    setSavedReceipts(updated);
    localStorage.setItem("receipts", JSON.stringify(updated));
    
    // Reset form
    setFile(null);
    setPreviewUrl(null);
    setFormData({ merchantName: "", date: "", totalAmount: "", currency: "", category: "" });
  };

  const handleDelete = (id: string) => {
    const updated = savedReceipts.filter(r => r.id !== id);
    setSavedReceipts(updated);
    localStorage.setItem("receipts", JSON.stringify(updated));
  };

  const downloadPdfSummary = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Receipt Summary", 14, 22);
    
    let total = 0;
    savedReceipts.forEach(r => {
      const val = parseFloat(r.totalAmount.replace(/[^0-9.-]/g, ''));
      if (!isNaN(val)) {
        total += val;
      }
    });

    const tableData = savedReceipts.map(r => [
      r.merchantName || 'N/A',
      r.date || 'N/A',
      r.category || 'Others',
      r.currency || '',
      r.totalAmount || '0.00'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Merchant', 'Date', 'Category', 'Currency', 'Amount']],
      body: tableData,
      foot: [['', '', '', 'Total', total.toFixed(2)]],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [16, 185, 129] }
    });

    doc.save("receipt-summary.pdf");
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto text-slate-100">
      <header className="mb-10 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 inline-block mb-2 text-shadow">
          Receipt-to-Form
        </h1>
        <p className="text-slate-400 text-lg">AI-powered extraction with Gemini</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Upload Section */}
        <section className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 shadow-2xl transition-all duration-300 hover:border-blue-500/30 hover:shadow-blue-900/20">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <UploadCloud className="text-blue-400" />
            Upload Receipt
          </h2>
          
          <div 
            className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer min-h-[300px] ${previewUrl ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-600 hover:border-blue-400 hover:bg-slate-700/30'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            
            {previewUrl ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img src={previewUrl} alt="Receipt preview" className="max-h-[300px] max-w-full rounded-lg object-contain shadow-lg" />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-900/60 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                    <p className="font-medium text-lg animate-pulse">Analyzing receipt with Gemini...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center opacity-70">
                <div className="bg-slate-700 p-4 rounded-full mb-4">
                  <Receipt className="w-10 h-10 text-blue-300" />
                </div>
                <p className="text-lg font-medium mb-1">Click to browse or drag image here</p>
                <p className="text-sm text-slate-400">Supports JPG, PNG, WEBP</p>
              </div>
            )}
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm">
              {error}
            </div>
          )}
        </section>

        {/* Form Section */}
        <section className="bg-slate-800/50 backdrop-blur-md rounded-3xl p-6 border border-slate-700/50 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-emerald-500/30 hover:shadow-emerald-900/20">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <CheckCircle2 className="text-emerald-400" />
            Extracted Data
          </h2>

          <div className="space-y-5 relative z-10">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Merchant Name</label>
              <input
                type="text"
                name="merchantName"
                value={formData.merchantName}
                onChange={handleInputChange}
                placeholder="e.g. Starbucks"
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Date</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                placeholder="YYYY-MM-DD"
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Total Amount</label>
                <input
                  type="text"
                  name="totalAmount"
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Currency</label>
                <input
                  type="text"
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  placeholder="USD, $, etc."
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
              >
                <option value="">Select a category</option>
                <option value="Food">Food</option>
                <option value="Transport">Transport</option>
                <option value="Shopping">Shopping</option>
                <option value="Others">Others</option>
              </select>
            </div>
            
            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={isAnalyzing || (!formData.merchantName && !formData.totalAmount)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-900/30"
              >
                <Save size={18} />
                Save Receipt
              </button>
            </div>
          </div>
          
          {/* Decorative background blob */}
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        </section>
      </div>

      {/* Saved Receipts Section */}
      {savedReceipts.length > 0 && (
        <section className="bg-slate-800/30 backdrop-blur-sm rounded-3xl p-6 border border-slate-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-2xl font-semibold">Saved Receipts</h2>
            <button 
              onClick={downloadPdfSummary}
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors border border-slate-600 shadow-sm text-sm"
            >
              <Download size={16} />
              Download PDF Summary
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedReceipts.map((receipt) => (
              <div key={receipt.id} className="bg-slate-900/60 rounded-2xl p-5 border border-slate-700 flex flex-col hover:border-slate-500 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg truncate pr-2">{receipt.merchantName || 'Unknown Merchant'}</h3>
                  <button 
                    onClick={() => handleDelete(receipt.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Delete receipt"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-2 mb-4">
                  <span className="inline-block bg-slate-700/50 text-blue-300 text-xs px-2.5 py-1 rounded-full border border-slate-600/50">
                    {receipt.category || 'Others'}
                  </span>
                </div>
                <div className="flex justify-between items-end mt-auto pt-2">
                  <span className="text-sm text-slate-400">{receipt.date || 'No date'}</span>
                  <span className="font-semibold text-emerald-400 text-xl">
                    {receipt.currency} {receipt.totalAmount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
