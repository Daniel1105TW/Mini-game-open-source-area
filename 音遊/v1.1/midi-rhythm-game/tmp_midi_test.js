const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('js/midi-parser.js', 'utf8');
const context = { window: {}, self: {}, console, Uint8Array };
vm.createContext(context);
vm.runInContext(code, context);
const MIDIParser = context.MIDIParser;
if (!MIDIParser) {
  console.error('MIDIParser not found');
  process.exit(1);
}
const parser = new MIDIParser();
function addVarInt(x) {
  const bytes = [];
  let buffer = x & 0x7f;
  x >>= 7;
  while (x > 0) {
    bytes.unshift(0x80 | buffer);
    buffer = x & 0x7f;
    x >>= 7;
  }
  bytes.unshift(buffer);
  return bytes;
}
function createMidi() {
  const data = [
    0x4d,0x54,0x68,0x64, 0x00,0x00,0x00,0x06, 0x00,0x00,0x00,0x01, 0x01,0xe0,
    0x4d,0x54,0x72,0x6b
  ];
  const events = [];
  events.push(...addVarInt(0));
  events.push(0xff,0x51,0x03,0x07,0xa1,0x20);
  events.push(...addVarInt(0));
  events.push(0x90,0x3c,0x40);
  events.push(...addVarInt(96));
  events.push(0x80,0x3c,0x40);
  events.push(...addVarInt(0));
  events.push(0xff,0x2f,0x00);
  const len = events.length;
  data.push((len>>24)&0xff, (len>>16)&0xff, (len>>8)&0xff, len&0xff);
  data.push(...events);
  return new Uint8Array(data);
}
const midiData = createMidi();
try {
  const result = parser._parseStandardMidi(midiData);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(e.stack || e);
}
