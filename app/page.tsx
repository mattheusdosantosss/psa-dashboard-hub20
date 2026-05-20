"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  AlertCircle,
  Trophy,
  XCircle,
  Briefcase,
  DollarSign,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type Negocio = {
  id: string;
  nome: string;
  valor: number;
  stageLabel: string;
  dataCriacao: string | null;
  dataFechamento: string | null;
  palestrantes: string[];
  motivoPerda: string | null;
  status: string;
};

type DashboardData = {
  atualizadoEm: string;
  periodo: string;
  resumo: {
    total: number;
    emNegociacao: { qtd: number; valor: number };
    ganhos: { qtd: number; valor: number };
    perdidos: { qtd: number; valor: number };
    taxaConversao: number;
  };
  funil: { label: string; count: number; valor: number; order: number }[];
  negocios: {
    emNegociacao: Negocio[];
    ganhos: Negocio[];
    perdidos: Negocio[];
  };
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const formatBRLCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("tudo");

  const fetchData = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await fetch(`/api/deals?periodo=${periodo}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erro ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [periodo]
  );

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => fetchData(true)} />;
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[var(--psa-cream)]">
      <Header
        atualizadoEm={data.atualizadoEm}
        onRefresh={() => fetchData(false)}
        refreshing={refreshing}
        periodo={periodo}
        setPeriodo={setPeriodo}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Cards de resumo */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total de negócios"
            value={data.resumo.total.toString()}
            icon={<Briefcase className="w-5 h-5" />}
            color="blue"
            delay={0}
          />
          <StatCard
            label="Em negociação"
            value={data.resumo.emNegociacao.qtd.toString()}
            sub={formatBRL(data.resumo.emNegociacao.valor)}
            icon={<TrendingUp className="w-5 h-5" />}
            color="orange"
            delay={50}
          />
          <StatCard
            label="Ganhos"
            value={data.resumo.ganhos.qtd.toString()}
            sub={formatBRL(data.resumo.ganhos.valor)}
            icon={<Trophy className="w-5 h-5" />}
            color="green"
            delay={100}
          />
          <StatCard
            label="Perdidos"
            value={data.resumo.perdidos.qtd.toString()}
            sub={formatBRL(data.resumo.perdidos.valor)}
            icon={<XCircle className="w-5 h-5" />}
            color="red"
            delay={150}
          />
        </section>

        {/* Taxa de conversão + Funil */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--psa-text)] uppercase tracking-wide">
                Taxa de conversão
              </h3>
              <BarChart3 className="w-5 h-5 text-[var(--psa-blue)]" />
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-bold text-[var(--psa-text)] font-['Plus_Jakarta_Sans']">
                {data.resumo.taxaConversao.toFixed(1)}
              </span>
              <span className="text-2xl font-bold text-[var(--psa-text)]">%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--psa-orange)] to-[var(--psa-orange-light)] transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(data.resumo.taxaConversao, 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-[var(--psa-text)] mt-3">
              Calculada sobre {data.resumo.ganhos.qtd + data.resumo.perdidos.qtd} negócios fechados
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--psa-text)] uppercase tracking-wide">
                Funil — negócios por etapa
              </h3>
              <Users className="w-5 h-5 text-[var(--psa-blue)]" />
            </div>
            {data.funil.length === 0 ? (
              <div className="py-12 text-center text-[var(--psa-text)]">
                Sem dados no período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.funil.map((f) => ({
                    etapa: f.label,
                    quantidade: f.count,
                    valor: f.valor,
                  }))}
                  margin={{ top: 10, right: 10, bottom: 30, left: 0 }}
                >
                  <XAxis
                    dataKey="etapa"
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <Tooltip
                    cursor={{ fill: "rgba(242, 101, 34, 0.06)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #eee",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: 13,
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "valor") return [formatBRL(value), "Valor"];
                      return [value, "Quantidade"];
                    }}
                  />
                  <Bar dataKey="quantidade" radius={[8, 8, 0, 0]}>
                    {data.funil.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i % 2 === 0 ? "#F26522" : "#1B3A6B"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Tabela: Em negociação */}
        <DealsTable
          title="Em negociação"
          icon={<TrendingUp className="w-5 h-5" />}
          deals={data.negocios.emNegociacao}
          columns={["Negócio", "Etapa", "Valor", "Criado em"]}
          renderRow={(d) => (
            <>
              <td className="px-4 py-3 font-medium">{d.nome}</td>
              <td className="px-4 py-3">
                <span className="inline-block px-2.5 py-1 rounded-full bg-[var(--psa-blue)]/10 text-[var(--psa-blue)] text-xs font-medium">
                  {d.stageLabel}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold text-[var(--psa-text)]">
                {formatBRL(d.valor)}
              </td>
              <td className="px-4 py-3 text-[var(--psa-text)]">
                {formatDate(d.dataCriacao)}
              </td>
            </>
          )}
          empty="Nenhum negócio em andamento no período."
        />

        {/* Tabela: Ganhos */}
        <DealsTable
          title="Negócios ganhos"
          icon={<Trophy className="w-5 h-5" />}
          deals={data.negocios.ganhos}
          columns={["Negócio", "Palestrantes", "Valor", "Data do ganho"]}
          renderRow={(d) => (
            <>
              <td className="px-4 py-3 font-medium">{d.nome}</td>
              <td className="px-4 py-3">
                <PalestrantesCell palestrantes={d.palestrantes} />
              </td>
              <td className="px-4 py-3 font-semibold text-green-700">
                {formatBRL(d.valor)}
              </td>
              <td className="px-4 py-3 text-[var(--psa-text)]">
                {formatDate(d.dataFechamento)}
              </td>
            </>
          )}
          empty="Nenhum negócio ganho no período."
          accent="green"
        />

        {/* Tabela: Perdidos */}
        <DealsTable
          title="Negócios perdidos"
          icon={<XCircle className="w-5 h-5" />}
          deals={data.negocios.perdidos}
          columns={["Negócio", "Palestrantes", "Valor", "Motivo", "Data da perda"]}
          renderRow={(d) => (
            <>
              <td className="px-4 py-3 font-medium">{d.nome}</td>
              <td className="px-4 py-3">
                <PalestrantesCell palestrantes={d.palestrantes} />
              </td>
              <td className="px-4 py-3 font-semibold text-[var(--psa-text)]">
                {formatBRL(d.valor)}
              </td>
              <td className="px-4 py-3 text-sm">
                {d.motivoPerda ? (
                  <span className="inline-block px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium">
                    {d.motivoPerda}
                  </span>
                ) : (
                  <span className="text-[var(--psa-text)]">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-[var(--psa-text)]">
                {formatDate(d.dataFechamento)}
              </td>
            </>
          )}
          empty="Nenhum negócio perdido no período."
          accent="red"
        />

        <footer className="text-center text-xs text-[var(--psa-text)] py-8">
          PSA · Dashboard Hub20 · Dados em tempo real do HubSpot
        </footer>
      </main>
    </div>
  );
}

// --- Componentes ---

function Header({
  atualizadoEm,
  onRefresh,
  refreshing,
  periodo,
  setPeriodo,
}: {
  atualizadoEm: string;
  onRefresh: () => void;
  refreshing: boolean;
  periodo: string;
  setPeriodo: (p: string) => void;
}) {
  const horaAtualizacao = new Date(atualizadoEm).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="bg-black border-b border-black sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="psa-logo text-4xl sm:text-5xl">PSA</h1>
          <p className="text-xs text-white mt-1">
            Dashboard Hub20 · atualizado às {horaAtualizacao}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--psa-text)] pointer-events-none" />
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-[var(--psa-text)] focus:outline-none focus:ring-2 focus:ring-[var(--psa-orange)]/30 focus:border-[var(--psa-orange)] cursor-pointer"
            >
              <option value="tudo">Todo o período</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="ano">Este ano</option>
            </select>
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--psa-orange)] hover:bg-[var(--psa-orange-dark)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: "orange" | "blue" | "green" | "red";
  delay?: number;
}) {
  const colors: Record<typeof color, { bg: string; text: string }> = {
    orange: { bg: "bg-orange-50", text: "text-[var(--psa-orange)]" },
    blue: { bg: "bg-blue-50", text: "text-[var(--psa-blue)]" },
    green: { bg: "bg-green-50", text: "text-green-700" },
    red: { bg: "bg-red-50", text: "text-red-700" },
  };
  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-fade-in opacity-0"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-[var(--psa-text)] uppercase tracking-wide">
          {label}
        </span>
        <span
          className={`w-9 h-9 rounded-lg ${colors[color].bg} ${colors[color].text} flex items-center justify-center`}
        >
          {icon}
        </span>
      </div>
      <div className="text-3xl font-bold text-[var(--psa-text)] font-['Plus_Jakarta_Sans']">
        {value}
      </div>
      {sub && (
        <div className="text-sm font-medium text-[var(--psa-text)] mt-1">
          {sub}
        </div>
      )}
    </div>
  );
}

function DealsTable({
  title,
  icon,
  deals,
  columns,
  renderRow,
  empty,
  accent = "orange",
}: {
  title: string;
  icon: React.ReactNode;
  deals: Negocio[];
  columns: string[];
  renderRow: (d: Negocio) => React.ReactNode;
  empty: string;
  accent?: "orange" | "green" | "red";
}) {
  const accentColors = {
    orange: "text-[var(--psa-orange)]",
    green: "text-green-700",
    red: "text-red-700",
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base font-bold text-[var(--psa-text)] font-['Plus_Jakarta_Sans'] flex items-center gap-2">
          <span className={accentColors[accent]}>{icon}</span>
          {title}
          <span className="text-sm font-medium text-[var(--psa-text)]">
            ({deals.length})
          </span>
        </h2>
      </div>
      {deals.length === 0 ? (
        <div className="py-12 text-center text-[var(--psa-text)] text-sm">
          {empty}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-4 py-3 text-left text-xs font-semibold text-[var(--psa-text)] uppercase tracking-wide"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                  {renderRow(d)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[var(--psa-cream)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--psa-orange)] to-[var(--psa-orange-dark)] flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 animate-pulse">
          P
        </div>
        <p className="text-[var(--psa-text)] text-sm">Carregando seus dados...</p>
      </div>
    </div>
  );
}

function PalestrantesCell({ palestrantes }: { palestrantes: string[] }) {
  if (palestrantes.length === 0) {
    return <span className="text-[var(--psa-text)]">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {palestrantes.map((p, i) => (
        <span
          key={`${p}-${i}`}
          className="inline-block px-2.5 py-1 rounded-full bg-[var(--psa-blue)]/10 text-[var(--psa-blue)] text-xs font-medium"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[var(--psa-cream)] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-[var(--psa-text)] mb-2 font-['Plus_Jakarta_Sans']">
          Erro ao carregar
        </h2>
        <p className="text-sm text-[var(--psa-text)] mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-[var(--psa-orange)] hover:bg-[var(--psa-orange-dark)] text-white font-medium text-sm transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

