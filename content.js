let floatPanel = null;
let cropOverlay = null;
let startX, startY, endX, endY;

let currentMode = 'onlyAnswer'; // Default mode

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content.js:', request.action);
  if (request.action === 'activateFloatMode') {
    console.log('Activating float mode...');
    currentMode = request.mode; // Update currentMode from popup
    if (!floatPanel) {
      createFloatPanel();
      console.log('Float panel created.');
    } else {
      console.log('Float panel already exists.');
    }
  }
});

function createFloatPanel() {
  floatPanel = document.createElement('div');
  floatPanel.id = 'question-master-float-panel';
  floatPanel.innerHTML = `
    <div class="header">
      <button id="closePanel">X</button>
    </div>
    <div class="content">
      <button id="captureBtn">Capture</button>
      <div id="previewContainer" style="display:none;">
        <img id="croppedImagePreview" style="max-width:100%; height:auto;" />
      </div>
      <div id="askContainer">
        <textarea id="questionInput" placeholder="Ask your question..."></textarea>
        <button id="askBtn">Ask</button>
      </div>
      <div id="responseContainer"></div>
      <button id="clearBtn" style="display:none;">Clear</button>
    </div>
  `;
  document.body.appendChild(floatPanel);

  // Initial state of questionInput based on currentMode
  const questionInput = floatPanel.querySelector('#questionInput');
  if (currentMode !== 'customInput') {
    questionInput.style.display = 'none';
  } else {
    questionInput.style.display = 'block';
  }

  // Make the panel draggable
  const header = floatPanel.querySelector('.header');
  let isDragging = false;
  let offsetX, offsetY;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - floatPanel.getBoundingClientRect().left;
    offsetY = e.clientY - floatPanel.getBoundingClientRect().top;
    floatPanel.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    floatPanel.style.left = (e.clientX - offsetX) + 'px';
    floatPanel.style.top = (e.clientY - offsetY) + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    floatPanel.style.cursor = 'grab';
  });

  floatPanel.querySelector('#closePanel').addEventListener('click', () => {
    floatPanel.remove();
    floatPanel = null;
  });

  floatPanel.querySelector('#captureBtn').addEventListener('click', () => {
    startCropping();
  });

  floatPanel.querySelector('#askBtn').addEventListener('click', () => {
    sendToGemini();
  });

  floatPanel.querySelector('#clearBtn').addEventListener('click', () => {
    clearPanel();
  });
}

function clearPanel() {
  const captureBtn = floatPanel.querySelector('#captureBtn');
  const previewContainer = floatPanel.querySelector('#previewContainer');
  const croppedImagePreview = floatPanel.querySelector('#croppedImagePreview');
  const askContainer = floatPanel.querySelector('#askContainer');
  const questionInput = floatPanel.querySelector('#questionInput');
  const responseContainer = floatPanel.querySelector('#responseContainer');
  const clearBtn = floatPanel.querySelector('#clearBtn');

  captureBtn.style.display = 'block';
  previewContainer.style.display = 'none';
  croppedImagePreview.src = '';
  askContainer.style.display = 'none';
  questionInput.value = '';
  responseContainer.innerHTML = '';
  clearBtn.style.display = 'none';
}

function startCropping() {
  document.body.style.cursor = 'crosshair';

  cropOverlay = document.createElement('div');
  cropOverlay.id = 'question-master-crop-overlay';
  document.body.appendChild(cropOverlay);

  const cropArea = document.createElement('div');
  cropArea.id = 'question-master-crop-area';
  cropOverlay.appendChild(cropArea);
  cropArea.style.display = 'none'; // Initially hidden

  let isDrawing = false;

  const onMouseDown = (e) => {
    if (e.button === 0) { // Left click
      isDrawing = true;
      startX = e.clientX;
      startY = e.clientY;
      cropArea.style.left = startX + 'px';
      cropArea.style.top = startY + 'px';
      cropArea.style.width = '0';
      cropArea.style.height = '0';
      cropArea.style.display = 'block'; // Show crop area after first click

      // Add mousemove and mouseup listeners to the document
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
  };

  const onMouseMove = (e) => {
    if (!isDrawing) return;
    endX = e.clientX;
    endY = e.clientY;

    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);

    cropArea.style.left = left + 'px';
    cropArea.style.top = top + 'px';
    cropArea.style.width = width + 'px';
    cropArea.style.height = height + 'px';
  };

  const onMouseUp = () => {
    if (!isDrawing) return;
    isDrawing = false;
    document.body.style.cursor = 'default';
    cropOverlay.remove();

    // Remove event listeners
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    cropOverlay.removeEventListener('mousedown', onMouseDown); // Remove this too

    captureCroppedArea(startX, startY, endX, endY);
  };

  cropOverlay.addEventListener('mousedown', onMouseDown);
}

