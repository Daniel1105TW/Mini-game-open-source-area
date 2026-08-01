/**
 * MIDIParser — @tonejs/midi based MIDI Parsing
 * 解析策略：
 *   bgmNotes = 全部音符（完整音樂播放）
 *   notes    = 挑選主旋律重要音符（玩家擊打對象）
 * 支援難度過濾、Hold 和 Roll 音符生成
 */
class MIDIParser {
  constructor() {
    this.difficulty = 'normal';
    this._diffSettings = {
      easy:   { maxNotesPerSec: 2.5, minInterval: 0.38, holdThreshold: 0.55, rollInterval: 0.2 },
      normal: { maxNotesPerSec: 5.0, minInterval: 0.18, holdThreshold: 0.35, rollInterval: 0.12 },
      hard:   { maxNotesPerSec: 9.0, minInterval: 0.08, holdThreshold: 0.25, rollInterval: 0.08 },
    };
  }

  setDifficulty(diff) {
    if (['easy','normal','hard'].includes(diff)) this.difficulty = diff;
  }

  /** ========================================================
   *  Preset song charts (programmatically generated)
   *  ======================================================== */
  getPresetChart(presetId, laneCount = 4) {
    const notes = [];
    const bgmNotes = [];
    const dur = presetId === 'canon' ? 124 : 80;

    if (presetId === 'canon') {
      this._generateCanon(notes, bgmNotes, laneCount);
    } else {
      this._generateFurElise(notes, bgmNotes, laneCount);
    }

    return {
      name: presetId === 'canon' ? 'Canon in D Major' : 'Für Elise',
      notes, bgmNotes,
      duration: dur,
      totalNotes: notes.length
    };
  }

  _generateCanon(notes, bgmNotes, laneCount) {
    // Canon chord progression: D A B F#m G D G A (in MIDI notes)
    const bassLine = [62,57,59,54,55,50,55,57]; // D A B F# G D G A (low)
    const melodyLine = [
      74,73,71,69,71,69,67,66,67,66,64,
      62,64,66,67,66,64,62,59,57,59,61,
      62,61,59,57,54,55,57,59,57,55,54,
      55,57,59,61,62,64,66,67,69,71,73,74,
    ];
    const tempo = 0.5; // seconds per beat
    const barLen = 4 * tempo;

    let t = 0.5;
    // BGM: bass line loops through song
    for (let rep = 0; rep < 30; rep++) {
      for (let i = 0; i < 8; i++) {
        bgmNotes.push({ pitch: bassLine[i], time: t + rep * barLen + i * tempo/2, duration: 0.45, velocity: 78 });
      }
    }

    // BGM: melody notes
    let mt = 1.5;
    for (let rep = 0; rep < 4; rep++) {
      for (const m of melodyLine) {
        bgmNotes.push({ pitch: m, time: mt, duration: 0.28, velocity: 95 });
        mt += 0.25;
      }
    }

    // Gameplay chart: exact timing aligned with melody bgmNotes
    const melodyNotesForGame = bgmNotes.filter(n => n.velocity === 95);
    const lastHit = new Array(laneCount).fill(-9);
    for (let idx = 0; idx < melodyNotesForGame.length; idx++) {
      const bgmN = melodyNotesForGame[idx];
      const lane = bgmN.pitch % laneCount;
      if (bgmN.time - lastHit[lane] < 0.15) continue;

      const isHold = (idx % 9 === 0);
      notes.push({
        lane,
        time: bgmN.time,
        type: isHold ? 'hold' : 'tap',
        duration: isHold ? 0.35 : 0,
        hitState: 'pending',
        rollHitCount: 0
      });
      lastHit[lane] = bgmN.time;
    }
  }

