document.getElementById('floatModeBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab.url && (currentTab.url.startsWith('http://') || currentTab.url.startsWith('https://'))) {
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Script injection failed: ", chrome.runtime.lastError.message);
          alert("Could not activate Float Mode on this page. Please try on a regular webpage.");
        } else {
          chrome.tabs.sendMessage(currentTab.id, { action: 'activateFloatMode' });
        }
      });
    } else {
      alert("Float Mode can only be activated on regular web pages (http:// or https://).");
    }
  });
});