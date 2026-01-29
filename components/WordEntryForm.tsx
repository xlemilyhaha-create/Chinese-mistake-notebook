import React, { useState, useRef, useMemo } from 'react';
import { Loader2, CheckCircle, AlertCircle, Camera, Image as ImageIcon, X, ScrollText, Type, RefreshCw, Info, AlertTriangle } from 'lucide-react';
import { analyzeWordsBatch, extractWordsFromImage, analyzePoem } from '../services/geminiService';
import { WordEntry, QuestionType, AnalysisResult, EntryType, TestStatus } from '../types';

interface DraftEntry {
  id: string;
  word: string;
  analysis: AnalysisResult | null;
  enabledTypes: QuestionType[];
  status: 'pending' | 'analyzing' | 'done' | 'error';
  errorMsg?: string;
  type: EntryType;
}

interface WordEntryFormProps {
  onAddWord: (entry: WordEntry) => void;
}

const MAX_BATCH_SIZE = 15; // 防止触发每分钟 15 次的 API 速率限制

const WordEntryForm: React.FC<WordEntryFormProps> = ({ onAddWord }) => {
  const [activeTab, setActiveTab] = useState<EntryType>(EntryType.WORD);
  const [inputText, setInputText] = useState('');
  // 修改：默认不勾选任何考点，强迫用户手动选择
  const [defaultTypes, setDefaultTypes] = useState<QuestionType[]>([]);
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

  // 实时计算当前输入的词语数量
  const detectedWords = useMemo(() => getUniqueWords(inputText), [inputText]);
  const isOverLimit = detectedWords.length > MAX_BATCH_SIZE;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const performAnalysis = async (wordsToAnalyze: string[]) => {
    if (wordsToAnalyze.length === 0) return;
    setIsProcessing(true);
    let processedCount = 0;
    let stoppedEarly = false;
    
    for (const word of wordsToAnalyze) {
      setDrafts(prev => prev.map(d => d.word === word && d.status !== 'done' ? { ...d, status: 'analyzing', errorMsg: undefined } : d));
      setProcessingStatus(`正在深度分析: ${word} (${processedCount + 1}/${wordsToAnalyze.length})`);
      
      try {
        const batchResults = await analyzeWordsBatch([word]);
        const result = batchResults[0];

        if (result) {
          setDrafts(prev => prev.map(d => {
            if (d.word !== word) return d;
            return { ...d, analysis: result, status: 'done' };
          }));
        } else {
          setDrafts(prev => prev.map(d => d.word === word ? { ...d, status: 'error', errorMsg: 'AI未返回结果' } : d));
        }
      } catch (e: any) {
        const isRateLimit = e.message?.includes('429') || e.message?.toLowerCase().includes('too many requests');
        
        let errorMsg = isRateLimit ? '服务器忙(请稍后重试)' : (e.message || '未知错误');
        
        // 简单的错误信息翻译，提升体验
        if (errorMsg.includes('API Key missing')) errorMsg = '未配置 API Key';
        else if (errorMsg.includes('timeout')) errorMsg = '请求超时';
        else if (errorMsg.includes('JSON')) errorMsg = 'AI返回格式错误';
        else if (errorMsg.startsWith('Error: ')) errorMsg = errorMsg.substring(7); // 去掉 "Error: " 前缀

        setDrafts(prev => prev.map(d => d.word === word ? { ...d, status: 'error', errorMsg } : d));
        
        if (isRateLimit) {
           setProcessingStatus(`触发频率限制，已停止后续请求`);
           stoppedEarly = true;
           break;
        }
      }
      processedCount++;
      if (processedCount < wordsToAnalyze.length) {
        setProcessingStatus(`正在准备下一个... (${processedCount}/${wordsToAnalyze.length})`);
        await delay(3000); 
      }
    }
    setIsProcessing(false);
    if (!stoppedEarly) {
      setProcessingStatus('');
    }
  };

  const handleAnalyzeWords = async () => {
    // 新增：校验是否选择了考点
    if (defaultTypes.length === 0) {
      alert("请至少选择一个默认考点（如：注音、书写等）后再开始分析。");
      return;
    }

    if (detectedWords.length === 0) return;
    if (isOverLimit) {
      alert(`为了保证分析质量，单次最多支持 ${MAX_BATCH_SIZE} 个词语，请分批录入。`);
      return;
    }

    const initialDrafts: DraftEntry[] = detectedWords.map(w => ({
      id: crypto.randomUUID(),
      word: w,
      analysis: null,
      enabledTypes: [...defaultTypes],
      status: 'pending',
      type: EntryType.WORD
    }));
    setDrafts(initialDrafts);
    setInputText('');
    await performAnalysis(detectedWords);
  };

  const handleRetryFailed = async () => {
    const failedItems = drafts.filter(d => d.status === 'error');
    if (failedItems.length === 0) return;
    const failedWords = failedItems.map(d => d.word);
    setDrafts(prev => prev.map(d => d.status === 'error' ? { ...d, status: 'pending', errorMsg: undefined } : d));
    await performAnalysis(failedWords);
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

  const finishedItemsCount = drafts.filter(d => d.status === 'done').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-2">
        <button onClick={() => { setActiveTab(EntryType.WORD); setProcessingStatus(''); }} className={`flex items-center gap-2 pb-2 text-sm font-bold transition-colors border-b-2 ${activeTab === EntryType.WORD ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Type className="w-4 h-4" /> 生字词录入
        </button>
        <button onClick={() => { setActiveTab(EntryType.POEM); setProcessingStatus(''); }} className={`flex items-center gap-2 pb-2 text-sm font-bold transition-colors border-b-2 ${activeTab === EntryType.POEM ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <ScrollText className="w-4 h-4" /> 古诗词录入
        </button>
      </div>

      {activeTab === EntryType.WORD ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative mb-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="多个字词可用空格、逗号等分隔。若考核拼音，也只需输入字词，选择“注音”考点即可。"
              className={`w-full border rounded-lg px-4 py-3 focus:ring-2 outline-none min-h-[100px] resize-y transition-colors ${isOverLimit ? 'border-orange-300 focus:ring-orange-200 bg-orange-50' : 'border-gray-300 focus:ring-primary'}`}
            />
            <div className={`text-xs text-right mt-1 font-medium transition-colors ${isOverLimit ? 'text-orange-600' : 'text-gray-400'}`}>
              已识别: {detectedWords.length} / {MAX_BATCH_SIZE}
            </div>
          </div>
          
          {isOverLimit && (
             <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 p-2 rounded mb-4 border border-orange-100">
               <AlertTriangle className="w-4 h-4 shrink-0" />
               为保证 AI 分析质量及防止接口限流，单次请勿超过 {MAX_BATCH_SIZE} 个词语。
             </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="text-sm text-gray-600 font-medium">默认考点(必选):</span>
            {[QuestionType.PINYIN, QuestionType.DICTATION, QuestionType.DEFINITION, QuestionType.DEFINITION_MATCH].map(t => (
               <label key={t} className="flex items-center space-x-2 cursor-pointer select-none">
                 <input type="checkbox" checked={defaultTypes.includes(t)} onChange={() => setDefaultTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} className="w-4 h-4 text-primary rounded border-gray-300" />
                 <span className="text-sm text-gray-700 font-medium">{{ [QuestionType.PINYIN]: '注音', [QuestionType.DICTATION]: '书写', [QuestionType.DEFINITION]: '释义', [QuestionType.DEFINITION_MATCH]: '辨析' }[t]}</span>
               </label>
            ))}
          </div>
          <div className="flex justify-between items-center border-t pt-3">
             <div className="text-sm text-gray-500">
               {processingStatus && (
                 <span className={`flex items-center font-medium ${isProcessing ? 'text-primary' : 'text-red-500'}`}>
                   {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} 
                   {processingStatus}
                 </span>
               )}
             </div>
             <button 
               onClick={handleAnalyzeWords} 
               disabled={isProcessing || !inputText.trim() || isOverLimit} 
               className="bg-primary hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed shadow-md"
             >
               开始分析
             </button>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <textarea value={poemInput} onChange={(e) => setPoemInput(e.target.value)} placeholder="输入诗名或全诗内容。" className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none min-h-[120px]" />
          <div className="flex justify-between items-center border-t pt-3">
             <div className="text-sm text-gray-500">
               {processingStatus && (
                 <span className={`flex items-center font-medium ${isProcessing ? 'text-primary' : 'text-red-500'}`}>
                   {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} 
                   {processingStatus}
                 </span>
               )}
             </div>
             <button onClick={async () => {
                setIsProcessing(true);
                setProcessingStatus('正在分析古诗...');
                try {
                  const res = await analyzePoem(poemInput);
                  if (res) {
                    setDrafts([{ id: crypto.randomUUID(), word: res.word, analysis: res, enabledTypes: [QuestionType.POEM_FILL, QuestionType.POEM_DEFINITION], status: 'done', type: EntryType.POEM }]);
                    setPoemInput('');
                  }
                } finally { 
                  setIsProcessing(false); 
                  setProcessingStatus('');
                }
             }} disabled={isProcessing || !poemInput.trim()} className="bg-primary hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-md disabled:opacity-50">分析古诗</button>
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-gray-800">识别进度 ({finishedItemsCount}/{drafts.length})</h3>
            <div className="flex gap-2">
              <button 
                onClick={handleRetryFailed} 
                className="text-primary hover:text-indigo-700 px-3 py-1 text-sm font-bold flex items-center transition-colors disabled:opacity-50"
                disabled={isProcessing || drafts.every(d => d.status !== 'error')}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> 重试失败项
              </button>
              <button onClick={handleSaveAll} disabled={isProcessing || finishedItemsCount === 0} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center shadow-sm disabled:opacity-50"><CheckCircle className="w-4 h-4 mr-2" /> 确认入库</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
            {drafts.map((draft) => (
              <div key={draft.id} className={`rounded-lg p-4 border relative group transition-all duration-300 ${draft.status === 'error' ? 'bg-red-50 border-red-200' : draft.status === 'analyzing' ? 'bg-indigo-50 border-indigo-200 shadow-md' : 'bg-gray-50 border-gray-200'}`}>
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
                              // 优化：只要不是对比词，注音和书写始终显示；释义和辨析也始终显示，但如果缺失数据会变灰提示。
                              const isComparison = draft.word.includes(' vs ') || draft.word.includes('/');
                              const hasData = (idx === 0 || idx === 1) ? !isComparison : (idx === 2 ? !!draft.analysis?.definitionData : !!draft.analysis?.definitionMatchData);
                              
                              if (isComparison && (idx === 0 || idx === 1)) return null;

                              return (
                                <button 
                                  key={type} 
                                  onClick={() => toggleEditType(draft.id, type)} 
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors flex items-center gap-1 ${draft.enabledTypes.includes(type) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'} ${!hasData ? 'opacity-50' : ''}`}
                                >
                                  {label}
                                  {!hasData && <Info className="w-2 h-2" title="AI未返回此项数据" />}
                                </button>
                              );
                            })}
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic">古诗分析完成</span>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col gap-1 w-full">
                        <span className="text-xs flex items-center text-gray-500 font-medium">
                          {draft.status === 'analyzing' && <><Loader2 className="w-3 h-3 mr-1.5 animate-spin text-primary" /> 正在深度学习词义...</>}
                          {draft.status === 'pending' && <span className="text-gray-400">队列排队中</span>}
                          {draft.status === 'error' && <><AlertCircle className="w-3 h-3 mr-1.5 text-red-500" /> {draft.errorMsg || '分析中断'}</>}
                        </span>
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