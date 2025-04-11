// index.js
import express from 'express';
import cors from 'cors';
import { Browserbase } from 'browserbase';

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
    const bb = new Browserbase({ apiKey: browserbase_api_key });
    const tools = await bb.tools.list({ projectId: browserbase_project_id });
    res.json(tools);
  } catch (err) {
    console.error('❌ Error al obtener tools:', err);
    res.status(500).json({ error: 'Error al listar herramientas', detail: err.message });
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
    const bb = new Browserbase({ apiKey: browserbase_api_key });

    const stream = await bb.chat.completions.stream({
      projectId: browserbase_project_id,
      toolId: tool_id,
      messages: [{ role: 'user', content: 'Hola, ¿qué puedes hacer?' }]
    });

    stream.on('data', (chunk) => {
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

    stream.on('end', () => res.end());
    stream.on('error', (err) => {
      console.error('Error en streaming:', err.message);
      res.write(`event: error\ndata: ${err.message}\n\n`);
      res.end();
    });

    req.on('close', () => {
      console.log('Cliente cerró la conexión');
      res.end();
    });

  } catch (err) {
    console.error('Error ejecutando tool:', err);
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
    const bb = new Browserbase({ apiKey: browserbase_api_key });
    const result = await bb.chat.completions.create({
      projectId: browserbase_project_id,
      toolId: tool_id,
      stream: false,
      messages
    });

    res.json(result);
  } catch (err) {
    console.error('Error en ejecución sin stream:', err);
    res.status(500).json({ error: 'Error al ejecutar la herramienta sin stream' });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 MCP Browserbase SSE corriendo en http://localhost:${PORT}`);
});