function captureCroppedArea(x1, y1, x2, y2) {
  chrome.runtime.sendMessage({ action: 'captureScreen' }, (response) => {
    if (response.screenshotUrl) {
      const img = new Image();
      img.src = response.screenshotUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;

        const cropX = Math.min(x1, x2) * scaleX;
        const cropY = Math.min(y1, y2) * scaleY;
        const cropWidth = Math.abs(x2 - x1) * scaleX;
        const cropHeight = Math.abs(y2 - y1) * scaleY;

        canvas.width = cropWidth;
        canvas.height = cropHeight;
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        const croppedImageUrl = canvas.toDataURL('image/png');
        displayAskButton(croppedImageUrl);
      };
    } else if (response.error) {
      console.error('Error capturing screen:', response.error);
      alert('Error capturing screen: ' + response.error);
    }
  });
}

function displayAskButton(imageData) {
  const captureBtn = floatPanel.querySelector('#captureBtn');
  const askContainer = floatPanel.querySelector('#askContainer');
  const previewContainer = floatPanel.querySelector('#previewContainer');
  const croppedImagePreview = floatPanel.querySelector('#croppedImagePreview');
  const questionInput = floatPanel.querySelector('#questionInput');
  const askBtn = floatPanel.querySelector('#askBtn');
  const clearBtn = floatPanel.querySelector('#clearBtn');

  captureBtn.style.display = 'none';
  previewContainer.style.display = 'block';
  croppedImagePreview.src = imageData;
  askContainer.style.display = 'block';
  askBtn.dataset.imageData = imageData; // Store image data for later use
  clearBtn.style.display = 'block'; // Show clear button after capture

  // Adjust visibility of question input based on currentMode
  if (currentMode === 'customInput') {
    questionInput.style.display = 'block';
  } else {
    questionInput.style.display = 'none';
  }
}

function sendToGemini() {
  const askBtn = floatPanel.querySelector('#askBtn');
  const questionInput = floatPanel.querySelector('#questionInput');
  const responseContainer = floatPanel.querySelector('#responseContainer');

  const imageData = askBtn.dataset.imageData;
  let question = '';

  if (!imageData) {
    alert('Please capture an image.');
    return;
  }

  switch (currentMode) {
    case 'onlyAnswer':
      question = 'Give only the answer.';
      break;
    case 'answerWithExplanation':
      question = 'Give a 30-word explanation with the answer. Answer is mandatory.';
      break;
    case 'customInput':
      question = questionInput.value;
      if (!question) {
        alert('Please enter your question.');
        return;
      }
      break;
  }

  switch (currentMode) {
    case 'onlyAnswer':
      question = 'Give only the answer.';
      break;
    case 'answerWithExplanation':
      question = 'Give a 30-word explanation with the answer. Answer is mandatory.';
      break;
    case 'customInput':
      question = questionInput.value;
      if (!question) {
        alert('Please enter your question.');
        return;
      }
      break;
  }

  responseContainer.innerHTML = 'Loading...';

  chrome.runtime.sendMessage({ action: 'sendToGemini', imageData: imageData, question: question, mode: currentMode }, (response) => {
    if (response.response) {
      responseContainer.innerHTML = response.response;
    } else if (response.error) {
      responseContainer.innerHTML = 'Error: ' + response.error;
      console.error('Error from Gemini API:', response.error);
    }
  });
}