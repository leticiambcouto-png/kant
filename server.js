const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();

// Rewrite de path: proxy Kant adiciona prefixo /u/<id>/p/<port>/
const server = http.createServer((req, res) => {
  req.url = req.url.replace(/^\/u\/[^/]+\/p\/[^/]+/, '') || '/';
  app(req, res);
});

const wss = new WebSocketServer({ server });

// Dados
const DATA_FILE = path.join(__dirname, 'assinaturas.json');
let assinaturas = [];
if (fs.existsSync(DATA_FILE)) {
  try { assinaturas = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) {}
}

function salvar() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(assinaturas, null, 2));
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

function serveHtml(file, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(__dirname, 'public', file)));
}

// Middlewares
app.use(express.json());

// API
app.post('/api/assinar', (req, res) => {
  const { nome, valor } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  const entrada = {
    id: Date.now(),
    nome: nome.trim().toUpperCase(),
    valor: valor || 'AMBIÇÃO',
    ts: new Date().toISOString()
  };
  assinaturas.push(entrada);
  salvar();
  broadcast({ tipo: 'nova_assinatura', ...entrada });
  return res.json({ ok: true, ...entrada });
});

app.get('/api/assinaturas', (req, res) => {
  res.json(assinaturas);
});

app.delete('/api/assinaturas', (req, res) => {
  assinaturas = [];
  salvar();
  broadcast({ tipo: 'reset' });
  res.json({ ok: true });
});

// WebSocket
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ tipo: 'estado_inicial', assinaturas }));
});

// Páginas
app.get('/{*path}', (req, res) => {
  const p = req.path;
  if (p.endsWith('/telao') || p.endsWith('/telao/')) {
    return serveHtml('telao.html', res);
  }
  serveHtml('assinar.html', res);
});

const PORT = process.env.PORT || 9095;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Convocação rodando na porta ${PORT}`);
});
