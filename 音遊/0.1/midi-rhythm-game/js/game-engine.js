/**
 * GameEngine - Full BGM Music Synchronizer, OSU! Accuracy & Auto Mod
 */
class GameEngine {
  constructor() {
    this.state = 'IDLE'; // 'IDLE', 'PLAYING', 'PAUSED', 'FINISHED'
    this.chart = null;
    
    // OSU! Inspired Mods & Settings
    this.isAutoPlay = false; // OSU! Auto Mod

    this.settings = {
      scrollSpeed: 1.8,
      audioOffset: 0,
      laneCount: 4,
      bgmVolume: 0.8,
      sfxVolume: 1.0
    };

    // OSU! Style Metrics
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.health = 100;
    this.totalNotes = 0;
    
    // OSU! Judgments: 300 / 100 / 50 / Miss
    this.stats = {
      count300: 0,
      count100: 0,
      count50: 0,
      miss: 0
    };

    // Precision Offset Tracking (ms)
    this.lastHitOffsetMs = 0;

    // Timing Clock
    this.startTime = 0;
    this.currentTime = 0;
    this.animationFrameId = null;

    // Key Inputs
    this.laneKeys = {
      4: ['d', 'f', 'j', 'k'],
      6: ['s', 'd', 'f', 'j', 'k', 'l']
    };
    this.keyStates = [false, false, false, false, false, false];

    // Callbacks
    this.onStateChange = null;
    this.onHitFeedback = null;
    this.onScoreUpdate = null;
  }

  loadChart(chart, laneCount = 4) {
    this.chart = chart;
    this.settings.laneCount = laneCount;
    this.totalNotes = (chart && chart.totalNotes) ? chart.totalNotes : 0;
    this.resetStats();
  }

  resetStats() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.health = 100;
    this.stats = { count300: 0, count100: 0, count50: 0, miss: 0 };
    this.keyStates = new Array(this.settings.laneCount).fill(false);

