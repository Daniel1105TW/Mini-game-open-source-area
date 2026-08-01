/**
 * App — Screen Manager, Touch Input, ESC Pause, Home Page, Full OSU! UI
 */

// ==============================
// Screen Manager
// ==============================
const Screens = {
  home: document.getElementById('screen-home'),
  game: document.getElementById('screen-game'),
};

function showScreen(name) {
  Object.values(Screens).forEach(s => s.classList.remove('active'));
  Screens[name]?.classList.add('active');
}

// ==============================
// DOM References
// ==============================
const midiFileInput    = document.getElementById('midi-file-input');
const btnHomeStart     = document.getElementById('btn-home-start');
const btnHomeUpload    = document.getElementById('btn-home-upload');
const btnHomePreset    = document.getElementById('btn-home-preset');
const btnHomeTutorial  = document.getElementById('btn-home-tutorial');
const btnPauseTutorial = document.getElementById('btn-pause-tutorial');
const btnAutoPlay      = document.getElementById('btn-auto-play');
const btnPause         = document.getElementById('btn-pause');

const presetModal      = document.getElementById('preset-modal');
const pauseModal       = document.getElementById('pause-modal');
const resultModal      = document.getElementById('result-modal');
const tutorialModal    = document.getElementById('tutorial-modal');

const btnClosePreset   = document.getElementById('btn-close-preset');
const btnCloseTutorial = document.getElementById('btn-close-tutorial');
const btnStartPractice = document.getElementById('btn-start-tutorial-practice');
const btnResume        = document.getElementById('btn-resume');
const btnRestartPause  = document.getElementById('btn-restart-pause');
const btnBackHome      = document.getElementById('btn-back-home');
const btnRestartResult = document.getElementById('btn-restart-result');
const btnHomeResult    = document.getElementById('btn-home-result');

const songTitleEl      = document.getElementById('song-title');
const songMetaEl       = document.getElementById('song-meta');
const scoreValEl       = document.getElementById('score-val');
const accValEl         = document.getElementById('acc-val');
const timeValEl        = document.getElementById('time-val');
const progressFillEl   = document.getElementById('progress-fill');
const healthFillEl     = document.getElementById('health-bar-fill');
const comboContainer   = document.getElementById('combo-container');
const comboNumEl       = document.getElementById('combo-num');
const hitFeedbackEl    = document.getElementById('hit-feedback');
const hitOffsetTagEl   = document.getElementById('hit-offset-tag');
const keyHintsEl       = document.getElementById('key-hints-container');
const touchLaneEl      = document.getElementById('touch-lane-container');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownText    = document.getElementById('countdown-text');
const statusBadgeEl    = document.getElementById('status-badge');
const loadingOverlay   = document.getElementById('loading-overlay');
const loadingTitleEl   = document.getElementById('loading-title');
const loadingSubtitleEl = document.getElementById('loading-subtitle');

const speedRange       = document.getElementById('speed-range');
const speedValEl       = document.getElementById('speed-val');
const offsetRange      = document.getElementById('offset-range');
const offsetValEl      = document.getElementById('offset-val');
const laneSelect       = document.getElementById('lane-select');
const diffSelect       = document.getElementById('diff-select');
const hitsoundSelect   = document.getElementById('hitsound-select');
const noteModeSelect   = document.getElementById('note-mode-select');

const resultRankEl     = document.getElementById('result-rank');
const resultScoreEl    = document.getElementById('result-score');
const resultAccEl      = document.getElementById('result-acc');
const resultMaxComboEl = document.getElementById('result-max-combo');
const result300El      = document.getElementById('result-300');
const result100El      = document.getElementById('result-100');
const result50El       = document.getElementById('result-50');
const resultMissEl     = document.getElementById('result-miss');

// ==============================
// State
// ==============================
let currentSongName  = 'Canon in D (Preset)';
let currentLaneCount = 4;
let currentDiff      = 'normal';
let lastMidiBuffer   = null;

