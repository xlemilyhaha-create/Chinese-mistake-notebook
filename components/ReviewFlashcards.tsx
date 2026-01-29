import React, { useState, useMemo } from 'react';
import { WordEntry, EntryType } from '../types';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCw, Filter, BookOpen, Quote } from 'lucide-react';

interface ReviewFlashcardsProps {
  words: WordEntry[];
  onBack: () => void;
}

const ReviewFlashcards: React.FC<ReviewFlashcardsProps> = ({ words, onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const availableDates = useMemo(() => {
    const dates = new Set(words.map(w => new Date(w.createdAt).toLocaleDateString('zh-CN')));
    return Array.from(dates).sort().reverse();
  }, [words]);

  // 只复习生字词，古诗暂时不放入闪卡
  const filteredWords = useMemo(() => {
    return words.filter(w => {
      if (w.type !== EntryType.WORD) return false;
      if (selectedDate && new Date(w.createdAt).toLocaleDateString('zh-CN') !== selectedDate) return false;
      return true;
    });
  }, [words, selectedDate]);

  const currentWord = filteredWords[currentIndex];

  const handleNext = () => {
    if (currentIndex < filteredWords.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(c => c + 1), 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(c => c - 1), 150);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDate(e.target.value);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  // 提取显示数据
  const displayData = useMemo(() => {
    if (!currentWord) return null;
    const defData = currentWord.definitionData;
    const matchData = currentWord.definitionMatchData;
    
    // 优先使用新字段 simpleDefinition，如果没有则尝试从选项中获取
    const definition = defData?.simpleDefinition 
      || (defData?.options ? defData.options[defData.correctIndex] : null)
      || "暂无释义";
      
    const example = defData?.exampleSentence || "暂无例句";

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

      {/* Card Container */}
      <div className="w-full max-w-md aspect-[3/4] relative perspective-1000 group z-10" onClick={() => setIsFlipped(!isFlipped)}>
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
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-indigo-700 rounded-3xl p-8 flex flex-col items-center justify-center backface-hidden rotate-y-180 text-white shadow-xl">
             <div className="flex-1 flex flex-col justify-center w-full">
                <div className="mb-8">
                  <h3 className="flex items-center text-indigo-200 text-sm font-bold uppercase tracking-wider mb-3">
                    <BookOpen className="w-4 h-4 mr-2" /> 释义
                  </h3>
                  <p className="text-xl font-medium leading-relaxed font-serif text-white/95">
                    {displayData?.definition}
                  </p>
                </div>

                <div className="bg-white/10 rounded-xl p-5 border border-white/10">
                  <h3 className="flex items-center text-indigo-200 text-sm font-bold uppercase tracking-wider mb-2">
                    <Quote className="w-4 h-4 mr-2" /> 例句
                  </h3>
                  <p className="text-lg text-white/90 italic font-kai leading-relaxed">
                    “{displayData?.example}”
                  </p>
                </div>
             </div>
             <button onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }} className="mt-auto text-white/50 hover:text-white transition-colors">
               <RotateCw className="w-6 h-6" />
             </button>
          </div>

        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-8 mt-10 z-10">
        <button 
          onClick={handlePrev} 
          disabled={currentIndex === 0}
          className="p-4 bg-white rounded-full shadow-lg text-gray-700 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
        
        <button 
          onClick={handleNext} 
          disabled={currentIndex === filteredWords.length - 1}
          className="p-4 bg-primary rounded-full shadow-lg shadow-primary/30 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};

export default ReviewFlashcards;