  _generateFurElise(notes, bgmNotes, laneCount) {
    // Für Elise main motif: E D# E D# E B D C A
    const motif = [76, 75, 76, 75, 76, 71, 74, 72, 69];
    const bassNotes = [45, 48, 52, 45, 48, 52]; // A minor arp

    let bt = 0.5;
    for (let rep = 0; rep < 20; rep++) {
      for (const b of bassNotes) {
        bgmNotes.push({ pitch: b, time: bt, duration: 0.38, velocity: 72 });
        bt += 0.28;
      }
    }

    let mt = 0.8;
    const fullMelody = [...motif, 69,60,64,67,72, ...motif.reverse(), 57,60,64,57];
    for (let rep = 0; rep < 5; rep++) {
      for (const m of fullMelody) {
        bgmNotes.push({ pitch: m, time: mt, duration: 0.22, velocity: 92 });
        mt += 0.22;
      }
    }

    // Gameplay chart: exact timing aligned with melody bgmNotes
    const melodyNotesForGame = bgmNotes.filter(n => n.velocity === 92);
    const lastHit = new Array(laneCount).fill(-9);
    for (let idx = 0; idx < melodyNotesForGame.length; idx++) {
      const bgmN = melodyNotesForGame[idx];
      const lane = bgmN.pitch % laneCount;
      if (bgmN.time - lastHit[lane] < 0.14) continue;

      const isHold = (idx % 12 === 0);
      notes.push({
        lane,
        time: bgmN.time,
        type: isHold ? 'hold' : 'tap',
        duration: isHold ? 0.3 : 0,
        hitState: 'pending',
        rollHitCount: 0
      });
      lastHit[lane] = bgmN.time;
    }
  }

  /** ========================================================
   *  Parse real MIDI buffer
   *  ======================================================== */
  async parseMidiBuffer(buffer, laneCount = 4, difficulty = null) {
    if (difficulty) this.difficulty = difficulty;
    const diff = this._diffSettings[this.difficulty] || this._diffSettings.normal;
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    let midi;
    try {
      midi = this._parseStandardMidi(uint8);
    } catch (error) {
      console.error('[MIDIParser] MIDI parse failed', error);
      throw error;
    }

    if (!midi || !Array.isArray(midi.notes)) {
      const error = new Error('MIDI 解析失敗：無法讀取音符資料');
      console.error('[MIDIParser] Invalid MIDI data', midi);
      throw error;
    }

    if (midi.notes.length === 0) {
      console.warn('[MIDIParser] MIDI parsed but contains no note events', midi);
    }

    const allEvents = midi.notes;
    const totalDuration = allEvents.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
    const bgmNotes = allEvents.map(n => ({ ...n, played: false }));
    const gameNotes = this._extractGameplayNotes(allEvents, laneCount, diff, totalDuration, midi.bpm || 120);

    return {
      notes: gameNotes,
      bgmNotes,
      duration: totalDuration + 2,
      totalNotes: gameNotes.length,
      bpm: midi.bpm || 120
    };
  }

