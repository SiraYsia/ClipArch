import { ClipboardItem, ContentType } from './types';
import { detectContentType } from './utils/contentDetection';

let isListenerActive = false;
let lastCopiedText: string | null = null;
let lastCopyTime = 0;

const detectListType = (element: Element | null): string | null => {
  if (!element) return null;
  
  // Check if element is a list item or part of a list
  if (element.matches('li, ul, ol')) {
    const listStyle = window.getComputedStyle(element);
    const listStyleType = listStyle.getPropertyValue('list-style-type');
    
    if (element.closest('ol')) return 'numbered';
    if (element.closest('ul')) return 'bullet';
  }
  
  // Check for common bullet point characters
  const text = element.textContent || '';
  if (/^[•·○●※■□☆★-]\s/.test(text)) return 'bullet';
  if (/^\d+[.)]\s/.test(text)) return 'numbered';
  
  return null;
};

const preserveFormatting = (node: Node, depth: number = 0): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() || '';
  }

  const element = node as Element;
  let result = '';
  const listType = detectListType(element);

  // Handle list items
  if (element.matches('li')) {
    const index = Array.from(element.parentElement?.children || []).indexOf(element) + 1;
    const prefix = listType === 'numbered' ? `${index}. ` : '• ';
    result = `${' '.repeat(depth * 2)}${prefix}${Array.from(element.childNodes)
      .map(child => preserveFormatting(child, depth + 1))
      .join(' ').trim()}\n`;
  } 
  // Handle paragraphs and divs
  else if (element.matches('p, div')) {
    result = Array.from(element.childNodes)
      .map(child => preserveFormatting(child, depth))
      .join(' ').trim();
    if (result) result += '\n';
  }
  // Handle line breaks
  else if (element.matches('br')) {
    result = '\n';
  }
  // Handle all other elements
  else {
    result = Array.from(element.childNodes)
      .map(child => preserveFormatting(child, depth))
      .join(' ').trim();
  }

  return result;
};

function initializeCopyListener() {
  if (isListenerActive) return;
  
  const handleClipboardEvent = async (e: Event) => {
    try {
      let selectedText: string | undefined;
      
      // Try multiple methods to get the selected text
      if (window.getSelection) {
        selectedText = window.getSelection()?.toString();
      }
      
      // Special handling for Google Docs/Slides
      if (!selectedText && document.querySelector('.kix-appview-editor, .punch-viewer-content')) {
        // Wait briefly for clipboard to be populated
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText) {
            selectedText = clipboardText;
          }
        } catch (clipboardError) {
          console.debug('Clipboard access denied:', clipboardError);
        }
      }
      
      if (selectedText) {
        const currentTime = Date.now();
        
        if (selectedText === lastCopiedText && currentTime - lastCopyTime < 1000) {
          console.log('Prevented duplicate copy within 1 second');
          return;
        }

        // First get settings to respect user's max items limit
        const { settings = {} } = await chrome.storage.sync.get('settings');
        const { items = [] } = await chrome.storage.local.get('items');
        
        const existingItemIndex = items.findIndex((item: ClipboardItem) => 
          item.content === selectedText
        );

        if (existingItemIndex !== -1) {
          const [existingItem] = items.splice(existingItemIndex, 1);
          existingItem.timestamp = currentTime;
          items.unshift(existingItem);
        } else {
          // Create new item without tags
          const newItem: ClipboardItem = {
            id: crypto.randomUUID(),
            content: selectedText,
            timestamp: currentTime,
            type: detectContentType(selectedText),
          };
          items.unshift(newItem);
        }
        
        lastCopiedText = selectedText;
        lastCopyTime = currentTime;
        
        // Respect user's maxHistoryItems setting, default to 50 if not set
        const maxItems = settings.maxHistoryItems || 50;
        if (items.length > maxItems) {
          items.length = maxItems; // Truncate to max items
        }
        
        await chrome.storage.local.set({ items });
        
        try {
          await chrome.runtime.sendMessage({ 
            action: 'updateBadge',
            count: items.length 
          });
        } catch (error) {
          chrome.runtime.connect();
        }
      }
    } catch (error) {
      console.error('Copy handler error:', error);
      initializeCopyListener();
    }
  };

  // Add listeners for both copy and cut events
  ['copy', 'cut'].forEach(eventType => {
    document.removeEventListener(eventType, handleClipboardEvent as EventListener);
    document.addEventListener(eventType, handleClipboardEvent as EventListener);
  });

  // Add fallback clipboard monitoring for protected sites
  if (document.querySelector('.kix-appview-editor, .punch-viewer-content')) {
    let lastCheckContent = '';
    setInterval(async () => {
      try {
        const clipContent = await navigator.clipboard.readText();
        if (clipContent && clipContent !== lastCheckContent) {
          lastCheckContent = clipContent;
          await handleClipboardEvent(new Event('copy'));
        }
      } catch (e) {
        // Ignore clipboard access errors
      }
    }, 1000);
  }

  isListenerActive = true;
}

// Initialize immediately
initializeCopyListener();

// Wake up on any user interaction
document.addEventListener('mousemove', () => {
  initializeCopyListener();
}, { once: true });

// Wake up on tab focus
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    initializeCopyListener();
  }
});

// Wake up on tab activation
window.addEventListener('focus', () => {
  initializeCopyListener();
});

// Keep connection alive with background script
let port = chrome.runtime.connect({ name: 'keepAlive' });
port.onDisconnect.addListener(() => {
  port = chrome.runtime.connect({ name: 'keepAlive' });
  initializeCopyListener();
});

// Force wake up every minute for long-inactive tabs
setInterval(() => {
  if (document.visibilityState === 'visible') {
    initializeCopyListener();
  }
}, 60000);

// Notify background script that content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptLoaded' });

const handleSelection = (e: ClipboardEvent) => {
  const selection = window.getSelection();
  if (!selection) return;

  try {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer as Element;
    
    // Check if we're dealing with formatted content
    const hasFormatting = 
      container.querySelector('li, ul, ol') || // List elements
      /^[•·○●※■□☆★-]\s/.test(selection.toString()) || // Bullet points
      /^\d+[.)]\s/m.test(selection.toString()); // Numbered lists

    if (hasFormatting || container.closest('.math-content')) {
      let formattedText = '';
      
      // Create a temporary element to hold the selection
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(range.cloneContents());
      
      // Preserve the formatting
      formattedText = preserveFormatting(tempDiv).trim();
      
      // Handle empty lines and normalize spacing
      formattedText = formattedText
        .replace(/\n{3,}/g, '\n\n') // Limit consecutive empty lines to 2
        .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
        .trim();

      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', formattedText);
        e.preventDefault();
      }
    }
  } catch (error) {
    console.error('Error handling formatted copy:', error);
  }
};

// Add the copy event listener
document.addEventListener('copy', handleSelection as EventListener);