document.addEventListener('copy', function (e) {
    const selectedText = window.getSelection().toString();
    if (selectedText) {
      chrome.runtime.sendMessage({ action: 'copyText', text: selectedText });
      console.log('Copied text:', selectedText);
    }
  });
  


  