
import { AnalysisResult, EntryType } from "../types";

// Note: We no longer import GoogleGenAI here. All AI logic is in /api/analyze.js

// --- HELPER TO CALL VERCEL API ---
const callApi = async (payload: any) => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Service Error:", error);
    throw error;
  }
};

// --- EXPORTED FUNCTIONS ---

export const analyzeWord = async (word: string): Promise<AnalysisResult> => {
  try {
    const data = await callApi({ type: 'word', text: word });
    return mapDataToResult(data);
  } catch (error) {
    return { type: EntryType.WORD, word, pinyin: "Error", definitionData: null, definitionMatchData: null };
  }
};

export const analyzeWordsBatch = async (words: string[]): Promise<Record<string, AnalysisResult>> => {
  // Although we process in parallel UI queue now, this function might still be used for legacy or bulk ops.
  // We will map it to individual calls or handle it one by one to reuse the robust 'analyzeWord' endpoint.
  // To avoid timeout on Vercel functions (10s limit on free tier), we prefer individual calls from the UI.
  // But if called, we do parallel fetch here.
  
  const results: Record<string, AnalysisResult> = {};
  
  // Process 5 at a time max
  const CHUNK_SIZE = 5;
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    const chunk = words.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (word) => {
        const res = await analyzeWord(word);
        results[word] = res;
    }));
  }

  return results;
};

export const analyzePoem = async (input: string): Promise<AnalysisResult | null> => {
  try {
    const data = await callApi({ type: 'poem', text: input });
    return {
      type: EntryType.POEM,
      word: data.title,
      pinyin: data.author,
      definitionData: null,
      definitionMatchData: null,
      poemData: {
        title: data.title,
        dynasty: data.dynasty,
        author: data.author,
        content: data.content,
        lines: data.lines || [],
        fillAnswers: data.fillQuestions || [],
        definitionQuestions: data.definitionQuestions || []
      }
    };
  } catch (error) {
    return null;
  }
};

export const extractWordsFromImage = async (base64Data: string, mimeType: string): Promise<string[]> => {
  try {
    const data = await callApi({ type: 'ocr', image: base64Data });
    return data.words || [];
  } catch (error) {
    return [];
  }
};

function mapDataToResult(data: any): AnalysisResult {
  return {
    type: EntryType.WORD,
    word: data.word,
    pinyin: data.pinyin,
    definitionData: data.hasDefinitionQuestion && data.options && data.options.length === 4 ? {
      targetChar: data.targetChar || data.word?.[0] || '?',
      options: data.options,
      correctIndex: typeof data.correctIndex === 'number' ? data.correctIndex : 0,
    } : null,
    definitionMatchData: data.hasMatchQuestion && data.matchOptions && data.matchOptions.length === 4 ? {
      targetChar: data.targetChar || data.word?.[0] || '?',
      options: data.matchOptions,
      correctIndex: typeof data.matchCorrectIndex === 'number' ? data.matchCorrectIndex : 0,
    } : null
  };
}
