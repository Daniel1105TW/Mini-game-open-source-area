/**
 * AudioEngine — Web Audio API
 * 改善音質：使用接近鋼琴音色的 ADSR、多重諧波、DynamicsCompressor
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.reverb = null;
    this.initialized = false;
    this.hitSoundStyle = 'osu';
    // BGM 音量稍微提高，確保完整曲目可聽見
    this.bgmVolume = 1.0;
    this.sfxVolume = 0.85;

    // Node pool for efficiency
    this._notePool = [];
    // 提升同時播放音符上限，防止 BGM 大量音符被丟棄
    this._maxConcurrent = 128;
    this._activeNodes = 0;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Compressor → limiter chain
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -6;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;

    this.master = this.ctx.createGain();
    this.master.gain.value = 1.0;

    this.compressor.connect(this.master);
    this.master.connect(this.ctx.destination);

    this._buildReverb();
    this.initialized = true;
  }

  async _buildReverb() {
    // Synthetic reverb impulse (saves bandwidth over a loaded .wav)
    const sampleRate = this.ctx.sampleRate;
    const duration = 1.5;
    const impulse = this.ctx.createBuffer(2, sampleRate * duration, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const buf = impulse.getChannelData(ch);
      for (let i = 0; i < buf.length; i++) {
        buf[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / buf.length, 2.4);
      }
    }
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = impulse;

    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.18;
    this.reverb.connect(reverbGain);
    reverbGain.connect(this.compressor);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /**
   * Play a single BGM/note with richer ADSR 包絡，確保音符在 BGM 中不會過快衰減
   * 使用三個振盪器（三角、鋸齒、正弦）混合，並全跑過 Compressor 與 Reverb
   */
  playBGMNote(midi, durationSec, velocity = 100, startTime = null) {
    if (!this.initialized || !this.ctx || this._activeNodes >= this._maxConcurrent) return;

    const now = this.ctx.currentTime;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const amp = (velocity / 127) * this.bgmVolume;
    const dur = Math.max(0.1, Math.min(durationSec || 0.25, 8.0));
    const startAt = typeof startTime === 'number' ? Math.max(startTime, now + 0.02) : now;

    this._activeNodes++;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, startAt);
    env.gain.linearRampToValueAtTime(amp, startAt + 0.01);
    env.gain.exponentialRampToValueAtTime(amp * 0.6, startAt + 0.13);
    env.gain.setValueAtTime(amp * 0.6, startAt + 0.13);
    env.gain.exponentialRampToValueAtTime(0.0001, startAt + dur + 0.2);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq * 1.002;

    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 2;

    const mix1 = this.ctx.createGain(); mix1.gain.value = 0.55;
    const mix2 = this.ctx.createGain(); mix2.gain.value = 0.30;
    const mix3 = this.ctx.createGain(); mix3.gain.value = 0.15;

    osc1.connect(mix1).connect(env);
    osc2.connect(mix2).connect(env);
    osc3.connect(mix3).connect(env);

    env.connect(this.compressor);
    if (this.reverb) env.connect(this.reverb);

    osc1.start(startAt);
    osc2.start(startAt);
    osc3.start(startAt);
    osc1.stop(startAt + dur + 0.25);
    osc2.stop(startAt + dur + 0.25);
    osc3.stop(startAt + dur + 0.25);

    const cleanup = () => { this._activeNodes = Math.max(0, this._activeNodes - 1); };
    osc1.addEventListener('ended', cleanup);
  }

  /**
   * Play hit SFX on key press
   */
  playHitSound(quality) {
    if (!this.initialized || !this.ctx) return;
    if (quality === 'miss') return;

    const now = this.ctx.currentTime;
    const sfxGain = this.ctx.createGain();
    sfxGain.gain.value = this.sfxVolume;
    sfxGain.connect(this.compressor);

    if (this.hitSoundStyle === 'osu') {
      // Classic OSU! Drum-like hit (click + low thud)
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / this.ctx.sampleRate;
        data[i] = Math.random() * 0.7 * Math.exp(-t * 70);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buf;
      source.connect(sfxGain);
      source.start(now);
    } else {
      // Soft "ping"
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
      const eg = this.ctx.createGain();
      eg.gain.setValueAtTime(this.sfxVolume * 0.5, now);
      eg.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(eg); eg.connect(sfxGain);
      osc.start(now); osc.stop(now + 0.12);
    }
  }
}

window.audioEngine = new AudioEngine();
