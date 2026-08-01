/**
 * MIDIParser - Full MIDI Track Preserved BGM + Smart Melody Note Extraction
 */
class MIDIParser {
  constructor() {
    this.keyCount = 4;
    this.difficulty = 'normal';
  }

  setDifficulty(diff) {
    this.difficulty = diff;
  }

  async parseMidiBuffer(arrayBuffer, laneCount = 4, difficulty = 'normal') {
    this.keyCount = laneCount;
    this.difficulty = difficulty;

    if (window.Midi) {
      try {
        const midi = new window.Midi(arrayBuffer);
        if (midi && midi.tracks && midi.tracks.length > 0) {
          const chart = this.convertToneMidiToChart(midi);
          if (chart.notes && chart.notes.length > 0) {
            return chart;
          }
        }
      } catch (err) {
        console.warn('Tone.Midi parse fallback to binary parser:', err);
      }
    }

    return this.parseStandardBinaryMIDI(arrayBuffer);
  }

  convertToneMidiToChart(midi) {
    const rawNotes = [];
    
    midi.tracks.forEach(track => {
      if (track && track.notes) {
        track.notes.forEach(note => {
          rawNotes.push({
            pitch: note.midi,
            time: note.time,
            duration: note.duration,
            velocity: note.velocity || 0.8
          });
        });
      }
    });

    rawNotes.sort((a, b) => a.time - b.time);
    return this.processNotesToChart(rawNotes);
  }

  parseStandardBinaryMIDI(arrayBuffer) {
    const data = new DataView(arrayBuffer);
    let offset = 0;

    function readString(len) {
      let str = '';
      for (let i = 0; i < len; i++) {
        if (offset < data.byteLength) {
          str += String.fromCharCode(data.getUint8(offset++));
        }
      }
      return str;
    }

    if (data.byteLength < 14) throw new Error('File too small for MIDI');
    const headerChunk = readString(4);
    if (headerChunk !== 'MThd') throw new Error('Invalid MIDI Header');

    const headerLength = data.getUint32(offset); offset += 4;
    const formatType = data.getUint16(offset); offset += 2;
    const trackCount = data.getUint16(offset); offset += 2;
    const timeDivision = data.getUint16(offset); offset += 2;

    let ticksPerBeat = (timeDivision & 0x8000) ? 480 : timeDivision;
    let usPerQuarter = 500000;
    const rawNotes = [];

    for (let i = 0; i < trackCount; i++) {
      if (offset >= data.byteLength) break;
      const trackHeader = readString(4);
      if (trackHeader !== 'MTrk') {
        if (offset + 4 <= data.byteLength) {
          const len = data.getUint32(offset); offset += 4 + len;
        }
        continue;
      }

      const trackLength = data.getUint32(offset); offset += 4;
      const trackEnd = Math.min(data.byteLength, offset + trackLength);
      let currentTimeTicks = 0;
      const activeNotes = new Map();
      let runningStatus = 0;

      while (offset < trackEnd) {
        let delta = 0, b = 0, limit = 0;
        do {
          if (offset >= trackEnd) break;
          b = data.getUint8(offset++);
          delta = (delta << 7) | (b & 0x7f);
          limit++;
        } while ((b & 0x80) && limit < 4);

        currentTimeTicks += delta;
        if (offset >= trackEnd) break;

        let status = data.getUint8(offset);
        if (status & 0x80) {
          offset++;
          runningStatus = status;
        } else {
          status = runningStatus;
        }

        const eventType = status >> 4;
        const channel = status & 0x0f;

        if (eventType === 0x9 || eventType === 0x8) {
          if (offset + 1 >= trackEnd) break;
          const pitch = data.getUint8(offset++);
          const vel = data.getUint8(offset++);
          const timeSec = (currentTimeTicks / ticksPerBeat) * (usPerQuarter / 1000000);
          const noteKey = `${channel}_${pitch}`;

          if (eventType === 0x9 && vel > 0) {
            activeNotes.set(noteKey, { pitch, time: timeSec, velocity: vel / 127 });
          } else {
            if (activeNotes.has(noteKey)) {
              const startNote = activeNotes.get(noteKey);
              activeNotes.delete(noteKey);
              const duration = Math.max(0.08, timeSec - startNote.time);
              rawNotes.push({
                pitch: startNote.pitch,
                time: startNote.time,
                duration: duration,
                velocity: startNote.velocity
              });
            }
          }
        } else if (status === 0xFF) {
          if (offset >= trackEnd) break;
          const metaType = data.getUint8(offset++);
          let len = 0, b = 0;
          do {
            if (offset >= trackEnd) break;
            b = data.getUint8(offset++);
            len = (len << 7) | (b & 0x7f);
          } while (b & 0x80);

          if (metaType === 0x51 && len === 3 && offset + 3 <= trackEnd) {
            usPerQuarter = (data.getUint8(offset) << 16) | (data.getUint8(offset + 1) << 8) | data.getUint8(offset + 2);
          }
          offset += len;
        } else if (eventType === 0xC || eventType === 0xD) {
          offset += 1;
        } else if (eventType === 0xA || eventType === 0xB || eventType === 0xE) {
          offset += 2;
        } else if (status === 0xF0 || status === 0xF7) {
          let len = 0, b = 0;
          do {
            if (offset >= trackEnd) break;
            b = data.getUint8(offset++);
            len = (len << 7) | (b & 0x7f);
          } while (b & 0x80);
          offset += len;
        } else {
          offset++;
        }
      }
    }

    rawNotes.sort((a, b) => a.time - b.time);
    return this.processNotesToChart(rawNotes);
  }

