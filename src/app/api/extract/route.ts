import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API key is not configured" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Analyze this receipt image and extract the following information.
      Return ONLY a JSON object with the following keys exactly as specified, no markdown, no other text:
      {
        "merchantName": "Name of the store or merchant (string)",
        "date": "Date of the transaction in YYYY-MM-DD format (string)",
        "time": "Time of the transaction (e.g. 14:30, 2:30 PM) (string)",
        "receiptNumber": "Receipt, invoice, or ticket ID (string)",
        "tax": "Tax amount, SST, GST, or VAT, just the number (string)",
        "totalAmount": "Total amount paid, just the number (string)",
        "currency": "The currency symbol or code (e.g., $, USD, RM, EUR) (string)",
        "category": "Classify the receipt into one of these exactly: Food, Transport, Shopping, or Others (string)",
        "items": [
          {
            "name": "Description of the item purchased (string)",
            "quantity": "Quantity of the item purchased (number)",
            "price": "Item total cost, just the number (string)"
          }
        ]
      }
      If a field cannot be found, return an empty string for that field (or empty array for items).
    `;

    const imageParts = [
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: file.type,
        },
      },
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Try to parse the text as JSON
    try {
      let cleanText = text.trim();
      // Remove markdown code block if present
      if (cleanText.startsWith("\`\`\`json")) {
        cleanText = cleanText.substring(7);
      }
      if (cleanText.endsWith("\`\`\`")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }

      const parsedData = JSON.parse(cleanText);
      return NextResponse.json(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini response:", text);
      return NextResponse.json(
        { error: "Failed to parse receipt data" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error processing receipt:", error);

    // Check if it is a rate limit / quota exceeded error
    if (
      error?.status === 429 ||
      error?.statusText === "Too Many Requests" ||
      error?.message?.includes("429") ||
      error?.message?.includes("quota") ||
      error?.message?.includes("Too Many Requests")
    ) {
      return NextResponse.json(
        { error: "Gemini API rate limit exceeded. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
