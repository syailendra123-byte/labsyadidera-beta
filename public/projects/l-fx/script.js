const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const controlsContainer = document.getElementById('controlsContainer');
const autoChangeToggle = document.getElementById('autoChangeToggle');

const FILTER_EFFECTS = [
    { id: 'none',       label: 'Hanya Garis',         type: 'none' },
    { id: 'alien',      label: 'Kebalikan',               type: 'css', value: 'invert(100%) hue-rotate(180deg)' },
    { id: 'bw',         label: 'Hitam Putih',         type: 'css', value: 'grayscale(100%) contrast(200%)' },
    { id: 'retro',      label: 'Retro Vintage',       type: 'css', value: 'sepia(100%) contrast(150%)' },
    { id: 'blur',       label: 'Sensor Blur',         type: 'css', value: 'blur(8px)' },
    { id: 'popart',     label: 'Pop Art',             type: 'css', value: 'saturate(300%) contrast(150%)' },
    { id: 'infrared',   label: 'Infra Merah',         type: 'infrared' }, 
    { id: 'pixelate',   label: 'Pixel 8-Bit',         type: 'pixelate' },
    { id: 'grid',       label: 'Grid Kotak-Kotak',    type: 'grid' },
    { id: 'ascii',      label: 'ASCII Art',           type: 'ascii' },
    { id: 'edge',       label: 'Edge Detection',      type: 'edge' },
    { id: 'halftone',   label: 'Halftone',            type: 'halftone' },
    { id: 'dither',     label: 'Game lama',           type: 'dither' },
    { id: 'glitch',     label: 'Glitch',              type: 'glitch' },
];

let currentEffectIndex = 0;

FILTER_EFFECTS.forEach((effect, index) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (index === 0 ? ' active' : '');
    btn.textContent = effect.label;
    btn.dataset.index = index;

    btn.addEventListener('click', () => {
        setActiveEffect(index);
    });

    controlsContainer.appendChild(btn);
});



function setActiveEffect(index) {
    currentEffectIndex = index;

    const allButtons = controlsContainer.querySelectorAll('.filter-btn');
    allButtons.forEach(b => b.classList.remove('active'));
    allButtons[index].classList.add('active');
}








let fingerState = 'apart';




const TOUCH_THRESHOLD = 35;   
const RELEASE_THRESHOLD = 55; 

function getDistance(pointA, pointB) {
    const dx = pointA.x - pointB.x;
    const dy = pointA.y - pointB.y;
    return Math.sqrt(dx * dx + dy * dy);
}







function pickRandomEffectIndex(excludeIndex) {
    const eligibleIndices = [];

    FILTER_EFFECTS.forEach((effect, idx) => {
        if (effect.type !== 'none' && idx !== excludeIndex) {
            eligibleIndices.push(idx);
        }
    });

    const randomPos = Math.floor(Math.random() * eligibleIndices.length);
    return eligibleIndices[randomPos];
}



function handleAutoChangeGesture(p1, p2, p3, p4) {
    
    
    
    const avgDistance = (getDistance(p1, p4) + getDistance(p2, p3)) / 2;

    if (avgDistance < TOUCH_THRESHOLD && fingerState === 'apart') {
        
        fingerState = 'together';

        if (autoChangeToggle.checked) {
            const randomIndex = pickRandomEffectIndex(currentEffectIndex);
            setActiveEffect(randomIndex);
        }
    } else if (avgDistance > RELEASE_THRESHOLD && fingerState === 'together') {
        
        fingerState = 'apart';
    }
}












const pixelateCanvas = document.createElement('canvas');
const pixelateCtx = pixelateCanvas.getContext('2d');
const PIXEL_BLOCK_SIZE = 16; 

