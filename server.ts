import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'helios-cpp-studio' });
  });

  // Low-latency C++20 analyzer & physics advisor (gemini-3.1-flash-lite)
  app.post('/api/gemini/fast-cpp', async (req, res) => {
    try {
      const { caseTitle, cppCode, params } = req.body as {
        caseTitle?: string;
        cppCode?: string;
        params?: Record<string, number>;
      };
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Perform a concise, expert C++20 & SIMD optimization audit for "${caseTitle ?? 'Simulation'}" with parameters ${JSON.stringify(params ?? {})}.\n\nCode:\n${(cppCode ?? '').slice(0, 6000)}`,
        config: {
          systemInstruction:
            'You are a principal C++20/OpenGL graphics and numerical simulation engineer. Provide 3 concrete, actionable performance or numerical-stability recommendations in crisp markdown bullet points.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      res.json({ text: response.text ?? '' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to run fast C++ audit';
      res.status(500).json({ error: msg });
    }
  });

  // Concept explainer + Search Grounding / Maps Grounding (gemini-4-hydrogen)
  app.post('/api/gemini/explain', async (req, res) => {
    try {
      const { prompt, groundingMode, latLng } = req.body as {
        prompt?: string;
        groundingMode?: 'none' | 'search' | 'maps';
        latLng?: { latitude: number; longitude: number };
      };
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'Prompt is required.' });
      }
      const ai = getAiClient();
      const config: Record<string, unknown> = {
        systemInstruction:
          'You are an engineering professor and C++ graphics architect. Explain physics, math, and C++20/OpenGL simulation concepts clearly with intuitive analogies and rigorous equations.',
      };
      if (groundingMode === 'search') {
        config.tools = [{ googleSearch: {} }];
      } else if (groundingMode === 'maps') {
        config.tools = [{ googleMaps: {} }];
        if (latLng) {
          config.toolConfig = {
            retrievalConfig: {
              latLng: { latitude: latLng.latitude, longitude: latLng.longitude },
            },
          };
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config,
      });

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources: { title: string; uri: string; type: 'web' | 'maps' }[] = [];
      for (const chunk of rawChunks) {
        const c = chunk as {
          web?: { title?: string; uri?: string };
          maps?: { title?: string; uri?: string };
        };
        if (c.web?.uri) {
          sources.push({ title: c.web.title || c.web.uri, uri: c.web.uri, type: 'web' });
        }
        if (c.maps?.uri) {
          sources.push({ title: c.maps.title || 'Google Maps Location', uri: c.maps.uri, type: 'maps' });
        }
      }
      res.json({ text: response.text ?? '', sources });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to generate explanation';
      res.status(500).json({ error: msg });
    }
  });

  // Multi-turn Gemini chatbot
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { messages, context } = req.body as {
        messages?: { role: 'user' | 'model'; text: string }[];
        context?: string;
      };
      if (!messages?.length) {
        return res.status(400).json({ error: 'Messages are required.' });
      }
      const ai = getAiClient();
      const contents = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: `You are the Helios C++ 3D Studio engineering mentor. Help users understand 3D modeling, physics solvers, C++20/OpenGL code, and simulation case telemetry. Current studio context: ${context ?? 'General'}.`,
        },
      });
      res.json({ text: response.text ?? '' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Chat request failed';
      res.status(500).json({ error: msg });
    }
  });

  // Parse pasted technical document into structured simulation case (gemini-4-hydrogen)
  app.post('/api/gemini/parse-document', async (req, res) => {
    try {
      const { documentText } = req.body as { documentText?: string };
      if (!documentText?.trim()) {
        return res.status(400).json({ error: 'Document text is required.' });
      }
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Extract a structured 3D engineering simulation case from this document excerpt:\n\n${documentText.slice(0, 12000)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              domain: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              summary: { type: Type.STRING },
              cppClassName: { type: Type.STRING },
              governingEquation: { type: Type.STRING },
              equations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    formula: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                },
              },
              concepts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    heading: { type: Type.STRING },
                    body: { type: Type.STRING },
                    keyTakeaway: { type: Type.STRING },
                  },
                },
              },
              parameters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    key: { type: Type.STRING },
                    label: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    min: { type: Type.NUMBER },
                    max: { type: Type.NUMBER },
                    step: { type: Type.NUMBER },
                    defaultValue: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ parsed });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to parse document';
      res.status(500).json({ error: msg });
    }
  });

  // Concept TTS narration (gemini-3.8-flash-lite-tts)
  app.post('/api/gemini/tts', async (req, res) => {
    try {
      const { text, voiceName } = req.body as { text?: string; voiceName?: string };
      if (!text?.trim()) {
        return res.status(400).json({ error: 'Text is required for TTS.' });
      }
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.slice(0, 1500),
                speechMetadata: {
                  style: 'Clear, calm technical lecturer explaining engineering concepts',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return res.status(500).json({ error: 'No audio returned by TTS model.' });
      }
      res.json({ audioDataUrl: `data:audio/wav;base64,${base64Audio}` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'TTS generation failed';
      res.status(500).json({ error: msg });
    }
  });

  // Audio transcription (gemini-3.5-transcribe)
  app.post('/api/gemini/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body as { audioBase64?: string; mimeType?: string };
      if (!audioBase64) {
        return res.status(400).json({ error: 'Audio payload is required.' });
      }
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 } },
            { text: 'Transcribe this engineering query accurately.' },
          ],
        },
      });
      res.json({ transcript: response.text ?? '' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Transcription failed';
      res.status(500).json({ error: msg });
    }
  });

  // Multimodal image/frame understanding (gemini-4-hydrogen)
  app.post('/api/gemini/analyze-media', async (req, res) => {
    try {
      const { mediaBase64, mimeType, prompt } = req.body as {
        mediaBase64?: string;
        mimeType?: string;
        prompt?: string;
      };
      if (!mediaBase64) {
        return res.status(400).json({ error: 'Media payload is required.' });
      }
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType || 'image/png', data: mediaBase64 } },
            { text: prompt || 'Analyze this engineering diagram or 3D viewport capture and summarize key physical insights.' },
          ],
        },
      });
      res.json({ analysis: response.text ?? '' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Media analysis failed';
      res.status(500).json({ error: msg });
    }
  });

  // Server-side reCAPTCHA verification token issuer
  app.post('/api/recaptcha/verify', (req, res) => {
    const { challengeId, selectedId, expectedId } = req.body as {
      challengeId?: string;
      selectedId?: string;
      expectedId?: string;
    };
    if (!challengeId || !selectedId || selectedId !== expectedId) {
      return res.status(400).json({ verified: false, error: 'reCAPTCHA geometry verification failed.' });
    }
    const token = Buffer.from(`${challengeId}:${Date.now()}:verified`).toString('base64');
    res.json({ verified: true, token });
  });

  // Vite or static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // Real-time Gemini 3.8 Live voice conversation WebSocket bridge
  const wss = new WebSocketServer({ server, path: '/api/live' });
  wss.on('connection', async (clientWs: WebSocket) => {
    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    try {
      const ai = getAiClient();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are the live voice engineering tutor for Helios C++ 3D Studio. Keep spoken answers crisp, practical, and grounded in C++20, OpenGL, and physics simulation principles.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(JSON.stringify({ inputTranscript: content.inputTranscription.text }));
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(JSON.stringify({ outputTranscript: content.outputTranscription.text }));
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: unknown) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({ error: err instanceof Error ? err.message : 'Live session error' })
              );
            }
          },
        },
      });
    } catch (err) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({ error: err instanceof Error ? err.message : 'Unable to start Live API session' })
        );
      }
      clientWs.close();
      return;
    }

    clientWs.on('message', (raw) => {
      if (!session) return;
      try {
        const msg = JSON.parse(raw.toString()) as { audio?: string; text?: string };
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({ text: msg.text });
        }
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // Ignore close cleanup error
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Helios C++ 3D Studio listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