  processNotesToChart(rawNotes) {
    if (!rawNotes || rawNotes.length === 0) {
      return { notes: [], bgmNotes: [], duration: 0, totalNotes: 0 };
    }

    // 1. FULL MIDI AUDIO TRACK: Keep 100% of raw notes for complete BGM music playback!
    const bgmNotes = rawNotes.map(n => ({
      pitch: n.pitch,
      time: n.time,
      duration: n.duration,
      velocity: n.velocity,
      played: false
    }));

    // 2. GAMEPLAY CHART NOTES: Filter down to clean, playable melody notes
    const chordWindow = 0.05;
    const filteredMelodyNotes = [];

    let currentGroup = [];
    let groupStartTime = -1;

    for (let i = 0; i < rawNotes.length; i++) {
      const note = rawNotes[i];
      if (groupStartTime < 0) {
        groupStartTime = note.time;
        currentGroup.push(note);
      } else if (Math.abs(note.time - groupStartTime) <= chordWindow) {
        currentGroup.push(note);
      } else {
        this.extractMelodyFromChordGroup(currentGroup, filteredMelodyNotes);
        groupStartTime = note.time;
        currentGroup = [note];
      }
    }

    if (currentGroup.length > 0) {
      this.extractMelodyFromChordGroup(currentGroup, filteredMelodyNotes);
    }

    // Difficulty Sampling Gap
    let minGap = 0.14;
    if (this.difficulty === 'easy') minGap = 0.24;
    else if (this.difficulty === 'hard') minGap = 0.08;

    const sampledNotes = [];
    let lastTime = -1;

    for (let i = 0; i < filteredMelodyNotes.length; i++) {
      const note = filteredMelodyNotes[i];
      if (lastTime < 0 || (note.time - lastTime) >= minGap) {
        sampledNotes.push(note);
        lastTime = note.time;
      }
    }

    // Lane Allocation
    let minPitch = 127, maxPitch = 0;
    sampledNotes.forEach(n => {
      if (n.pitch < minPitch) minPitch = n.pitch;
      if (n.pitch > maxPitch) maxPitch = n.pitch;
    });

    const range = Math.max(1, maxPitch - minPitch + 1);
    const gameNotes = [];
    let noteIdCounter = 1;

    sampledNotes.forEach(n => {
      const relativePitch = n.pitch - minPitch;
      let lane = Math.floor((relativePitch / range) * this.keyCount);
      lane = Math.max(0, Math.min(this.keyCount - 1, lane));

      const isHold = n.duration >= 0.35 && this.difficulty !== 'easy';

      gameNotes.push({
        id: noteIdCounter++,
        lane: lane,
        time: n.time,
        duration: n.duration,
        type: isHold ? 'hold' : 'tap',
        pitch: n.pitch,
        velocity: n.velocity || 0.8,
        hitState: 'pending',
        holdProgress: 0
      });
    });

    const totalDuration = rawNotes.length > 0 ? rawNotes[rawNotes.length - 1].time + 2 : 0;

    return {
      notes: gameNotes,
      bgmNotes: bgmNotes,
      duration: totalDuration,
      totalNotes: gameNotes.length
    };
  }

