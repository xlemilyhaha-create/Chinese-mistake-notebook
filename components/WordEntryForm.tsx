
import React, { useState, useRef } from 'react';
import { Loader2, Sparkles, CheckCircle, AlertCircle, Camera, Image as ImageIcon, X, ScrollText, Type, Monitor } from 'lucide-react';
import { analyzeWordsBatch, analyzeWord, extractWordsFromImage, analyzePoem, ApiError } from '../services/geminiService';
import { WordEntry, QuestionType, AnalysisResult, EntryType, TestStatus } from '../types';

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
  error?: ApiError; // Error details for better user feedback
}

const WordEntryForm: React.FC<WordEntryFormProps> = ({ onAddWord }) => {
  const [activeTab, setActiveTab] = useState<EntryType>(EntryType.WORD);
  
  // Word State
  const [inputText, setInputText] = useState('');
  const [defaultTypes, setDefaultTypes] = useState<QuestionType[]>([QuestionType.PINYIN, QuestionType.DICTATION]);
  
  // Poem State
  const [poemInput, setPoemInput] = useState('');

  // Camera State
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Shared State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  // --- Camera Logic ---
  
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setShowCameraModal(true);
    } catch (err) {
      console.error("Camera access denied", err);
      alert("无法访问摄像头，请检查权限或使用文件上传。");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
        stopCamera();
        processBase64Image(base64Data, 'image/jpeg');
      }
    }
  };

  // Attach stream to video element when modal opens
  React.useEffect(() => {
    if (showCameraModal && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCameraModal, cameraStream]);


  // --- Handlers ---

  const processBase64Image = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setProcessingStatus('正在识别图片...');
    try {
      const extractedWords = await extractWordsFromImage(base64, mimeType);
      if (extractedWords.length > 0) {
        const currentText = inputText.trim();
        const newText = currentText ? `${currentText} ${extractedWords.join(' ')}` : extractedWords.join(' ');
        setInputText(newText);
      } else {
        alert("未能识别出文字");
      }
    } catch (err) {
      console.error(err);
      setProcessingStatus('识别失败');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleAnalyzeWords = async () => {
    const words = getUniqueWords(inputText);
    if (words.length === 0) return;
    
    setIsProcessing(true);
    setProcessingStatus('正在初始化队列...');
    
    // 1. Create placeholders immediately
    const newDrafts: DraftEntry[] = words.map(w => ({
      id: crypto.randomUUID(),
      word: w,
      analysis: null,
      enabledTypes: [...defaultTypes],
      status: 'pending', // Initial status
      type: EntryType.WORD
    }));
    setDrafts(newDrafts);
    setInputText('');

    // 2. Concurrency Queue Logic
    const CONCURRENCY_LIMIT = 3;
    let currentIndex = 0;
    let completedCount = 0;
    let activeCount = 0;
    
    const processNext = async () => {
      console.log(`[队列] processNext 被调用, currentIndex: ${currentIndex}, newDrafts.length: ${newDrafts.length}`);
      
      // 检查是否还有待处理的项
      if (currentIndex >= newDrafts.length) {
        console.log(`[队列] 没有更多任务，currentIndex: ${currentIndex}, newDrafts.length: ${newDrafts.length}`);
        activeCount--;
        // 如果所有任务都完成了
        if (activeCount === 0 && completedCount >= newDrafts.length) {
          setIsProcessing(false);
          setProcessingStatus('');
        }
        return;
      }
      
      const myIndex = currentIndex++;
      const draft = newDrafts[myIndex];
      activeCount++;

      // Update status to analyzing
      setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'analyzing' } : d));
      setProcessingStatus(`正在分析 "${draft.word}"... (${completedCount}/${newDrafts.length})`);
      
      console.log(`[队列] 开始处理: ${draft.word}, 当前索引: ${myIndex}, 已完成: ${completedCount}, 活跃: ${activeCount}`);

      try {
        console.log(`[分析] 开始分析词条: ${draft.word}`);
        const res = await analyzeWord(draft.word);
        console.log(`[分析] 完成: ${draft.word}`, res);
        
        // Check if result contains error
        const hasError = (res as any).error || res.pinyin === "Error";
        
        // Update result
        setDrafts(prev => prev.map(d => {
          if (d.id !== draft.id) return d;
          
          if (hasError) {
             return { 
               ...d, 
               status: 'error',
               error: (res as any).error || {
                 message: '分析失败，请重试',
                 type: 'unknown',
                 retryable: true
               }
             };
          }
          
          let types = [...defaultTypes];
          if (types.includes(QuestionType.DEFINITION) && !res.definitionData) {
            types = types.filter(t => t !== QuestionType.DEFINITION);
          }
          if (types.includes(QuestionType.DEFINITION_MATCH) && !res.definitionMatchData) {
            types = types.filter(t => t !== QuestionType.DEFINITION_MATCH);
          }
          
          return { ...d, analysis: res, enabledTypes: types, status: 'done', error: undefined };
        }));
      } catch (e: any) {
        console.error(`分析失败: ${draft.word}`, e);
        setDrafts(prev => prev.map(d => d.id === draft.id ? { 
          ...d, 
          status: 'error',
          error: e.type ? e : {
            message: e.message || '分析失败，请重试',
            type: 'unknown',
            retryable: true
          }
        } : d));
      } finally {
        completedCount++;
        activeCount--;
        setProcessingStatus(`正在分析... (${completedCount}/${newDrafts.length})`);
        
        // 如果所有任务都完成了
        if (completedCount >= newDrafts.length) {
          setIsProcessing(false);
          setProcessingStatus('');
        } else {
          // Trigger next in queue (不等待，避免阻塞)
          if (currentIndex < newDrafts.length) {
            processNext().catch(error => {
              console.error('处理下一个任务时出错:', error);
            });
          }
        }
      }
    };

    // Start initial pool
    console.log(`[队列] 初始化队列，共 ${newDrafts.length} 个词条，并发限制: ${CONCURRENCY_LIMIT}`);
    console.log(`[队列] newDrafts:`, newDrafts.map(d => d.word));
    
    // 确保状态立即更新
    setProcessingStatus(`正在分析... (0/${newDrafts.length})`);
    
    // 立即启动初始任务（不使用 setTimeout，避免延迟）
    console.log(`[队列] 准备启动 ${Math.min(CONCURRENCY_LIMIT, newDrafts.length)} 个初始任务`);
    for (let i = 0; i < CONCURRENCY_LIMIT && i < newDrafts.length; i++) {
      console.log(`[队列] 启动任务 ${i + 1}/${Math.min(CONCURRENCY_LIMIT, newDrafts.length)}`);
      // 使用立即执行的异步函数确保任务启动
      (async () => {
        try {
          await processNext();
        } catch (error) {
          console.error('[队列] 处理错误:', error);
          // 即使出错也继续处理其他任务
          completedCount++;
          activeCount--;
          if (currentIndex < newDrafts.length) {
            setTimeout(() => processNext(), 1000);
          }
        }
      })();
    }
    
    // 设置超时保护，防止队列永远卡住
    const timeoutId = setTimeout(() => {
      if (completedCount < newDrafts.length) {
        console.warn('分析超时，强制结束');
        setIsProcessing(false);
        setProcessingStatus('分析超时，部分任务可能未完成');
      }
    }, 300000); // 5分钟超时
    
    // 清理超时定时器（当所有任务完成时）
    const checkCompletion = setInterval(() => {
      if (completedCount === newDrafts.length && activeCount === 0) {
        clearInterval(checkCompletion);
        clearTimeout(timeoutId);
        setIsProcessing(false);
        setProcessingStatus('');
      }
    }, 500);
  };

  const handleAnalyzePoem = async () => {
    if (!poemInput.trim()) return;

    setIsProcessing(true);
    setProcessingStatus('正在分析古诗词...');
    
    try {
       const res = await analyzePoem(poemInput);
       if (res && !(res as any).error) {
         setDrafts([{
           id: crypto.randomUUID(),
           word: res.word, // Title
           analysis: res,
           enabledTypes: [QuestionType.POEM_FILL, QuestionType.POEM_DEFINITION],
           status: 'done',
           type: EntryType.POEM,
           error: undefined
         }]);
         setPoemInput('');
       } else {
         const error = (res as any)?.error || {
           message: '古诗分析失败，请重试',
           type: 'unknown' as const,
           retryable: true
         };
         setDrafts([{
           id: crypto.randomUUID(),
           word: poemInput,
           analysis: null,
           enabledTypes: [],
           status: 'error',
           type: EntryType.POEM,
           error
         }]);
       }
    } catch (err: any) {
      console.error(err);
      setDrafts([{
        id: crypto.randomUUID(),
        word: poemInput,
        analysis: null,
        enabledTypes: [],
        status: 'error',
        type: EntryType.POEM,
        error: err.type ? err : {
          message: err.message || '分析出错，请重试',
          type: 'unknown' as const,
          retryable: true
        }
      }]);
      setProcessingStatus('分析出错');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeTab === EntryType.POEM) {
      alert("目前仅支持生字词图片识别，古诗请手动输入。");
      e.target.value = ''; 
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      processBase64Image(base64String, file.type);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCameraClick = () => {
    // Detect mobile device approximately
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      cameraInputRef.current?.click();
    } else {
      startCamera();
    }
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
        definitionMatchData: draft.analysis.definitionMatchData || undefined,
        poemData: draft.analysis.poemData,
        enabledTypes: draft.enabledTypes,
        testStatus: TestStatus.NOT_TESTED,
        isMultipleAttempts: false,
        previousTestStatus: undefined
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
              placeholder="输入多个字词，用空格或逗号分隔。或者使用右下角按钮上传/拍摄照片。"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[100px] resize-y"
            />
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                title="从相册选择"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

              <button
                onClick={handleCameraClick}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                title="直接拍照"
              >
                <Camera className="w-5 h-5" />
              </button>
              {/* Native mobile capture input (hidden) */}
              <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} />
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
              <span className="text-sm text-gray-700">释义</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={defaultTypes.includes(QuestionType.DEFINITION_MATCH)}
                onChange={() => toggleDefaultType(QuestionType.DEFINITION_MATCH)}
                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <span className="text-sm text-gray-700">辨析</span>
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
                    
                    {/* Poem Content Preview - FULL CONTENT, NO SLICE */}
                    {draft.type === EntryType.POEM && (
                      <div className="text-sm text-gray-600 italic border-l-2 border-primary pl-2 mb-2 whitespace-pre-line leading-relaxed font-kai">
                         {draft.analysis?.poemData?.lines.join('\n')}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                       {draft.type === EntryType.WORD ? (
                         <>
                           <button onClick={() => toggleType(draft.id, QuestionType.PINYIN)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.PINYIN) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>注音</button>
                           <button onClick={() => toggleType(draft.id, QuestionType.DICTATION)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.DICTATION) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>书写</button>
                           {draft.analysis?.definitionData && (
                             <button onClick={() => toggleType(draft.id, QuestionType.DEFINITION)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.DEFINITION) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>释义</button>
                           )}
                           {draft.analysis?.definitionMatchData && (
                             <button onClick={() => toggleType(draft.id, QuestionType.DEFINITION_MATCH)} className={`px-2 py-1 text-xs rounded border ${draft.enabledTypes.includes(QuestionType.DEFINITION_MATCH) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>辨析</button>
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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center text-gray-500">
                      {draft.status === 'analyzing' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
                       draft.status === 'pending' ? <span className="text-xs">等待分析...</span> :
                       <AlertCircle className="w-4 h-4 mr-2 text-red-500" />}
                      {draft.status === 'error' && (
                        <span className="text-xs text-red-600">
                          {draft.error?.message || '分析失败'}
                        </span>
                      )}
                    </div>
                    {draft.status === 'error' && draft.error?.retryable && (
                      <button
                        onClick={async () => {
                          if (draft.type === EntryType.WORD) {
                            const res = await analyzeWord(draft.word);
                            const hasError = (res as any).error || res.pinyin === "Error";
                            setDrafts(prev => prev.map(d => {
                              if (d.id !== draft.id) return d;
                              if (hasError) {
                                return { ...d, status: 'error', error: (res as any).error };
                              }
                              let types = [...defaultTypes];
                              if (types.includes(QuestionType.DEFINITION) && !res.definitionData) {
                                types = types.filter(t => t !== QuestionType.DEFINITION);
                              }
                              if (types.includes(QuestionType.DEFINITION_MATCH) && !res.definitionMatchData) {
                                types = types.filter(t => t !== QuestionType.DEFINITION_MATCH);
                              }
                              return { ...d, analysis: res, enabledTypes: types, status: 'done', error: undefined };
                            }));
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
                      >
                        重试
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PC Custom Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white rounded-lg overflow-hidden shadow-2xl max-w-lg w-full">
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
              <span className="font-bold flex items-center"><Camera className="w-5 h-5 mr-2" /> 拍照</span>
              <button onClick={stopCamera}><X className="w-6 h-6" /></button>
            </div>
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="max-w-full max-h-[60vh]" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="p-6 flex justify-center bg-gray-100">
              <button 
                onClick={capturePhoto} 
                className="w-16 h-16 rounded-full bg-red-500 border-4 border-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
              >
                <div className="w-14 h-14 rounded-full border-2 border-red-500"></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordEntryForm;