export enum ContentType {
  TEXT = 'text',
  CODE = 'code',
  HTML = 'html',
  CSS = 'css',
  JSON = 'json',
  XML = 'xml',
  PYTHON = 'python',
  SQL = 'sql',
  MARKDOWN = 'markdown',
  SHELL = 'shell',
  URL = 'url',
  MATH = 'math'
}

export interface DetectionScore {
  type: ContentType;
  score: number;
}

export interface ClipboardItem {
    id: string;
    content: string;
    timestamp: number;
    metadata?: {
      charCount?: number;
      wordCount?: number;
      language?: string;
      url?: string;
      colors?: string[];
      emails?: string[];
      phones?: string[];
      addresses?: string[];
      dates?: Date[];
      calculations?: string[];
      units?: {
        original: string;
        converted: string;
      }[];
    };
    type?: ContentType;
}
  
export interface Settings {
    theme: 'light' | 'dark' | 'system';
    maxHistoryItems: number;
    retentionDays: 1 | 3 | 7;
    shortcuts: {
      [key: string]: string;
    };
}

export interface SearchOptions {
    query: string;
    dateRange?: {
      start: number;
      end: number;
    };
}