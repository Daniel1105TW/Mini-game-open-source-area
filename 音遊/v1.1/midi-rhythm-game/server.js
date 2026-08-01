const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 1235;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi'
};

const server = http.createServer((req, res) => {
  if (req.url === '/api/presets') {
    const presetsDir = path.join(__dirname, 'presets');
    fs.readdir(presetsDir, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read presets directory' }));
        return;
      }
      const presets = files
        .filter(f => f.toLowerCase().endsWith('.mid') || f.toLowerCase().endsWith('.midi'))
        .map(file => {
          let name = file.replace(/\.(mid|midi)$/i, '');
          if (name.toLowerCase() === 'canon') name = '卡農 (Canon in D Major)';
          else if (name.toLowerCase() === 'furelise') name = '致愛麗絲 (Für Elise)';
          return {
            id: file,
            name: name,
            url: `presets/${file}`
          };
        });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(presets));
    });
    return;
  }

  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`MIDI Rhythm Game running at http://localhost:${PORT}`);
});
