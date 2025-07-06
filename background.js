chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreen') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (screenshotUrl) => {
      sendResponse({ screenshotUrl: screenshotUrl });
    });
    return true; // Required for asynchronous sendResponse
  } else if (request.action === 'sendToGemini') {
    fetch('http://localhost:3000/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageData: request.imageData, question: request.question, mode: request.mode }),
    })
    .then(response => response.json())
    .then(data => sendResponse({ response: data.response }))
    .catch(error => sendResponse({ error: error.message }));
    return true; // Required for asynchronous sendResponse
  }
});