function drawPixelateEffect(image, w, h) {
    const smallW = Math.max(1, Math.floor(w / PIXEL_BLOCK_SIZE));
    const smallH = Math.max(1, Math.floor(h / PIXEL_BLOCK_SIZE));

    pixelateCanvas.width = smallW;
    pixelateCanvas.height = smallH;

    
    
    pixelateCtx.imageSmoothingEnabled = false;
    pixelateCtx.drawImage(image, 0, 0, smallW, smallH);

    canvasCtx.imageSmoothingEnabled = false;
    canvasCtx.drawImage(pixelateCanvas, 0, 0, smallW, smallH, 0, 0, w, h);
    canvasCtx.imageSmoothingEnabled = true; 
}











const infraredCanvas = document.createElement('canvas');
const infraredCtx = infraredCanvas.getContext('2d');
const INFRARED_BLOCK_SIZE = 2; 



const THERMAL_COLOR_STOPS = [
    [0,   [8, 0, 40]],      
    [64,  [70, 0, 130]],    
    [128, [210, 0, 0]],     
    [180, [255, 120, 0]],   
    [220, [255, 255, 0]],   
    [255, [255, 255, 255]], 
];



function getThermalColor(luminance) {
    for (let i = 0; i < THERMAL_COLOR_STOPS.length - 1; i++) {
        const [lumA, colorA] = THERMAL_COLOR_STOPS[i];
        const [lumB, colorB] = THERMAL_COLOR_STOPS[i + 1];

        if (luminance >= lumA && luminance <= lumB) {
            const t = (luminance - lumA) / (lumB - lumA); 
            return [
                Math.round(colorA[0] + (colorB[0] - colorA[0]) * t),
                Math.round(colorA[1] + (colorB[1] - colorA[1]) * t),
                Math.round(colorA[2] + (colorB[2] - colorA[2]) * t),
            ];
        }
    }
    return THERMAL_COLOR_STOPS[THERMAL_COLOR_STOPS.length - 1][1]; 
}

function drawInfraredEffect(image, w, h) {
    const smallW = Math.max(1, Math.floor(w / INFRARED_BLOCK_SIZE));
    const smallH = Math.max(1, Math.floor(h / INFRARED_BLOCK_SIZE));

    infraredCanvas.width = smallW;
    infraredCanvas.height = smallH;
    infraredCtx.imageSmoothingEnabled = false;
    infraredCtx.drawImage(image, 0, 0, smallW, smallH);

    
    const imageData = infraredCtx.getImageData(0, 0, smallW, smallH);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        
        
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        const [tr, tg, tb] = getThermalColor(luminance);

        
        
        data[i] = tr;
        data[i + 1] = tg;
        data[i + 2] = tb;
    }

    
    infraredCtx.putImageData(imageData, 0, 0);

    
    canvasCtx.imageSmoothingEnabled = false;
    canvasCtx.drawImage(infraredCanvas, 0, 0, smallW, smallH, 0, 0, w, h);
    canvasCtx.imageSmoothingEnabled = true;
}





const GRID_SIZE = 24; 

function drawGridEffect(image, w, h) {
    canvasCtx.drawImage(image, 0, 0, w, h);

    canvasCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    canvasCtx.lineWidth = 1;
    canvasCtx.beginPath();

    for (let x = 0; x <= w; x += GRID_SIZE) {
        canvasCtx.moveTo(x, 0);
        canvasCtx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += GRID_SIZE) {
        canvasCtx.moveTo(0, y);
        canvasCtx.lineTo(w, y);
    }

    canvasCtx.stroke();
}







const asciiCanvas = document.createElement('canvas');
const asciiCtx = asciiCanvas.getContext('2d');
const ASCII_FONT_SIZE = 10; 
const ASCII_CELL_WIDTH = Math.round(ASCII_FONT_SIZE * 0.6); 


const ASCII_RAMP = ' .:-=+*#%@';

