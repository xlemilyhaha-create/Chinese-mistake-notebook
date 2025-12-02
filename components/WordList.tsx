import React, { useState } from 'react';
import { WordEntry, QuestionType, EntryType } from '../types';
import { Trash2, Calendar, Edit2, Check, X, ChevronDown, ScrollText } from 'lucide-react';

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

  if (words.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-400">暂无错题，请在上方录入</p>
      </div>
    );
  }

  const displayedWords = words.slice(0, page * PAGE_SIZE);
  const hasMore = words.length > displayedWords.length;

  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-gray-700">最近录入 ({words.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedWords.map((word) => {
          const isEditing = editingId === word.id;
          const displayWord = isEditing && editState ? editState : word;
          const isPoem = word.type === EntryType.POEM;

          return (
            <div key={word.id} className={`bg-white p-4 rounded-lg border shadow-sm transition-all group relative ${isEditing ? 'border-primary ring-1 ring-primary' : 'border-gray-100 hover:shadow-md'}`}>
              
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
              
              {isPoem && word.poemData && (
                <div className="mb-2 text-sm text-gray-500 line-clamp-2 italic font-kai">
                  {word.poemData.lines.join('，')}
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