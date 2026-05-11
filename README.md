# 🧾 Receipt-to-Form Auto-Fill Web App

A sleek, modern web application that takes the pain out of expense reporting! Just upload a picture of a receipt, and watch as our AI magically extracts the merchant name, date, total amount, and currency.

Built with **Next.js**, styled beautifully with **Tailwind CSS**, and powered by the **Google Gemini API**.

## ✨ Features
- **AI-Powered Extraction**: Uses advanced multimodal AI to read receipts accurately.
- **Modern UI**: Stunning glassmorphism design with a dynamic, responsive layout.
- **Local Storage**: Automatically saves your processed receipts directly in your browser.
- **Secure Backend**: All AI communication is handled securely via Next.js API routes, keeping your API key safe.

## 🧠 How it Works (Model & Prompt)

This application leverages Google's **`gemini-2.5-flash`** model, which is incredibly fast and excellent at multimodal tasks (reading images).

**The exact prompt we use under the hood:**
\`\`\`text
Analyze this receipt image and extract the following information.
Return ONLY a JSON object with the following keys exactly as specified, no markdown, no other text:
{
  "merchantName": "Name of the store or merchant (string)",
  "date": "Date of the transaction in YYYY-MM-DD format (string)",
  "totalAmount": "Total amount paid, just the number (string)",
  "currency": "The currency symbol or code (e.g., $, USD, EUR) (string)"
}
If a field cannot be found, return an empty string for that field.
\`\`\`

## 🚀 How to Run It Locally

### 1. Prerequisites
- Node.js installed on your machine.
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2. Setup
Clone or download the repository, then navigate to the folder in your terminal:
\`\`\`bash
cd receipt-app
\`\`\`

Install the dependencies:
\`\`\`bash
npm install
\`\`\`

### 3. Configure API Key
Create a file named \`.env.local\` in the root directory and add your API key:
\`\`\`env
GEMINI_API_KEY=your_actual_api_key_here
\`\`\`

### 4. Start the Magic
Run the development server:
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser and start uploading receipts!

---
*Built with ❤️ and AI.*
