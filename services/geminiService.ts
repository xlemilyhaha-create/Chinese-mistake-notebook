import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to clean markdown formatting from JSON response
const cleanJson = (text: string | undefined): string => {
  if (!text) return '{}';
  let cleaned = text.trim();
  // Remove markdown code blocks if present (e.g., ```json ... ```)
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  return cleaned;
};

// Reusable schema properties for a single word entry
const itemSchemaProperties = {
  word: { type: Type.STRING, description: "The exact Chinese word from the input list." },
  pinyin: {
    type: Type.STRING,
    description: "The correct pinyin for the word with tone marks. IMPORTANT: separate each character's pinyin with a space (e.g., 'jīng yì qiú jīng').",
  },
  hasDefinitionQuestion: {
    type: Type.BOOLEAN,
    description: "Whether a multiple choice definition question can be generated for a specific character in this word.",
  },
  targetChar: {
    type: Type.STRING,
    description: "The specific character to test definition for. If no specific hard character, pick the most difficult one.",
    nullable: true,
  },
  options: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: "4 options for the meaning of the targetChar. One is correct, three are plausible distractors.",
    nullable: true,
  },
  correctIndex: {
    type: Type.INTEGER,
    description: "The index (0-3) of the correct option in the options array.",
    nullable: true,
  },
};

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: itemSchemaProperties,
  required: ["pinyin", "hasDefinitionQuestion", "word"],
};

// Changed to Root Object -> items Array for stability
const batchAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: itemSchemaProperties,
        required: ["pinyin", "hasDefinitionQuestion", "word"],
      },
    },
  },
};

const ocrSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    words: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of Chinese words or idioms found in the image."
    }
  }
};

export const analyzeWord = async (word: string): Promise<AnalysisResult> => {
  if (!apiKey) {
    console.error("Gemini API Key is missing. Check your environment variables.");
    return { pinyin: "wèi pèi zhì", definitionData: null };
  }

  try {
    const prompt = `
      Analyze the Chinese word: "${word}".
      1. Provide Pinyin with tones. Separate each character's pinyin with a space.
      2. Create a definition test for the hardest character.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: analysisSchema,
      }
    });

    const data = JSON.parse(cleanJson(response.text));
    return mapDataToResult(data);

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { pinyin: "Error", definitionData: null };
  }
};

export const analyzeWordsBatch = async (words: string[]): Promise<Record<string, AnalysisResult>> => {
  if (!apiKey) {
    console.error("Gemini API Key is missing in batch request. Ensure 'API_KEY' is set in Vercel and exposed via vite.config.ts.");
    // Log slightly more info to help debug in browser console
    console.log("Current process.env.API_KEY is:", process.env.API_KEY ? "Present (Hidden)" : "UNDEFINED");
    return {};
  }
  
  if (words.length === 0) return {};

  try {
    const prompt = `
      Analyze the following list of Chinese words: ${JSON.stringify(words)}.
      For each word:
      1. Provide Pinyin with tones. MUST separate each character's pinyin with a space (e.g. "měi lì" not "měilì").
      2. Identify the most challenging character and create a definition multiple-choice question.
      Return a JSON object with an 'items' array containing the results.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: batchAnalysisSchema,
      }
    });

    const rawText = cleanJson(response.text);
    const data = JSON.parse(rawText);
    
    // Handle both { items: [...] } (expected) and raw array (fallback)
    const itemsArray = Array.isArray(data) ? data : (data.items || []);

    const results: Record<string, AnalysisResult> = {};
    if (Array.isArray(itemsArray)) {
      itemsArray.forEach((item: any) => {
        if (item.word) {
          // Normalize key just in case (trim)
          results[item.word.trim()] = mapDataToResult(item);
        }
      });
    }
    return results;

  } catch (error) {
    console.error("Batch Analysis Error:", error);
    return {};
  }
};

export const extractWordsFromImage = async (base64Data: string, mimeType: string): Promise<string[]> => {
  if (!apiKey) {
    console.error("Gemini API Key is missing for OCR.");
    return ["请配置", "API", "KEY"];
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Identify all Chinese vocabulary words, idioms, or distinct terms in this image. Ignore simplified/traditional differences. Return a simple list." }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: ocrSchema,
      }
    });

    const data = JSON.parse(cleanJson(response.text));
    return data.words || [];

  } catch (error) {
    console.error("OCR Error:", error);
    return [];
  }
};

function mapDataToResult(data: any): AnalysisResult {
  return {
    pinyin: data.pinyin,
    definitionData: data.hasDefinitionQuestion && data.options && data.options.length === 4 ? {
      targetChar: data.targetChar || data.word?.[0] || '?',
      options: data.options,
      correctIndex: typeof data.correctIndex === 'number' ? data.correctIndex : 0,
    } : null
  };
}