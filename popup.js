document.addEventListener('DOMContentLoaded', () => {
  const floatModeBtn = document.getElementById('floatModeBtn');
  const modeRadios = document.querySelectorAll('input[name="mode"]');

  // Load saved mode or set default
  chrome.storage.local.get(['selectedMode'], (result) => {
    const savedMode = result.selectedMode || 'onlyAnswer';
    document.querySelector(`input[value="${savedMode}"]`).checked = true;
  });

  modeRadios.forEach(radio => {
    radio.addEventListener('change', (event) => {
      chrome.storage.local.set({ selectedMode: event.target.value });
    });
  });

  floatModeBtn.addEventListener('click', () => {
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
            const selectedMode = document.querySelector('input[name="mode"]:checked').value;
            chrome.tabs.sendMessage(currentTab.id, { action: 'activateFloatMode', mode: selectedMode });
          }
        });
      } else {
        alert("Float Mode can only be activated on regular web pages (http:// or https://).");
      }
    });
  });
});