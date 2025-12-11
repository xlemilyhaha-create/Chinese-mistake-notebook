import { WordEntry, FilterOptions, TestStatus } from '../types';

const API_BASE = '/api/words';

export const wordService = {
  // Get all words with optional filters
  async getWords(filters?: FilterOptions): Promise<WordEntry[]> {
    const params = new URLSearchParams();
    
    if (filters?.questionTypes && filters.questionTypes.length > 0) {
      filters.questionTypes.forEach(type => params.append('questionTypes', type));
    }
    
    if (filters?.testStatuses && filters.testStatuses.length > 0) {
      filters.testStatuses.forEach(status => params.append('testStatuses', status));
    }
    
    if (filters?.isMultipleAttempts !== undefined && filters.isMultipleAttempts !== null) {
      // 支持数组类型（多选）
      if (Array.isArray(filters.isMultipleAttempts)) {
        filters.isMultipleAttempts.forEach(value => {
          params.append('isMultipleAttempts', String(value));
        });
      } else {
        params.append('isMultipleAttempts', String(filters.isMultipleAttempts));
      }
    }

    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch words: ${response.statusText}`);
    }
    return response.json();
  },

  // Create a new word entry
  async createWord(entry: WordEntry): Promise<void> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!response.ok) {
      throw new Error(`Failed to create word: ${response.statusText}`);
    }
  },

  // Update a word entry
  async updateWord(id: string, updates: Partial<WordEntry>): Promise<void> {
    const response = await fetch(`${API_BASE}?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      throw new Error(`Failed to update word: ${response.statusText}`);
    }
  },

  // Batch update test status
  async batchUpdateTestStatus(ids: string[], testStatus: TestStatus): Promise<void> {
    const response = await fetch(API_BASE, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, testStatus })
    });
    if (!response.ok) {
      throw new Error(`Failed to batch update status: ${response.statusText}`);
    }
  },

  // Delete a word entry
  async deleteWord(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}?id=${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to delete word: ${response.statusText}`);
    }
  }
};