function drawAsciiEffect(image, w, h) {
    const cols = Math.max(1, Math.floor(w / ASCII_CELL_WIDTH));
    const rows = Math.max(1, Math.floor(h / ASCII_FONT_SIZE));

    
    
    
    asciiCanvas.width = cols;
    asciiCanvas.height = rows;
    asciiCtx.imageSmoothingEnabled = true;
    asciiCtx.drawImage(image, 0, 0, cols, rows);

    const imageData = asciiCtx.getImageData(0, 0, cols, rows);
    const data = imageData.data;

    
    canvasCtx.fillStyle = '#000000';
    canvasCtx.fillRect(0, 0, w, h);

    canvasCtx.font = `bold ${ASCII_FONT_SIZE}px monospace`;
    canvasCtx.textBaseline = 'top';

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const i = (row * cols + col) * 4; 
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

            
            const charIndex = Math.floor((luminance / 255) * (ASCII_RAMP.length - 1));
            const char = ASCII_RAMP[charIndex];

            if (char !== ' ') {
                canvasCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                canvasCtx.fillText(char, col * ASCII_CELL_WIDTH, row * ASCII_FONT_SIZE);
            }
        }
    }
}








const edgeCanvas = document.createElement('canvas');
const edgeCtx = edgeCanvas.getContext('2d');
const EDGE_WORK_SCALE = 0.5; 

function drawEdgeDetectionEffect(image, w, h) {
    const workW = Math.max(1, Math.floor(w * EDGE_WORK_SCALE));
    const workH = Math.max(1, Math.floor(h * EDGE_WORK_SCALE));

    edgeCanvas.width = workW;
    edgeCanvas.height = workH;
    edgeCtx.drawImage(image, 0, 0, workW, workH);

    const srcData = edgeCtx.getImageData(0, 0, workW, workH);
    const src = srcData.data;

    
    
    const gray = new Float32Array(workW * workH);
    for (let p = 0; p < workW * workH; p++) {
        const i = p * 4;
        gray[p] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    }

    const outData = edgeCtx.createImageData(workW, workH);
    const out = outData.data;

    
    const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    
    
    for (let y = 1; y < workH - 1; y++) {
        for (let x = 1; x < workW - 1; x++) {
            let gx = 0;
            let gy = 0;
            let k = 0;

            
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const sample = gray[(y + ky) * workW + (x + kx)];
                    gx += sample * kernelX[k];
                    gy += sample * kernelY[k];
                    k++;
                }
            }

            
            const magnitude = Math.min(255, Math.sqrt(gx * gx + gy * gy));

            const outIndex = (y * workW + x) * 4;
            
            
            out[outIndex] = 0;
            out[outIndex + 1] = magnitude;
            out[outIndex + 2] = magnitude;
            out[outIndex + 3] = 255;
        }
    }

    edgeCtx.putImageData(outData, 0, 0);

    canvasCtx.imageSmoothingEnabled = true; 
    canvasCtx.drawImage(edgeCanvas, 0, 0, workW, workH, 0, 0, w, h);
}






const halftoneCanvas = document.createElement('canvas');
const halftoneCtx = halftoneCanvas.getContext('2d');
const HALFTONE_CELL_SIZE = 12; 

function drawHalftoneEffect(image, w, h) {
    const cols = Math.max(1, Math.floor(w / HALFTONE_CELL_SIZE));
    const rows = Math.max(1, Math.floor(h / HALFTONE_CELL_SIZE));

    
    
    halftoneCanvas.width = cols;
    halftoneCanvas.height = rows;
    halftoneCtx.imageSmoothingEnabled = true;
    halftoneCtx.drawImage(image, 0, 0, cols, rows);

    const imageData = halftoneCtx.getImageData(0, 0, cols, rows);
    const data = imageData.data;

    canvasCtx.fillStyle = '#000000';
    canvasCtx.fillRect(0, 0, w, h);

    const maxRadius = HALFTONE_CELL_SIZE * 0.55; 

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const i = (row * cols + col) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

            
            
            
            const darkness = 1 - (luminance / 255);
            const radius = darkness * maxRadius;

            if (radius > 0.5) {
                const cx = col * HALFTONE_CELL_SIZE + HALFTONE_CELL_SIZE / 2;
                const cy = row * HALFTONE_CELL_SIZE + HALFTONE_CELL_SIZE / 2;

                canvasCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                canvasCtx.beginPath();
                canvasCtx.arc(cx, cy, radius, 0, Math.PI * 2);
                canvasCtx.fill();
            }
        }
    }
}









