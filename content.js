let floatPanel = null;
let cropOverlay = null;
let startX, startY, endX, endY;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content.js:', request.action);
  if (request.action === 'activateFloatMode') {
    console.log('Activating float mode...');
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
      <div id="askContainer" style="display:none;">
        <textarea id="questionInput" placeholder="Ask your question..."></textarea>
        <button id="askBtn">Ask</button>
      </div>
      <div id="responseContainer"></div>
    </div>
  `;
  document.body.appendChild(floatPanel);

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
  const askBtn = floatPanel.querySelector('#askBtn');

  captureBtn.style.display = 'none';
  previewContainer.style.display = 'block';
  croppedImagePreview.src = imageData;
  askContainer.style.display = 'block';
  askBtn.dataset.imageData = imageData; // Store image data for later use
}

function sendToGemini() {
  const askBtn = floatPanel.querySelector('#askBtn');
  const questionInput = floatPanel.querySelector('#questionInput');
  const responseContainer = floatPanel.querySelector('#responseContainer');

  const imageData = askBtn.dataset.imageData;
  const question = questionInput.value;

  if (!imageData || !question) {
    alert('Please capture an image and ask a question.');
    return;
  }

  responseContainer.innerHTML = 'Loading...';

  chrome.runtime.sendMessage({ action: 'sendToGemini', imageData: imageData, question: question }, (response) => {
    if (response.response) {
      responseContainer.innerHTML = response.response;
    } else if (response.error) {
      responseContainer.innerHTML = 'Error: ' + response.error;
      console.error('Error from Gemini API:', response.error);
    }
  });
}