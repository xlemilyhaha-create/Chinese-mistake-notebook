
import { AnalysisResult, EntryType } from "../types";

// --- AI ANALYZER (Pure Backend Proxy) ---

export interface ApiError {
  message: string;
  code?: number;
  type?: 'network' | 'timeout' | 'server' | 'overloaded' | 'unknown';
  retryable?: boolean;
}

const analyzeWithGeminiBackend = async (payload: any): Promise<any> => {
  console.log('[API] analyzeWithGeminiBackend 被调用, payload:', payload);
  
  // Use AbortController to enforce a timeout (60s to match Vercel function limits)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); 

  try {
    console.log('[API] 准备发起 fetch 请求到 /api/analyze');
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    console.log('[API] fetch 请求完成, status:', response.status);

    const contentType = response.headers.get("content-type");
    
    // Parse error response
    if (!response.ok) {
      let errorData: any = {};
      try {
        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json();
        }
      } catch (e) {
        // Ignore JSON parse errors
      }

      const error: ApiError = {
        message: errorData.error || errorData.message || `服务器错误: ${response.status}`,
        code: response.status,
        type: 'server',
        retryable: false
      };

      // Handle specific error types
      if (response.status === 503) {
        error.type = 'overloaded';
        error.message = 'AI 服务暂时过载，请稍后重试';
        error.retryable = true;
      } else if (response.status === 429) {
        error.type = 'overloaded';
        error.message = '请求过于频繁，请稍后重试';
        error.retryable = true;
      } else if (response.status === 500) {
        error.message = errorData.error?.includes('API Key') 
          ? 'API 密钥配置错误，请检查配置'
          : '服务器内部错误，请稍后重试';
        error.retryable = true;
      } else if (response.status >= 400 && response.status < 500) {
        error.message = errorData.error || '请求参数错误';
        error.retryable = false;
      }

      throw error;
    }

    if (!contentType || !contentType.includes("application/json")) {
      throw {
        message: '服务器返回格式错误',
        type: 'server' as const,
        retryable: false
      } as ApiError;
    }

    return await response.json();

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle abort (timeout)
    if (error.name === 'AbortError') {
      throw {
        message: '请求超时，请检查网络连接后重试',
        type: 'timeout' as const,
        retryable: true
      } as ApiError;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw {
        message: '网络连接失败，请检查网络设置',
        type: 'network' as const,
        retryable: true
      } as ApiError;
    }

    // If it's already an ApiError, re-throw it
    if (error.type) {
      throw error;
    }

    // Unknown error
    console.error("Analysis Error:", error);
    throw {
      message: error.message || '未知错误，请稍后重试',
      type: 'unknown' as const,
      retryable: true
    } as ApiError;
  }
};


// --- EXPORTED FUNCTIONS ---

export const analyzeWord = async (word: string): Promise<AnalysisResult | { error: ApiError }> => {
  console.log(`[API] analyzeWord 被调用, word: ${word}`);
  try {
    const data = await analyzeWithGeminiBackend({ type: 'word', text: word });
    console.log(`[API] analyzeWord 完成, word: ${word}, data:`, data);
    return mapDataToResult(data);
  } catch (error: any) {
    console.error(`[API] Failed to analyze word: ${word}`, error);
    // Return error object so UI can display specific error message
    return { 
      type: EntryType.WORD, 
      word, 
      pinyin: "Error", 
      definitionData: null, 
      definitionMatchData: null,
      error: error as ApiError
    } as any;
  }
};

export const analyzeWordsBatch = async (words: string[]): Promise<Record<string, AnalysisResult | { error: ApiError }>> => {
  const results: Record<string, AnalysisResult | { error: ApiError }> = {};
  // Process sequentially or in small parallel batches to avoid overwhelming the server
  // but here we just call analyzeWord which calls the backend
  for (const word of words) {
    results[word] = await analyzeWord(word);
  }
  return results;
};

export const analyzePoem = async (input: string): Promise<AnalysisResult | { error: ApiError } | null> => {
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
  } catch (error: any) {
    console.error("Poem Analysis Error:", error);
    return { error: error as ApiError } as any;
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
