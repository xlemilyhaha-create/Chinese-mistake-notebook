
import React, { useState, useRef } from 'react';
import { Loader2, CheckCircle, AlertCircle, Camera, Image as ImageIcon, X, ScrollText, Type, RefreshCw, Info } from 'lucide-react';
import { analyzeWordsBatch, extractWordsFromImage, analyzePoem } from '../services/geminiService';
import { WordEntry, QuestionType, AnalysisResult, EntryType, TestStatus } from '../types';

interface WordEntryFormProps {
  onAddWord: (entry: WordEntry) => void;
}

interface DraftEntry {
  id: string;
  word: string;
  analysis: AnalysisResult | null;
  enabledTypes: QuestionType[];
  status: 'pending' | 'analyzing' | 'done' | 'error';
  errorMsg?: string;
  type: EntryType;
}

const WordEntryForm: React.FC<WordEntryFormProps> = ({ onAddWord }) => {
  const [activeTab, setActiveTab] = useState<EntryType>(EntryType.WORD);
  const [inputText, setInputText] = useState('');
  const [defaultTypes, setDefaultTypes] = useState<QuestionType[]>([QuestionType.PINYIN, QuestionType.DICTATION, QuestionType.DEFINITION_MATCH]);
  const [poemInput, setPoemInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUniqueWords = (text: string) => {
    const normalized = text.replace(/\s+(vs|VS)\s+/g, ' vs ')
                           .replace(/([^\s])(\/|\|)([^\s])/g, '$1 / $3');
    
    const lines = normalized.split(/[\n,，、;；]+/).map(w => w.trim()).filter(w => w.length > 0);
    
    const results: string[] = [];
    lines.forEach(line => {
      if (line.toLowerCase().includes(' vs ') || line.includes('/') || line.includes('和')) {
        results.push(line);
      } else {
        const parts = line.split(/\s+/).filter(p => p.length > 0);
        results.push(...parts);
      }
    });
    
    return Array.from(new Set(results));
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const performAnalysis = async (wordsToAnalyze: string[]) => {
    if (wordsToAnalyze.length === 0) return;
    setIsProcessing(true);
    const CHUNK_SIZE = 3;
    const wordChunks = [];
    for (let i = 0; i < wordsToAnalyze.length; i += CHUNK_SIZE) {
      wordChunks.push(wordsToAnalyze.slice(i, i + CHUNK_SIZE));
    }
    let processedCount = 0;
    for (const chunk of wordChunks) {
      setDrafts(prev => prev.map(d => chunk.includes(d.word) && d.status !== 'done' ? { ...d, status: 'analyzing', errorMsg: undefined } : d));
      setProcessingStatus(`分析中... (${processedCount}/${wordsToAnalyze.length})`);
      try {
        const batchResults = await analyzeWordsBatch(chunk);
        setDrafts(prev => prev.map(d => {
          if (!chunk.includes(d.word)) return d;
          
          // 模糊匹配：忽略空格和大小写
          const findMatch = (target: string) => {
             const clean = (s: string) => s.replace(/\s+/g, '').toLowerCase();
             return batchResults.find(r => clean(r.word) === clean(target));
          };

          const result = findMatch(d.word);
          if (result) {
            let types = [...d.enabledTypes];
            if (!result.definitionData) types = types.filter(t => t !== QuestionType.DEFINITION);
            if (!result.definitionMatchData) types = types.filter(t => t !== QuestionType.DEFINITION_MATCH);
            return { ...d, analysis: result, enabledTypes: types, status: 'done' };
          } else {
            return { ...d, status: 'error', errorMsg: 'AI未返回结果' };
          }
        }));
      } catch (e: any) {
        const errorMsg = e.message?.includes('429') ? '服务器繁忙' : '分析超时';
        setDrafts(prev => prev.map(d => chunk.includes(d.word) && d.status === 'analyzing' ? { ...d, status: 'error', errorMsg } : d));
      }
      processedCount += chunk.length;
      if (processedCount < wordsToAnalyze.length) {
        await delay(3000);
      }
    }
    setProcessingStatus('');
    setIsProcessing(false);
  };

  const handleAnalyzeWords = async () => {
    const words = getUniqueWords(inputText);
    if (words.length === 0) return;
    const initialDrafts: DraftEntry[] = words.map(w => ({
      id: crypto.randomUUID(),
      word: w,
      analysis: null,
      enabledTypes: [...defaultTypes],
      status: 'pending',
      type: EntryType.WORD
    }));
    setDrafts(initialDrafts);
    setInputText('');
    await performAnalysis(words);
  };

  const handleRetryFailed = async () => {
    const failedWords = drafts.filter(d => d.status === 'error').map(d => d.word);
    if (failedWords.length === 0) return;
    setDrafts(prev => prev.map(d => d.status === 'error' ? { ...d, status: 'pending', errorMsg: undefined } : d));
    await performAnalysis(failedWords);
  };

  const handleAnalyzePoem = async () => {
    if (!poemInput.trim()) return;
    setIsProcessing(true);
    setProcessingStatus('正在分析古诗词...');
    try {
       const res = await analyzePoem(poemInput);
       if (res) {
         setDrafts([{
           id: crypto.randomUUID(),
           word: res.word,
           analysis: res,
           enabledTypes: [QuestionType.POEM_FILL, QuestionType.POEM_DEFINITION],
           status: 'done',
           type: EntryType.POEM
         }]);
         setPoemInput('');
       }
    } catch (err) {
      setProcessingStatus('分析出错');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const processBase64Image = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setProcessingStatus('正在识别图片...');
    try {
      const extractedWords = await extractWordsFromImage(base64, mimeType);
      if (extractedWords.length > 0) {
        setInputText(prev => prev ? `${prev} ${extractedWords.join(' ')}` : extractedWords.join(' '));
      }
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      processBase64Image(base64String, file.type);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveAll = () => {
    const validDrafts = drafts.filter(d => d.status === 'done' && d.analysis);
    validDrafts.forEach(draft => {
      if (!draft.analysis) return;
      onAddWord({
        id: draft.id,
        type: draft.type,
        word: draft.word,
        pinyin: draft.analysis.pinyin,
        createdAt: Date.now(),
        definitionData: draft.analysis.definitionData || undefined,
        definitionMatchData: draft.analysis.definitionMatchData || undefined,
        poemData: draft.analysis.poemData,
        enabledTypes: draft.enabledTypes,
        testStatus: TestStatus.UNTESTED,
        passedAfterRetries: false
      });
    });
    setDrafts([]);
  };

  const toggleEditType = (draftId: string, type: QuestionType) => {
    setDrafts(prev => prev.map(d => {
      if (d.id !== draftId) return d;
      const types = d.enabledTypes.includes(type)
        ? d.enabledTypes.filter(t => t !== type)
        : [...d.enabledTypes, type];
      return { ...d, enabledTypes: types };
    }));
  };

  const hasFailedItems = drafts.some(d => d.status === 'error');
  const finishedItemsCount = drafts.filter(d => d.status === 'done').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-2">
        <button onClick={() => setActiveTab(EntryType.WORD)} className={`flex items-center gap-2 pb-2 text-sm font-bold transition-colors border-b-2 ${activeTab === EntryType.WORD ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Type className="w-4 h-4" /> 生字词录入
        </button>
        <button onClick={() => setActiveTab(EntryType.POEM)} className={`flex items-center gap-2 pb-2 text-sm font-bold transition-colors border-b-2 ${activeTab === EntryType.POEM ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <ScrollText className="w-4 h-4" /> 古诗词录入
        </button>
      </div>

      {activeTab === EntryType.WORD ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative mb-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入字词，或录入近义词组如 '改善 vs 改变'。"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none min-h-[100px] resize-y"
            />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"><ImageIcon className="w-5 h-5" /></button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="text-sm text-gray-600 font-medium">默认考点:</span>
            {[QuestionType.PINYIN, QuestionType.DICTATION, QuestionType.DEFINITION, QuestionType.DEFINITION_MATCH].map(t => (
               <label key={t} className="flex items-center space-x-2 cursor-pointer select-none">
                 <input type="checkbox" checked={defaultTypes.includes(t)} onChange={() => setDefaultTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} className="w-4 h-4 text-primary rounded border-gray-300" />
                 <span className="text-sm text-gray-700 font-medium">{{ [QuestionType.PINYIN]: '注音', [QuestionType.DICTATION]: '书写', [QuestionType.DEFINITION]: '释义', [QuestionType.DEFINITION_MATCH]: '辨析' }[t]}</span>
               </label>
            ))}
          </div>
          <div className="flex justify-between items-center border-t pt-3">
             <div className="text-sm text-gray-500">
               {processingStatus && <span className="flex items-center text-primary font-medium"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {processingStatus}</span>}
             </div>
             <button onClick={handleAnalyzeWords} disabled={isProcessing || !inputText.trim()} className="bg-primary hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100">开始分析</button>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <textarea value={poemInput} onChange={(e) => setPoemInput(e.target.value)} placeholder="输入诗名或全诗内容。" className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none min-h-[120px]" />
          <div className="flex justify-between items-center border-t pt-3">
             <div className="text-sm text-gray-500">{processingStatus && <span className="flex items-center text-primary font-medium"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {processingStatus}</span>}</div>
             <button onClick={handleAnalyzePoem} disabled={isProcessing || !poemInput.trim()} className="bg-primary hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all transform active:scale-95 disabled:opacity-50">分析古诗</button>
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-gray-800">识别结果 ({finishedItemsCount}/{drafts.length})</h3>
            <div className="flex gap-2">
              {hasFailedItems && (
                <button onClick={handleRetryFailed} disabled={isProcessing} className="bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center disabled:opacity-50"><RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} /> 重试失败项</button>
              )}
              <button onClick={handleSaveAll} disabled={isProcessing || finishedItemsCount === 0} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center shadow-sm disabled:opacity-50"><CheckCircle className="w-4 h-4 mr-2" /> 确认添加全部</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
            {drafts.map((draft) => (
              <div key={draft.id} className={`rounded-lg p-4 border relative group transition-all duration-300 ${draft.status === 'error' ? 'bg-red-50 border-red-200' : draft.status === 'analyzing' ? 'bg-indigo-50 border-indigo-200 shadow-inner' : 'bg-gray-50 border-gray-200'}`}>
                <button onClick={() => setDrafts(prev => prev.filter(d => d.id !== draft.id))} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                <div className="flex flex-col gap-1">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2">
                    {draft.word} 
                    {draft.status === 'done' && draft.analysis?.pinyin && <span className="text-primary text-sm font-normal">{draft.analysis.pinyin}</span>}
                    {draft.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {draft.status === 'done' ? (
                      <>
                        {draft.type === EntryType.WORD ? (
                          <>
                            {['注音', '书写', '释义', '辨析'].map((label, idx) => {
                              const type = [QuestionType.PINYIN, QuestionType.DICTATION, QuestionType.DEFINITION, QuestionType.DEFINITION_MATCH][idx];
                              const isAvailable = (idx < 2 && !draft.word.includes(' vs ') && !draft.word.includes('/')) || (idx === 2 && draft.analysis?.definitionData) || (idx === 3 && draft.analysis?.definitionMatchData);
                              if (!isAvailable && idx !== 3) return null;
                              return <button key={type} onClick={() => toggleEditType(draft.id, type)} className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${draft.enabledTypes.includes(type) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{label}</button>
                            })}
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic">古诗分析完成</span>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col gap-1 w-full">
                        <span className="text-xs flex items-center text-gray-500 font-medium">
                          {draft.status === 'analyzing' && <><Loader2 className="w-3 h-3 mr-1.5 animate-spin text-primary" /> 深度分析中...</>}
                          {draft.status === 'pending' && <span className="text-gray-400">队列等待中</span>}
                          {draft.status === 'error' && <><AlertCircle className="w-3 h-3 mr-1.5 text-red-500" /> 分析失败</>}
                        </span>
                        {draft.errorMsg && <span className="text-[10px] text-red-500 bg-red-100/50 px-2 py-0.5 rounded flex items-center"><Info className="w-2.5 h-2.5 mr-1" /> {draft.errorMsg}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WordEntryForm;
