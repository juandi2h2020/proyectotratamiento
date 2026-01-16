const fileInput = document.getElementById("audioFile");
const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d");
const durationSlider = document.getElementById("durationSlider");
const durationLabel = document.getElementById("durationLabel");
const exportBtn = document.getElementById("exportBtn");
const playBtn = document.getElementById("playBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");

const tempoSpan = document.getElementById("tempo");
const keysList = document.getElementById("keys");

const audioContext = new AudioContext();

let buffer;
let selectionStart = 0;
let currentSource = null;
let isPlaying = false;
let playStartTime = 0;
let pauseOffset = 0;
let zoomFactor = 1;

// ancho y alto inicial del canvas
canvas.width = 1500;
canvas.height = 120;

// --------------------
// EVENTOS
// --------------------
fileInput.addEventListener("change", loadAudio);
durationSlider.addEventListener("input", updateDuration);
canvas.addEventListener("click", moveSelection);
exportBtn.addEventListener("click", exportSample);
playBtn.addEventListener("click", togglePlay);
zoomInBtn.addEventListener("click", () => adjustZoom(1.5));
zoomOutBtn.addEventListener("click", () => adjustZoom(0.2));

// --------------------
// CARGAR AUDIO
// --------------------
function loadAudio() {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        audioContext.decodeAudioData(e.target.result).then(b => {
            buffer = b;
            zoomFactor = 1;
            selectionStart = 0;
            updateCanvasWidth();
            drawWaveform();
            analyzeMusic();
        });
    };
    reader.readAsArrayBuffer(file);
}

// --------------------
// ACTUALIZAR CANVAS WIDTH
// --------------------
function updateCanvasWidth() {
    if (!buffer) return;
    canvas.width = Math.min(Math.max(buffer.duration * 500 * zoomFactor, 800), 5000);
}

// --------------------
// AJUSTAR ZOOM
// --------------------
function adjustZoom(factor) {
    zoomFactor *= factor;
    zoomFactor = Math.min(Math.max(0.1, zoomFactor), 50);
    updateCanvasWidth();
    drawWaveform();
}

// --------------------
// ACTUALIZAR DURACIÓN
// --------------------
function updateDuration() {
    durationLabel.textContent = durationSlider.value + "s";
    drawWaveform();
}

// --------------------
// MOVER SELECCIÓN DONDE CLIC
// --------------------
function moveSelection(e) {
    if (!buffer) return;

    const container = canvas.parentElement;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;

    const clickedTime = (x / canvas.width) * buffer.duration;

    selectionStart = clickedTime;
    const dur = parseFloat(durationSlider.value);
    if (selectionStart + dur > buffer.duration) selectionStart = buffer.duration - dur;
    if (selectionStart < 0) selectionStart = 0;

    drawWaveform();
}

// --------------------
// DIBUJAR WAVEFORM + SELECCIÓN
// --------------------
function drawWaveform() {
    if (!buffer) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / canvas.width));

    const mid = canvas.height / 2;
    ctx.beginPath();
    ctx.strokeStyle = "#333";
    ctx.moveTo(0, mid);

    for (let i = 0; i < canvas.width; i++) {
        const sampleIndex = Math.min(i * step, data.length - 1);
        const val = data[sampleIndex] * (canvas.height / 2 - 5);
        ctx.lineTo(i, mid + val);
    }
    ctx.stroke();

    // SELECCIÓN ROJA
    const dur = parseFloat(durationSlider.value);
    const startX = (selectionStart / buffer.duration) * canvas.width;
    const widthX = (dur / buffer.duration) * canvas.width;

    ctx.fillStyle = "rgba(255, 0, 100, 0.35)";
    ctx.fillRect(startX, 0, widthX, canvas.height);
}

// --------------------
// REPRODUCIR / PAUSAR SELECCIÓN
// --------------------
function togglePlay() {
    if (!buffer) return;

    if (isPlaying) {
        currentSource.stop();
        pauseOffset += audioContext.currentTime - playStartTime;
        isPlaying = false;
        playBtn.textContent = "▶ Reproducir";
    } else {
        const dur = parseFloat(durationSlider.value);

        currentSource = audioContext.createBufferSource();
        currentSource.buffer = buffer;
        currentSource.connect(audioContext.destination);

        playStartTime = audioContext.currentTime;
        currentSource.start(0, selectionStart + pauseOffset, dur - pauseOffset);
        isPlaying = true;
        playBtn.textContent = "⏸ Pausar";

        currentSource.onended = () => {
            isPlaying = false;
            pauseOffset = 0;
            playBtn.textContent = "▶ Reproducir";
        };
    }
}

// --------------------
// EXPORTAR SELECCIÓN
// --------------------
function exportSample() {
    if (!buffer) return;

    const dur = parseFloat(durationSlider.value);
    const startSample = Math.floor(selectionStart * buffer.sampleRate);
    const length = Math.floor(dur * buffer.sampleRate);

    const newBuffer = audioContext.createBuffer(
        buffer.numberOfChannels,
        length,
        buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const slice = buffer.getChannelData(ch).slice(startSample, startSample + length);
        newBuffer.copyToChannel(slice, ch);
    }

    const wav = bufferToWav(newBuffer);
    const blob = new Blob([wav], { type: "audio/wav" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sample.wav";
    a.click();
}

// --------------------
// ANALIZAR TEMPO + TONALIDAD (simulado)
// --------------------
function analyzeMusic() {
    if (!buffer) return;
    // Valor de ejemplo coherente
    tempoSpan.textContent = "120 BPM";

    const tonalidades = [
        { key: "Mi menor", p: 42 },
        { key: "Sol mayor", p: 34 },
        { key: "Re mayor", p: 24 }
    ];

    keysList.innerHTML = "";
    tonalidades.forEach(t => {
        const li = document.createElement("li");
        li.textContent = `${t.key} — ${t.p}%`;
        keysList.appendChild(li);
    });
}

// --------------------
// CONVERTIR BUFFER A WAV
// --------------------
function bufferToWav(buffer) {
    const length = buffer.length * 2 + 44;
    const view = new DataView(new ArrayBuffer(length));
    let offset = 0;

    const write = s => { for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i)); };

    write("RIFF");
    view.setUint32(offset, length - 8, true); offset += 4;
    write("WAVEfmt ");
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint32(offset, buffer.sampleRate, true); offset += 4;
    view.setUint32(offset, buffer.sampleRate * 2, true); offset += 4;
    view.setUint16(offset, 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    write("data");
    view.setUint32(offset, length - offset - 4, true); offset += 4;

    const data = buffer.getChannelData(0);
    data.forEach(s => {
        view.setInt16(offset, Math.max(-1, Math.min(1, s)) * 0x7fff, true);
        offset += 2;
    });

    return view.buffer;
}
