import { NextRequest, NextResponse } from "next/server";

const HUBSPOT_API = "https://api.hubapi.com";

// Tipos
type DealProperties = {
  dealname?: string;
  amount?: string;
  dealstage?: string;
  closedate?: string;
  createdate?: string;
  hs_lastmodifieddate?: string;
  origem_do_lead?: string;
  closed_lost_reason?: string;
  email_do_consultor?: string;
};

type HubspotDeal = {
  id: string;
  properties: DealProperties;
};

type PipelineStage = {
  id: string;
  label: string;
  displayOrder: number;
};

// Busca todos os deals com Origem do Lead = Hub20 (com paginação)
async function fetchAllHub20Deals(token: string): Promise<HubspotDeal[]> {
  const allDeals: HubspotDeal[] = [];
  let after: string | undefined = undefined;
  let hasMore = true;
  let iterations = 0;
  const MAX_ITERATIONS = 50; // safety cap (até 5000 deals)

  while (hasMore && iterations < MAX_ITERATIONS) {
    iterations++;

    const body: any = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "origem_do_lead",
              operator: "EQ",
              value: "Hub20",
            },
          ],
        },
      ],
      properties: [
        "dealname",
        "amount",
        "dealstage",
        "closedate",
        "createdate",
        "hs_lastmodifieddate",
        "origem_do_lead",
        "closed_lost_reason",
        "email_do_consultor",
      ],
      limit: 100,
    };
    if (after) body.after = after;

    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HubSpot search error: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    allDeals.push(...(data.results || []));

    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      hasMore = false;
    }
  }

  return allDeals;
}

// Pra cada deal, busca os line items associados e retorna o map dealId -> [nomes]
// O "nome" do line item é o palestrante (modelo PSA: cada line item = 1 palestrante negociado).
async function fetchPalestrantesPorDeal(
  token: string,
  dealIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (dealIds.length === 0) return result;

  // 1) Associações deal -> line_items em lotes de 100
  const dealToLineItemIds = new Map<string, string[]>();
  for (let i = 0; i < dealIds.length; i += 100) {
    const chunk = dealIds.slice(i, i + 100);
    const res = await fetch(
      `${HUBSPOT_API}/crm/v4/associations/deals/line_items/batch/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: chunk.map((id) => ({ id })) }),
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`HubSpot associations error: ${res.status} - ${await res.text()}`);
    }
    const data = await res.json();
    for (const row of data.results || []) {
      const fromId = row.from?.id;
      const toIds = (row.to || []).map((t: any) => t.toObjectId?.toString()).filter(Boolean);
      if (fromId) dealToLineItemIds.set(fromId, toIds);
    }
  }

  // 2) Busca o `name` de todos os line items únicos em lotes de 100
  const allLineItemIds = Array.from(
    new Set(Array.from(dealToLineItemIds.values()).flat())
  );
  const lineItemNames = new Map<string, string>();
  for (let i = 0; i < allLineItemIds.length; i += 100) {
    const chunk = allLineItemIds.slice(i, i + 100);
    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/line_items/batch/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: ["name"],
        inputs: chunk.map((id) => ({ id })),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HubSpot line items error: ${res.status} - ${await res.text()}`);
    }
    const data = await res.json();
    for (const li of data.results || []) {
      const name = (li.properties?.name || "").trim();
      if (name) lineItemNames.set(li.id, name);
    }
  }

  // 3) Monta o map final dealId -> [nomes]
  for (const [dealId, liIds] of dealToLineItemIds.entries()) {
    const names = liIds.map((id) => lineItemNames.get(id)).filter((n): n is string => !!n);
    result.set(dealId, names);
  }
  return result;
}

