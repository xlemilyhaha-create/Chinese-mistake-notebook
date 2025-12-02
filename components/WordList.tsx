import React, { useState } from 'react';
import { WordEntry, QuestionType } from '../types';
import { Trash2, Calendar, Edit2, Check, X } from 'lucide-react';

interface WordListProps {
  words: WordEntry[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<WordEntry>) => void;
}

const WordList: React.FC<WordListProps> = ({ words, onDelete, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<WordEntry | null>(null);

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

  if (words.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-400">暂无错题，请在上方录入</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-gray-700">最近录入 ({words.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {words.map((word) => {
          const isEditing = editingId === word.id;
          const displayWord = isEditing && editState ? editState : word;

          return (
            <div key={word.id} className={`bg-white p-4 rounded-lg border shadow-sm transition-all group relative ${isEditing ? 'border-primary ring-1 ring-primary' : 'border-gray-100 hover:shadow-md'}`}>
              
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-xl font-bold text-gray-800 font-serif">{word.word}</h4>
                  <p className="text-primary text-sm font-medium">{word.pinyin}</p>
                </div>
                
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button 
                        onClick={saveEdit}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="保存"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={cancelEdit}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="取消"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => startEdit(word)}
                        className="p-1.5 text-gray-300 hover:text-primary hover:bg-indigo-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="编辑考点"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDelete(word.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-2 min-h-[24px] items-center">
                {isEditing ? (
                  <>
                    <span className="text-xs text-gray-400 mr-1">考点:</span>
                    <button
                      onClick={() => toggleEditType(QuestionType.PINYIN)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        displayWord.enabledTypes.includes(QuestionType.PINYIN)
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      注音
                    </button>
                    <button
                      onClick={() => toggleEditType(QuestionType.DICTATION)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        displayWord.enabledTypes.includes(QuestionType.DICTATION)
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      书写
                    </button>
                    {word.definitionData && (
                      <button
                        onClick={() => toggleEditType(QuestionType.DEFINITION)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          displayWord.enabledTypes.includes(QuestionType.DEFINITION)
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        释义
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {displayWord.enabledTypes.includes(QuestionType.PINYIN) && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">注音</span>}
                    {displayWord.enabledTypes.includes(QuestionType.DICTATION) && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">书写</span>}
                    {displayWord.enabledTypes.includes(QuestionType.DEFINITION) && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">释义</span>}
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
    </div>
  );
};

export default WordList;