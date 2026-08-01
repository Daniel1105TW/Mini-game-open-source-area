/**
 * GameEngine - Full BGM + OSU! Judgments + Touch + Hold + Roll Note Modes
 */
class GameEngine {
  constructor() {
    this.state = 'IDLE'; // IDLE | PLAYING | PAUSED | FINISHED
    this.chart = null;
    this.isAutoPlay = false;

    this.settings = {
      scrollSpeed: 1.8,
      audioOffset: 0,
      laneCount: 4,
      noteMode: 'standard', // standard | tap-only | roll
      bgmVolume: 0.75,
      sfxVolume: 0.9,
      judgmentWindow: 0.17,
      perfectWindow: 0.045,
      goodWindow: 0.09,
      missWindow: 0.2,
    };

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.health = 100;
    this.totalNotes = 0;

    this.stats = { count300: 0, count100: 0, count50: 0, miss: 0 };

    this.startTime = 0;
    this.currentTime = 0;
    this.audioStartTime = 0;
    this.schedulerLeadTime = 0.22;
    this.animationFrameId = null;

    // Roll note state: tracks continuous pressing per lane
    this.rollHitTimers = {};
    this.nextNoteIndex = 0;
    this.nextBgmIndex = 0;

    this.onStateChange = null;
    this.onHitFeedback = null;
    this.onScoreUpdate = null;
    this.onTimeUpdate = null;

    this.laneKeys = {
      4: ['d', 'f', 'j', 'k'],
      6: ['s', 'd', 'f', 'j', 'k', 'l']
    };
    this.keyStates = [false, false, false, false, false, false];
  }

  loadChart(chart, laneCount = 4) {
    this.chart = chart;
    this.settings.laneCount = laneCount;
    this.totalNotes = chart?.totalNotes || 0;
    this.resetStats();
  }

  resetStats() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.health = 100;
    this.stats = { count300: 0, count100: 0, count50: 0, miss: 0 };
    this.keyStates = new Array(this.settings.laneCount).fill(false);
    this.rollHitTimers = {};
    this.nextNoteIndex = 0;
    this.nextBgmIndex = 0;

