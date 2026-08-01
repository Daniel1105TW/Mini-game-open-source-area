/**
 * AudioEngine - Full MIDI Track Playback Engine & OSU! Style Hitsound Synthesizer
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.isInitialized = false;

    // Hitsound Style: 'osu', 'soft', 'piano'
    this.hitSoundStyle = 'osu';
  }

  init() {
    if (this.isInitialized) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(this.ctx.destination);

    // SFX Gain (Hit sound)
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.masterGain);

    // BGM Gain (Full MIDI Track Playback)
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.75;
    this.bgmGain.connect(this.masterGain);

    this.isInitialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Play Full MIDI Audio Track Note (All background chords & melodies)
   */
  playBGMNote(midiNote, duration = 0.4, velocity = 0.8, startTime = 0) {
    if (!this.isInitialized) this.init();
    this.resume();

    const now = startTime > 0 ? startTime : this.ctx.currentTime;
    const freq = this.midiToFreq(midiNote);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(3500, freq * 3.8), now);

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 0.5, now);

    const attack = 0.008;
    const decay = 0.35;
    const sustain = velocity * 0.3;
    const noteLen = Math.max(0.12, duration);

    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(velocity * 0.5, now + attack);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.001, sustain), now + attack + decay);
    
    const stopTime = now + noteLen;
    noteGain.gain.setValueAtTime(sustain, stopTime);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.25);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.bgmGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(stopTime + 0.3);
    osc2.stop(stopTime + 0.3);
  }

  /**
   * OSU! Inspired Hit Sound Synthesizer (Clap / Percussion / Piano)
   */
  playHitSound(quality = '300') {
    if (!this.isInitialized) this.init();
    this.resume();

    const now = this.ctx.currentTime;

    if (quality === 'miss') {
      // Miss Combobreak Sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    if (this.hitSoundStyle === 'osu') {
      // OSU! Crisp Snare / Clap Hit Sound
      const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(quality === '300' ? 1200 : 800, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(quality === '300' ? 0.7 : 0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      // Tonal Pop Body
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(quality === '300' ? 1200 : 900, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

      oscGain.gain.setValueAtTime(0.6, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.07);
      osc.start(now);
      osc.stop(now + 0.05);
    } else {
      // Classic Percussion Tap
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const freq = quality === '300' ? 1300 : (quality === '100' ? 1000 : 700);
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.06);

      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.06);
    }
  }
}

window.audioEngine = new AudioEngine();