// ==============================
// Home Background Canvas Animation
// ==============================
(function startHomeBG() {
  const canvas = document.getElementById('home-bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height, dots = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function createDots() {
    dots = [];
    const n = Math.floor((width * height) / 12000);
    const cols = ['#00f5d4','#f72585','#3a86ff','#ffee32','#9d4edd'];
    for (let i = 0; i < n; i++) {
      dots.push({
        x: Math.random() * width, y: Math.random() * height,
        r: Math.random() * 2.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        color: cols[Math.floor(Math.random() * cols.length)],
        alpha: Math.random() * 0.7 + 0.15
      });
    }
  }

  let raf;
  function animate() {
    raf = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, width, height);

    // Dark gradient base
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#06050f');
    bg.addColorStop(0.5, '#0a0818');
    bg.addColorStop(1, '#06050f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = width; if (d.x > width) d.x = 0;
      if (d.y < 0) d.y = height; if (d.y > height) d.y = 0;

      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  window.addEventListener('resize', () => { resize(); createDots(); });
  resize(); createDots(); animate();
})();

// ==============================
// Init Renderer & Preload Song
// ==============================
(function init() {
  const canvas = document.getElementById('game-canvas');
  if (canvas && window.Renderer) {
    try { window.renderer = new Renderer(canvas); } catch(e) { console.error(e); }
  }

  window.gameEngine.settings.scrollSpeed = 1.8;
  setStatus('內建曲目可直接開始', 'info');
  renderPresetListUI();
  loadPresetSong('presets/canon.mid', '卡農 (Canon in D Major)');
  buildKeyHints();
  buildTouchLanes();
})();

// ==============================
// Helpers
// ==============================
function ensureAudio() {
  try { window.audioEngine.init(); window.audioEngine.resume(); } catch(e) {}
}

function setStatus(message, tone = 'info') {
  if (!statusBadgeEl) return;
  statusBadgeEl.innerText = message;
  statusBadgeEl.dataset.tone = tone;
}

function showLoading(title, subtitle = '正在處理…') {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add('active');
  if (loadingTitleEl) loadingTitleEl.innerText = title;
  if (loadingSubtitleEl) loadingSubtitleEl.innerText = subtitle;
}

function hideLoading() {
  loadingOverlay?.classList.remove('active');
}

function buildKeyHints() {
  if (!keyHintsEl) return;
  keyHintsEl.innerHTML = '';
  const keys = window.gameEngine.laneKeys[currentLaneCount] || ['d','f','j','k'];
  keys.forEach((k, i) => {
    const el = document.createElement('div');
    el.className = 'key-hint';
    el.innerText = k.toUpperCase();
    el.dataset.key = k;
    el.style.borderColor = `rgba(130,90,255,0.3)`;
    keyHintsEl.appendChild(el);
  });
}

function buildTouchLanes() {
  if (!touchLaneEl) return;
  touchLaneEl.innerHTML = '';
  const keys = window.gameEngine.laneKeys[currentLaneCount] || ['d','f','j','k'];
  const colors = ['#00f5d4','#3a86ff','#f72585','#ffee32','#7b2cbf','#ff9e00'];

  keys.forEach((k, i) => {
    const btn = document.createElement('div');
    btn.className = 'touch-lane-btn';
    btn.innerText = k.toUpperCase();
    btn.style.borderColor = colors[i % colors.length] + '50';
    btn.style.color = colors[i % colors.length];

    const laneIdx = i;

    // Touch events (multi-touch safe)
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      ensureAudio();
      btn.classList.add('pressed');
      btn.style.background = colors[laneIdx % colors.length] + '40';
      btn.style.boxShadow = `0 0 20px ${colors[laneIdx % colors.length]}`;
      window.gameEngine.handleLanePress(laneIdx);
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      btn.style.background = '';
      btn.style.boxShadow = '';
      window.gameEngine.handleLaneRelease(laneIdx);
    }, { passive: false });

    btn.addEventListener('touchcancel', (e) => {
      btn.classList.remove('pressed');
      btn.style.background = '';
      btn.style.boxShadow = '';
      window.gameEngine.handleLaneRelease(laneIdx);
    }, { passive: false });

    // Mouse fallback for desktop testing
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      ensureAudio();
      btn.classList.add('pressed');
      window.gameEngine.handleLanePress(laneIdx);
    });

    btn.addEventListener('mouseup', () => {
      btn.classList.remove('pressed');
      window.gameEngine.handleLaneRelease(laneIdx);
    });

    btn.addEventListener('mouseleave', () => {
      if (btn.classList.contains('pressed')) {
        btn.classList.remove('pressed');
        window.gameEngine.handleLaneRelease(laneIdx);
      }
    });

    touchLaneEl.appendChild(btn);
  });
}