  _parseStandardMidi(data) {
    let pos = 0;
    const len = data.length;

    const ensureAvailable = (n) => {
      if (pos + n > len) throw new Error('Unexpected end of MIDI data');
    };

    const readUint8 = () => {
      ensureAvailable(1);
      return data[pos++];
    };
    const readUint16 = () => (readUint8() << 8) | readUint8();
    const readUint32 = () => (readUint8() << 24) | (readUint8() << 16) | (readUint8() << 8) | readUint8();
    const readBytes = (n) => {
      ensureAvailable(n);
      const out = data.slice(pos, pos + n);
      pos += n;
      return out;
    };
    const readVarInt = () => {
      let value = 0;
      let b;
      while (pos < len) {
        b = readUint8();
        value = (value << 7) | (b & 0x7f);
        if ((b & 0x80) === 0) return value;
      }
      throw new Error('Malformed variable-length quantity');
    };
    const readString = (n) => String.fromCharCode(...readBytes(n));
    const readChunkType = () => {
      const chunk = readString(4);
      if (chunk.length !== 4) throw new Error('Invalid MIDI chunk header');
      return chunk;
    };

    if (readChunkType() !== 'MThd') throw new Error('Missing MIDI header');
    const headerSize = readUint32();
    if (headerSize < 6) throw new Error('Invalid MIDI header size');
    ensureAvailable(headerSize);

    const format = readUint16();
    const trackCount = readUint16();
    const division = readUint16();
    const ppq = division & 0x7fff;
    if (division & 0x8000) throw new Error('SMPTE timecode MIDI files are not supported');
    if (headerSize > 6) pos += headerSize - 6;

    const noteEvents = [];
    const openNotes = new Map();
    const tempoEvents = [{ tick: 0, microsecondsPerBeat: 500000 }];
    let bpm = 120;

    const addOpenNote = (trackId, channel, pitch, tick, velocity) => {
      const key = `${trackId}:${channel}:${pitch}`;
      if (!openNotes.has(key)) openNotes.set(key, []);
      openNotes.get(key).push({ tick, velocity });
    };

    const releaseOpenNote = (trackId, channel, pitch, tick) => {
      const key = `${trackId}:${channel}:${pitch}`;
      const stack = openNotes.get(key);
      if (!stack || !stack.length) return null;
      const opened = stack.pop();
      noteEvents.push({ pitch, startTick: opened.tick, endTick: tick, velocity: opened.velocity, trackId });
      return true;
    };

    const eventDataLength = (status) => {
      if (status >= 0x80 && status <= 0xef) {
        const eventType = status & 0xf0;
        return eventType === 0xc0 || eventType === 0xd0 ? 1 : 2;
      }
      if (status === 0xf1 || status === 0xf3) return 1;
      if (status === 0xf2) return 2;
      return 0;
    };

    let trackId = 0;
    let parsedTrackCount = 0;
    while (pos < len) {
      if (pos + 8 > len) break;
      const chunkType = readChunkType();
      const chunkSize = readUint32();
      if (pos + chunkSize > len) {
        throw new Error(`Invalid MIDI chunk size for ${chunkType}`);
      }
      const chunkEnd = pos + chunkSize;

      if (chunkType !== 'MTrk') {
        pos = chunkEnd;
        continue;
      }
      parsedTrackCount += 1;

      let currentTick = 0;
      let lastStatus = null;

      while (pos < chunkEnd) {
        const delta = readVarInt();
        currentTick += delta;

        let status = readUint8();
        if (status < 0x80) {
          if (lastStatus === null) throw new Error('MIDI running-status without previous status');
          pos -= 1;
          status = lastStatus;
        }

        if (status === 0xff) {
          const type = readUint8();
          const length = readVarInt();
          const metaData = readBytes(length);
          if (type === 0x2f) break;
          if (type === 0x51 && length === 3) {
            const tempo = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
            tempoEvents.push({ tick: currentTick, microsecondsPerBeat: tempo });
            bpm = Math.round(60000000 / tempo);
          }
          continue;
        }

        if (status === 0xf0 || status === 0xf7) {
          const size = readVarInt();
          pos += size;
          continue;
        }

        const eventType = status & 0xf0;
        const channel = status & 0x0f;
        const dataLen = eventDataLength(status);
        const param1 = dataLen >= 1 ? readUint8() : null;
        const param2 = dataLen === 2 ? readUint8() : null;

        if (eventType === 0x90 && param2 > 0) {
          addOpenNote(trackId, channel, param1, currentTick, param2);
          lastStatus = status;
          continue;
        }

        if (eventType === 0x80 || (eventType === 0x90 && param2 === 0)) {
          releaseOpenNote(trackId, channel, param1, currentTick);
          lastStatus = status;
          continue;
        }

        if (status >= 0x80 && status <= 0xef) {
          lastStatus = status;
          continue;
        }
      }

      for (const [key, stack] of openNotes.entries()) {
        if (!key.startsWith(`${trackId}:`)) continue;
        while (stack.length) {
          const opened = stack.pop();
          const pitch = Number(key.split(':')[2]);
          noteEvents.push({ pitch, startTick: opened.tick, endTick: currentTick, velocity: opened.velocity, trackId });
        }
      }

      pos = chunkEnd;
      trackId += 1;
    }

    tempoEvents.sort((a, b) => a.tick - b.tick);
    const tempoMap = [];
    let elapsedTime = 0;
    let currentTempo = tempoEvents[0].microsecondsPerBeat;
    let lastTick = tempoEvents[0].tick;
    tempoMap.push({ tick: lastTick, time: elapsedTime, microsecondsPerBeat: currentTempo });

    for (let i = 1; i < tempoEvents.length; i++) {
      const next = tempoEvents[i];
      const dt = next.tick - lastTick;
      elapsedTime += (dt * currentTempo) / ppq / 1000000;
      lastTick = next.tick;
      currentTempo = next.microsecondsPerBeat;
      tempoMap.push({ tick: lastTick, time: elapsedTime, microsecondsPerBeat: currentTempo });
    }

    const tickToSeconds = (tick) => {
      let index = tempoMap.length - 1;
      for (let i = tempoMap.length - 1; i >= 0; i--) {
        if (tick >= tempoMap[i].tick) {
          index = i;
          break;
        }
      }
      const base = tempoMap[index];
      return base.time + ((tick - base.tick) * base.microsecondsPerBeat) / ppq / 1000000;
    };

    const notes = noteEvents.map((note) => {
      const start = tickToSeconds(note.startTick);
      const end = tickToSeconds(note.endTick);
      return {
        pitch: note.pitch,
        time: start,
        duration: Math.max(0, end - start),
        velocity: note.velocity,
        trackId: note.trackId
      };
    });

    return { header: { format, trackCount, ppq }, notes, bpm };
  }

