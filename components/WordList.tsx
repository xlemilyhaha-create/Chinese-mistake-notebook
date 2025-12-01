import React from 'react';
import { WordEntry, QuestionType } from '../types';
import { Trash2, Calendar } from 'lucide-react';

interface WordListProps {
  words: WordEntry[];
  onDelete: (id: string) => void;
}

const WordList: React.FC<WordListProps> = ({ words, onDelete }) => {
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
        {words.map((word) => (
          <div key={word.id} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-xl font-bold text-gray-800 font-serif">{word.word}</h4>
                <p className="text-primary text-sm font-medium">{word.pinyin}</p>
              </div>
              <button 
                onClick={() => onDelete(word.id)}
                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-1 mb-2">
              {word.enabledTypes.includes(QuestionType.PINYIN) && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">注音</span>}
              {word.enabledTypes.includes(QuestionType.DICTATION) && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">书写</span>}
              {word.enabledTypes.includes(QuestionType.DEFINITION) && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded">释义</span>}
            </div>

            <div className="flex items-center text-xs text-gray-400 mt-2 border-t pt-2">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date(word.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WordList;