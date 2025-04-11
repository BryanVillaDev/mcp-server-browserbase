# 🧠 Browserbase SSE Server

Servidor SSE (Server-Sent Events) en Node.js que actúa como proxy para la API de Browserbase. Envía respuestas en tiempo real desde modelos como GPT-4 usando Browserbase y puede ser usado en proyectos MCP (Master Control Program).

---

## 🚀 Características

- Streaming de respuestas usando `EventSource` (SSE).
- Soporte para parámetros dinámicos vía URL (`prompt`, `browserbase_api_key`, `project_id`).
- Ideal para frontends o chats embebidos que requieren comunicación en tiempo real.

---

## 🛠️ Requisitos

- Node.js ≥ 18
- Una cuenta en [https://www.browserbase.com/](https://www.browserbase.com/)
- API Key y Project ID de Browserbase

---

## 📦 Instalación local

```bash
git clone https://github.com/tuusuario/browserbase-sse-server.git
cd browserbase-sse-server
npm install
npm start
