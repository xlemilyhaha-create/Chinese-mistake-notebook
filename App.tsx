import React, { useState, useEffect } from 'react';
import { BookOpen, FileText, Settings, Database } from 'lucide-react';
import WordEntryForm from './components/WordEntryForm';
import WordList from './components/WordList';
import ExamGenerator from './components/ExamGenerator';
import { WordEntry } from './types';

enum View {
  HOME = 'HOME',
  EXAM = 'EXAM',
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [words, setWords] = useState<WordEntry[]>([]);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('yuwen_words');
    if (saved) {
      try {
        setWords(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved words");
      }
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('yuwen_words', JSON.stringify(words));
  }, [words]);

  const handleAddWord = (entry: WordEntry) => {
    setWords(prev => [entry, ...prev]);
  };

  const handleDeleteWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  if (currentView === View.EXAM) {
    return (
      <ExamGenerator 
        words={words} 
        onBack={() => setCurrentView(View.HOME)} 
      />
    );
  }

  return (
    <div className="h-full bg-gray-50 flex flex-col font-sans">
      {/* Navbar - Fixed at top */}
      <header className="bg-white border-b border-gray-200 shrink-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold text-xl">
            <BookOpen className="w-6 h-6" />
            <span>语文错题助手</span>
          </div>
          <button 
            onClick={() => setCurrentView(View.EXAM)}
            className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            生成试卷
          </button>
        </div>
      </header>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
          
          {/* Input Section */}
          <section>
            <WordEntryForm onAddWord={handleAddWord} />
          </section>

          {/* List Section */}
          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Database className="w-5 h-5 mr-2 text-gray-500" />
                题库列表
              </h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                共 {words.length} 个词
              </span>
            </div>
            <WordList words={words} onDelete={handleDeleteWord} />
          </section>

        </main>
        
        <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-400 mt-auto shrink-0">
          <p>© 2025 语文错题助手 - Build Your Vocabulary</p>
        </footer>
      </div>
    </div>
  );
};

export default App;