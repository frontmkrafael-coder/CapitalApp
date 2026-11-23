import { Transaction, AIAnalysisResult, FinancialGoal } from "../types";
import { isNativePlatform, resolveApiUrl } from "./nativeAndroid";

/**
 * Solicita insights financeiros para a rota de backend (/api/ai/insights).
 * No APK Android nativo, resolve automaticamente para o servidor hospedado configurado.
 */
export const generateFinancialInsights = async (
  transactions: Transaction[],
  goals: FinancialGoal[] = []
): Promise<AIAnalysisResult> => {
  const endpoint = resolveApiUrl("/api/ai/insights");
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactions, goals }),
    });
  } catch {
    throw new Error(
      isNativePlatform()
        ? "Sem conexão com o servidor Capitalyx AI. Verifique sua internet ou a URL do servidor em Ajustes > Conta."
        : "Não foi possível conectar ao servidor de IA. Verifique sua conexão e tente novamente."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      `Erro no serviço de IA (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return {
    summary: data.summary || "Análise concluída.",
    savingsTip: data.savingsTip || "",
    alert: data.alert ?? null,
    prediction: data.prediction || "",
    cashFlowTip: data.cashFlowTip || "",
    suggestedGoals: Array.isArray(data.suggestedGoals) ? data.suggestedGoals : [],
    analyzedAt: data.analyzedAt || Date.now(),
  };
};
