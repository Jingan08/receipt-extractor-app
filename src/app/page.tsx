"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, Receipt, Loader2, CheckCircle2, Save, Trash2, Download, X } from "lucide-react";

interface ItemPurchased {
  name: string;
  quantity: number;
  price: string;
}

interface ExtractedData {
  merchantName: string;
  date: string;
  time: string;
  receiptNumber: string;
  tax: string;
  totalAmount: string;
  currency: string;
  category: string;
  items: ItemPurchased[];
}

interface SavedReceipt extends ExtractedData {
  id: string;
  timestamp: number;
}

// IndexedDB Helper functions for storing receipt images safely (bypassing LocalStorage limits)
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("receipt-images-db", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveImage = async (id: string, fileData: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("images", "readwrite");
    const store = transaction.objectStore("images");
    const request = store.put(fileData, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getImage = async (id: string): Promise<string | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("images", "readonly");
    const store = transaction.objectStore("images");
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const deleteImage = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("images", "readwrite");
    const store = transaction.objectStore("images");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<ExtractedData>({
    merchantName: "",
    date: "",
    time: "",
    receiptNumber: "",
    tax: "",
    totalAmount: "",
    currency: "",
    category: "",
    items: [],
  });
  const [savedReceipts, setSavedReceipts] = useState<SavedReceipt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState<SavedReceipt | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setFile(null);
    setPreviewUrl(null);
    setFormData({
      merchantName: "",
      date: "",
      time: "",
      receiptNumber: "",
      tax: "",
      totalAmount: "",
      currency: "",
      category: "",
      items: [],
    });
    setError(null);
    setIsAnalyzing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

    // Cancel any ongoing analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const data = new FormData();
    data.append("file", selectedFile);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: data,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to analyze receipt");
      }

      const result: ExtractedData = await response.json();
      setFormData({
        merchantName: result.merchantName || "",
        date: result.date || "",
        time: result.time || "",
        receiptNumber: result.receiptNumber || "",
        tax: result.tax || "",
        totalAmount: result.totalAmount || "",
        currency: result.currency || "",
        category: result.category || "Others",
        items: result.items || [],
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Analysis aborted");
        return;
      }
      console.error(err);
      setError(err.message || "An error occurred while analyzing the receipt.");
    } finally {
      if (abortControllerRef.current === controller) {
        setIsAnalyzing(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };



  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSave = async () => {
    if (!formData.merchantName && !formData.totalAmount) {
      setError("Please ensure at least Merchant Name or Total Amount is filled.");
      return;
    }

    const isDuplicate = savedReceipts.some(r =>
      (r.merchantName || "").trim().toLowerCase() === (formData.merchantName || "").trim().toLowerCase() &&
      (r.date || "").trim() === (formData.date || "").trim() &&
      (r.totalAmount || "").trim() === (formData.totalAmount || "").trim() &&
      (r.currency || "").trim().toLowerCase() === (formData.currency || "").trim().toLowerCase()
    );

    if (isDuplicate) {
      setError("This receipt already exists.");
      return;
    }

    const id = Math.random().toString(36).substring(7);

    // Save image to IndexedDB if present
    if (file) {
      try {
        const base64 = await getBase64(file);
        await saveImage(id, base64);
      } catch (err) {
        console.error("Failed to save image to IndexedDB", err);
      }
    }

    const newReceipt: SavedReceipt = {
      ...formData,
      id,
      timestamp: Date.now(),
    };

    const updated = [newReceipt, ...savedReceipts];
    setSavedReceipts(updated);
    localStorage.setItem("receipts", JSON.stringify(updated));

    // Reset form
    setFile(null);
    setPreviewUrl(null);
    setFormData({
      merchantName: "",
      date: "",
      time: "",
      receiptNumber: "",
      tax: "",
      totalAmount: "",
      currency: "",
      category: "",
      items: [],
    });
  };

  const handleDelete = async (id: string) => {
    const updated = savedReceipts.filter(r => r.id !== id);
    setSavedReceipts(updated);
    localStorage.setItem("receipts", JSON.stringify(updated));
    try {
      await deleteImage(id);
    } catch (err) {
      console.error("Failed to delete image from IndexedDB", err);
    }
  };

  const handleViewDetails = async (receipt: SavedReceipt) => {
    setSelectedReceiptForModal(receipt);
    setModalImageUrl(null);
    try {
      const img = await getImage(receipt.id);
      setModalImageUrl(img);
    } catch (err) {
      console.error("Failed to load image from IndexedDB", err);
    }
  };

  const handleCloseModal = () => {
    setSelectedReceiptForModal(null);
    setModalImageUrl(null);
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
              <div className="relative w-full h-full flex items-center justify-center group/preview">
                <img src={previewUrl} alt="Receipt preview" className="max-h-[300px] max-w-full rounded-lg object-contain shadow-lg" />
                {!isAnalyzing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel();
                    }}
                    className="absolute top-2 right-2 bg-slate-900/95 hover:bg-red-600 text-white p-2 rounded-full transition-all duration-200 border border-slate-700 hover:border-red-500/50 shadow-lg"
                    title="Remove receipt"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-slate-900/60 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                    <p className="font-medium text-lg animate-pulse mb-4">Analyzing receipt with Gemini...</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                      }}
                      className="px-4 py-2 bg-red-600/90 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all duration-200 border border-red-500/50 shadow-md active:scale-95"
                    >
                      Cancel Analysis
                    </button>
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

            <div className="grid grid-cols-2 gap-4">
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

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Time</label>
                <input
                  type="text"
                  name="time"
                  value={formData.time || ""}
                  onChange={handleInputChange}
                  placeholder="e.g. 14:30"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Receipt Number</label>
                <input
                  type="text"
                  name="receiptNumber"
                  value={formData.receiptNumber || ""}
                  onChange={handleInputChange}
                  placeholder="e.g. INV-10023"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Tax Amount</label>
                <input
                  type="text"
                  name="tax"
                  value={formData.tax || ""}
                  onChange={handleInputChange}
                  placeholder="e.g. 0.00"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
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
            <a
              href={`/api/download?receipts=${encodeURIComponent(JSON.stringify(savedReceipts))}`}
              download="receipt-summary.pdf"
              className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors border border-slate-600 shadow-sm text-sm"
            >
              <Download size={16} />
              Download PDF Summary
            </a>
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
                <div className="mt-2 mb-4 flex flex-wrap items-center gap-2">
                  <span className="inline-block bg-slate-700/50 text-blue-300 text-xs px-2.5 py-1 rounded-full border border-slate-600/50">
                    {receipt.category || 'Others'}
                  </span>
                </div>
                <div className="flex justify-between items-end mt-auto pt-3 border-t border-slate-800/60">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Date</span>
                    <span className="text-xs text-slate-300 font-medium">{receipt.date || 'No date'}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Amount</span>
                    <span className="font-semibold text-emerald-400 text-base">
                      {receipt.currency} {receipt.totalAmount}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-1">
                  <button
                    onClick={() => handleViewDetails(receipt)}
                    className="w-full bg-slate-850 hover:bg-blue-600 hover:text-white text-slate-300 text-xs font-semibold py-2.5 px-3 rounded-xl border border-slate-750 hover:border-blue-500 transition-all duration-200 active:scale-[0.98]"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Detail Popup Modal */}
      {selectedReceiptForModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/60 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl transition-all scale-100 flex flex-col md:flex-row max-h-[90vh]">

            {/* Left side: Image preview */}
            <div className="md:w-1/2 bg-slate-950/40 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-700/50 min-h-[300px]">
              {modalImageUrl ? (
                <img
                  src={modalImageUrl}
                  alt="Receipt"
                  className="max-h-[350px] md:max-h-[500px] object-contain rounded-xl shadow-lg border border-slate-850"
                />
              ) : (
                <div className="flex flex-col items-center opacity-40">
                  <Receipt className="w-16 h-16 text-slate-400 mb-3" />
                  <p className="text-sm font-medium text-slate-400">No receipt image stored</p>
                </div>
              )}
            </div>

            {/* Right side: Receipt details */}
            <div className="md:w-1/2 p-8 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="inline-block bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full border border-blue-500/20 font-medium mb-2">
                      {selectedReceiptForModal.category || "Others"}
                    </span>
                    <h3 className="text-2xl font-bold text-slate-100 leading-tight">
                      {selectedReceiptForModal.merchantName || "Unknown Merchant"}
                    </h3>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800/60">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Transaction Date</span>
                      <span className="text-slate-200 font-medium text-sm">{selectedReceiptForModal.date || "N/A"}</span>
                    </div>

                    <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800/60">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Transaction Time</span>
                      <span className="text-slate-200 font-medium text-sm">{selectedReceiptForModal.time || "N/A"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800/60">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Receipt Number</span>
                      <span className="text-slate-200 font-medium text-sm">{selectedReceiptForModal.receiptNumber || "N/A"}</span>
                    </div>

                    <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800/60">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Tax Amount</span>
                      <span className="text-slate-200 font-medium text-sm">
                        {selectedReceiptForModal.currency} {selectedReceiptForModal.tax || "0.00"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/30 p-3.5 rounded-xl border border-slate-800/60">
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Amount Charged (Total)</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      {selectedReceiptForModal.currency} {selectedReceiptForModal.totalAmount || "0.00"}
                    </span>
                  </div>

                  {/* Items purchased list */}
                  <div className="bg-slate-950/30 p-3.5 rounded-xl border border-slate-800/60">
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Items Purchased</span>
                    {selectedReceiptForModal.items && selectedReceiptForModal.items.length > 0 ? (
                      <div className="space-y-2">
                        {selectedReceiptForModal.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-800/50 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-slate-850 text-slate-350 w-5 h-5 flex items-center justify-center rounded-full font-semibold">{item.quantity}</span>
                              <span className="text-slate-200">{item.name}</span>
                            </div>
                            <span className="text-slate-300 text-xs font-medium">{selectedReceiptForModal.currency} {item.price}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No item list recorded</p>
                    )}
                  </div>

                  <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800/60">
                    <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Receipt ID</span>
                    <span className="text-xs font-mono text-slate-400 select-all">{selectedReceiptForModal.id}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={handleCloseModal}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-6 rounded-xl border border-slate-700/80 transition-all hover:border-slate-600 active:scale-98"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </main>
  );
}
