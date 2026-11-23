import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Lazy Gemini SDK initialization (server-side only)
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));

  // CORS for Capacitor Android WebView & hosted preview origins
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    const isAllowedOrigin =
      !origin ||
      origin === "https://localhost" ||
      origin === "http://localhost" ||
      origin === "capacitor://localhost" ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("https://localhost:") ||
      origin.endsWith(".run.app");

    if (origin && isAllowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });

  // 1. Healthcheck
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // 1b. Android APK metadata & direct download
  const apkFilePath = path.join(process.cwd(), "capitalyx-debug.apk");

  app.get("/api/apk/info", (_req, res) => {
    try {
      if (!fs.existsSync(apkFilePath)) {
        return res.json({ available: false });
      }
      const stat = fs.statSync(apkFilePath);
      return res.json({
        available: true,
        filename: "capitalyx-debug.apk",
        appId: "com.capitalyx.finance",
        version: "1.0.0-debug",
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        downloadUrl: "/api/apk/download",
      });
    } catch {
      return res.json({ available: false });
    }
  });

  app.get("/api/apk/download", (_req, res) => {
    if (!fs.existsSync(apkFilePath)) {
      return res.status(404).json({ error: "APK ainda não disponível no servidor." });
    }
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", 'attachment; filename="capitalyx-debug.apk"');
    return res.sendFile(apkFilePath);
  });

  // 2. Gemini AI Financial Insights Route
  app.post("/api/ai/insights", async (req, res) => {
    try {
      const { transactions = [], goals = [] } = req.body || {};
      const ai = getAI();

      if (!ai) {
        return res.status(503).json({
          error:
            "A chave GEMINI_API_KEY não está configurada no servidor. Verifique o painel Settings > Secrets.",
        });
      }

      if (!Array.isArray(transactions) || (transactions.length === 0 && (!Array.isArray(goals) || goals.length === 0))) {
        return res.status(400).json({
          error: "Adicione ao menos uma transação ou meta para gerar uma análise financeira.",
        });
      }

      const sortedTransactions = [...transactions].sort((a: any, b: any) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      );

      const simpleTransactions = sortedTransactions.slice(0, 50).map((t: any) => ({
        d: t.date,
        v: Number(t.amount) || 0,
        t: t.type,
        c: t.category,
        desc: String(t.description || "").slice(0, 100),
      }));

      const simpleGoals = (Array.isArray(goals) ? goals : []).slice(0, 20).map((g: any) => ({
        title: String(g.title || "").slice(0, 100),
        curr: Number(g.currentAmount) || 0,
        target: Number(g.targetAmount) || 0,
        dl: g.deadline,
        done: Boolean(g.isCompleted),
      }));

      const todayStr = new Date().toISOString().split("T")[0];
      const prompt = `Data de hoje: ${todayStr}.
Analise os dados financeiros JSON abaixo e forneça insights estratégicos em português do Brasil (PT-BR).

DADOS:
Transações (d=data, v=valor em BRL, t=tipo income/expense, c=categoria, desc=descrição): ${JSON.stringify(simpleTransactions)}
Metas: ${JSON.stringify(simpleGoals)}

REQUISITOS:
1. "summary": Visão geral objetiva do momento financeiro (máximo 25 palavras).
2. "savingsTip": Uma ação concreta de economia baseada nos maiores gastos reais.
3. "alert": Alerta curto se houver risco (ex: despesas superando receitas) ou null se estiver saudável.
4. "prediction": Previsão de saldo para o fim do mês com base no ritmo atual.
5. "cashFlowTip": Dica prática sobre liquidez e organização de fluxo de caixa.
6. "suggestedGoals": Array com 2 metas realistas sugeridas (title, targetAmount > 0, deadline futuro no formato YYYY-MM-DD).`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "Você é o Capitalyx AI, um consultor financeiro de elite focado em finanças pessoais no Brasil. Responda sempre em JSON válido e conciso em PT-BR.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              savingsTip: { type: Type.STRING },
              alert: { type: Type.STRING, nullable: true },
              prediction: { type: Type.STRING },
              cashFlowTip: { type: Type.STRING },
              suggestedGoals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    targetAmount: { type: Type.NUMBER },
                    deadline: { type: Type.STRING },
                  },
                  required: ["title", "targetAmount", "deadline"],
                },
              },
            },
            required: ["summary", "savingsTip", "prediction", "cashFlowTip", "suggestedGoals"],
          },
        },
      });

      const rawText = (response.text || "").trim();
      if (!rawText) {
        return res.status(502).json({
          error: "O modelo de IA retornou uma resposta vazia. Tente novamente.",
        });
      }

      let clean = rawText;
      if (clean.startsWith("```json")) {
        clean = clean.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (clean.startsWith("```")) {
        clean = clean.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(clean);
      return res.json({
        ...parsed,
        analyzedAt: Date.now(),
      });
    } catch (error: any) {
      console.error("Erro na geração de insights com Gemini no servidor:", error);
      const status = typeof error?.status === "number" ? error.status : 500;
      let userMessage = "Não foi possível gerar os insights financeiros no momento. Tente novamente.";
      if (status === 400 || status === 403) {
        userMessage = "Erro de autenticação com o serviço de IA. Verifique a chave em Settings > Secrets.";
      } else if (status === 429) {
        userMessage = "Limite temporário de requisições da IA atingido. Aguarde alguns instantes.";
      }
      return res.status(status >= 400 && status < 600 ? status : 500).json({
        error: userMessage,
      });
    }
  });

  // Vite middleware for development or static serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

startServer();
