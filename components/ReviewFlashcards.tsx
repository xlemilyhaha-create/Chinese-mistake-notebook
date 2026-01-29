import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WordEntry, EntryType } from '../types';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCw, Filter, BookOpen, Quote, Edit2, Save, X, Wand2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { explainWord } from '../services/geminiService';

interface ReviewFlashcardsProps {
  words: WordEntry[];
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<WordEntry>) => void;
}

const ReviewFlashcards: React.FC<ReviewFlashcardsProps> = ({ words, onBack, onUpdate }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editDefinition, setEditDefinition] = useState('');
  const [editExample, setEditExample] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  
  // Prevent infinite auto-gen loops
  const hasTriedAutoGenerateRef = useRef(false);

  const availableDates = useMemo(() => {
    const dates = new Set(words.map(w => new Date(w.createdAt).toLocaleDateString('zh-CN')));
    return Array.from(dates).sort().reverse();
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter(w => {
      if (w.type !== EntryType.WORD) return false;
      if (selectedDate && new Date(w.createdAt).toLocaleDateString('zh-CN') !== selectedDate) return false;
      return true;
    });
  }, [words, selectedDate]);

  const currentWord = filteredWords[currentIndex];

  // Reset state when changing card
  useEffect(() => {
    setIsEditing(false);
    setIsGenerating(false);
    setGenError(null);
    setIsFlipped(false);
    hasTriedAutoGenerateRef.current = false; // Reset auto-gen flag
    
    if (currentWord) {
      const defData = currentWord.definitionData;
      const definition = defData?.simpleDefinition 
        || (defData?.options && defData.correctIndex !== undefined ? defData.options[defData.correctIndex] : '')
        || "";
      const example = defData?.exampleSentence || "";
      
      setEditDefinition(definition);
      setEditExample(example);
    }
  }, [currentWord?.id]); 

  // Logic to execute generation
  const performGeneration = async () => {
    if (!currentWord || isGenerating) return;
    
    setIsGenerating(true);
    setGenError(null);
    hasTriedAutoGenerateRef.current = true; // Mark as tried

    try {
      const res = await explainWord(currentWord.word);
      if (res) {
        if (isEditing) {
          setEditDefinition(res.simpleDefinition);
          setEditExample(res.exampleSentence);
        } else {
          const newDefinitionData = {
            ...(currentWord.definitionData || {
              targetChar: currentWord.word[0],
              options: [],
              correctIndex: 0
            }),
            simpleDefinition: res.simpleDefinition,
            exampleSentence: res.exampleSentence
          };
          onUpdate(currentWord.id, { definitionData: newDefinitionData });
        }
      } else {
        setGenError("AI 未返回数据");
      }
    } catch (err) {
      console.error("Auto-gen failed", err);
      setGenError("生成失败，请检查网络");
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate effect
  useEffect(() => {
    if (isFlipped && currentWord && !isGenerating && !isEditing && !hasTriedAutoGenerateRef.current && !genError) {
       const defData = currentWord.definitionData;
       const missingSimpleDef = !defData?.simpleDefinition || defData.simpleDefinition.trim() === '';
       const missingExample = !defData?.exampleSentence || defData.exampleSentence.trim() === '';
       
       if (missingSimpleDef || missingExample) {
         performGeneration();
       }
    }
  }, [isFlipped, currentWord, isGenerating, isEditing, genError]);

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < filteredWords.length - 1) {
      setTimeout(() => setCurrentIndex(c => c + 1), 150);
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      setTimeout(() => setCurrentIndex(c => c - 1), 150);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDate(e.target.value);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentWord) return;

    const newDefinitionData = {
      ...(currentWord.definitionData || {
        targetChar: currentWord.word[0],
        options: [],
        correctIndex: 0
      }),
      simpleDefinition: editDefinition,
      exampleSentence: editExample
    };

    onUpdate(currentWord.id, { definitionData: newDefinitionData });
    setIsEditing(false);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    const defData = currentWord.definitionData;
    const definition = defData?.simpleDefinition 
      || (defData?.options && defData.correctIndex !== undefined ? defData.options[defData.correctIndex] : '')
      || "";
    const example = defData?.exampleSentence || "";
    setEditDefinition(definition);
    setEditExample(example);
  };

  const handleManualGenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    performGeneration();
  };

  // 提取显示数据 (用于非编辑模式)
  const displayData = useMemo(() => {
    if (!currentWord) return null;
    const defData = currentWord.definitionData;
    
    // Logic for display text
    const definition = defData?.simpleDefinition 
      || (defData?.options ? defData.options[defData.correctIndex] : null);
      
    const example = defData?.exampleSentence;

    return {
      word: currentWord.word,
      pinyin: currentWord.pinyin,
      definition,
      example
    };
  }, [currentWord]);

  if (filteredWords.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col p-6">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center font-bold mb-8 transition-colors self-start">
          <ArrowLeft className="w-5 h-5 mr-1" /> 返回
        </button>
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
          <BookOpen className="w-16 h-16 mb-4 text-gray-300" />
          <p>当前筛选条件下没有可复习的生字词。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-64 bg-primary/10 rounded-b-[3rem]"></div>

      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-8 z-10 relative">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 bg-white/50 p-2 rounded-full backdrop-blur-sm transition-all shadow-sm">
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm border border-white/50">
           <Filter className="w-4 h-4 text-primary" />
           <select 
             value={selectedDate} 
             onChange={handleDateChange}
             className="bg-transparent text-sm text-gray-700 font-bold focus:outline-none cursor-pointer"
           >
             <option value="">全部题库 ({words.filter(w => w.type === EntryType.WORD).length})</option>
             {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
           </select>
        </div>

        <div className="text-gray-600 font-bold text-sm bg-white/50 px-3 py-1.5 rounded-full">
          {currentIndex + 1} / {filteredWords.length}
        </div>
      </div>

      {/* Main Content Area: Left Button + Card + Right Button */}
      <div className="relative w-full max-w-4xl flex items-center justify-center gap-4 md:gap-12 z-10">
        
        {/* Prev Button (Left) */}
        <button 
          onClick={handlePrev} 
          disabled={currentIndex === 0}
          className="hidden md:flex p-4 bg-white/80 rounded-full shadow-lg text-gray-700 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 backdrop-blur-sm"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Card Container */}
        <div className="w-full max-w-md aspect-[3/4] relative perspective-1000 group" onClick={() => !isEditing && setIsFlipped(!isFlipped)}>
          <div className={`w-full h-full relative transition-all duration-500 transform-style-3d cursor-pointer shadow-2xl rounded-3xl ${isFlipped ? 'rotate-y-180' : ''}`}>
            
            {/* Front */}
            <div className="absolute inset-0 bg-white rounded-3xl p-8 flex flex-col items-center justify-center backface-hidden border-2 border-white shadow-inner">
               <div className="flex-1 flex flex-col items-center justify-center gap-6">
                  <span className="text-3xl text-gray-500 font-medium font-sans tracking-widest">{displayData?.pinyin}</span>
                  <h2 className="text-7xl font-bold text-gray-800 font-serif mb-4">{displayData?.word}</h2>
                  <div className="w-16 h-1 bg-primary/20 rounded-full"></div>
               </div>
               <p className="text-gray-400 text-sm mt-auto animate-pulse">点击翻转查看释义</p>
            </div>

            {/* Back */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-indigo-700 rounded-3xl p-6 md:p-8 flex flex-col items-center backface-hidden rotate-y-180 text-white shadow-xl">
               
               {/* Toolbar (Edit/Save/AI) */}
               <div className="w-full flex justify-end mb-2 gap-2">
                 <button 
                    onClick={handleManualGenerate} 
                    disabled={isGenerating}
                    className={`p-2 rounded-full transition-colors ${isGenerating ? 'bg-white/20' : 'text-white/50 hover:text-white hover:bg-white/10'}`} 
                    title="强制 AI 重新生成"
                 >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Sparkles className="w-5 h-5" />}
                 </button>

                 {isEditing ? (
                   <div className="flex gap-2 border-l border-white/20 pl-2">
                     <button onClick={handleCancelEdit} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors" title="取消">
                        <X className="w-4 h-4 text-white" />
                     </button>
                     <button onClick={handleSave} className="p-2 bg-green-500 hover:bg-green-600 rounded-full transition-colors shadow-sm" title="保存">
                        <Save className="w-4 h-4 text-white" />
                     </button>
                   </div>
                 ) : (
                   <button onClick={handleStartEdit} className="p-2 text-white/50 hover:text-white transition-colors" title="编辑释义和例句">
                      <Edit2 className="w-5 h-5" />
                   </button>
                 )}
               </div>

               <div className="flex-1 flex flex-col w-full overflow-y-auto pr-1 custom-scrollbar">
                  <div className="mb-6">
                    <h3 className="flex items-center text-indigo-200 text-sm font-bold uppercase tracking-wider mb-2">
                      <BookOpen className="w-4 h-4 mr-2" /> 释义
                    </h3>
                    {isEditing ? (
                      <textarea
                        value={editDefinition}
                        onChange={(e) => setEditDefinition(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 text-base"
                        rows={3}
                        placeholder="请输入简明释义..."
                      />
                    ) : (
                      <>
                        {isGenerating && !displayData?.definition ? (
                          <p className="text-white/50 animate-pulse text-lg">AI 正在思考...</p>
                        ) : displayData?.definition ? (
                          <p className="text-xl font-medium leading-relaxed font-serif text-white/95">{displayData.definition}</p>
                        ) : (
                          <div onClick={(e) => { e.stopPropagation(); handleManualGenerate(e); }} className="p-3 border border-dashed border-white/30 rounded-lg text-center text-white/60 hover:text-white hover:border-white/60 cursor-pointer transition-all">
                             {genError ? <span className="text-red-300 flex items-center justify-center"><AlertCircle className="w-4 h-4 mr-1"/> {genError}</span> : "暂无释义，点击 AI 生成"}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className={`bg-white/10 rounded-xl p-4 border border-white/10 ${isEditing ? 'bg-transparent border-0 p-0' : ''}`}>
                    <h3 className="flex items-center text-indigo-200 text-sm font-bold uppercase tracking-wider mb-2">
                      <Quote className="w-4 h-4 mr-2" /> 例句
                    </h3>
                    {isEditing ? (
                      <textarea
                        value={editExample}
                        onChange={(e) => setEditExample(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 text-base font-kai"
                        rows={3}
                        placeholder="请输入通俗例句..."
                      />
                    ) : (
                      <>
                        {isGenerating && !displayData?.example ? (
                           <p className="text-white/50 animate-pulse italic">AI 正在造句...</p>
                        ) : displayData?.example ? (
                           <p className="text-lg text-white/90 italic font-kai leading-relaxed">“{displayData.example}”</p>
                        ) : (
                           <div onClick={(e) => { e.stopPropagation(); handleManualGenerate(e); }} className="p-3 border border-dashed border-white/30 rounded-lg text-center text-white/60 hover:text-white hover:border-white/60 cursor-pointer transition-all">
                              {genError ? <span className="text-red-300 flex items-center justify-center"><AlertCircle className="w-4 h-4 mr-1"/> {genError}</span> : "暂无例句，点击 AI 生成"}
                           </div>
                        )}
                      </>
                    )}
                  </div>
               </div>

               {!isEditing && (
                 <button onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }} className="mt-4 text-white/50 hover:text-white transition-colors pt-2">
                   <RotateCw className="w-6 h-6" />
                 </button>
               )}
            </div>

          </div>
        </div>

        {/* Next Button (Right) */}
        <button 
          onClick={handleNext} 
          disabled={currentIndex === filteredWords.length - 1}
          className="hidden md:flex p-4 bg-primary rounded-full shadow-lg shadow-primary/30 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <ChevronRight className="w-8 h-8" />
        </button>

      </div>
      
      {/* Mobile Controls (Below Card) */}
      <div className="flex md:hidden items-center gap-8 mt-6 z-10">
        <button 
          onClick={handlePrev} 
          disabled={currentIndex === 0}
          className="p-4 bg-white rounded-full shadow-lg text-gray-700 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button 
          onClick={handleNext} 
          disabled={currentIndex === filteredWords.length - 1}
          className="p-4 bg-primary rounded-full shadow-lg shadow-primary/30 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default ReviewFlashcards;