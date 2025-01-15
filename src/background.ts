import clipboardManager from './background/clipboard-manager';

const manager = clipboardManager.getInstance();

const tabStates = new Map<number, number>();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    reinjectContentScript(tabId);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) reinjectContentScript(tab.id);
      });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'updateBadge':
      chrome.action.setBadgeText({ text: message.count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#4A90E2' });
      break;
      
    case 'contentScriptLoaded':
      if (sender.tab?.id) {
        tabStates.set(sender.tab.id, Date.now());
      }
      break;

    case 'clipboardUpdate':
      manager.handleClipboardChange(message.content);
      break;
  }
});

async function reinjectContentScript(tabId: number) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (error) {
    console.warn(`Failed to inject content script into tab ${tabId}:`, error);
  }
}

chrome.runtime.onSuspend.addListener(() => {
  manager.cleanup();
});

manager.reinitialize().catch(console.error);

// Less aggressive periodic check (every 5 seconds)
setInterval(() => {
  chrome.tabs.query({ active: true }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        const lastActive = tabStates.get(tab.id);
        const now = Date.now();
        
        // Only reinject if tab hasn't been active in the last 30 seconds
        if (!lastActive || (now - lastActive > 30000)) {
          reinjectContentScript(tab.id);
          tabStates.set(tab.id, now);
        }
      }
    });
  });
}, 5000);