  /**
   * Smart melody extraction:
   * 1. Pick the most "melodic" track (highest avg pitch, most note variety)
   * 2. Sub-sample by difficulty density
   * 3. Assign to lanes by pitch modulo
   * 4. Detect long notes → Hold type, rapid sequences → Roll type
   */
  _extractGameplayNotes(allEvents, laneCount, diff, totalDuration, bpm) {
    if (!allEvents || !allEvents.length) return [];

    allEvents.sort((a, b) => a.time - b.time);

    const trackStats = new Map();
    for (const note of allEvents) {
      const track = trackStats.get(note.trackId) || {
        noteCount: 0,
        totalPitch: 0,
        totalVel: 0,
        uniquePitches: new Set(),
        firstTime: note.time,
        lastTime: note.time,
        longNoteCount: 0,
        pitchChanges: 0,
        lastNotePitch: null
      };
      track.noteCount += 1;
      track.totalPitch += note.pitch;
      track.totalVel += note.velocity;
      track.longNoteCount += note.duration >= 0.08 ? 1 : 0;
      track.uniquePitches.add(note.pitch);
      if (track.lastNotePitch !== null && Math.abs(track.lastNotePitch - note.pitch) >= 2) {
        track.pitchChanges += 1;
      }
      track.lastNotePitch = note.pitch;
      track.firstTime = Math.min(track.firstTime, note.time);
      track.lastTime = Math.max(track.lastTime, note.time);
      trackStats.set(note.trackId, track);
    }

    let melodyTrackId = null;
    if (trackStats.size > 1) {
      let bestScore = -Infinity;
      for (const [trackId, stats] of trackStats.entries()) {
        const duration = Math.max(0.001, stats.lastTime - stats.firstTime);
        const density = stats.noteCount / duration;
        const avgPitch = stats.totalPitch / stats.noteCount;
        const uniqueRatio = stats.uniquePitches.size / stats.noteCount;
        const velocityScore = stats.totalVel / stats.noteCount;
        const contourScore = stats.pitchChanges / Math.max(1, stats.noteCount);
        const longNoteRatio = stats.longNoteCount / Math.max(1, stats.noteCount);
        const score = density * 0.8 + avgPitch * 0.12 + uniqueRatio * 4.5 + velocityScore * 0.04 + contourScore * 0.6 + longNoteRatio * 0.6;
        if (score > bestScore) {
          bestScore = score;
          melodyTrackId = trackId;
        }
      }
    }

    let melodyPool = allEvents;
    if (melodyTrackId !== null) {
      const candidate = allEvents.filter(n => n.trackId === melodyTrackId && n.velocity >= 30);
      if (candidate.length >= Math.max(4, allEvents.length * 0.25)) {
        melodyPool = candidate;
      }
    }

    const pitches = melodyPool.map(n => n.pitch);
    const minPitch = Math.min(...pitches);
    const maxPitch = Math.max(...pitches);
    const pitchRange = Math.max(1, maxPitch - minPitch);

    const beatLength = 60 / Math.max(1, bpm);
    const quantizeStep = Math.max(0.04, beatLength / 3);
    const chordWindow = Math.min(0.16, quantizeStep * 1.4);
    const minNoteGap = Math.max(0.06, quantizeStep * 0.8);

    const groups = [];
    let currentGroup = [];
    for (const note of melodyPool) {
      if (!currentGroup.length || note.time - currentGroup[0].time <= chordWindow) {
        currentGroup.push(note);
      } else {
        groups.push(currentGroup);
        currentGroup = [note];
      }
    }
    if (currentGroup.length) groups.push(currentGroup);

    const quantizedNotes = [];
    let lastSelectedTime = -Infinity;
    for (const group of groups) {
      const selected = group.length === 1 ? group[0] : group.reduce((best, note) => {
        const score = note.pitch * 0.7 + note.velocity * 0.25 + note.duration * 14;
        return score > best.score ? { note, score } : best;
      }, { note: group[0], score: -Infinity }).note;
      const time = selected.time;
      if (time - lastSelectedTime < minNoteGap) continue;
      quantizedNotes.push({
        ...selected,
        time,
        duration: Math.max(selected.duration, minNoteGap * 0.75)
      });
      lastSelectedTime = time;
    }

    const laneTime = new Array(laneCount).fill(-99);
    const gameNotes = [];
    for (const note of quantizedNotes) {
      const relativePitch = (note.pitch - minPitch) / pitchRange;
      const lane = Math.min(laneCount - 1, Math.max(0, Math.round(relativePitch * (laneCount - 1))));
      const timeSinceLast = note.time - laneTime[lane];
      if (timeSinceLast < diff.minInterval) continue;
      laneTime[lane] = note.time;

      const type = note.duration >= diff.holdThreshold ? 'hold' : 'tap';
      gameNotes.push({
        lane,
        time: note.time,
        type,
        duration: note.duration,
        hitState: 'pending',
        rollHitCount: 0
      });
    }

    const densityWindow = 1.0;
    const minGlobalGap = 1.0 / Math.max(1, diff.maxNotesPerSec);
    const filteredNotes = [];
    let lastGlobalTime = -99;
    for (const note of gameNotes) {
      if (note.time - lastGlobalTime < minGlobalGap) continue;
      filteredNotes.push(note);
      lastGlobalTime = note.time;
    }

    for (let i = 0; i < filteredNotes.length - 2; i++) {
      const n1 = filteredNotes[i];
      const n2 = filteredNotes[i + 1];
      const n3 = filteredNotes[i + 2];
      if (n1.lane === n2.lane && n2.lane === n3.lane
          && n2.time - n1.time <= diff.rollInterval
          && n3.time - n2.time <= diff.rollInterval
          && n1.type === 'tap' && n2.type === 'tap' && n3.type === 'tap') {
        n1.type = 'roll';
        n2.type = 'roll';
        n3.type = 'roll';
      }
    }

    return filteredNotes;
  }
}

if (typeof window !== 'undefined') { window.midiParser = new MIDIParser(); }
