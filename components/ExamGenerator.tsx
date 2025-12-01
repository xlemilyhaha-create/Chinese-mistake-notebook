import React, { useState, useMemo } from 'react';
import { WordEntry, QuestionType } from '../types';
import { Printer, ArrowLeft, Sliders, AlertCircle } from 'lucide-react';

interface ExamGeneratorProps {
  words: WordEntry[];
  onBack: () => void;
}

const ExamGenerator: React.FC<ExamGeneratorProps> = ({ words, onBack }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Get unique dates available in the word list
  const availableDates = useMemo(() => {
    const dates = new Set(words.map(w => new Date(w.createdAt).toLocaleDateString('zh-CN')));
    return Array.from(dates).sort().reverse(); // Newest first
  }, [words]);

  const filteredWords = useMemo(() => {
    if (!selectedDate) return words;
    return words.filter(w => new Date(w.createdAt).toLocaleDateString('zh-CN') === selectedDate);
  }, [words, selectedDate]);

  const questions = useMemo(() => {
    const qs: { type: QuestionType, word: WordEntry }[] = [];
    filteredWords.forEach(w => {
      if (w.enabledTypes.includes(QuestionType.PINYIN)) qs.push({ type: QuestionType.PINYIN, word: w });
      if (w.enabledTypes.includes(QuestionType.DICTATION)) qs.push({ type: QuestionType.DICTATION, word: w });
      if (w.enabledTypes.includes(QuestionType.DEFINITION) && w.definitionData) qs.push({ type: QuestionType.DEFINITION, word: w });
    });
    return {
      pinyin: qs.filter(q => q.type === QuestionType.PINYIN),
      dictation: qs.filter(q => q.type === QuestionType.DICTATION),
      definition: qs.filter(q => q.type === QuestionType.DEFINITION),
    };
  }, [filteredWords]);

  const handlePrint = () => {
    // Small timeout to ensure DOM is ready if we were doing any dynamic rendering
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Helper to render aligned pinyin boxes
  const renderPinyinBoxes = (entry: WordEntry) => {
    const chars = entry.word.split('');
    const pinyinParts = entry.pinyin.trim().split(/\s+/);
    // Best effort alignment: if parts match chars, 1-to-1. Otherwise fallback to spread.
    const isAligned = chars.length === pinyinParts.length;

    return (
      <div className="flex gap-1 justify-center">
        {chars.map((char, idx) => (
          <div key={idx} className="flex flex-col items-center">
             {/* Pinyin Slot */}
             <div className="h-6 flex items-end justify-center w-10 text-center">
               <span className="text-sm font-medium font-sans leading-none">
                 {isAligned ? pinyinParts[idx] : (idx === 0 ? entry.pinyin : '')}
               </span>
             </div>
             
             {/* Tian Zi Ge */}
             <div className="w-10 h-10 border border-black relative bg-white">
                <div className="absolute inset-0 border-t border-dashed border-gray-300 top-1/2 pointer-events-none"></div>
                <div className="absolute inset-0 border-l border-dashed border-gray-300 left-1/2 pointer-events-none"></div>
             </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Control Panel - Hidden when printing via CSS */}
      <div className="bg-white border-b p-4 flex flex-col md:flex-row items-center justify-between gap-4 no-print shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center">
            <ArrowLeft className="w-5 h-5 mr-1" /> 返回
          </button>
          <div className="h-6 w-px bg-gray-300 hidden md:block"></div>
          <div className="flex items-center gap-2 flex-1 md:flex-none">
            <Sliders className="w-4 h-4 text-gray-500" />
            <select 
              className="border rounded px-3 py-1.5 text-sm bg-gray-50 min-w-[160px]"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              <option value="">所有日期 ({words.length} 词)</option>
              {availableDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500 hidden lg:flex items-center">
             <AlertCircle className="w-3 h-3 mr-1" />
             预览为连续模式，打印/PDF将自动分页
          </div>
          <button 
            onClick={handlePrint}
            className="bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg shadow flex items-center font-medium transition-colors"
          >
            <Printer className="w-5 h-5 mr-2" />
            打印 / 下载PDF
          </button>
        </div>
      </div>

      {/* Preview Area */}
      {/* The `printable-root` ID is targeted by @media print to hide everything else */}
      <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
        
        <div id="printable-root">
          {/* A4 Container Visual on Screen */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[20mm] box-border relative">
            
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-4 mb-8 section-title">
              <h1 className="text-2xl font-bold font-serif tracking-widest mb-2">语文词语专项练习</h1>
              <div className="flex justify-between text-sm mt-4 font-kai">
                <span>班级: __________</span>
                <span>姓名: __________</span>
                <span>得分: __________</span>
                <span>日期: {selectedDate || new Date().toLocaleDateString('zh-CN')}</span>
              </div>
            </div>

            {/* Section 1: Pinyin */}
            {questions.pinyin.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                  <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">1</span>
                  看汉字，写拼音
                </h2>
                <div className="flex flex-wrap gap-x-8 gap-y-8">
                  {questions.pinyin.map((q, idx) => (
                    <div key={idx} className="flex flex-col items-center question-item w-[calc(25%-1.5rem)] min-w-[120px]">
                      <div className="w-full h-8 border-b border-gray-400 relative">
                          {/* Optional lines */}
                      </div>
                      <div className="font-serif text-xl mt-2 tracking-widest text-center">{q.word.word}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Dictation */}
            {questions.dictation.length > 0 && (
               <div className="mb-8">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                 <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">2</span>
                 看拼音，写词语
               </h2>
               <div className="flex flex-wrap gap-x-6 gap-y-10">
                 {questions.dictation.map((q, idx) => (
                   <div key={idx} className="question-item">
                      {renderPinyinBoxes(q.word)}
                   </div>
                 ))}
               </div>
             </div>
            )}

            {/* Section 3: Definition Selection */}
            {questions.definition.length > 0 && (
               <div className="mb-8">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                 <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">3</span>
                 字义选择
               </h2>
               <div className="space-y-6">
                 {questions.definition.map((q, idx) => (
                    <div key={idx} className="question-item">
                      <div className="font-serif text-base mb-2">
                        {idx + 1}. 请选择“<span className="font-bold underline mx-1">{q.word.word}</span>”中“<span className="font-bold text-lg">{q.word.definitionData!.targetChar}</span>”的正确意思：（ &nbsp;&nbsp;&nbsp;&nbsp; ）
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-4 text-sm font-kai">
                          {q.word.definitionData!.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex">
                                  <span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                  <span>{opt}</span>
                              </div>
                          ))}
                      </div>
                    </div>
                 ))}
               </div>
             </div>
            )}

            <div className="mt-12 text-center text-gray-300 text-xs no-print">
              Generated by Yuwen Cuoti Helper
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamGenerator;