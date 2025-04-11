import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/sse', async (req, res) => {
  const browserbase_api_key = req.query.browserbase_api_key;
  const browserbase_project_id = req.query.browserbase_project_id;
  const prompt = req.query.prompt || 'Hola, ¿en qué puedo ayudarte?';

  if (!browserbase_api_key || !browserbase_project_id) {
    res.status(400).json({ error: 'Faltan parámetros: api_key o project_id' });
    return;
  }

  // Encabezados necesarios para SSE
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
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: true
      }
    });

    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter((line) => line.trim() !== '');
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
          console.error('Error al parsear:', err.message);
        }
      }
    });

    response.data.on('end', () => {
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('Error en stream:', err.message);
      res.write(`event: error\ndata: ${err.message}\n\n`);
      res.end();
    });

    req.on('close', () => {
      console.log('Cliente cerró la conexión');
      res.end();
    });

  } catch (error) {
    console.error('Error al conectar con Browserbase:', error.message);
    res.status(500).json({ error: 'Error en el servidor de Browserbase' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor SSE con Browserbase corriendo en http://localhost:${PORT}/sse`);
});
