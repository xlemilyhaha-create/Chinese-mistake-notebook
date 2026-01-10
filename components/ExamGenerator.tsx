import React, { useState, useMemo } from 'react';
import { WordEntry, QuestionType, MatchMode } from '../types';
import { Printer, ArrowLeft, Filter, Download, Copy, FileJson, Check } from 'lucide-react';

interface ExamGeneratorProps {
  words: WordEntry[];
  onBack: () => void;
}

const ExamGenerator: React.FC<ExamGeneratorProps> = ({ words, onBack }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  const availableDates = useMemo(() => {
    const dates = new Set(words.map(w => new Date(w.createdAt).toLocaleDateString('zh-CN')));
    return Array.from(dates).sort().reverse();
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter(w => !selectedDate || new Date(w.createdAt).toLocaleDateString('zh-CN') === selectedDate);
  }, [words, selectedDate]);

  const questions = useMemo(() => {
    const qs = {
      pinyin: [] as WordEntry[],
      dictation: [] as WordEntry[],
      definition: [] as WordEntry[],
      definitionMatch: [] as WordEntry[],
      poemFill: [] as WordEntry[],
      poemDef: [] as WordEntry[]
    };
    filteredWords.forEach(w => {
      if (w.enabledTypes.includes(QuestionType.PINYIN)) qs.pinyin.push(w);
      if (w.enabledTypes.includes(QuestionType.DICTATION)) qs.dictation.push(w);
      if (w.enabledTypes.includes(QuestionType.DEFINITION) && w.definitionData) qs.definition.push(w);
      if (w.enabledTypes.includes(QuestionType.DEFINITION_MATCH) && w.definitionMatchData?.targetChar) qs.definitionMatch.push(w);
      if (w.enabledTypes.includes(QuestionType.POEM_FILL) && w.poemData?.fillAnswers.length) qs.poemFill.push(w);
      if (w.enabledTypes.includes(QuestionType.POEM_DEFINITION) && w.poemData?.definitionQuestions.length) qs.poemDef.push(w);
    });
    return qs;
  }, [filteredWords]);

  const handlePrint = () => {
    setIsPrinting(true);
    // 提示用户如何保存 PDF
    const hint = "提示：在弹出的打印窗口中，将『目标打印机』更改为『另存为 PDF』即可完成下载。";
    console.log(hint);
    setTimeout(() => {
      try { window.print(); } catch (e) { alert("调用打印失败"); } finally { setIsPrinting(false); }
    }, 500);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(filteredWords, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `试卷数据_${selectedDate || '全集'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = async () => {
    let text = `语文错题专项强化练习卷\n日期: ${selectedDate || '全集'}\n\n`;
    
    if (questions.pinyin.length > 0) {
      text += "一、看汉字写拼音\n";
      questions.pinyin.forEach((w, i) => text += `${i+1}. ${w.word} (      )\n`);
      text += "\n";
    }
    
    if (questions.dictation.length > 0) {
      text += "二、看拼音写词语\n";
      questions.dictation.forEach((w, i) => text += `${i+1}. ${w.pinyin} (      )\n`);
      text += "\n";
    }

    if (questions.poemFill.length > 0) {
      text += "三、古诗文默写\n";
      questions.poemFill.forEach(w => {
        text += `《${w.word}》:\n`;
        w.poemData?.fillAnswers.forEach(f => text += `  ${f.pre}______${f.post}\n`);
      });
      text += "\n";
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      alert("复制失败");
    }
  };

  const renderPinyinBoxes = (entry: WordEntry) => {
    const chars = entry.word.split('');
    const pinyinParts = entry.pinyin.trim().split(/\s+/);
    const isAligned = chars.length === pinyinParts.length;
    return (
      <div className="flex gap-0.5 justify-center">
        {chars.map((char, idx) => (
          <div key={idx} className="flex flex-col items-center">
             <div className="h-4 flex items-end justify-center w-7 text-center">
               <span className="text-[9px] font-sans leading-none">{isAligned ? pinyinParts[idx] : (idx === 0 ? entry.pinyin : '')}</span>
             </div>
             <div className="w-7 h-7 border border-black relative bg-white">
                <div className="absolute inset-0 border-t border-dashed border-gray-300 top-1/2"></div>
                <div className="absolute inset-0 border-l border-dashed border-gray-300 left-1/2"></div>
             </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b p-4 flex flex-col gap-4 no-print shadow-sm z-10 shrink-0">
        <div className="flex items-center justify-between">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center font-bold transition-colors"><ArrowLeft className="w-5 h-5 mr-1" /> 返回</button>
            
            <div className="flex gap-2">
                <button 
                  onClick={handleCopyText}
                  className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all shadow-sm active:scale-95"
                >
                  {copySuccess ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copySuccess ? '已复制' : '复制试卷文字'}
                </button>
                
                <button 
                  onClick={handleExportJson}
                  className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all shadow-sm active:scale-95"
                >
                  <FileJson className="w-4 h-4 mr-2 text-orange-500" />
                  导出数据
                </button>

                <button 
                  onClick={handlePrint} 
                  disabled={isPrinting || filteredWords.length === 0} 
                  className="bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg shadow-md flex items-center font-bold transition-all active:scale-95 disabled:opacity-50"
                >
                  <Printer className="w-5 h-5 mr-2" /> 
                  打印试卷 / 另存为 PDF
                </button>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-6 bg-gray-50 p-2 rounded border border-gray-100">
            <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-gray-400" /><span className="text-sm font-bold text-gray-700">筛选范围:</span></div>
            <select className="border rounded px-2 py-1 text-sm bg-white min-w-[120px] outline-none focus:ring-1 focus:ring-primary" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
                <option value="">全部日期错题合集 ({words.length})</option>
                {availableDates.map(date => (<option key={date} value={date}>{date}</option>))}
            </select>
            <span className="text-xs text-gray-400">通过“另存为 PDF”可完成离线保存</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
        <div id="printable-root" className="relative">
          <div className="page-footer hidden print:block"></div>

          {/* 试卷主页 */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[12mm] box-border relative mb-8">
            <div className="text-center border-b border-black pb-2 mb-4">
              <h1 className="text-xl font-bold font-serif tracking-widest mb-1">语文错题专项强化练习卷</h1>
              <div className="flex justify-between text-[11px] font-kai px-4"><span>姓名: __________</span><span>得分: __________</span></div>
            </div>

            {questions.pinyin.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold mb-2 font-kai flex items-center"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2">1</span>看汉字，写拼音</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {questions.pinyin.map((w, idx) => (<div key={idx} className="flex flex-col items-center w-[calc(20%-1.5rem)]"><div className="w-full h-5 border-b border-gray-400"></div><div className="font-serif text-sm mt-1">{w.word}</div></div>))}
                </div>
              </div>
            )}

            {questions.dictation.length > 0 && (
               <div className="mb-4">
               <h2 className="text-sm font-bold mb-2 font-kai flex items-center"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2">2</span>看拼音，写词语</h2>
               <div className="flex flex-wrap gap-x-4 gap-y-4">
                 {questions.dictation.map((w, idx) => (
                   <div key={idx} className="question-item">{renderPinyinBoxes(w)}</div>
                 ))}
               </div>
             </div>
            )}

            {questions.poemFill.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold mb-2 font-kai flex items-center"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2">3</span>古诗文默写</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {questions.poemFill.map((w, idx) => (
                    <div key={idx} className="question-item border border-gray-50 p-1 rounded">
                      <div className="text-[9px] font-bold text-gray-400 mb-0.5">《{w.word}》</div>
                      <div className="space-y-0.5">
                        {w.poemData?.fillAnswers && Array.from(new Map(w.poemData.fillAnswers.map(f => [f.lineIndex, f])).values()).map((fill: any, fIdx) => (
                           <div key={fIdx} className="font-serif text-[11px] leading-relaxed">{fill.pre}<span className="inline-block border-b border-black min-w-[50px] text-transparent select-none">{fill.answer}</span>{fill.post}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.definition.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold mb-2 font-kai flex items-center"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2">4</span>词语释义选择</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {questions.definition.map((w, idx) => (
                    <div key={idx} className="question-item">
                      <div className="font-serif text-[11px] mb-0.5">
                        {idx + 1}. “<span className="font-bold underline">{w.word}</span>”中“<span className="font-bold">{w.definitionData?.targetChar}</span>”意为：（ &nbsp; ）
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 pl-2 text-[10px] font-kai text-gray-600">
                        {w.definitionData?.options.map((opt, oIdx) => (
                          <div key={oIdx} className="truncate flex"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.definitionMatch.length > 0 && (
               <div className="mb-4">
               <h2 className="text-sm font-bold mb-2 font-kai flex items-center"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2">5</span>字词辨析</h2>
               <div className="space-y-2">
                 {questions.definitionMatch.map((w, idx) => {
                   const m = w.definitionMatchData!;
                   return (
                    <div key={idx} className="question-item text-[11px]">
                      {m.mode === MatchMode.TWO_WAY_COMPARE ? (
                        <div className="flex items-center justify-between border-l-2 border-primary/20 pl-2 bg-gray-50/30 p-1">
                          <div className="font-serif">{idx + 1}. 判断“<span className="font-bold">{m.targetChar}</span>”意思是否相同：（ &nbsp; ）</div>
                          <div className="flex gap-4 font-serif font-bold">
                             <span className="border-b border-black">{m.compareWordA}</span> / <span className="border-b border-black">{m.compareWordB}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[1fr_200px] gap-2">
                          <div className="font-serif">{idx + 1}. 与“<span className="font-bold underline">{m.context || w.word}</span>”中“<span className="font-bold">{m.targetChar}</span>”意同的一项：（ &nbsp; ）</div>
                          <div className="grid grid-cols-2 text-[10px] font-kai">
                            {m.options?.slice(0, 4).map((opt, oIdx) => (
                              <div key={oIdx} className="truncate flex"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                   );
                 })}
               </div>
             </div>
            )}

            {questions.poemDef.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold mb-2 font-kai flex items-center"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2">6</span>古诗重点字释义</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {questions.poemDef.map((w, idx) => (
                    <div key={idx} className="question-item">
                      {w.poemData?.definitionQuestions.map((q, qIdx) => (
                        <div key={qIdx} className="mb-2">
                          <div className="font-serif text-[11px] leading-tight mb-1">
                             <span className="text-[9px] text-gray-400 mr-1 italic">《{w.word}》</span>
                             “{w.poemData?.lines[q.lineIndex]}”的“<span className="font-bold underline">{q.targetChar}</span>”意为：（ &nbsp; ）
                          </div>
                          <div className="grid grid-cols-2 gap-0.5 pl-3 text-[10px] font-kai text-gray-600">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex truncate"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="print-break-before"></div>

          {/* 答案页 */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[15mm] box-border relative">
            <div className="text-center border-b border-black pb-2 mb-6">
              <h1 className="text-lg font-bold font-serif tracking-widest mb-1">参考答案</h1>
            </div>
            
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  {questions.pinyin.length > 0 && (
                    <div>
                      <h3 className="font-bold text-xs mb-1 border-b pb-0.5">1. 注音答案</h3>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">{questions.pinyin.map((w, i) => (<div key={i}>{w.word}: {w.pinyin}</div>))}</div>
                    </div>
                  )}
                  {questions.dictation.length > 0 && (
                    <div>
                      <h3 className="font-bold text-xs mb-1 border-b pb-0.5">2. 词语答案</h3>
                      <div className="grid grid-cols-2 gap-1 text-[10px] font-bold">{questions.dictation.map((w, i) => (<div key={i}>{w.word}</div>))}</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {questions.definition.length > 0 && (
                      <div>
                        <h3 className="font-bold text-xs mb-1 border-b pb-0.5">4. 释义选择</h3>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">{questions.definition.map((w, i) => (
                          <div key={i}>{i+1}. {String.fromCharCode(65 + (w.definitionData?.correctIndex || 0))}</div>
                        ))}</div>
                      </div>
                    )}
                    {questions.definitionMatch.length > 0 && (
                      <div>
                        <h3 className="font-bold text-xs mb-1 border-b pb-0.5">5. 字词辨析</h3>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">{questions.definitionMatch.map((w, i) => {
                          const m = w.definitionMatchData!;
                          return <div key={i}>{i+1}. {m.mode === MatchMode.TWO_WAY_COMPARE ? (m.isSame ? 'A' : 'B') : String.fromCharCode(65 + (m.correctIndex || 0))}</div>;
                        })}</div>
                      </div>
                    )}
                </div>

                {questions.poemFill.length > 0 && (
                  <div>
                    <h3 className="font-bold text-xs mb-1 border-b pb-0.5">3. 默写全文答案</h3>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px]">
                      {questions.poemFill.map((w, i) => (
                        <div key={i} className="flex gap-1"><span className="text-gray-400 shrink-0">《{w.word}》</span><span className="font-serif">{w.poemData?.fillAnswers.map(f => f.answer).join(', ')}</span></div>
                      ))}
                    </div>
                  </div>
                )}

                {questions.poemDef.length > 0 && (
                  <div>
                    <h3 className="font-bold text-xs mb-1 border-b pb-0.5">6. 古诗重点字答案</h3>
                    <div className="grid grid-cols-3 gap-3 text-[10px]">
                      {questions.poemDef.map((w, i) => (
                        <div key={i} className="border-l-2 border-gray-100 pl-2">
                          <div className="font-bold text-[9px] text-gray-400">《{w.word}》</div>
                          {w.poemData?.definitionQuestions.map((q, qIdx) => (
                            <div key={qIdx} className="flex justify-between"><span>{q.targetChar}</span><span className="font-bold">{String.fromCharCode(65 + q.correctIndex)}</span></div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamGenerator;