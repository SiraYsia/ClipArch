chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === 'copyText') {
      chrome.storage.sync.get('copiedTexts', function (data) {
        const copiedTexts = data.copiedTexts || [];
        copiedTexts.push(message.text);
        chrome.storage.sync.set({ copiedTexts: copiedTexts });
        console.log('Text added to storage:', message.text);
      });
    }
  });
  