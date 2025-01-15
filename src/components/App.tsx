import React, { useState, useEffect, useRef } from 'react';
import { Search, Moon, Sun, File, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ClipboardItem, Settings } from '../types';
import { storageService } from '../services/storageService';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco, dark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { ContentType } from '../types';

const App = () => {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || 
           (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const settingsRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Settings>({
    theme: 'system',
    maxHistoryItems: 100,
    retentionDays: 7,
    shortcuts: {
      openPopup: 'Ctrl+Shift+V',
      pasteLast: 'Ctrl+Shift+X'
    }
  });

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.items) {
        setItems(changes.items.newValue || []);
      }
    };

    chrome.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await storageService.getSettings();
      setSettings(savedSettings);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);



  const showNotification = (message: string) => {
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const handleCopy = (item: ClipboardItem) => {
    navigator.clipboard.writeText(item.content);
    showNotification('Copied to clipboard!');
  };

  const handleDelete = async (id: string) => {
    const updatedItems = items.filter(item => item.id !== id);
    await chrome.storage.local.set({ items: updatedItems });
    setItems(updatedItems);
    chrome.runtime.sendMessage({ 
      action: 'updateBadge',
      count: updatedItems.length 
    });
    showNotification('Item deleted');
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (expandedItems.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updatedSettings = await storageService.updateSettings(newSettings);
    setSettings(updatedSettings);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const handleClearHistory = async () => {
    await chrome.storage.local.set({ items: [] });
    setItems([]);
    chrome.runtime.sendMessage({ 
      action: 'updateBadge',
      count: 0
    });
    showNotification('History cleared');
    setShowSettings(false);
  };
  const renderContent = (item: ClipboardItem, isExpanded: boolean) => {
    const maxLengths = {
      text: 150,
      code: 150,
      math: 150
    };
    
    const content = item.content;
    
    if (item.type === ContentType.MATH) {
      const isTruncated = content.length > maxLengths.math && !isExpanded;
      return (
        <div className="max-w-full">
          {content.length > maxLengths.math && isExpanded && (
            <button
              onClick={() => toggleExpand(item.id)}
              className="text-xs text-blue-500 mb-2 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              Show less
              <ChevronUp size={14} />
            </button>
          )}
          <SyntaxHighlighter 
            language="latex"
            style={isDarkMode ? dark : docco}
            customStyle={{ 
              margin: 0,
              background: isDarkMode ? '#1f2937' : '#f9fafb',
              maxHeight: isExpanded ? 'none' : '200px',
              overflow: 'auto'
            }}
            className="overflow-x-auto"
          >
            {isTruncated ? content.slice(0, maxLengths.math) + '...' : content}
          </SyntaxHighlighter>
          {content.length > maxLengths.math && !isExpanded && (
            <button
              onClick={() => toggleExpand(item.id)}
              className="text-xs text-blue-500 mt-2 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              Show more
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      );
    }
  
    if (content.match(/<[^>]+>/) || 
        content.match(/[{}\[\]]/) || 
        content.match(/^(SELECT|INSERT|UPDATE|DELETE)/i) || 
        content.includes('function') || 
        content.includes('class')) {
      
      const isTruncated = content.length > maxLengths.code && !isExpanded;
      let language = 'text';
      let formattedContent = content;
  
      if (content.includes('{') && content.includes('}')) {
        if (content.match(/[.#][a-zA-Z]/) || content.includes('@media')) {
          language = 'css';
        } else if (content.includes('function') || content.includes('const ')) {
          language = 'javascript';
        } else {
          try {
            JSON.parse(content);
            language = 'json';
            formattedContent = JSON.stringify(JSON.parse(content), null, 2);
          } catch {}
        }
      } else if (content.match(/^(SELECT|INSERT|UPDATE|DELETE)/i)) {
        language = 'sql';
      } else if (content.trim().startsWith('<')) {
        language = 'html';
      }
  
      return (
        <div className="max-w-full">
          {content.length > maxLengths.code && isExpanded && (
            <button 
              onClick={() => toggleExpand(item.id)}
              className="text-xs text-blue-500 mb-2 hover:text-blue-600 flex items-center gap-1"
            >
              Show less
              <ChevronUp size={14} />
            </button>
          )}
          <SyntaxHighlighter 
            language={language}
            style={isDarkMode ? dark : docco}
            customStyle={{ 
              margin: 0,
              maxHeight: isExpanded ? 'none' : '200px',
              overflow: 'auto'
            }}
            className="overflow-x-auto"
            showLineNumbers={true}
          >
            {isTruncated ? formattedContent.slice(0, maxLengths.code) + '...' : formattedContent}
          </SyntaxHighlighter>
          {content.length > maxLengths.code && !isExpanded && (
            <button 
              onClick={() => toggleExpand(item.id)}
              className="text-xs text-blue-500 mt-2 hover:text-blue-600 flex items-center gap-1"
            >
              Show more
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      );
    }
    
    const isTruncated = content.length > maxLengths.text && !isExpanded;
    return (
      <div className="max-w-full overflow-x-auto">
        {content.length > maxLengths.text && isExpanded && (
          <button 
            onClick={() => toggleExpand(item.id)}
            className="text-xs text-blue-500 mb-2 hover:text-blue-600 flex items-center gap-1"
          >
            Show less
            <ChevronUp size={14} />
          </button>
        )}
        <div className="whitespace-pre-wrap">
          {isTruncated ? content.slice(0, maxLengths.text) + '...' : content}
        </div>
        {content.length > maxLengths.text && !isExpanded && (
          <button 
            onClick={() => toggleExpand(item.id)}
            className="text-xs text-blue-500 mt-2 hover:text-blue-600 flex items-center gap-1"
          >
            Show more
            <ChevronDown size={14} />
          </button>
        )}
      </div>
    );
  };
  
  const loadItems = async () => {
    const { items = [] } = await chrome.storage.local.get('items');
    setItems(items);
  };

  const handleNewClipboardItem = async (item: ClipboardItem) => {
    const updatedItems = [item, ...items].slice(0, settings.maxHistoryItems);
    await chrome.storage.local.set({ items: updatedItems });
    setItems(updatedItems);
  };

  return (
    <div className={`w-96 h-[600px] flex flex-col ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">CopyCache Pro</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Settings"
            >
              <Filter size={20} />
            </button>
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search clips..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border-0 dark:text-white text-black placeholder:text-gray-500 dark:placeholder:text-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div 
          ref={settingsRef}
          className="absolute right-4 top-16 w-72 bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden z-50"
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-black dark:text-white">Settings</h3>
            <button 
              onClick={handleClearHistory}
              className="text-sm text-red-500 hover:text-red-600"
            >
              Clear All History
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-black dark:text-white block mb-2">
                History Retention
              </label>
              <select 
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 text-black dark:text-white border border-gray-300 dark:border-gray-600"
                value={settings.retentionDays}
                onChange={(e) => updateSettings({ retentionDays: Number(e.target.value) as 1 | 3 | 7 })}
              >
                <option value={1}>Every day</option>
                <option value={3}>Every 3 days</option>
                <option value={7}>Every 7 days</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-black dark:text-white block mb-2">
                Maximum History Items
              </label>
              <select 
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 text-black dark:text-white border border-gray-300 dark:border-gray-600"
                value={settings.maxHistoryItems}
                onChange={(e) => updateSettings({ maxHistoryItems: Number(e.target.value) })}
              >
                <option value={50}>50 items</option>
                <option value={100}>100 items</option>
                <option value={200}>200 items</option>
              </select>
            </div>
            


            </div>
      
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="mb-2">
              <File size={48} />
            </div>
            <p className="text-center">No clips yet</p>
            <p className="text-sm text-center mt-2">Copy something to get started</p>
          </div>
        ) : (
          items
            .filter(item => {
              return item.content.toLowerCase().includes(searchQuery.toLowerCase());
            })
            .map((item: ClipboardItem) => (
              <div 
                key={item.id}
                className="group relative p-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleCopy(item)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-green-100 dark:bg-green-700 text-green-700 dark:text-green-100"
                    >
                      Copy
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded bg-red-100 dark:bg-red-700 text-red-700 dark:text-red-100"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className={`text-sm ${isDarkMode ? 'bg-gray-700' : 'bg-white'} p-2 rounded`}>
                  {renderContent(item, expandedItems.has(item.id))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default App;