  extractMelodyFromChordGroup(group, targetArray) {
    if (group.length === 0) return;
    group.sort((a, b) => b.pitch - a.pitch);
    targetArray.push(group[0]);
    if (this.difficulty === 'hard' && group.length > 1 && (group[0].pitch - group[1].pitch) > 5) {
      targetArray.push(group[1]);
    }
  }

  getPresetChart(presetId = 'canon', laneCount = 4) {
    this.keyCount = laneCount;
    const rawNotes = [];

    if (presetId === 'canon') {
      const bpm = 90;
      const beatSec = 60 / bpm;
      const melody = [
        { p: 74, b: 0, d: 2 }, { p: 69, b: 2, d: 2 }, { p: 71, b: 4, d: 2 }, { p: 66, b: 6, d: 2 },
        { p: 67, b: 8, d: 2 }, { p: 62, b: 10, d: 2 }, { p: 67, b: 12, d: 2 }, { p: 69, b: 14, d: 2 },
        { p: 74, b: 16, d: 1 }, { p: 76, b: 17, d: 1 }, { p: 74, b: 18, d: 1 }, { p: 73, b: 19, d: 1 },
        { p: 71, b: 20, d: 1 }, { p: 73, b: 21, d: 1 }, { p: 74, b: 22, d: 1 }, { p: 71, b: 23, d: 1 },
        { p: 69, b: 24, d: 1 }, { p: 67, b: 25, d: 1 }, { p: 69, b: 26, d: 1 }, { p: 66, b: 27, d: 1 },
        { p: 67, b: 28, d: 1 }, { p: 69, b: 29, d: 1 }, { p: 67, b: 30, d: 1 }, { p: 66, b: 31, d: 1 }
      ];

      melody.forEach(item => {
        rawNotes.push({
          pitch: item.p,
          time: item.b * beatSec + 0.5,
          duration: item.d * beatSec,
          velocity: 0.85
        });

        // Add harmonizing bass notes for full Canon BGM experience
        rawNotes.push({
          pitch: item.p - 12,
          time: item.b * beatSec + 0.5,
          duration: item.d * beatSec,
          velocity: 0.5
        });
      });
    } else if (presetId === 'furelise') {
      const bpm = 130;
      const beatSec = 60 / bpm;
      const notes = [
        { p: 76, b: 0, d: 0.4 }, { p: 75, b: 0.5, d: 0.4 }, { p: 76, b: 1, d: 0.4 }, { p: 75, b: 1.5, d: 0.4 },
        { p: 76, b: 2, d: 0.4 }, { p: 71, b: 2.5, d: 0.4 }, { p: 74, b: 3, d: 0.4 }, { p: 72, b: 3.5, d: 0.4 },
        { p: 69, b: 4, d: 1.2 }, { p: 60, b: 5.5, d: 0.4 }, { p: 64, b: 6, d: 0.4 }, { p: 69, b: 6.5, d: 0.4 }
      ];

      notes.forEach(item => {
        rawNotes.push({
          pitch: item.p,
          time: item.b * beatSec + 0.5,
          duration: item.d * beatSec,
          velocity: 0.85
        });
      });
    }

    return this.processNotesToChart(rawNotes);
  }
}

window.midiParser = new MIDIParser();
