
import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
};

const apiKey = process.env.API_KEY;

// --- SCHEMAS (Moved from frontend) ---
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

export default async function handler(request) {
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server API Key missing" }), { status: 500 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { type, text, image } = await request.json();

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
        return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400 });
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
    return new Response(cleanText, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
