// index.js
import express from 'express';
import cors from 'cors';
import { Browserbase } from '@browserbasehq/sdk';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 🔹 GET /tools - Lista tools del proyecto
app.get('/tools', async (req, res) => {
  const { browserbase_api_key, browserbase_project_id } = req.query;

  if (!browserbase_api_key || !browserbase_project_id) {
    return res.status(400).json({ error: 'Faltan parámetros: api_key o project_id' });
  }

  try {
    const bb = new Browserbase(browserbase_api_key);
    const tools = await bb.tools.list(browserbase_project_id);
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
    const bb = new Browserbase(browserbase_api_key);

    const stream = await bb.chat.stream({
      projectId: browserbase_project_id,
      toolId: tool_id,
      messages: [{ role: 'user', content: 'Hola, ¿qué puedes hacer?' }]
    });

    for await (const message of stream) {
      if (message === '[DONE]') {
        res.write(`event: done\ndata: [DONE]\n\n`);
        res.end();
        return;
      }

      const content = message?.choices?.[0]?.delta?.content;
      if (content) {
        res.write(`data: ${content}\n\n`);
      }
    }

    req.on('close', () => {
      console.log('Cliente cerró la conexión');
      res.end();
    });

  } catch (err) {
    console.error('Error ejecutando tool:', err);
    res.status(500).json({ error: 'Error ejecutando herramienta', detail: err.message });
  }
});

// 🔹 POST /execute - Ejecuta tool y devuelve todo el resultado
app.post('/execute', async (req, res) => {
  const { browserbase_api_key, browserbase_project_id, tool_id, messages } = req.body;

  if (!browserbase_api_key || !browserbase_project_id || !tool_id || !messages) {
    return res.status(400).json({ error: 'Faltan parámetros: api_key, project_id, tool_id o messages' });
  }

  try {
    const bb = new Browserbase(browserbase_api_key);

    const result = await bb.chat.run({
      projectId: browserbase_project_id,
      toolId: tool_id,
      messages
    });

    res.json(result);
  } catch (err) {
    console.error('Error en ejecución sin stream:', err);
    res.status(500).json({ error: 'Error al ejecutar la herramienta sin stream', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🧠 MCP Browserbase corriendo en http://localhost:${PORT}`);
});
