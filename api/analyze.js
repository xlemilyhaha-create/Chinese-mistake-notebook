
import { GoogleGenAI, Type } from "@google/genai";

// Default to Node.js runtime (more stable for Google SDK than Edge)
const apiKey = process.env.API_KEY;

// --- SCHEMAS ---
const itemSchemaProperties = {
  word: { type: Type.STRING },
  pinyin: { type: Type.STRING },
  hasDefinitionQuestion: { type: Type.BOOLEAN },
  targetChar: { type: Type.STRING, nullable: true },
  options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  correctIndex: { type: Type.INTEGER, nullable: true },
  hasMatchQuestion: { type: Type.BOOLEAN },
  matchOptions: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  matchCorrectIndex: { type: Type.INTEGER, nullable: true }
};

const singleAnalysisSchema = {
  type: Type.OBJECT,
  properties: itemSchemaProperties,
  required: ["pinyin", "word"],
};

const poemSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    dynasty: { type: Type.STRING },
    author: { type: Type.STRING },
    content: { type: Type.STRING },
    lines: { type: Type.ARRAY, items: { type: Type.STRING } },
    fillQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lineIndex: { type: Type.INTEGER },
          pre: { type: Type.STRING },
          answer: { type: Type.STRING },
          post: { type: Type.STRING },
        }
      }
    },
    definitionQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lineIndex: { type: Type.INTEGER },
          targetChar: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
        }
      }
    }
  },
  required: ["title", "author", "lines"]
};

const ocrSchema = {
  type: Type.OBJECT,
  properties: {
    words: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
};

// Helper to clean JSON
const cleanJson = (text) => {
  if (!text) return '{}';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
};

export default async function handler(req, res) {
  // CORS Handling (Optional for Vercel, but good practice)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!apiKey) {
    console.error("CRITICAL: Server API Key is missing in environment variables.");
    return res.status(500).json({ error: "Server API Key missing. Please configure API_KEY in Vercel Settings." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { type, text, image } = req.body;

    let model = 'gemini-2.5-flash';
    let prompt = '';
    let schema = null;
    let parts = [];

    switch (type) {
      case 'word':
        prompt = `
          Analyze the Chinese word: "${text}".
          1. Provide Pinyin with tones (space separated).
          2. Create Definition Test (Meaning).
          3. Create Definition Match Test (Same character meaning).
          Options must be in Simplified Chinese.
        `;
        schema = singleAnalysisSchema;
        parts = [{ text: prompt }];
        break;

      case 'poem':
        prompt = `
          Analyze this Chinese poem text/request: "${text}".
          1. Identify the Title, Author, Dynasty, and content.
          2. Split into lines.
          3. Create 1-2 "Fill in the blank" questions.
          4. Create 1-2 "Definition" questions.
          Options must be in SIMPLIFIED CHINESE.
        `;
        schema = poemSchema;
        parts = [{ text: prompt }];
        break;

      case 'ocr':
        prompt = "Identify all Chinese vocabulary words, idioms, or distinct terms in this image. Return a simple list.";
        schema = ocrSchema;
        parts = [
          { inlineData: { mimeType: 'image/jpeg', data: image } },
          { text: prompt }
        ];
        break;

      default:
        return res.status(400).json({ error: "Invalid request type" });
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });

    const cleanText = cleanJson(response.text);
    const jsonResponse = JSON.parse(cleanText);
    
    return res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Backend API Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error", details: error.toString() });
  }
}