const ditherCanvas = document.createElement('canvas');
const ditherCtx = ditherCanvas.getContext('2d');
const DITHER_WORK_SCALE = 0.35; 


const GAMEBOY_PALETTE = [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
];

function drawDitherEffect(image, w, h) {
    const workW = Math.max(1, Math.floor(w * DITHER_WORK_SCALE));
    const workH = Math.max(1, Math.floor(h * DITHER_WORK_SCALE));

    ditherCanvas.width = workW;
    ditherCanvas.height = workH;
    ditherCtx.drawImage(image, 0, 0, workW, workH);

    const imageData = ditherCtx.getImageData(0, 0, workW, workH);
    const data = imageData.data;

    
    
    
    const gray = new Float32Array(workW * workH);
    for (let p = 0; p < workW * workH; p++) {
        const i = p * 4;
        gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    
    
    
    const levelMap = new Uint8Array(workW * workH);
    const paletteLevels = GAMEBOY_PALETTE.length;

    
    
    
    for (let y = 0; y < workH; y++) {
        for (let x = 0; x < workW; x++) {
            const idx = y * workW + x;
            const oldValue = Math.max(0, Math.min(255, gray[idx]));

            
            const levelIndex = Math.round((oldValue / 255) * (paletteLevels - 1));
            const newValue = (levelIndex / (paletteLevels - 1)) * 255;
            const quantError = oldValue - newValue; 

            levelMap[idx] = levelIndex;

            
            
            
            
            if (x + 1 < workW) {
                gray[idx + 1] += quantError * (7 / 16);
            }
            if (y + 1 < workH) {
                if (x - 1 >= 0) {
                    gray[idx - 1 + workW] += quantError * (3 / 16);
                }
                gray[idx + workW] += quantError * (5 / 16);
                if (x + 1 < workW) {
                    gray[idx + 1 + workW] += quantError * (1 / 16);
                }
            }
        }
    }

    
    const outData = ditherCtx.createImageData(workW, workH);
    const out = outData.data;
    for (let p = 0; p < workW * workH; p++) {
        const color = GAMEBOY_PALETTE[levelMap[p]];
        const i = p * 4;
        out[i] = color[0];
        out[i + 1] = color[1];
        out[i + 2] = color[2];
        out[i + 3] = 255;
    }

    ditherCtx.putImageData(outData, 0, 0);

    canvasCtx.imageSmoothingEnabled = false; 
    canvasCtx.drawImage(ditherCanvas, 0, 0, workW, workH, 0, 0, w, h);
    canvasCtx.imageSmoothingEnabled = true;
}







const glitchCanvas = document.createElement('canvas');
const glitchCtx = glitchCanvas.getContext('2d');
const GLITCH_WORK_SCALE = 0.5;
const GLITCH_RGB_SHIFT = 4; 

function drawGlitchEffect(image, w, h) {
    const workW = Math.max(1, Math.floor(w * GLITCH_WORK_SCALE));
    const workH = Math.max(1, Math.floor(h * GLITCH_WORK_SCALE));

    glitchCanvas.width = workW;
    glitchCanvas.height = workH;
    glitchCtx.drawImage(image, 0, 0, workW, workH);

    const srcData = glitchCtx.getImageData(0, 0, workW, workH);
    const src = srcData.data;
    const outData = glitchCtx.createImageData(workW, workH);
    const out = outData.data;

    
    
    
    for (let y = 0; y < workH; y++) {
        for (let x = 0; x < workW; x++) {
            const destIndex = (y * workW + x) * 4;

            const rSrcX = Math.max(0, Math.min(workW - 1, x - GLITCH_RGB_SHIFT));
            const bSrcX = Math.max(0, Math.min(workW - 1, x + GLITCH_RGB_SHIFT));

            const rIndex = (y * workW + rSrcX) * 4;
            const gIndex = (y * workW + x) * 4;
            const bIndex = (y * workW + bSrcX) * 4;

            out[destIndex] = src[rIndex];         
            out[destIndex + 1] = src[gIndex + 1]; 
            out[destIndex + 2] = src[bIndex + 2]; 
            out[destIndex + 3] = 255;
        }
    }

    glitchCtx.putImageData(outData, 0, 0);

    
    const bandCount = 3 + Math.floor(Math.random() * 4); 
    for (let b = 0; b < bandCount; b++) {
        const bandHeight = 1 + Math.floor(Math.random() * 6);
        const bandY = Math.floor(Math.random() * (workH - bandHeight));
        const shiftAmount = Math.floor((Math.random() - 0.5) * workW * 0.3);

        
        glitchCtx.drawImage(
            glitchCanvas,
            0, bandY, workW, bandHeight,       
            shiftAmount, bandY, workW, bandHeight 
        );
    }

    
    const scanlineCount = 2 + Math.floor(Math.random() * 3);
    glitchCtx.fillStyle = '#000000';
    for (let s = 0; s < scanlineCount; s++) {
        const lineY = Math.floor(Math.random() * workH);
        glitchCtx.fillRect(0, lineY, workW, 1);
    }

    canvasCtx.imageSmoothingEnabled = false;
    canvasCtx.drawImage(glitchCanvas, 0, 0, workW, workH, 0, 0, w, h);
    canvasCtx.imageSmoothingEnabled = true;
}




function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {

        const hand1 = results.multiHandLandmarks[0];
        const hand2 = results.multiHandLandmarks[1];
        const w = canvasElement.width;
        const h = canvasElement.height;

        const p1 = { x: hand1[8].x * w, y: hand1[8].y * h };
        const p2 = { x: hand1[4].x * w, y: hand1[4].y * h };
        const p3 = { x: hand2[4].x * w, y: hand2[4].y * h };
        const p4 = { x: hand2[8].x * w, y: hand2[8].y * h };

        
        handleAutoChangeGesture(p1, p2, p3, p4);

        
        canvasCtx.beginPath();
        canvasCtx.moveTo(p1.x, p1.y);
        canvasCtx.lineTo(p2.x, p2.y);
        canvasCtx.lineTo(p3.x, p3.y);
        canvasCtx.lineTo(p4.x, p4.y);
        canvasCtx.closePath();

        const activeEffect = FILTER_EFFECTS[currentEffectIndex];

        if (activeEffect.type !== 'none') {
            
            
            canvasCtx.clip();

            
            switch (activeEffect.type) {
                case 'css':
                    canvasCtx.filter = activeEffect.value;
                    canvasCtx.drawImage(results.image, 0, 0, w, h);
                    canvasCtx.filter = 'none'; 
                    break;

                case 'pixelate':
                    drawPixelateEffect(results.image, w, h);
                    break;

                case 'infrared':
                    drawInfraredEffect(results.image, w, h);
                    break;

                case 'grid':
                    drawGridEffect(results.image, w, h);
                    break;

                case 'ascii':
                    drawAsciiEffect(results.image, w, h);
                    break;

                case 'edge':
                    drawEdgeDetectionEffect(results.image, w, h);
                    break;

                case 'halftone':
                    drawHalftoneEffect(results.image, w, h);
                    break;

                case 'dither':
                    drawDitherEffect(results.image, w, h);
                    break;

                case 'glitch':
                    drawGlitchEffect(results.image, w, h);
                    break;
            }
        }

        
        canvasCtx.lineWidth = 4;
        canvasCtx.strokeStyle = 'cyan';
        canvasCtx.stroke();
    } else {
        
        
        fingerState = 'apart';
    }

    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});
camera.start();