let selectedPresetUrl = 'presets/canon.mid';

async function loadPresetSong(presetUrl = selectedPresetUrl, name = '卡農 (Canon in D Major)') {
  try {
    showLoading('載入內建曲目', `正在載入 ${name}…`);
    const res = await fetch(presetUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    lastMidiBuffer = buffer;
    currentSongName = name;

    const chart = await window.midiParser.parseMidiBuffer(buffer, currentLaneCount, currentDiff);
    window.gameEngine.loadChart(chart, currentLaneCount);

    if (songTitleEl) songTitleEl.innerText = currentSongName;
    if (songMetaEl) songMetaEl.innerText = `Preset · ${currentLaneCount} Lanes · ${chart.totalNotes} Notes`;
    setStatus(`已載入內建曲目：${currentSongName}`, 'success');
  } catch (e) {
    console.warn('Failed to fetch real preset midi, fallbacking:', e);
    const chart = window.midiParser.getPresetChart('canon', currentLaneCount);
    window.gameEngine.loadChart(chart, currentLaneCount);
    if (songTitleEl) songTitleEl.innerText = name;
  } finally {
    hideLoading();
  }
}

async function renderPresetListUI() {
  const container = document.querySelector('.preset-list');
  if (!container) return;

  try {
    const res = await fetch('/api/presets');
    if (!res.ok) return;
    const presets = await res.json();
    if (!Array.isArray(presets) || !presets.length) return;

    container.innerHTML = '';
    presets.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = `preset-item ${idx === 0 ? 'selected' : ''}`;
      item.dataset.url = p.url;
      item.dataset.name = p.name;
      item.innerHTML = `
        <div>
          <div class="preset-name">${p.name}</div>
          <div class="preset-info">presets/ 資料夾 · ${p.id}</div>
        </div>
        <span class="diff-badge normal">MIDI</span>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.preset-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedPresetUrl = p.url;
        loadPresetSong(p.url, p.name);
      });

      container.appendChild(item);
    });
  } catch (e) {
    console.error('renderPresetListUI error:', e);
  }
}

async function reloadWithBuffer() {
  if (!lastMidiBuffer) { loadPresetSong('canon'); return; }
  try {
    const chart = await window.midiParser.parseMidiBuffer(lastMidiBuffer, currentLaneCount, currentDiff);
    window.gameEngine.loadChart(chart, currentLaneCount);
    if (songMetaEl) songMetaEl.innerText = `Custom · ${currentLaneCount} Lanes · ${chart.totalNotes} Notes`;
    setStatus('已套用自訂 MIDI 譜面', 'success');
  } catch(e) { console.error('reloadWithBuffer:', e); setStatus('自訂 MIDI 譜面載入失敗', 'error'); }
}

function goHome() {
  if (window.gameEngine.state === 'PLAYING') window.gameEngine.pause();
  [presetModal, pauseModal, resultModal, tutorialModal].forEach(m => m?.classList.remove('active'));
  showScreen('home');
}

// ==============================
// HOME SCREEN BUTTONS
// ==============================
btnHomeStart.addEventListener('click', () => {
  ensureAudio();
  showScreen('game');
  startGameWithCountdown();
});

btnHomeUpload.addEventListener('click', () => {
  ensureAudio();
  midiFileInput.value = '';
  midiFileInput.click();
});

btnHomePreset.addEventListener('click', () => {
  renderPresetListUI();
  presetModal.classList.add('active');
});

btnHomeTutorial.addEventListener('click', () => {
  tutorialModal.classList.add('active');
});

btnPauseTutorial?.addEventListener('click', () => {
  pauseModal.classList.remove('active');
  tutorialModal.classList.add('active');
});

btnCloseTutorial?.addEventListener('click', () => {
  tutorialModal.classList.remove('active');
});

// Tutorial Tabs Switching
document.querySelectorAll('.t-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const slideIdx = tab.dataset.tab;
    document.querySelectorAll('.t-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tutorial-slide').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`.tutorial-slide[data-slide="${slideIdx}"]`)?.classList.add('active');
  });
});

// Start Tutorial Practice
btnStartPractice?.addEventListener('click', () => {
  ensureAudio();
  tutorialModal.classList.remove('active');
  pauseModal.classList.remove('active');
  currentSongName = '🎓 互動新手教學 (Tutorial)';
  const chart = window.midiParser.getTutorialChart(currentLaneCount);
  window.gameEngine.loadChart(chart, currentLaneCount);
  if (songTitleEl) songTitleEl.innerText = currentSongName;
  if (songMetaEl) songMetaEl.innerText = `Tutorial · ${currentLaneCount} Lanes · ${chart.totalNotes} Notes`;
  setStatus('開始新手練習關卡', 'success');
  showScreen('game');
  startGameWithCountdown();
});

midiFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      showLoading('解析 MIDI', '正在分析旋律與節奏…');
      setStatus('正在解析 MIDI…', 'loading');
      lastMidiBuffer = ev.target.result;
      const chart = await window.midiParser.parseMidiBuffer(lastMidiBuffer, currentLaneCount, currentDiff);

      if (!chart?.notes?.length) {
        alert('MIDI 解析完成，但未找到有效音符！請嘗試其他 MIDI 檔案。');
        return;
      }

      currentSongName = file.name.replace(/\.[^/.]+$/, '');
      window.gameEngine.loadChart(chart, currentLaneCount);

      if (songTitleEl) songTitleEl.innerText = currentSongName;
      setStatus(`已載入 ${currentSongName}`, 'success');
      hideLoading();
      if (songMetaEl) songMetaEl.innerText = `Custom MIDI · ${currentLaneCount} Lanes · ${chart.totalNotes} Notes`;
      buildKeyHints();
      buildTouchLanes();

      const go = confirm(`🎉 「${currentSongName}」 匯入成功！\n已生成 ${chart.totalNotes} 個擊打音符，全曲完整音樂保留。\n\n點擊確定前往遊戲！`);
      if (go) {
        ensureAudio();
        showScreen('game');
        startGameWithCountdown();
      }
    } catch(err) {
      const errorMessage = err?.message ? `\n${err.message}` : '';
      setStatus('MIDI 匯入失敗', 'error');
      hideLoading();
      alert(`MIDI 解析失敗，請確認為標準 .mid / .midi 格式。${errorMessage}`);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
});

// ==============================
// PRESET MODAL
// ==============================
document.querySelectorAll('.preset-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.preset-item').forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    lastMidiBuffer = null;
    loadPresetSong(item.dataset.preset);
    buildKeyHints();
    buildTouchLanes();
    presetModal.classList.remove('active');
  });
});

btnClosePreset.addEventListener('click', () => presetModal.classList.remove('active'));

// ==============================
// PAUSE / RESUME (Header Btn + ESC)
// ==============================
btnPause.addEventListener('click', () => {
  ensureAudio();
  if (window.gameEngine.state === 'PLAYING') {
    window.gameEngine.pause();
    pauseModal.classList.add('active');
  }
});

btnResume.addEventListener('click', () => {
  pauseModal.classList.remove('active');
  window.gameEngine.resume();
});

btnRestartPause.addEventListener('click', () => {
  ensureAudio();
  pauseModal.classList.remove('active');
  window.gameEngine.resetStats();
  startGameWithCountdown();
});

btnBackHome.addEventListener('click', () => goHome());

// ==============================
// RESULT MODAL
// ==============================
btnRestartResult.addEventListener('click', () => {
  ensureAudio();
  resultModal.classList.remove('active');
  startGameWithCountdown();
});

btnHomeResult.addEventListener('click', () => goHome());

// ==============================
// AUTO PLAY BUTTON
// ==============================
btnAutoPlay.addEventListener('click', () => {
  ensureAudio();
  window.gameEngine.isAutoPlay = !window.gameEngine.isAutoPlay;
  if (window.gameEngine.isAutoPlay) {
    btnAutoPlay.classList.add('active');
    btnAutoPlay.innerText = '🤖 Auto ON';
  } else {
    btnAutoPlay.classList.remove('active');
    btnAutoPlay.innerText = '🤖 Auto';
  }
});

// ==============================
// SETTINGS (inside Pause Modal)
// ==============================
speedRange.addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  speedValEl.innerText = v.toFixed(1) + 'x';
  window.gameEngine.settings.scrollSpeed = v;
});

offsetRange.addEventListener('input', (e) => {
  const v = parseInt(e.target.value);
  offsetValEl.innerText = v + ' ms';
  window.gameEngine.settings.audioOffset = v;
});

// Volume sliders
const bgmVolumeRange = document.getElementById('bgm-volume-range');
const bgmVolumeVal = document.getElementById('bgm-volume-val');
const sfxVolumeRange = document.getElementById('sfx-volume-range');
const sfxVolumeVal = document.getElementById('sfx-volume-val');

bgmVolumeRange.addEventListener('input', (e) => {
  const v = parseInt(e.target.value);
  bgmVolumeVal.innerText = `${v}%`;
  if (window.audioEngine) window.audioEngine.bgmVolume = v / 100;
});

sfxVolumeRange.addEventListener('input', (e) => {
  const v = parseInt(e.target.value);
  sfxVolumeVal.innerText = `${v}%`;
  if (window.audioEngine) window.audioEngine.sfxVolume = v / 100;
});

laneSelect.addEventListener('change', async (e) => {
  currentLaneCount = parseInt(e.target.value);
  window.gameEngine.settings.laneCount = currentLaneCount;
  await reloadWithBuffer();
  buildKeyHints();
  buildTouchLanes();
});

diffSelect.addEventListener('change', async (e) => {
  currentDiff = e.target.value;
  window.midiParser.setDifficulty(currentDiff);
  await reloadWithBuffer();
});

hitsoundSelect.addEventListener('change', (e) => {
  if (window.audioEngine) window.audioEngine.hitSoundStyle = e.target.value;
});

noteModeSelect.addEventListener('change', (e) => {
  window.gameEngine.settings.noteMode = e.target.value;
});

// ==============================
// KEYBOARD EVENTS
// ==============================
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  ensureAudio();

  // ESC = toggle pause
  if (e.key === 'Escape') {
    if (window.gameEngine.state === 'PLAYING') {
      window.gameEngine.pause();
      pauseModal.classList.add('active');
    } else if (window.gameEngine.state === 'PAUSED') {
      pauseModal.classList.remove('active');
      window.gameEngine.resume();
    }
    return;
  }

  window.gameEngine.handleKeyDown(e.key);

  const keyBtn = keyHintsEl.querySelector(`[data-key="${e.key.toLowerCase()}"]`);
  if (keyBtn) keyBtn.classList.add('pressed');
});

window.addEventListener('keyup', (e) => {
  window.gameEngine.handleKeyUp(e.key);

  const keyBtn = keyHintsEl.querySelector(`[data-key="${e.key.toLowerCase()}"]`);
  if (keyBtn) keyBtn.classList.remove('pressed');
});

// ==============================
// ENGINE CALLBACKS
// ==============================
window.gameEngine.onHitFeedback = (quality, combo, offsetMs) => {
  if (hitFeedbackEl) {
    hitFeedbackEl.innerText = quality;
    hitFeedbackEl.className = `hit-feedback val-${quality} animate`;
    void hitFeedbackEl.offsetWidth;
  }

  if (hitOffsetTagEl) {
    if (quality === 'miss') {
      hitOffsetTagEl.innerText = 'MISS';
      hitOffsetTagEl.style.color = 'var(--pink)';
    } else {
      const sign = offsetMs > 0 ? '+' : '';
      hitOffsetTagEl.innerText = `${sign}${offsetMs} ms (${offsetMs > 0 ? 'Late' : 'Early'})`;
      hitOffsetTagEl.style.color = Math.abs(offsetMs) <= 45 ? 'var(--cyan)' : 'var(--yellow)';
    }
    hitOffsetTagEl.classList.add('active');
    clearTimeout(hitOffsetTagEl._timer);
    hitOffsetTagEl._timer = setTimeout(() => hitOffsetTagEl.classList.remove('active'), 600);
  }

  if (comboContainer && comboNumEl) {
    if (combo > 1) {
      comboContainer.classList.add('active');
      comboNumEl.innerText = combo;
    } else {
      comboContainer.classList.remove('active');
    }
  }
};

window.gameEngine.onScoreUpdate = (score, accStr, health) => {
  if (scoreValEl) scoreValEl.innerText = score.toLocaleString().padStart(7, '0');
  if (accValEl) accValEl.innerText = accStr;
  if (healthFillEl) healthFillEl.style.width = `${health}%`;
};

window.gameEngine.onStateChange = (state) => {
  if (state === 'FINISHED') {
    countdownOverlay?.classList.remove('active');
    if (resultRankEl) resultRankEl.innerText = window.gameEngine.calculateRank();
    if (resultScoreEl) resultScoreEl.innerText = window.gameEngine.score.toLocaleString();
    if (resultAccEl) resultAccEl.innerText = window.gameEngine.getAccuracy();
    if (resultMaxComboEl) resultMaxComboEl.innerText = window.gameEngine.maxCombo;
    if (result300El) result300El.innerText = window.gameEngine.stats.count300;
    if (result100El) result100El.innerText = window.gameEngine.stats.count100;
    if (result50El) result50El.innerText = window.gameEngine.stats.count50;
    if (resultMissEl) resultMissEl.innerText = window.gameEngine.stats.miss;
    setTimeout(() => resultModal.classList.add('active'), 400);
  }
};

window.gameEngine.onTimeUpdate = (currentTime, duration) => {
  if (timeValEl) {
    const format = (sec) => {
      const safe = Math.max(0, sec);
      const m = Math.floor(safe / 60).toString().padStart(2, '0');
      const s = Math.floor(safe % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };
    timeValEl.innerText = `${format(currentTime)} / ${format(duration)}`;
  }
  if (progressFillEl) {
    const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    progressFillEl.style.width = `${progress * 100}%`;
  }
};

function startGameWithCountdown() {
  if (!countdownOverlay || !countdownText) {
    window.gameEngine.start();
    if (btnPause) btnPause.innerText = '⏸ 暫停';
    return;
  }

  countdownOverlay.classList.add('active');
  let tick = 3;
  countdownText.innerText = String(tick);
  const interval = setInterval(() => {
    tick -= 1;
    if (tick <= 0) {
      clearInterval(interval);
      countdownOverlay.classList.remove('active');
      window.gameEngine.start();
      if (btnPause) btnPause.innerText = '⏸ 暫停';
      return;
    }
    countdownText.innerText = String(tick);
  }, 800);
}
