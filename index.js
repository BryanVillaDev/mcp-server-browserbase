// index.js
import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔹 GET /tools - Lista tools del proyecto
app.get('/tools', async (req, res) => {
  const { browserbase_api_key, browserbase_project_id } = req.query;

  if (!browserbase_api_key || !browserbase_project_id) {
    return res.status(400).json({ error: 'Faltan parámetros: api_key o project_id' });
  }

  try {
    const response = await axios.get(
      `https://api.browserbase.com/v1/projects/${browserbase_project_id}/tools`,
      {
        headers: {
          Authorization: `Bearer ${browserbase_api_key}`,
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error('Error al obtener tools:', err.message);
    res.status(500).json({ error: 'Error al listar herramientas' });
  }
});

// 🔹 GET /sse - Ejecuta tool y responde en tiempo real
app.get('/sse', async (req, res) => {
  const { browserbase_api_key, browserbase_project_id, tool_id } = req.query;

  if (!browserbase_api_key || !browserbase_project_id || !tool_id) {
    return res.status(400).json({ error: 'Faltan parámetros: api_key, project_id o tool_id' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
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
        tool_id,
        stream: true
      }
    });

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        if (line === 'data: [DONE]') {
          res.write(`event: done\ndata: [DONE]\n\n`);
          res.end();
          return;
        }

        const message = line.replace(/^data: /, '');
        try {
          const parsed = JSON.parse(message);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${content}\n\n`);
          }
        } catch (err) {
          console.error('Error parsing JSON:', err.message);
        }
      }
    });

    response.data.on('end', () => res.end());
    response.data.on('error', (err) => {
      console.error('Error en streaming:', err.message);
      res.write(`event: error\ndata: ${err.message}\n\n`);
      res.end();
    });

    req.on('close', () => {
      console.log('Cliente cerró la conexión');
      res.end();
    });

  } catch (err) {
    console.error('Error ejecutando tool:', err.message);
    res.status(500).json({ error: 'Error ejecutando herramienta' });
  }
});

// 🔹 POST /execute - Ejecuta tool y devuelve todo el resultado (sin streaming)
app.post('/execute', async (req, res) => {
  const { browserbase_api_key, browserbase_project_id, tool_id, messages } = req.body;

  if (!browserbase_api_key || !browserbase_project_id || !tool_id || !messages) {
    return res.status(400).json({ error: 'Faltan parámetros: api_key, project_id, tool_id o messages' });
  }

  try {
    const response = await axios({
      method: 'POST',
      url: 'https://api.browserbase.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${browserbase_api_key}`,
        'Content-Type': 'application/json'
      },
      data: {
        project_id: browserbase_project_id,
        tool_id,
        stream: false,
        messages
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error('Error en ejecución sin stream:', err.message);
    res.status(500).json({ error: 'Error al ejecutar la herramienta sin stream' });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 MCP Browserbase SSE corriendo en http://localhost:${PORT}`);
});
