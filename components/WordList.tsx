import React, { useState, useMemo } from 'react';
import { WordEntry, QuestionType, EntryType, TestStatus, FilterOptions } from '../types';
import { Trash2, Calendar, Edit2, Check, X, ChevronDown, ScrollText, Filter, CheckSquare, Square, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface WordListProps {
  words: WordEntry[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<WordEntry>) => void;
  onBatchUpdateStatus?: (ids: string[], status: TestStatus) => void;
  onFilterChange?: (filters: FilterOptions) => void;
  initialFilters?: FilterOptions; // 从父组件传入的初始筛选条件
}

const PAGE_SIZE = 24;

const WordList: React.FC<WordListProps> = ({ words, onDelete, onUpdate, onBatchUpdateStatus, onFilterChange, initialFilters }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<WordEntry | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  // 筛选状态完全由 WordList 内部管理，不依赖父组件
  const [filters, setFilters] = useState<FilterOptions>({
    questionTypes: [],
    testStatuses: [],
    isMultipleAttempts: null
  });
  // 临时筛选状态，用于在选择时暂存，点击确定后才应用
  const [tempFilters, setTempFilters] = useState<FilterOptions>(filters);

  // 只在组件首次挂载时，如果有 initialFilters，则初始化
  React.useEffect(() => {
    if (initialFilters) {
      const hasFilters = (initialFilters.questionTypes && initialFilters.questionTypes.length > 0) ||
                         (initialFilters.testStatuses && initialFilters.testStatuses.length > 0) ||
                         (initialFilters.isMultipleAttempts !== null && initialFilters.isMultipleAttempts !== undefined);
      if (hasFilters) {
        setFilters(initialFilters);
        setTempFilters(initialFilters);
      }
    }
  }, []); // 只在组件挂载时执行一次

  // 当打开筛选面板时，将当前 filters 同步到 tempFilters
  React.useEffect(() => {
    if (showFilters) {
      setTempFilters(filters);
    }
  }, [showFilters]);

  // Filter words based on current filters
  const filteredWords = useMemo(() => {
    let result = words;

    if (filters.questionTypes && filters.questionTypes.length > 0) {
      result = result.filter(word => 
        word.enabledTypes.some(type => filters.questionTypes!.includes(type))
      );
    }

    if (filters.testStatuses && filters.testStatuses.length > 0) {
      result = result.filter(word => 
        filters.testStatuses!.includes(word.testStatus)
      );
    }

    // 处理 isMultipleAttempts 为数组的情况（多选）
    if (filters.isMultipleAttempts !== null && filters.isMultipleAttempts !== undefined) {
      if (Array.isArray(filters.isMultipleAttempts) && filters.isMultipleAttempts.length > 0) {
        const multipleAttemptsArray = filters.isMultipleAttempts as boolean[];
        result = result.filter(word => 
          multipleAttemptsArray.includes(word.isMultipleAttempts)
        );
      } else if (!Array.isArray(filters.isMultipleAttempts)) {
        result = result.filter(word => 
          word.isMultipleAttempts === filters.isMultipleAttempts
        );
      }
    }

    return result;
  }, [words, filters]);

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
      const updates: Partial<WordEntry> = { enabledTypes: editState.enabledTypes };
      
      // Handle test status update with proper logic
      if (editState.testStatus !== words.find(w => w.id === editState.id)?.testStatus) {
        const currentWord = words.find(w => w.id === editState.id);
        const oldStatus = currentWord?.testStatus;
        const newStatus = editState.testStatus;

        // Update isMultipleAttempts based on status change
        let isMultipleAttempts = editState.isMultipleAttempts;
        let previousTestStatus = editState.previousTestStatus;

        if (oldStatus === TestStatus.NOT_TESTED && newStatus === TestStatus.PASSED) {
          isMultipleAttempts = false;
          previousTestStatus = TestStatus.NOT_TESTED;
        } else if (oldStatus !== TestStatus.NOT_TESTED && oldStatus !== newStatus && newStatus === TestStatus.PASSED) {
          isMultipleAttempts = true;
          previousTestStatus = oldStatus;
        } else if (oldStatus !== newStatus) {
          previousTestStatus = oldStatus;
        }

        updates.testStatus = newStatus;
        updates.isMultipleAttempts = isMultipleAttempts;
        updates.previousTestStatus = previousTestStatus;
      }

      onUpdate(editState.id, updates);
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

  // 临时筛选状态的操作函数（不立即应用）
  const toggleTempFilterQuestionType = (type: QuestionType) => {
    const newTempFilters = { ...tempFilters };
    if (!newTempFilters.questionTypes) newTempFilters.questionTypes = [];
    
    if (newTempFilters.questionTypes.includes(type)) {
      newTempFilters.questionTypes = newTempFilters.questionTypes.filter(t => t !== type);
    } else {
      newTempFilters.questionTypes = [...newTempFilters.questionTypes, type];
    }
    
    setTempFilters(newTempFilters);
  };

  const toggleTempFilterTestStatus = (status: TestStatus) => {
    const newTempFilters = { ...tempFilters };
    if (!newTempFilters.testStatuses) newTempFilters.testStatuses = [];
    
    if (newTempFilters.testStatuses.includes(status)) {
      newTempFilters.testStatuses = newTempFilters.testStatuses.filter(s => s !== status);
    } else {
      newTempFilters.testStatuses = [...newTempFilters.testStatuses, status];
    }
    
    setTempFilters(newTempFilters);
  };

  // 是否多次测试才通过改为多选（支持同时选择 true 和 false）
  const toggleTempFilterMultipleAttempts = (value: boolean) => {
    const newTempFilters = { ...tempFilters };
    if (!newTempFilters.isMultipleAttempts) {
      newTempFilters.isMultipleAttempts = [];
    }
    const currentValues = Array.isArray(newTempFilters.isMultipleAttempts) 
      ? newTempFilters.isMultipleAttempts 
      : [];
    
    if (currentValues.includes(value)) {
      newTempFilters.isMultipleAttempts = currentValues.filter(v => v !== value);
      // 如果清空后数组为空，设置为 null
      if (newTempFilters.isMultipleAttempts.length === 0) {
        newTempFilters.isMultipleAttempts = null;
      }
    } else {
      newTempFilters.isMultipleAttempts = [...currentValues, value];
    }
    
    setTempFilters(newTempFilters);
  };

  // 应用筛选条件
  const applyFilters = () => {
    const newFilters = { ...tempFilters };
    setFilters(newFilters);
    // 重置页码，因为筛选结果可能变化
    setPage(1);
    // 通知父组件（可选，用于后端筛选）
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
    // 关闭筛选面板
    setShowFilters(false);
  };

  // 重置筛选条件
  const resetFilters = () => {
    const emptyFilters: FilterOptions = {
      questionTypes: [],
      testStatuses: [],
      isMultipleAttempts: null
    };
    setTempFilters(emptyFilters);
    setFilters(emptyFilters);
    if (onFilterChange) onFilterChange(emptyFilters);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredWords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWords.map(w => w.id)));
    }
  };

  const handleBatchUpdateStatus = async (status: TestStatus) => {
    if (selectedIds.size === 0) return;
    
    const selectedWords = filteredWords.filter(w => selectedIds.has(w.id));
    
    // Validate status transitions
    const invalidWords = selectedWords.filter(w => {
      if (w.testStatus === TestStatus.NOT_TESTED) {
        return status === TestStatus.NOT_TESTED; // Can't stay as NOT_TESTED
      }
      if (w.testStatus === TestStatus.FAILED) {
        return false; // Can change to any status
      }
      if (w.testStatus === TestStatus.PASSED) {
        return status === TestStatus.NOT_TESTED; // Can't go back to NOT_TESTED
      }
      return false;
    });

    if (invalidWords.length > 0) {
      alert(`部分词条的状态转换无效。只能从未测试更新为未通过或已通过，从未通过更新为未通过或已通过。`);
      return;
    }

    if (onBatchUpdateStatus) {
      await onBatchUpdateStatus(Array.from(selectedIds), status);
      setSelectedIds(new Set());
    }
  };

  const handleLoadMore = () => {
    setPage(p => p + 1);
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case TestStatus.PASSED:
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case TestStatus.FAILED:
        return <XCircle className="w-4 h-4 text-red-500" />;
      case TestStatus.NOT_TESTED:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: TestStatus) => {
    switch (status) {
      case TestStatus.PASSED:
        return '已通过';
      case TestStatus.FAILED:
        return '未通过';
      case TestStatus.NOT_TESTED:
        return '未测试';
    }
  };

  if (words.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-400">暂无错题，请在上方录入</p>
      </div>
    );
  }

  const displayedWords = filteredWords.slice(0, page * PAGE_SIZE);
  const hasMore = filteredWords.length > displayedWords.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-gray-700">
          错题列表 ({filteredWords.length} / {words.length})
        </h3>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">已选择 {selectedIds.size} 项</span>
              <select
                onChange={(e) => {
                  const status = e.target.value as TestStatus;
                  if (status) handleBatchUpdateStatus(status);
                }}
                className="border rounded px-2 py-1 text-sm"
                defaultValue=""
              >
                <option value="">批量更新状态</option>
                <option value={TestStatus.PASSED}>标记为已通过</option>
                <option value={TestStatus.FAILED}>标记为未通过</option>
              </select>
            </div>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>
        </div>
      </div>

      {showFilters && (
        <div 
          className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">题型（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {Object.values(QuestionType).map(type => {
                const labels: Record<QuestionType, string> = {
                  [QuestionType.PINYIN]: '注音',
                  [QuestionType.DICTATION]: '书写',
                  [QuestionType.DEFINITION]: '释义',
                  [QuestionType.DEFINITION_MATCH]: '辨析',
                  [QuestionType.POEM_FILL]: '默写',
                  [QuestionType.POEM_DEFINITION]: '释义'
                };
                const isSelected = tempFilters.questionTypes?.includes(type);
                return (
                  <button
                    key={type}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTempFilterQuestionType(type);
                    }}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      isSelected ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {labels[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">测试通过状态（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {Object.values(TestStatus).map(status => {
                const isSelected = tempFilters.testStatuses?.includes(status);
                return (
                  <button
                    key={status}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTempFilterTestStatus(status);
                    }}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors flex items-center gap-1 ${
                      isSelected ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {getStatusIcon(status)}
                    {getStatusLabel(status)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">是否多次测试才通过（可多选）</label>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTempFilterMultipleAttempts(true);
                }}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  Array.isArray(tempFilters.isMultipleAttempts) && tempFilters.isMultipleAttempts.includes(true) 
                    ? 'bg-blue-100 text-blue-700 border-blue-300' 
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                是
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTempFilterMultipleAttempts(false);
                }}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  Array.isArray(tempFilters.isMultipleAttempts) && tempFilters.isMultipleAttempts.includes(false) 
                    ? 'bg-blue-100 text-blue-700 border-blue-300' 
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                否
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-gray-600">
              已选择条件: 
              {(tempFilters.questionTypes?.length || 0) > 0 && <span className="ml-1">题型({tempFilters.questionTypes?.length})</span>}
              {(tempFilters.testStatuses?.length || 0) > 0 && <span className="ml-1">状态({tempFilters.testStatuses?.length})</span>}
              {Array.isArray(tempFilters.isMultipleAttempts) && tempFilters.isMultipleAttempts.length > 0 && (
                <span className="ml-1">多次测试({tempFilters.isMultipleAttempts.length})</span>
              )}
              {(!tempFilters.questionTypes || tempFilters.questionTypes.length === 0) && 
               (!tempFilters.testStatuses || tempFilters.testStatuses.length === 0) && 
               (!Array.isArray(tempFilters.isMultipleAttempts) || tempFilters.isMultipleAttempts.length === 0) && (
                <span className="text-gray-400">未选择任何条件（将显示全部）</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetFilters();
                }}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                重置
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  applyFilters();
                }}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={toggleSelectAll}
          className="p-1 hover:bg-gray-100 rounded"
        >
          {selectedIds.size === filteredWords.length ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
        <span className="text-sm text-gray-600">全选</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedWords.map((word) => {
          const isEditing = editingId === word.id;
          const displayWord = isEditing && editState ? editState : word;
          const isPoem = word.type === EntryType.POEM;
          const isSelected = selectedIds.has(word.id);

          return (
            <div key={word.id} className={`bg-white p-4 rounded-lg border shadow-sm transition-all group relative ${
              isEditing ? 'border-primary ring-1 ring-primary' : 
              isSelected ? 'border-blue-500 ring-1 ring-blue-300' : 
              'border-gray-100 hover:shadow-md'
            }`}>
              
              <div className="flex items-start gap-2 mb-2">
                <button
                  onClick={() => toggleSelect(word.id)}
                  className="mt-1 p-0.5 hover:bg-gray-100 rounded"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
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
                
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                      <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(word)} className="p-1.5 text-gray-300 hover:text-primary hover:bg-indigo-50 rounded opacity-0 group-hover:opacity-100"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => onDelete(word.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                    </div>
                  </div>
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
                    
                    <div className="w-full mt-2 pt-2 border-t">
                      <span className="text-xs text-gray-400 mr-2">测试状态:</span>
                      <select
                        value={displayWord.testStatus}
                        onChange={(e) => {
                          if (editState) {
                            setEditState({ ...editState, testStatus: e.target.value as TestStatus });
                          }
                        }}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value={TestStatus.NOT_TESTED}>未测试</option>
                        <option value={TestStatus.FAILED}>未通过</option>
                        <option value={TestStatus.PASSED}>已通过</option>
                      </select>
                    </div>
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

              <div className="flex items-center justify-between text-xs text-gray-400 mt-2 border-t pt-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                {new Date(word.createdAt).toLocaleDateString('zh-CN')}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(word.testStatus)}
                  <span>{getStatusLabel(word.testStatus)}</span>
                  {word.isMultipleAttempts && (
                    <span className="text-orange-500">(多次)</span>
                  )}
                </div>
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