    if (this.chart?.notes) {
      this.chart.notes.sort((a, b) => a.time - b.time);
      this.chart.notes.forEach(n => { n.hitState = 'pending'; n.rollHitCount = 0; });
    }
    if (this.chart?.bgmNotes) {
      this.chart.bgmNotes.sort((a, b) => a.time - b.time);
      this.chart.bgmNotes.forEach(n => { n.played = false; });
    }
  }

  start() {
    if (!this.chart?.notes?.length) { alert('請先選擇或導入有效的 MIDI 樂曲！'); return; }
    try { window.audioEngine.init(); window.audioEngine.resume(); } catch(e) {}

    this.resetStats();
    this.state = 'PLAYING';
    this.startLeadTime = 1.2;

    if (window.audioEngine?.ctx) {
      this.audioStartTime = window.audioEngine.ctx.currentTime + this.startLeadTime;
    } else {
      this.audioStartTime = 0;
    }
    this.startTime = performance.now() + (this.startLeadTime * 1000);
    this.currentTime = -this.startLeadTime;

    if (this.onStateChange) this.onStateChange('PLAYING');
    this.gameLoop();
  }

  pause() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
    if (this.onStateChange) this.onStateChange('PAUSED');
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    const offsetSec = (this.settings.audioOffset || 0) / 1000;
    if (window.audioEngine?.ctx) {
      this.audioStartTime = window.audioEngine.ctx.currentTime - (this.currentTime - offsetSec);
    }
    this.startTime = performance.now() - ((this.currentTime - offsetSec) * 1000);
    if (this.onStateChange) this.onStateChange('PLAYING');
    this.gameLoop();
  }

  stop() {
    this.state = 'FINISHED';
    if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
    if (this.onStateChange) this.onStateChange('FINISHED');
  }

  gameLoop() {
    if (this.state !== 'PLAYING') return;

    const offsetSec = (this.settings.audioOffset || 0) / 1000;
    if (window.audioEngine?.ctx && window.audioEngine.ctx.state === 'running') {
      this.currentTime = (window.audioEngine.ctx.currentTime - this.audioStartTime) + offsetSec;
    } else {
      const elapsedMs = performance.now() - this.startTime;
      this.currentTime = (elapsedMs / 1000) + offsetSec;
    }

    if (this.onTimeUpdate) this.onTimeUpdate(Math.max(0, this.currentTime), this.chart?.duration || 0);

    this.processAudioPlayback();
    if (this.isAutoPlay) this.processAutoPlay();
    this.processMissedNotes();
    this.processRollNotes();

    if (window.renderer) {
      window.renderer.render(this, this.settings, this.keyStates);
    }

    if (this.chart && this.currentTime > (this.chart.duration || 10) + 1.8) {
      this.finishGame(); return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  processAudioPlayback() {
    if (!this.chart?.bgmNotes) return;
    const lead = this.schedulerLeadTime;
    const ctx = window.audioEngine?.ctx;
    const offsetSec = (this.settings.audioOffset || 0) / 1000;

    while (this.nextBgmIndex < this.chart.bgmNotes.length) {
      const note = this.chart.bgmNotes[this.nextBgmIndex];
      if (note.played) {
        this.nextBgmIndex += 1;
        continue;
      }
      if (note.time > this.currentTime + lead) break;
      note.played = true;
      try {
        if (ctx) {
          const startAt = this.audioStartTime + note.time - offsetSec;
          window.audioEngine.playBGMNote(note.pitch, note.duration, note.velocity, startAt);
        } else {
          window.audioEngine.playBGMNote(note.pitch, note.duration, note.velocity);
        }
      } catch(e) {}
      this.nextBgmIndex += 1;
    }
  }

  processAutoPlay() {
    if (!this.chart?.notes) return;
    while (this.nextNoteIndex < this.chart.notes.length) {
      const note = this.chart.notes[this.nextNoteIndex];
      if (note.hitState !== 'pending') {
        this.nextNoteIndex += 1;
        continue;
      }
      if (note.time > this.currentTime) break;
      note.hitState = 'hit';
      this.keyStates[note.lane] = true;
      setTimeout(() => { this.keyStates[note.lane] = false; }, 80);
      this.registerHit('300', note.lane, 0);
      this.nextNoteIndex += 1;
    }
  }

  processMissedNotes() {
    if (!this.chart?.notes) return;
    const missWin = this.settings.missWindow;
    while (this.nextNoteIndex < this.chart.notes.length) {
      const note = this.chart.notes[this.nextNoteIndex];
      if (note.hitState !== 'pending') {
        this.nextNoteIndex += 1;
        continue;
      }
      if (note.time + missWin > this.currentTime) break;

      note.hitState = 'miss';
      this.registerHit('miss');
      this.nextNoteIndex += 1;
    }
  }

  /**
   * Roll Mode: While key held in a roll lane, auto-hits notes at a fixed interval
   */
  processRollNotes() {
    if (this.settings.noteMode !== 'roll') return;
    if (!this.chart?.notes) return;

    for (let laneIdx = 0; laneIdx < this.settings.laneCount; laneIdx++) {
      if (!this.keyStates[laneIdx]) continue;

      if (!this.rollHitTimers[laneIdx]) this.rollHitTimers[laneIdx] = 0;

      if (this.currentTime - this.rollHitTimers[laneIdx] >= 0.08) {
        // Find closest pending note in this lane for roll
        let closest = null, minDiff = Infinity;
        for (const note of this.chart.notes) {
          if (note.lane === laneIdx && note.hitState === 'pending') {
            const diff = Math.abs(note.time - this.currentTime);
            if (diff < minDiff) { minDiff = diff; closest = note; }
          }
        }

        if (closest && minDiff <= 0.22) {
          closest.hitState = 'hit';
          this.registerHit('300', laneIdx, 0);
        }

        this.rollHitTimers[laneIdx] = this.currentTime;
      }
    }
  }

  handleKeyDown(key) {
    if (this.state !== 'PLAYING' || this.isAutoPlay) return;
    const keys = this.laneKeys[this.settings.laneCount] || ['d','f','j','k'];
    const laneIdx = keys.indexOf(key.toLowerCase());
    if (laneIdx === -1 || this.keyStates[laneIdx]) return;

    this.keyStates[laneIdx] = true;

    if (this.settings.noteMode !== 'roll') {
      this.judgeKeyPress(laneIdx);
    }
  }

  handleKeyUp(key) {
    if (this.isAutoPlay) return;
    const keys = this.laneKeys[this.settings.laneCount] || ['d','f','j','k'];
    const laneIdx = keys.indexOf(key.toLowerCase());
    if (laneIdx !== -1) this.keyStates[laneIdx] = false;
  }

  handleLanePress(laneIdx) {
    if (this.state !== 'PLAYING' || this.isAutoPlay) return;
    if (this.keyStates[laneIdx]) return;
    this.keyStates[laneIdx] = true;
    if (this.settings.noteMode !== 'roll') this.judgeKeyPress(laneIdx);
  }

  handleLaneRelease(laneIdx) {
    if (this.isAutoPlay) return;
    this.keyStates[laneIdx] = false;
  }

  judgeKeyPress(lane) {
    if (!this.chart?.notes) return;
    let closest = null, minDiff = Infinity, rawDiff = 0;

    for (const note of this.chart.notes) {
      if (note.lane === lane && note.hitState === 'pending') {
        const diff = Math.abs(note.time - this.currentTime);
        if (diff < minDiff) { minDiff = diff; rawDiff = this.currentTime - note.time; closest = note; }
      }
    }

    if (!closest) return;

    const maxWindow = this.settings.judgmentWindow;
    if (minDiff <= maxWindow) {
      closest.hitState = 'hit';
      const grade = minDiff <= this.settings.perfectWindow ? '300' : minDiff <= this.settings.goodWindow ? '100' : '50';
      this.registerHit(grade, lane, Math.round(rawDiff * 1000));
    }
  }

  registerHit(quality, lane = 0, offsetMs = 0) {
    const scoreMap = { '300': 1.0, '100': 0.6, '50': 0.3, miss: 0 };
    const healthMap = { '300': 2.5, '100': 1.2, '50': 0, miss: -10 };

    if (quality === 'miss') {
      this.stats.miss++;
      this.combo = 0;
    } else {
      this.stats[`count${quality}`]++;
      this.combo++;
    }

    this.health = Math.max(0, Math.min(100, this.health + (healthMap[quality] || 0)));
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    const noteWeight = this.totalNotes > 0 ? (1000000 / this.totalNotes) : 1000;
    this.score += Math.round(noteWeight * scoreMap[quality]);

    try { window.audioEngine.playHitSound(quality); } catch(e) {}

    if (quality !== 'miss' && window.renderer) {
      window.renderer.spawnHitParticles(lane, this.settings.laneCount, quality === '300' ? 'perfect' : 'great');
    }

    if (this.onHitFeedback) this.onHitFeedback(quality, this.combo, offsetMs);
    if (this.onScoreUpdate) this.onScoreUpdate(this.score, this.getAccuracy(), this.health);
  }

  getAccuracy() {
    const total = this.stats.count300 + this.stats.count100 + this.stats.count50 + this.stats.miss;
    if (!total) return '100.00%';
    const w = (this.stats.count300 * 1.0) + (this.stats.count100 * 0.6) + (this.stats.count50 * 0.3);
    return ((w / total) * 100).toFixed(2) + '%';
  }

  calculateRank() {
    const acc = parseFloat(this.getAccuracy());
    if (acc >= 98) return 'SS';
    if (acc >= 93) return 'S';
    if (acc >= 85) return 'A';
    if (acc >= 75) return 'B';
    if (acc >= 60) return 'C';
    return 'D';
  }

  finishGame() {
    this.stop();
    this.state = 'FINISHED';
    if (this.onStateChange) this.onStateChange('FINISHED');
  }
}

window.gameEngine = new GameEngine();