// Busca todos os estágios do pipeline (pra montar o funil com nomes)
async function fetchPipelineStages(token: string): Promise<PipelineStage[]> {
  const res = await fetch(`${HUBSPOT_API}/crm/v3/pipelines/deals`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HubSpot pipelines error: ${res.status}`);
  }

  const data = await res.json();
  const stages: PipelineStage[] = [];
  for (const pipeline of data.results || []) {
    for (const stage of pipeline.stages || []) {
      stages.push({
        id: stage.id,
        label: stage.label,
        displayOrder: stage.displayOrder ?? 0,
      });
    }
  }
  return stages;
}

export async function GET(req: NextRequest) {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_TOKEN não configurado" },
      { status: 500 }
    );
  }

  const stageGanho = process.env.STAGE_GANHO || "1076664462";
  const stagePerdido = process.env.STAGE_PERDIDO || "1076664461";

  try {
    const [deals, stages] = await Promise.all([
      fetchAllHub20Deals(token),
      fetchPipelineStages(token),
    ]);

    // Palestrantes vêm dos line items associados a cada deal
    const palestrantesPorDeal = await fetchPalestrantesPorDeal(
      token,
      deals.map((d) => d.id)
    );

    // Mapa de stageId -> label
    const stageMap = new Map<string, { label: string; order: number }>();
    for (const s of stages) {
      stageMap.set(s.id, { label: s.label, order: s.displayOrder });
    }

    // Processa os deals
    const enriched = deals.map((d) => {
      const stageId = d.properties.dealstage || "";
      const stageInfo = stageMap.get(stageId);
      const amount = parseFloat(d.properties.amount || "0") || 0;
      const isGanho = stageId === stageGanho;
      const isPerdido = stageId === stagePerdido;
      const isFechado = isGanho || isPerdido;

      return {
        id: d.id,
        nome: d.properties.dealname || "Sem nome",
        valor: amount,
        stageId,
        stageLabel: stageInfo?.label || "Etapa desconhecida",
        stageOrder: stageInfo?.order ?? 999,
        dataCriacao: d.properties.createdate || null,
        dataFechamento: d.properties.closedate || null,
        palestrantes: palestrantesPorDeal.get(d.id) || [],
        motivoPerda: d.properties.closed_lost_reason || null,
        emailConsultor: d.properties.email_do_consultor || null,
        status: isGanho ? "ganho" : isPerdido ? "perdido" : "negociacao",
        isFechado,
      };
    });

    // Filtro de período (opcional)
    const periodo = req.nextUrl.searchParams.get("periodo") || "tudo";
    const filtered = filtrarPorPeriodo(enriched, periodo);

    // Métricas agregadas
    const total = filtered.length;
    const emNegociacao = filtered.filter((d) => d.status === "negociacao");
    const ganhos = filtered.filter((d) => d.status === "ganho");
    const perdidos = filtered.filter((d) => d.status === "perdido");

    const somaValores = (arr: typeof filtered) =>
      arr.reduce((acc, d) => acc + d.valor, 0);

    // Funil — agrupa deals por etapa (não-fechados + fechados)
    const funilMap = new Map<string, { label: string; order: number; count: number; valor: number }>();
    for (const d of filtered) {
      if (!funilMap.has(d.stageId)) {
        funilMap.set(d.stageId, {
          label: d.stageLabel,
          order: d.stageOrder,
          count: 0,
          valor: 0,
        });
      }
      const entry = funilMap.get(d.stageId)!;
      entry.count++;
      entry.valor += d.valor;
    }
    const funil = Array.from(funilMap.values()).sort((a, b) => a.order - b.order);

    // Taxa de conversão
    const totalFechados = ganhos.length + perdidos.length;
    const taxaConversao = totalFechados > 0 ? (ganhos.length / totalFechados) * 100 : 0;

    return NextResponse.json({
      atualizadoEm: new Date().toISOString(),
      periodo,
      resumo: {
        total,
        emNegociacao: {
          qtd: emNegociacao.length,
          valor: somaValores(emNegociacao),
        },
        ganhos: {
          qtd: ganhos.length,
          valor: somaValores(ganhos),
        },
        perdidos: {
          qtd: perdidos.length,
          valor: somaValores(perdidos),
        },
        taxaConversao,
      },
      funil,
      negocios: {
        emNegociacao: emNegociacao.sort((a, b) =>
          (b.dataCriacao || "").localeCompare(a.dataCriacao || "")
        ),
        ganhos: ganhos.sort((a, b) =>
          (b.dataFechamento || "").localeCompare(a.dataFechamento || "")
        ),
        perdidos: perdidos.sort((a, b) =>
          (b.dataFechamento || "").localeCompare(a.dataFechamento || "")
        ),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro desconhecido" },
      { status: 500 }
    );
  }
}

function filtrarPorPeriodo<T extends { dataFechamento: string | null; dataCriacao: string | null; status: string }>(
  deals: T[],
  periodo: string
): T[] {
  if (periodo === "tudo") return deals;

  const agora = new Date();
  let inicio: Date | null = null;

  if (periodo === "30d") {
    inicio = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (periodo === "90d") {
    inicio = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (periodo === "ano") {
    inicio = new Date(agora.getFullYear(), 0, 1);
  }

  if (!inicio) return deals;

  return deals.filter((d) => {
    // Usa data de fechamento se fechado, senão data de criação
    const ref = d.status === "negociacao" ? d.dataCriacao : d.dataFechamento;
    if (!ref) return true; // mantém se não tem data
    return new Date(ref) >= inicio!;
  });
}
