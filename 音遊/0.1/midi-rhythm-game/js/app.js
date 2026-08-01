/**
 * App - Main UI Coordinator with Full MIDI BGM & OSU! Auto Play Support
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const gameCanvas = document.getElementById('game-canvas');
  const midiFileInput = document.getElementById('midi-file-input');
  const btnUpload = document.getElementById('btn-upload');
  const btnSelectPreset = document.getElementById('btn-select-preset');
  const btnSettings = document.getElementById('btn-settings');
  const btnStart = document.getElementById('btn-start');
  const btnAutoPlay = document.getElementById('btn-auto-play');
  const btnRestart = document.getElementById('btn-restart');
  const btnCloseResult = document.getElementById('btn-close-result');

  const btnClosePreset = document.getElementById('btn-close-preset');
  const btnCloseSettings = document.getElementById('btn-close-settings');

  // Modals
  const presetModal = document.getElementById('preset-modal');
  const settingsModal = document.getElementById('settings-modal');
  const resultModal = document.getElementById('result-modal');

  // HUD Elements
  const songTitleEl = document.getElementById('song-title');
  const songMetaEl = document.getElementById('song-meta');
  const scoreValEl = document.getElementById('score-val');
  const accValEl = document.getElementById('acc-val');
  const healthFillEl = document.getElementById('health-bar-fill');
  const comboContainer = document.getElementById('combo-container');
  const comboNumEl = document.getElementById('combo-num');
  const hitFeedbackEl = document.getElementById('hit-feedback');
  const hitOffsetTagEl = document.getElementById('hit-offset-tag');
  const keyHintsContainer = document.getElementById('key-hints-container');

  // Settings Controls
  const speedRange = document.getElementById('speed-range');
  const speedVal = document.getElementById('speed-val');
  const offsetRange = document.getElementById('offset-range');
  const offsetVal = document.getElementById('offset-val');
  const laneSelect = document.getElementById('lane-select');
  const diffSelect = document.getElementById('diff-select');
  const hitsoundSelect = document.getElementById('hitsound-select');

  // Result Elements
  const resultRankEl = document.getElementById('result-rank');
  const resultScoreEl = document.getElementById('result-score');
  const resultAccEl = document.getElementById('result-acc');
  const resultMaxComboEl = document.getElementById('result-max-combo');
  const result300El = document.getElementById('result-300');
  const result100El = document.getElementById('result-100');
  const result50El = document.getElementById('result-50');
  const resultMissEl = document.getElementById('result-miss');

  // Initialize Canvas Renderer
  try {
    if (gameCanvas && window.Renderer) {
      window.renderer = new Renderer(gameCanvas);
    }
  } catch (err) {
    console.error('Renderer init error:', err);
  }

  let currentSongName = 'Canon in D (Preset)';
  let currentLaneCount = 4;
  let currentDifficulty = 'normal';
  let lastMidiBuffer = null;

  if (window.gameEngine) {
    window.gameEngine.settings.scrollSpeed = 1.8;
  }

  function ensureAudioUnlocked() {
    if (window.audioEngine) {
      try {
        window.audioEngine.init();
        window.audioEngine.resume();
      } catch(e){}
    }
  }

  // --- BUTTON EVENT LISTENERS ---

  // Auto Mod Button (OSU! Auto Play)
  if (btnAutoPlay) {
    btnAutoPlay.addEventListener('click', () => {
      ensureAudioUnlocked();
      if (!window.gameEngine) return;

      window.gameEngine.isAutoPlay = !window.gameEngine.isAutoPlay;
      if (window.gameEngine.isAutoPlay) {
        btnAutoPlay.classList.add('active');
        btnAutoPlay.innerText = '🤖 Auto (演示開啟)';
      } else {
        btnAutoPlay.classList.remove('active');
        btnAutoPlay.innerText = '🤖 Auto 演示';
      }
    });
  }

  // Start Game Button
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      ensureAudioUnlocked();

      if (!window.gameEngine.chart) {
        loadPresetSong('canon');
      }

      window.gameEngine.start();
      btnStart.innerText = '🔄 重新開始';
    });
  }

  // MIDI File Upload
  if (btnUpload && midiFileInput) {
    btnUpload.addEventListener('click', (e) => {
      e.preventDefault();
      ensureAudioUnlocked();
      midiFileInput.value = '';
      midiFileInput.click();
    });

    midiFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          lastMidiBuffer = event.target.result;
          const chart = await window.midiParser.parseMidiBuffer(lastMidiBuffer, currentLaneCount, currentDifficulty);

          if (!chart || !chart.notes || chart.notes.length === 0) {
            alert('MIDI 解析完成，但未發現有效音符！請嘗試其他 MIDI 檔案。');
            return;
          }

          currentSongName = file.name.replace(/\.[^/.]+$/, "");
          window.gameEngine.loadChart(chart, currentLaneCount);

          if (songTitleEl) songTitleEl.innerText = currentSongName;
          if (songMetaEl) songMetaEl.innerText = `Custom MIDI | Full BGM Track | ${chart.totalNotes} Playable Notes`;
          updateKeyHintsUI();

          alert(`🎉 成功匯入 「${currentSongName}」！\n已為您載入全曲完整 MIDI 音樂與精選打擊譜面（${chart.totalNotes} 個擊打音符）。\n點擊「▶ 開始遊戲」開彈！`);
        } catch (err) {
          alert('MIDI 解析失敗，請確認檔案為標準 .mid / .midi 格式。');
          console.error('MIDI parse error:', err);
        }
      };

      reader.readAsArrayBuffer(file);
    });
  }

  // Modals Open / Close Handlers
  if (btnSelectPreset && presetModal) {
    btnSelectPreset.addEventListener('click', () => {
      ensureAudioUnlocked();
      presetModal.classList.add('active');
    });
  }

  if (btnClosePreset && presetModal) {
    btnClosePreset.addEventListener('click', () => {
      presetModal.classList.remove('active');
    });
  }

  document.querySelectorAll('.preset-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.preset-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');

      const presetId = item.dataset.preset;
      lastMidiBuffer = null;
      loadPresetSong(presetId);
      if (presetModal) presetModal.classList.remove('active');
    });
  });

  if (btnSettings && settingsModal) {
    btnSettings.addEventListener('click', () => {
      ensureAudioUnlocked();
      settingsModal.classList.add('active');
    });
  }

  if (btnCloseSettings && settingsModal) {
    btnCloseSettings.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });
  }

  if (btnCloseResult && resultModal) {
    btnCloseResult.addEventListener('click', () => {
      resultModal.classList.remove('active');
    });
  }

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      ensureAudioUnlocked();
      if (resultModal) resultModal.classList.remove('active');
      window.gameEngine.start();
    });
  }

  // Settings Controls
  if (speedRange && speedVal) {
    speedRange.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      speedVal.innerText = val.toFixed(1) + 'x';
      if (window.gameEngine) window.gameEngine.settings.scrollSpeed = val;
    });
  }

  if (offsetRange && offsetVal) {
    offsetRange.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      offsetVal.innerText = val + ' ms';
      if (window.gameEngine) window.gameEngine.settings.audioOffset = val;
    });
  }

  if (laneSelect) {
    laneSelect.addEventListener('change', (e) => {
      currentLaneCount = parseInt(e.target.value);
      reloadCurrentSong();
    });
  }

  if (diffSelect) {
    diffSelect.addEventListener('change', async (e) => {
      currentDifficulty = e.target.value;
      window.midiParser.setDifficulty(currentDifficulty);
      await reloadCurrentSong();
    });
  }

  if (hitsoundSelect) {
    hitsoundSelect.addEventListener('change', (e) => {
      if (window.audioEngine) {
        window.audioEngine.hitSoundStyle = e.target.value;
      }
    });
  }

  async function reloadCurrentSong() {
    if (lastMidiBuffer) {
      const chart = await window.midiParser.parseMidiBuffer(lastMidiBuffer, currentLaneCount, currentDifficulty);
      window.gameEngine.loadChart(chart, currentLaneCount);
      if (songMetaEl) songMetaEl.innerText = `Custom MIDI | Full BGM Track | ${chart.totalNotes} Playable Notes`;
      updateKeyHintsUI();
    } else {
      loadPresetSong('canon');
    }
  }

  // Keyboard Listeners
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    ensureAudioUnlocked();
    if (window.gameEngine) window.gameEngine.handleKeyDown(e.key);

    const keyBtn = keyHintsContainer.querySelector(`[data-key="${e.key.toLowerCase()}"]`);
    if (keyBtn) keyBtn.classList.add('pressed');
  });

  window.addEventListener('keyup', (e) => {
    if (window.gameEngine) window.gameEngine.handleKeyUp(e.key);

    const keyBtn = keyHintsContainer.querySelector(`[data-key="${e.key.toLowerCase()}"]`);
    if (keyBtn) keyBtn.classList.remove('pressed');
  });

  // Helpers
  function updateKeyHintsUI() {
    if (!keyHintsContainer || !window.gameEngine) return;
    keyHintsContainer.innerHTML = '';
    const keys = window.gameEngine.laneKeys[currentLaneCount] || ['d', 'f', 'j', 'k'];
    keys.forEach(k => {
      const hintDiv = document.createElement('div');
      hintDiv.className = 'key-hint';
      hintDiv.innerText = k.toUpperCase();
      hintDiv.dataset.key = k;
      keyHintsContainer.appendChild(hintDiv);
    });
  }

  function loadPresetSong(presetId) {
    try {
      currentSongName = presetId === 'canon' ? 'Canon in D Major (Preset)' : 'Für Elise (Preset)';
      const chart = window.midiParser.getPresetChart(presetId, currentLaneCount);
      window.gameEngine.loadChart(chart, currentLaneCount);

      if (songTitleEl) songTitleEl.innerText = currentSongName;
      if (songMetaEl) songMetaEl.innerText = `${currentLaneCount} Lanes | Full BGM Track | ${chart.totalNotes} Notes`;
      updateKeyHintsUI();
    } catch (err) {
      console.error('loadPresetSong error:', err);
    }
  }

  // Engine Callbacks (OSU! Judgments Feedback)
  if (window.gameEngine) {
    window.gameEngine.onHitFeedback = (quality, combo, offsetMs) => {
      if (hitFeedbackEl) {
        hitFeedbackEl.innerText = quality;
        hitFeedbackEl.className = `hit-feedback val-${quality} animate`;
        void hitFeedbackEl.offsetWidth;
      }

      if (hitOffsetTagEl) {
        if (quality === 'miss') {
          hitOffsetTagEl.innerText = 'MISS';
          hitOffsetTagEl.style.color = 'var(--osu-miss)';
        } else {
          const sign = offsetMs > 0 ? '+' : '';
          const diffTag = offsetMs > 0 ? 'Late' : 'Early';
          hitOffsetTagEl.innerText = `${sign}${offsetMs} ms (${diffTag})`;
          hitOffsetTagEl.style.color = Math.abs(offsetMs) <= 45 ? 'var(--osu-300)' : 'var(--osu-100)';
        }
        hitOffsetTagEl.classList.add('active');
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
      if (state === 'FINISHED' && resultModal) {
        if (resultRankEl) resultRankEl.innerText = window.gameEngine.calculateRank();
        if (resultScoreEl) resultScoreEl.innerText = window.gameEngine.score.toLocaleString();
        if (resultAccEl) resultAccEl.innerText = window.gameEngine.getAccuracy();
        if (resultMaxComboEl) resultMaxComboEl.innerText = window.gameEngine.maxCombo;

        if (result300El) result300El.innerText = window.gameEngine.stats.count300;
        if (result100El) result100El.innerText = window.gameEngine.stats.count100;
        if (result50El) result50El.innerText = window.gameEngine.stats.count50;
        if (resultMissEl) resultMissEl.innerText = window.gameEngine.stats.miss;

        resultModal.classList.add('active');
      }
    };
  }

  // Load Preset Initially
  loadPresetSong('canon');
});
