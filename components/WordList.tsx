
import React, { useState, useMemo } from 'react';
import { WordEntry, QuestionType, EntryType, TestStatus } from '../types';
import { Trash2, Calendar, Edit2, Check, X, ChevronDown, ScrollText, Filter, CheckCircle2, XCircle, HelpCircle, AlertTriangle } from 'lucide-react';

interface WordListProps {
  words: WordEntry[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<WordEntry>) => void;
}

const PAGE_SIZE = 24;

const WordList: React.FC<WordListProps> = ({ words, onDelete, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<WordEntry | null>(null);
  const [page, setPage] = useState(1);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<TestStatus | 'ALL'>('ALL');
  const [filterDifficulty, setFilterDifficulty] = useState<'ALL' | 'HARD' | 'NORMAL'>('ALL');
  const [filterType, setFilterType] = useState<EntryType | 'ALL'>('ALL');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- Filtering Logic ---
  const filteredWords = useMemo(() => {
    return words.filter(w => {
      if (filterType !== 'ALL' && w.type !== filterType) return false;
      if (filterStatus !== 'ALL' && w.testStatus !== filterStatus) return false;
      if (filterDifficulty === 'HARD' && !w.passedAfterRetries) return false;
      if (filterDifficulty === 'NORMAL' && w.passedAfterRetries) return false; // Normal means passed easily or failed/untested
      return true;
    });
  }, [words, filterType, filterStatus, filterDifficulty]);

  const displayedWords = filteredWords.slice(0, page * PAGE_SIZE);
  const hasMore = filteredWords.length > displayedWords.length;

  // --- Selection Logic ---
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === displayedWords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedWords.map(w => w.id)));
    }
  };

  // --- Bulk Actions ---
  const handleBulkUpdateStatus = (newStatus: TestStatus) => {
    if (selectedIds.size === 0) return;
    
    // We iterate selected items and apply the transition logic
    selectedIds.forEach(id => {
      const word = words.find(w => w.id === id);
      if (!word) return;

      // Logic: 
      // Untested -> Passed => passedAfterRetries = false
      // Failed -> Passed => passedAfterRetries = true
      // Passed -> Failed => Status Failed (keep passedAfterRetries as is or reset? Usually keep history or reset. Let's keep logic simple: Failed is Failed).
      
      let updates: Partial<WordEntry> = { testStatus: newStatus };
      
      if (newStatus === TestStatus.PASSED) {
        if (word.testStatus === TestStatus.UNTESTED) {
           updates.passedAfterRetries = false;
        } else if (word.testStatus === TestStatus.FAILED) {
           updates.passedAfterRetries = true;
        }
        // If already passed, do nothing or update anyway.
      }
      
      onUpdate(id, updates);
    });
    setSelectedIds(new Set());
  };

  // --- Individual Edit Logic ---
  const startEdit = (word: WordEntry) => {
    setEditingId(word.id);
    setEditState({ ...word });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  const saveEdit = () => {
    if (editState) {
      onUpdate(editState.id, { enabledTypes: editState.enabledTypes });
    }
    setEditingId(null);
    setEditState(null);
  };

  const toggleEditType = (type: QuestionType) => {
    if (!editState) return;
    const current = editState.enabledTypes;
    const next = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setEditState({ ...editState, enabledTypes: next });
  };

  const handleLoadMore = () => {
    setPage(p => p + 1);
  };

  // --- Render Helpers ---
  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case TestStatus.PASSED: return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case TestStatus.FAILED: return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <HelpCircle className="w-4 h-4 text-gray-300" />;
    }
  };

  if (words.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-400">暂无错题，请在上方录入</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
         <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1 text-gray-600 text-sm mr-2">
              <Filter className="w-4 h-4" /> 筛选:
            </div>
            
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)}
              className="text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="ALL">全部类型</option>
              <option value={EntryType.WORD}>生字词</option>
              <option value={EntryType.POEM}>古诗词</option>
            </select>

            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value as any)}
              className="text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="ALL">全部状态</option>
              <option value={TestStatus.UNTESTED}>未测试</option>
              <option value={TestStatus.FAILED}>未通过</option>
              <option value={TestStatus.PASSED}>已通过</option>
            </select>

            <select 
              value={filterDifficulty} 
              onChange={e => setFilterDifficulty(e.target.value as any)}
              className="text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="ALL">全部难度</option>
              <option value="HARD">困难 (多次重测)</option>
              <option value="NORMAL">普通</option>
            </select>
         </div>

         <div className="text-sm text-gray-500">
           显示 {filteredWords.length} 条
         </div>
      </div>

      {/* Bulk Actions & Selection Header */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-t-lg border-b border-gray-200">
         <label className="flex items-center space-x-2 cursor-pointer select-none text-sm text-gray-600 font-medium">
            <input 
              type="checkbox" 
              checked={displayedWords.length > 0 && selectedIds.size === displayedWords.length}
              onChange={selectAll}
              className="rounded text-primary focus:ring-primary"
            />
            <span>全选本页</span>
         </label>

         {selectedIds.size > 0 && (
           <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <span className="text-sm text-gray-600 mr-2">已选 {selectedIds.size} 项:</span>
              <button 
                onClick={() => handleBulkUpdateStatus(TestStatus.PASSED)}
                className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-200 font-medium flex items-center"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> 标记通过
              </button>
              <button 
                onClick={() => handleBulkUpdateStatus(TestStatus.FAILED)}
                className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full hover:bg-red-200 font-medium flex items-center"
              >
                <XCircle className="w-3 h-3 mr-1" /> 标记未过
              </button>
           </div>
         )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedWords.map((word) => {
          const isEditing = editingId === word.id;
          const displayWord = isEditing && editState ? editState : word;
          const isPoem = word.type === EntryType.POEM;
          const isSelected = selectedIds.has(word.id);

          return (
            <div 
              key={word.id} 
              className={`bg-white p-4 rounded-lg border shadow-sm transition-all group relative ${isEditing ? 'border-primary ring-1 ring-primary' : isSelected ? 'border-primary bg-indigo-50/10' : 'border-gray-100 hover:shadow-md'}`}
            >
              {/* Checkbox Overlay */}
              <div className={`absolute top-3 left-3 z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                 <input 
                   type="checkbox" 
                   checked={isSelected}
                   onChange={() => toggleSelection(word.id)}
                   className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary shadow-sm"
                 />
              </div>

              {/* Status Badge */}
              <div className="absolute top-3 right-12 flex items-center gap-1">
                 {word.passedAfterRetries && (
                   <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-bold border border-orange-200 flex items-center">
                     <AlertTriangle className="w-3 h-3 mr-1" /> 困难
                   </span>
                 )}
                 <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                    {getStatusIcon(word.testStatus)}
                    <span className={`text-xs font-medium ${
                      word.testStatus === TestStatus.PASSED ? 'text-green-600' : 
                      word.testStatus === TestStatus.FAILED ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {word.testStatus === TestStatus.PASSED ? '已通过' : 
                       word.testStatus === TestStatus.FAILED ? '未通过' : '未测试'}
                    </span>
                 </div>
              </div>

              {/* Delete Button (Keep original position but shift slightly) */}
              <button 
                  onClick={() => onDelete(word.id)} 
                  className={`absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-opacity ${isEditing ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>


              <div className="flex justify-between items-start mb-2 mt-6 pl-1">
                <div>
                  <h4 className="text-xl font-bold text-gray-800 font-serif flex items-center gap-2">
                    {isPoem && <ScrollText className="w-4 h-4 text-secondary" />}
                    {word.word}
                  </h4>
                  {isPoem ? (
                     <p className="text-gray-500 text-sm">[{word.poemData?.dynasty}] {word.poemData?.author}</p>
                  ) : (
                     <p className="text-primary text-sm font-medium">{word.pinyin}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-1 self-start">
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                      <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(word)} className="p-1.5 text-gray-300 hover:text-primary hover:bg-indigo-50 rounded opacity-0 group-hover:opacity-100"><Edit2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
              
              {isPoem && word.poemData && (
                <div className="mb-2 text-sm text-gray-500 italic font-kai max-h-48 overflow-y-auto border-l-2 border-gray-100 pl-2">
                  {word.poemData.lines.map((line, idx) => (
                    <div key={idx} className="leading-relaxed">{line}</div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-2 min-h-[24px] items-center">
                {isEditing ? (
                  <>
                    <span className="text-xs text-gray-400 mr-1">考点:</span>
                    {!isPoem && (
                      <>
                        <button onClick={() => toggleEditType(QuestionType.PINYIN)} className={`text-xs px-2 py-1 rounded-full border ${displayWord.enabledTypes.includes(QuestionType.PINYIN) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>注音</button>
                        <button onClick={() => toggleEditType(QuestionType.DICTATION)} className={`text-xs px-2 py-1 rounded-full border ${displayWord.enabledTypes.includes(QuestionType.DICTATION) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>书写</button>
                        {word.definitionData && <button onClick={() => toggleEditType(QuestionType.DEFINITION)} className={`text-xs px-2 py-1 rounded-full border ${displayWord.enabledTypes.includes(QuestionType.DEFINITION) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>释义</button>}
                        {word.definitionMatchData && <button onClick={() => toggleEditType(QuestionType.DEFINITION_MATCH)} className={`text-xs px-2 py-1 rounded-full border ${displayWord.enabledTypes.includes(QuestionType.DEFINITION_MATCH) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>辨析</button>}
                      </>
                    )}
                    {isPoem && (
                       <>
                         <button onClick={() => toggleEditType(QuestionType.POEM_FILL)} className={`text-xs px-2 py-1 rounded-full border ${displayWord.enabledTypes.includes(QuestionType.POEM_FILL) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>默写</button>
                         <button onClick={() => toggleEditType(QuestionType.POEM_DEFINITION)} className={`text-xs px-2 py-1 rounded-full border ${displayWord.enabledTypes.includes(QuestionType.POEM_DEFINITION) ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}>释义</button>
                       </>
                    )}
                  </>
                ) : (
                  <>
                    {displayWord.enabledTypes.map(t => {
                      const labels: Record<string, string> = {
                        [QuestionType.PINYIN]: '注音',
                        [QuestionType.DICTATION]: '书写',
                        [QuestionType.DEFINITION]: '释义',
                        [QuestionType.DEFINITION_MATCH]: '辨析',
                        [QuestionType.POEM_FILL]: '默写',
                        [QuestionType.POEM_DEFINITION]: '释义'
                      };
                      return <span key={t} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{labels[t]}</span>;
                    })}
                  </>
                )}
              </div>

              <div className="flex items-center text-xs text-gray-400 mt-2 border-t pt-2">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(word.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          );
        })}
      </div>
      
      {hasMore && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={handleLoadMore}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-600 px-6 py-2 rounded-full hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ChevronDown className="w-4 h-4" />
            加载更多
          </button>
        </div>
      )}
    </div>
  );
};

export default WordList;
