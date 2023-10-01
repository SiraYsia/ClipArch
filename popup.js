// popup.js
document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.sync.get('copiedTexts', function (data) {
      const copiedTexts = data.copiedTexts || [];
      const copiedTextList = document.getElementById('copiedTextList');
  
      copiedTexts.forEach(function (text) {
        const listItem = document.createElement('li');
        listItem.textContent = text;
        copiedTextList.prepend(listItem);
      });
    });
  });

  function clearCopiedTexts() {
    const confirmation = window.confirm('Are you sure you want to clear the copied text history?');
    if (confirmation) {
      chrome.storage.sync.remove('copiedTexts', function () {
        // Clear the copied text history
        const copiedTextList = document.getElementById('copiedTextList');
        copiedTextList.innerHTML = ''; // Remove all copied text items from the list
        
  
        // Refresh the extension
        chrome.runtime.reload();
  
        // Close the popup (optional)
        window.close();
      });
    }
  }
  
  // Add event listener for the "Clear Copied Texts" button
  document.addEventListener('DOMContentLoaded', function () {
    const clearButton = document.getElementById('clearTextsButton');
    clearButton.addEventListener('click', clearCopiedTexts);
  });
  