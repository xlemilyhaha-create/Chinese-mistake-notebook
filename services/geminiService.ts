
import { AnalysisResult, EntryType } from "../types";

// --- GEMINI ANALYZER (Pure Backend Proxy) ---

const analyzeWithGeminiBackend = async (payload: any) => {
  // Use AbortController to enforce a timeout (60s to match Vercel function limits)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); 

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType || !contentType.includes("application/json")) {
      // If server error or HTML returned (Preview environment), just throw.
      // We do NOT fallback to client-side key because we want to be secure.
      throw new Error(`Backend API failure: ${response.status} ${response.statusText}`);
    }

    return await response.json();

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Analysis Error:", error);
    // Re-throw to let the UI show the error state
    throw error;
  }
};


// --- EXPORTED FUNCTIONS ---

export const analyzeWord = async (word: string): Promise<AnalysisResult> => {
  try {
    const data = await analyzeWithGeminiBackend({ type: 'word', text: word });
    return mapDataToResult(data);
  } catch (error) {
    console.error(`Failed to analyze word: ${word}`, error);
    // Return error state so UI shows red icon
    return { type: EntryType.WORD, word, pinyin: "Error", definitionData: null, definitionMatchData: null };
  }
};

export const analyzeWordsBatch = async (words: string[]): Promise<Record<string, AnalysisResult>> => {
  const results: Record<string, AnalysisResult> = {};
  // Process sequentially or in small parallel batches to avoid overwhelming the server
  // but here we just call analyzeWord which calls the backend
  for (const word of words) {
    results[word] = await analyzeWord(word);
  }
  return results;
};

export const analyzePoem = async (input: string): Promise<AnalysisResult | null> => {
  try {
    const data = await analyzeWithGeminiBackend({ type: 'poem', text: input });
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
    console.error("Poem Analysis Error:", error);
    return null;
  }
};

export const extractWordsFromImage = async (base64Data: string, mimeType: string): Promise<string[]> => {
  try {
    const data = await analyzeWithGeminiBackend({ type: 'ocr', image: base64Data });
    return data.words || [];
  } catch (error) {
    console.error("OCR Error:", error);
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
