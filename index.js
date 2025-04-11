// index.js
import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
// Store active SSE sessions: session_id -> { res, heartbeat, browserbase_api_key, browserbase_project_id, openai_api_key }
const sessions = new Map();

// 🔹 GET /sse - Inicia conexión SSE (no ejecuta ninguna tool todavía)
app.get('/sse', (req, res) => {
  const { browserbase_api_key, browserbase_project_id, openai_api_key, session_id } = req.query;
  if (!browserbase_api_key || !browserbase_project_id || !openai_api_key || !session_id) {
    return res.status(400).json({ error: 'Faltan parámetros: browserbase_api_key, browserbase_project_id, openai_api_key o session_id' });
  }

  // Cabeceras SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // Heartbeat para mantener viva la conexión
  const heartbeat = setInterval(() => res.write(`:\n\n`), 30000);

  // Guardar sesión
  sessions.set(session_id, {
    res,
    heartbeat,
    browserbase_api_key,
    browserbase_project_id,
    openai_api_key
  });

  // Limpiar al desconectar
  req.on('close', () => {
    clearInterval(heartbeat);
    sessions.delete(session_id);
    res.end();
  });
});

// 🔹 POST /messages - Recibe mensajes de usuario y dispara streaming SSE
app.post('/messages', async (req, res) => {
  const { session_id, messages } = req.body;
  if (!session_id || !messages) {
    return res.status(400).json({ error: 'Faltan parámetros: session_id o messages' });
  }

  const session = sessions.get(session_id);
  if (!session) {
    return res.status(400).json({ error: 'session_id inválido o conexión SSE no iniciada' });
  }

  const { res: sseRes, heartbeat, browserbase_api_key, browserbase_project_id, openai_api_key } = session;

  try {
    // Llamada a Browserbase chat completions con streaming
    const response = await axios({
      method: 'POST',
      url: 'https://api.browserbase.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${browserbase_api_key}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      data: {
        project_id: browserbase_project_id,
        stream: true,
        openai_api_key,
        messages
      }
    });

    response.data.on('data', chunk => {
      const lines = chunk.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        if (line === 'data: [DONE]') {
          // Final del stream
          clearInterval(heartbeat);
          sseRes.write(`event: done\ndata: [DONE]\n\n`);
          sseRes.end();
          sessions.delete(session_id);
          return;
        }
        const msg = line.replace(/^data: /, '');
        try {
          const parsed = JSON.parse(msg);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            sseRes.write(`data: ${content}\n\n`);
          }
        } catch {};
      }
    });

    response.data.on('end', () => {
      clearInterval(heartbeat);
      sseRes.end();
      sessions.delete(session_id);
    });

    response.data.on('error', err => {
      clearInterval(heartbeat);
      sseRes.write(`event: error\ndata: ${err.message}\n\n`);
      sseRes.end();
      sessions.delete(session_id);
    });

    // Respuesta inmediata al cliente que envía el mensaje
    res.json({ status: 'streaming_started' });
  } catch (err) {
    console.error('Error en /messages:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error iniciando stream', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 MCP clon SSE corriendo en http://localhost:${PORT}`);
});
