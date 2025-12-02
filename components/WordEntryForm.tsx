import React, { useState, useRef } from 'react';
import { Loader2, Sparkles, CheckCircle, AlertCircle, Camera, Image as ImageIcon, X, Trash2 } from 'lucide-react';
import { analyzeWordsBatch, extractWordsFromImage } from '../services/geminiService';
import { WordEntry, QuestionType, AnalysisResult } from '../types';

interface WordEntryFormProps {
  onAddWord: (entry: WordEntry) => void;
}

interface DraftEntry {
  id: string;
  word: string;
  analysis: AnalysisResult | null;
  enabledTypes: QuestionType[];
  status: 'pending' | 'analyzing' | 'done' | 'error';
}

const WordEntryForm: React.FC<WordEntryFormProps> = ({ onAddWord }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  // Default exam types selected by the user
  const [defaultTypes, setDefaultTypes] = useState<QuestionType[]>([QuestionType.PINYIN, QuestionType.DICTATION]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse input text into unique words
  const getUniqueWords = (text: string) => {
    return Array.from(new Set(
      text.split(/[ \n,，、;；]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0)
    ));
  };

  const toggleDefaultType = (type: QuestionType) => {
    setDefaultTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  const handleAnalyze = async () => {
    const words = getUniqueWords(inputText);
    if (words.length === 0) return;
    
    setIsProcessing(true);
    setProcessingStatus('正在批量分析字词...');
    
    try {
      // 1. Create initial drafts using the USER SELECTED defaultTypes
      const newDrafts: DraftEntry[] = words.map(w => ({
        id: crypto.randomUUID(),
        word: w,
        analysis: null,
        enabledTypes: [...defaultTypes], // Use the state here
        status: 'analyzing'
      }));
      setDrafts(newDrafts);

      // 2. Call Batch API
      const results = await analyzeWordsBatch(words);

      // 3. Update drafts with results
      setDrafts(prev => prev.map(draft => {
        const res = results[draft.word];
        if (res) {
          // Start with user preferences
          let types = [...defaultTypes];
          
          // CRITICAL: If user wanted DEFINITION but API returned null, remove it
          if (types.includes(QuestionType.DEFINITION) && !res.definitionData) {
            types = types.filter(t => t !== QuestionType.DEFINITION);
          }

          return { ...draft, analysis: res, enabledTypes: types, status: 'done' };
        } else {
          return { ...draft, status: 'error' };
        }
      }));
      
      // Clear input after successful analysis
      setInputText('');

    } catch (err) {
      console.error(err);
      setProcessingStatus('分析出错，请重试');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus('正在识别图片中的文字...');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const extractedWords = await extractWordsFromImage(base64String, file.type);
        
        if (extractedWords.length > 0) {
          const currentText = inputText.trim();
          const newText = currentText ? `${currentText} ${extractedWords.join(' ')}` : extractedWords.join(' ');
          setInputText(newText);
        }
        setIsProcessing(false);
        setProcessingStatus('');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setProcessingStatus('图片识别失败');
      setIsProcessing(false);
    }
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveAll = () => {
    const validDrafts = drafts.filter(d => d.status === 'done' && d.analysis);
    
    // Check if analysis returned nothing (likely API key issue)
    if (validDrafts.length === 0 && drafts.length > 0 && drafts.every(d => d.status === 'error')) {
      alert("警告：未检测到有效结果。请检查 Vercel 环境变量 API_KEY 配置是否正确，或尝试刷新页面。");
      return;
    }

    validDrafts.forEach(draft => {
      if (!draft.analysis) return;
      onAddWord({
        id: draft.id,
        word: draft.word,
        pinyin: draft.analysis.pinyin,
        createdAt: Date.now(),
        definitionData: draft.analysis.definitionData || undefined,
        enabledTypes: draft.enabledTypes
      });
    });

    setDrafts([]);
  };

  const removeDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const toggleType = (draftId: string, type: QuestionType) => {
    setDrafts(prev => prev.map(d => {
      if (d.id !== draftId) return d;
      const types = d.enabledTypes.includes(type)
        ? d.enabledTypes.filter(t => t !== type)
        : [...d.enabledTypes, type];
      return { ...d, enabledTypes: types };
    }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <Sparkles className="w-5 h-5 mr-2 text-primary" />
        批量录入
      </h2>

      {/* Input Area */}
      <div className="mb-4">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入多个字词，用空格或逗号分隔。或者点击右下角相机图标上传图片。"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[100px] resize-y"
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
              title="拍照/上传图片识别"
            >
              <Camera className="w-5 h-5" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>
        </div>

        {/* Default Exam Types Selection */}
        <div className="flex flex-wrap items-center gap-4 mt-3 pl-1">
          <span className="text-sm text-gray-600 font-medium">默认考点:</span>
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={defaultTypes.includes(QuestionType.PINYIN)}
              onChange={() => toggleDefaultType(QuestionType.PINYIN)}
              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <span className="text-sm text-gray-700">拼音</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={defaultTypes.includes(QuestionType.DICTATION)}
              onChange={() => toggleDefaultType(QuestionType.DICTATION)}
              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <span className="text-sm text-gray-700">书写</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={defaultTypes.includes(QuestionType.DEFINITION)}
              onChange={() => toggleDefaultType(QuestionType.DEFINITION)}
              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <span className="text-sm text-gray-700">字义</span>
          </label>
        </div>
        
        <div className="flex justify-between items-center mt-4 border-t pt-3">
          <div className="text-sm text-gray-500">
             {processingStatus && (
               <span className="flex items-center text-primary">
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                 {processingStatus}
               </span>
             )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isProcessing || !inputText.trim()}
            className="bg-primary hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始分析
          </button>
        </div>
      </div>

      {/* Drafts Review Area */}
      {drafts.length > 0 && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-gray-700">识别结果 ({drafts.length})</h3>
            <button
              onClick={handleSaveAll}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center shadow-sm"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              确认添加全部
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {drafts.map((draft) => (
              <div key={draft.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 relative group animate-fade-in">
                <button 
                  onClick={() => removeDraft(draft.id)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {draft.status === 'analyzing' ? (
                   <div className="flex items-center text-gray-500 py-2">
                     <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                     分析中: {draft.word}
                   </div>
                ) : draft.status === 'error' ? (
                   <div className="flex items-center text-red-500 py-2">
                     <AlertCircle className="w-4 h-4 mr-2" />
                     分析失败: {draft.word}
                   </div>
                ) : (
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Word Info */}
                    <div className="min-w-[120px]">
                      <div className="text-xl font-bold font-serif text-gray-900">{draft.word}</div>
                      <div className="text-primary font-medium">{draft.analysis?.pinyin}</div>
                    </div>

                    {/* Options Config */}
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-3">
                         <button
                           onClick={() => toggleType(draft.id, QuestionType.PINYIN)}
                           className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${draft.enabledTypes.includes(QuestionType.PINYIN) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}
                         >
                           拼音
                         </button>
                         <button
                           onClick={() => toggleType(draft.id, QuestionType.DICTATION)}
                           className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${draft.enabledTypes.includes(QuestionType.DICTATION) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}
                         >
                           书写
                         </button>
                         {draft.analysis?.definitionData && (
                           <button
                            onClick={() => toggleType(draft.id, QuestionType.DEFINITION)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${draft.enabledTypes.includes(QuestionType.DEFINITION) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}
                           >
                             字义
                           </button>
                         )}
                      </div>

                      {/* Definition Preview */}
                      {draft.analysis?.definitionData && (
                        <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-100">
                          <span className="font-semibold text-gray-700">释义题:</span> "{draft.analysis.definitionData.targetChar}" 的意思是?
                          <span className="ml-2 text-gray-400">(答案: {draft.analysis.definitionData.options[draft.analysis.definitionData.correctIndex]})</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WordEntryForm;