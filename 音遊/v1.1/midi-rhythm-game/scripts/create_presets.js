const fs = require('fs');
const path = require('path');

const presetsDir = path.join(__dirname, '..', 'presets');
if (!fs.existsSync(presetsDir)) {
  fs.mkdirSync(presetsDir, { recursive: true });
}

// Write README for users
const readmeText = `================================================
Cyber Pulse MIDI — 內建曲目資料夾 (Presets Folder)
================================================

您可以在此資料夾放入任何 .mid 或 .midi 檔案！
遊戲開啟或選取「內建曲目」時，系統會自動掃描此資料夾內的所有 MIDI 檔案，
並出現在選單中供您隨時點選遊玩。

預設曲目檔案：
- canon.mid    (約翰·帕海貝爾 - 卡農 Canon in D)
- furelise.mid (貝多芬 - 致愛麗絲 Für Elise)
================================================
`;
fs.writeFileSync(path.join(presetsDir, 'README.txt'), readmeText, 'utf-8');

function createMidiFile(bpm, notes) {
  const ppq = 480;
  const tempoMicros = Math.round(60000000 / bpm);

  const track0Events = [];
  track0Events.push(0x00, 0xFF, 0x51, 0x03, (tempoMicros >> 16) & 0xFF, (tempoMicros >> 8) & 0xFF, tempoMicros & 0xFF);
  track0Events.push(0x00, 0xFF, 0x2F, 0x00);

  const track0Header = Buffer.from([
    0x4D, 0x54, 0x72, 0x6B,
    (track0Events.length >> 24) & 0xFF,
    (track0Events.length >> 16) & 0xFF,
    (track0Events.length >> 8) & 0xFF,
    track0Events.length & 0xFF
  ]);
  const track0Body = Buffer.from(track0Events);

  const midiEvents = [];
  const rawEvents = [];

  notes.forEach(n => {
    const startTick = Math.round(n.beat * ppq);
    const endTick = Math.round((n.beat + n.duration) * ppq);
    rawEvents.push({ tick: startTick, type: 0x90, pitch: n.pitch, vel: n.vel || 90 });
    rawEvents.push({ tick: endTick, type: 0x80, pitch: n.pitch, vel: 0 });
  });

  rawEvents.sort((a, b) => a.tick - b.tick);

  let lastTick = 0;
  function writeVarInt(val) {
    const bytes = [];
    let buffer = val & 0x7F;
    while (val >> 7) {
      val >>= 7;
      buffer <<= 8;
      buffer |= ((val & 0x7F) | 0x80);
    }
    while (true) {
      bytes.push(buffer & 0xFF);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return bytes;
  }

  rawEvents.forEach(e => {
    const delta = e.tick - lastTick;
    lastTick = e.tick;
    const varDelta = writeVarInt(delta);
    varDelta.forEach(b => midiEvents.push(b));
    midiEvents.push(e.type, e.pitch, e.vel);
  });

  midiEvents.push(0x00, 0xFF, 0x2F, 0x00);

  const track1Header = Buffer.from([
    0x4D, 0x54, 0x72, 0x6B,
    (midiEvents.length >> 24) & 0xFF,
    (midiEvents.length >> 16) & 0xFF,
    (midiEvents.length >> 8) & 0xFF,
    midiEvents.length & 0xFF
  ]);
  const track1Body = Buffer.from(midiEvents);

  const header = Buffer.from([
    0x4D, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x01,
    0x00, 0x02,
    (ppq >> 8) & 0xFF, ppq & 0xFF
  ]);

  return Buffer.concat([header, track0Header, track0Body, track1Header, track1Body]);
}

function generateCanonNotes() {
  const notes = [];
  const bassPitches = [38, 45, 47, 42, 43, 38, 43, 45];
  const bassHarm = [62, 57, 59, 54, 55, 50, 55, 57];
  
  const theme1 = [
    74, 73, 71, 69, 71, 69, 67, 66, 67, 66, 64, 62, 64, 66, 67, 69,
    74, 73, 71, 69, 71, 69, 67, 66, 67, 66, 64, 62, 59, 57, 59, 61
  ];
  
  const theme2 = [
    62, 61, 59, 57, 54, 55, 57, 59, 57, 55, 54, 52, 50, 52, 54, 55,
    57, 55, 54, 52, 55, 54, 52, 50, 49, 50, 52, 50, 49, 47, 49, 50
  ];

  for (let rep = 0; rep < 5; rep++) {
    for (let i = 0; i < 8; i++) {
      const bBeat = (rep * 8 + i) * 2;
      notes.push({ pitch: bassPitches[i], beat: bBeat, duration: 1.8, vel: 75 });
      notes.push({ pitch: bassHarm[i], beat: bBeat + 0.5, duration: 1.2, vel: 80 });
    }
  }

  let beat = 2;
  theme1.forEach(p => {
    notes.push({ pitch: p, beat, duration: 0.45, vel: 95 });
    beat += 0.5;
  });

  theme2.forEach(p => {
    notes.push({ pitch: p, beat, duration: 0.45, vel: 95 });
    beat += 0.5;
  });

  theme1.forEach(p => {
    notes.push({ pitch: p + 12, beat, duration: 0.42, vel: 100 });
    beat += 0.5;
  });

  return notes;
}

function generateFurEliseNotes() {
  const notes = [];
  const mainMotif = [
    76, 75, 76, 75, 76, 71, 74, 72, 69,
    60, 64, 69, 71,
    64, 68, 71, 72,
    64, 76, 75, 76, 75, 76, 71, 74, 72, 69
  ];

  const bassArp = [
    { pitches: [45, 57, 60], beat: 2 },
    { pitches: [40, 56, 59], beat: 5 },
    { pitches: [45, 57, 60], beat: 8 }
  ];

  let beat = 0.5;
  for (let rep = 0; rep < 3; rep++) {
    mainMotif.forEach(p => {
      notes.push({ pitch: p, beat, duration: 0.4, vel: 92 });
      beat += 0.5;
    });

    bassArp.forEach(b => {
      const baseB = rep * 16 + b.beat;
      b.pitches.forEach((bp, idx) => {
        notes.push({ pitch: bp, beat: baseB + idx * 0.5, duration: 1.2, vel: 75 });
      });
    });
  }

  return notes;
}

const canonBuffer = createMidiFile(100, generateCanonNotes());
fs.writeFileSync(path.join(presetsDir, 'canon.mid'), canonBuffer);

const furEliseBuffer = createMidiFile(132, generateFurEliseNotes());
fs.writeFileSync(path.join(presetsDir, 'furelise.mid'), furEliseBuffer);

console.log('Successfully created real MIDI preset files in ./presets/');