    if (this.chart) {
      if (this.chart.notes) {
        this.chart.notes.forEach(n => {
          n.hitState = 'pending';
        });
      }
      if (this.chart.bgmNotes) {
        this.chart.bgmNotes.forEach(n => {
          n.played = false;
        });
      }
    }
  }

  start() {
    if (!this.chart || !this.chart.notes || this.chart.notes.length === 0) {
      alert('請先選擇或導入有效的 MIDI 樂曲！');
      return;
    }

    try {
      window.audioEngine.init();
      window.audioEngine.resume();
    } catch(e){}

    this.resetStats();
    this.state = 'PLAYING';
    this.startTime = performance.now();
    this.currentTime = 0;

    if (this.onStateChange) this.onStateChange(this.state);

    this.gameLoop();
  }

  pause() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.onStateChange) this.onStateChange(this.state);
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.startTime = performance.now() - (this.currentTime * 1000);
    if (this.onStateChange) this.onStateChange(this.state);
    this.gameLoop();
  }

  stop() {
    this.state = 'FINISHED';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.onStateChange) this.onStateChange(this.state);
  }

  /**
   * Main 60 FPS Loop
   */
  gameLoop() {
    if (this.state !== 'PLAYING') return;

    const elapsedMs = performance.now() - this.startTime;
    this.currentTime = (elapsedMs / 1000) + (this.settings.audioOffset / 1000);

    // 1. Full MIDI Track Playback (Background Music Audio)
    this.processAudioPlayback();

    // 2. Auto Mod Support (Computer plays perfectly)
    if (this.isAutoPlay) {
      this.processAutoPlay();
    }

    // 3. Process Missed Notes
    this.processMissedNotes();

    // 4. Render Canvas Frame
    if (window.renderer) {
      window.renderer.render(this, this.settings, this.keyStates);
    }

    // 5. Check Song Finish Condition
    if (this.chart && this.currentTime > (this.chart.duration || 10) + 1.5) {
      this.finishGame();
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Play 100% Full MIDI Track Background Audio (All chords, melody & bass)
   */
  processAudioPlayback() {
    if (!this.chart || !this.chart.bgmNotes) return;
    const bgm = this.chart.bgmNotes;

    for (let i = 0; i < bgm.length; i++) {
      const note = bgm[i];
      if (!note.played && note.time <= this.currentTime) {
        note.played = true;
        try {
          window.audioEngine.playBGMNote(note.pitch, note.duration, note.velocity);
        } catch(e){}
      }
    }
  }

  /**
   * OSU! Auto Mod Handler
   */
  processAutoPlay() {
    if (!this.chart || !this.chart.notes) return;
    const notes = this.chart.notes;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.hitState === 'pending' && this.currentTime >= note.time) {
        note.hitState = 'hit';
        this.keyStates[note.lane] = true;
        setTimeout(() => { this.keyStates[note.lane] = false; }, 80);
        this.registerHit('300', note.lane, 0);
      }
    }
  }

  /**
   * Check Missed Notes
   */
  processMissedNotes() {
    if (!this.chart || !this.chart.notes) return;
    const notes = this.chart.notes;
    const missWindow = 0.14; // 140ms limit

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.hitState === 'pending' && (this.currentTime - note.time) > missWindow) {
        note.hitState = 'miss';
        this.registerHit('miss');
      }
    }
  }

  /**
   * Key Event Handlers
   */
  handleKeyDown(key) {
    if (this.state !== 'PLAYING' || this.isAutoPlay) return;

    const keys = this.laneKeys[this.settings.laneCount] || ['d','f','j','k'];
    const laneIndex = keys.indexOf(key.toLowerCase());

    if (laneIndex === -1) return;

    if (this.keyStates[laneIndex]) return;
    this.keyStates[laneIndex] = true;

    this.judgeKeyPress(laneIndex);
  }

  handleKeyUp(key) {
    if (this.isAutoPlay) return;
    const keys = this.laneKeys[this.settings.laneCount] || ['d','f','j','k'];
    const laneIndex = keys.indexOf(key.toLowerCase());

    if (laneIndex !== -1) {
      this.keyStates[laneIndex] = false;
    }
  }

  /**
   * OSU! Judgment Algorithm (300 / 100 / 50 / Miss)
   */
  judgeKeyPress(lane) {
    if (!this.chart || !this.chart.notes) return;

    const notes = this.chart.notes;
    let closestNote = null;
    let minTimeDiff = Infinity;
    let rawDiff = 0;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.lane === lane && note.hitState === 'pending') {
        const timeDiff = Math.abs(note.time - this.currentTime);
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          rawDiff = (this.currentTime - note.time); // positive = late, negative = early
          closestNote = note;
        }
      }
    }

    if (!closestNote) return;

    const WIN_300 = 0.045; // 45ms
    const WIN_100 = 0.090; // 90ms
    const WIN_50  = 0.140; // 140ms

    if (minTimeDiff <= WIN_50) {
      closestNote.hitState = 'hit';
      let judgment = '50';

      if (minTimeDiff <= WIN_300) {
        judgment = '300';
      } else if (minTimeDiff <= WIN_100) {
        judgment = '100';
      }

      this.registerHit(judgment, lane, Math.round(rawDiff * 1000));
    }
  }

  /**
   * Register OSU! Hit Score & Health
   */
  registerHit(quality, lane = 0, offsetMs = 0) {
    this.lastHitOffsetMs = offsetMs;

    if (quality === '300') {
      this.stats.count300++;
      this.combo++;
      this.health = Math.min(100, this.health + 2.5);
      try { window.audioEngine.playHitSound('300'); } catch(e){}
    } else if (quality === '100') {
      this.stats.count100++;
      this.combo++;
      this.health = Math.min(100, this.health + 1.2);
      try { window.audioEngine.playHitSound('100'); } catch(e){}
    } else if (quality === '50') {
      this.stats.count50++;
      this.combo++;
      try { window.audioEngine.playHitSound('50'); } catch(e){}
    } else if (quality === 'miss') {
      this.stats.miss++;
      this.combo = 0;
      this.health = Math.max(0, this.health - 10);
      try { window.audioEngine.playHitSound('miss'); } catch(e){}
    }

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    const noteWeight = (this.totalNotes > 0) ? (1000000 / this.totalNotes) : 1000;
    const hitScoreMap = { '300': 1.0, '100': 0.6, '50': 0.3, 'miss': 0.0 };
    
    this.score += Math.round(noteWeight * hitScoreMap[quality]);

    if (quality !== 'miss' && window.renderer) {
      window.renderer.spawnHitParticles(lane, this.settings.laneCount, quality === '300' ? 'perfect' : 'great');
    }

    if (this.onHitFeedback) this.onHitFeedback(quality, this.combo, offsetMs);
    if (this.onScoreUpdate) this.onScoreUpdate(this.score, this.getAccuracy(), this.health);
  }

  getAccuracy() {
    const totalJudged = this.stats.count300 + this.stats.count100 + this.stats.count50 + this.stats.miss;
    if (totalJudged === 0) return '100.00%';

    const weightedScore = (this.stats.count300 * 1.0) + (this.stats.count100 * 0.6) + (this.stats.count50 * 0.3);
    const acc = (weightedScore / totalJudged) * 100;
    return acc.toFixed(2) + '%';
  }

  calculateRank() {
    const accVal = parseFloat(this.getAccuracy());
    if (accVal >= 98) return 'SS';
    if (accVal >= 93) return 'S';
    if (accVal >= 85) return 'A';
    if (accVal >= 75) return 'B';
    if (accVal >= 60) return 'C';
    return 'D';
  }

  finishGame() {
    this.stop();
    this.state = 'FINISHED';
    if (this.onStateChange) this.onStateChange(this.state);
  }
}

window.gameEngine = new GameEngine();
