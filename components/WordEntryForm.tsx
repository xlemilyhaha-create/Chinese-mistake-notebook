import React, { useState, useRef } from 'react';
import { Loader2, Sparkles, CheckCircle, AlertCircle, Camera, X, ScrollText, Type } from 'lucide-react';
import { analyzeWordsBatch, extractWordsFromImage, analyzePoem } from '../services/geminiService';
import { WordEntry, QuestionType, AnalysisResult, EntryType } from '../types';

interface WordEntryFormProps {
  onAddWord: (entry: WordEntry) => void;
}

interface DraftEntry {
  id: string;
  word: string; // or poem title
  analysis: AnalysisResult | null;
  enabledTypes: QuestionType[];
  status: 'pending' | 'analyzing' | 'done' | 'error';
  type: EntryType;
}

const WordEntryForm: React.FC<WordEntryFormProps> = ({ onAddWord }) => {
  const [activeTab, setActiveTab] = useState<EntryType>(EntryType.WORD);
  
  // Word State
  const [inputText, setInputText] = useState('');
  const [defaultTypes, setDefaultTypes] = useState<QuestionType[]>([QuestionType.PINYIN, QuestionType.DICTATION]);
  
  // Poem State
  const [poemInput, setPoemInput] = useState('');

  // Shared State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helpers ---

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

  // --- Handlers ---

  const handleAnalyzeWords = async () => {
    const words = getUniqueWords(inputText);
    if (words.length === 0) return;
    
    setIsProcessing(true);
    setProcessingStatus('正在批量分析字词...');
    
    try {
      const newDrafts: DraftEntry[] = words.map(w => ({
        id: crypto.randomUUID(),
        word: w,
        analysis: null,
        enabledTypes: [...defaultTypes],
        status: 'analyzing',
        type: EntryType.WORD
      }));
      setDrafts(newDrafts);

      const results = await analyzeWordsBatch(words);

      setDrafts(prev => prev.map(draft => {
        const res = results[draft.word];
        if (res) {
          let types = [...defaultTypes];
          if (types.includes(QuestionType.DEFINITION) && !res.definitionData) {
            types = types.filter(t => t !== QuestionType.DEFINITION);
          }
          return { ...draft, analysis: res, enabledTypes: types, status: 'done' };
        } else {
          return { ...draft, status: 'error' };
        }
      }));
      setInputText('');
    } catch (err) {
      console.error(err);
      setProcessingStatus('分析出错');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
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
           word: res.word, // Title
           analysis: res,
           enabledTypes: [QuestionType.POEM_FILL, QuestionType.POEM_DEFINITION],
           status: 'done',
           type: EntryType.POEM
         }]);
         setPoemInput('');
       } else {
         alert("古诗分析失败，请重试");
       }
    } catch (err) {
      console.error(err);
      setProcessingStatus('分析出错');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeTab === EntryType.POEM) {
      alert("目前仅支持生字词图片识别，古诗请手动输入。");
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('正在识别图片...');

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
      setProcessingStatus('识别失败');
      setIsProcessing(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveAll = () => {
    const validDrafts = drafts.filter(d => d.status === 'done' && d.analysis);
    
    if (validDrafts.length === 0 && drafts.length > 0 && drafts.every(d => d.status === 'error')) {
      alert("警告：未检测到有效结果，请检查API KEY配置。");
      return;
    }

    validDrafts.forEach(draft => {
      if (!draft.analysis) return;
      onAddWord({
        id: draft.id,
        type: draft.type,
        word: draft.word,
        pinyin: draft.analysis.pinyin,
        createdAt: Date.now(),
        definitionData: draft.analysis.definitionData || undefined,
        poemData: draft.analysis.poemData,
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
      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-2">
        <button
          onClick={() => setActiveTab(EntryType.WORD)}
          className={`flex items-center gap-2 pb-2 text-sm font-bold transition-colors border-b-2 ${activeTab === EntryType.WORD ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Type className="w-4 h-4" /> 生字词录入
        </button>
        <button
          onClick={() => setActiveTab(EntryType.POEM)}
          className={`flex items-center gap-2 pb-2 text-sm font-bold transition-colors border-b-2 ${activeTab === EntryType.POEM ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ScrollText className="w-4 h-4" /> 古诗词录入
        </button>
      </div>

      {/* WORD INPUT MODE */}
      {activeTab === EntryType.WORD && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative mb-4">
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
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-3 mb-4 pl-1">
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

          <div className="flex justify-between items-center border-t pt-3">
             <div className="text-sm text-gray-500">
               {processingStatus && (
                 <span className="flex items-center text-primary">
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {processingStatus}
                 </span>
               )}
             </div>
             <button
               onClick={handleAnalyzeWords}
               disabled={isProcessing || !inputText.trim()}
               className="bg-primary hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
             >
               开始分析
             </button>
          </div>
        </div>
      )}

      {/* POEM INPUT MODE */}
      {activeTab === EntryType.POEM && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-4">
             <textarea
               value={poemInput}
               onChange={(e) => setPoemInput(e.target.value)}
               placeholder="输入诗名（如'静夜思'）或整首诗内容，AI将自动分析考点。"
               className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none min-h-[120px]"
             />
          </div>
          <div className="flex justify-between items-center border-t pt-3">
             <div className="text-sm text-gray-500">
               {processingStatus && (
                 <span className="flex items-center text-primary">
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {processingStatus}
                 </span>
               )}
             </div>
             <button
               onClick={handleAnalyzePoem}
               disabled={isProcessing || !poemInput.trim()}
               className="bg-primary hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
             >
               分析古诗
             </button>
          </div>
        </div>
      )}

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
                <button onClick={() => removeDraft(draft.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>

                {draft.status === 'done' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <h4 className="font-bold text-gray-900">{draft.word}</h4>
                      {draft.type === EntryType.WORD && <span className="text-primary text-sm">{draft.analysis?.pinyin}</span>}
                      {draft.type === EntryType.POEM && <span className="text-gray-500 text-sm">[{draft.analysis?.poemData?.dynasty}] {draft.analysis?.poemData?.author}</span>}
                    </div>
                    
                    {/* Poem Content Preview */}
                    {draft.type === EntryType.POEM && (
                      <div className="text-sm text-gray-600 italic border-l-2 border-primary pl-2 mb-2">
                         {draft.analysis?.poemData?.lines.slice(0, 2).join('，')}...
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                       {draft.type === EntryType.WORD ? (
                         <>
                           <button onClick={() => toggleType(draft.id, QuestionType.PINYIN)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.PINYIN) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>注音</button>
                           <button onClick={() => toggleType(draft.id, QuestionType.DICTATION)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.DICTATION) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>书写</button>
                           {draft.analysis?.definitionData && (
                             <button onClick={() => toggleType(draft.id, QuestionType.DEFINITION)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.DEFINITION) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>字义</button>
                           )}
                         </>
                       ) : (
                         <>
                           <button onClick={() => toggleType(draft.id, QuestionType.POEM_FILL)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.POEM_FILL) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>古诗默写</button>
                           <button onClick={() => toggleType(draft.id, QuestionType.POEM_DEFINITION)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.POEM_DEFINITION) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>古文释义</button>
                         </>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center text-gray-500">
                    {draft.status === 'analyzing' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertCircle className="w-4 h-4 mr-2 text-red-500" />}
                    {draft.status === 'analyzing' ? '分析中...' : '分析失败'}
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