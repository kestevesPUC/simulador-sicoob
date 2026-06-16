import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CIcon from '@coreui/icons-react';
import {
  cilBank, cilBuilding, cilCalculator, cilChart, cilChartLine,
  cilCloudDownload, cilDollar, cilGraph, cilMoney, cilReload,
  cilSettings, cilWallet, cilArrowThickFromBottom
} from '@coreui/icons';
import {
  CBadge, CButton, CCard, CCardBody, CCol, CContainer,
  CFormInput, CFormLabel, CHeader, CHeaderBrand, CInputGroup,
  CInputGroupText, CRow, CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow, CNav, CNavItem, CNavLink
} from '@coreui/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, LineChart, Line
} from 'recharts';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_REVENUE_BASE = 23000000;
const DEFAULT_PAYMENTS_BASE = 24000000;
const DEFAULT_RESULT_2026 = 15500000;

const STATIC = {
  indCondominiums: 46,
  indUnits: 1768,
  poolCondominiums: 217,
  poolUnits: 6445,
  costBoletagem: 1,
  tariffInd: 14,
  priceBoletagem: 1.7,
  depositRate: 0.0913,
  investmentRate: 0.096,
  depositRateio: 0.4,
  investmentRateio: 0.25,
  collectionRateio: 0.2,
  tariffPrice: 50,
  paymentTickets: 3750,
  paymentSpread: 0.2,
  contaDeposito: 102559246.79,
  contaInvestimento: 359016883.85,
  contaCobranca: 4339523.32,
  dist2024: 2751739.53,
  result2024: 11370764,
  dist2025: 1326211.7,
  result2025: 22876889,
};

const COLORS = {
  individual: '#007f5f',
  pool: '#2eb85c',
  secondary: '#6c757d',
  accent: '#f9a825',
  bg: '#f3f6f8',
  primary: '#007f5f',
};

const PIE_COLORS = ['#2eb85c', '#007f5f', '#00b8a9', '#f9a825', '#e74c3c', '#9b59b6'];

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (value, compact = false) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 2 }),
  }).format(Number.isFinite(value) ? value : 0);

const fmtPct = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number.isFinite(value) ? value : 0);

const fmtNum = (value) => new Intl.NumberFormat('pt-BR').format(value);

const tooltipFmt = (value) => fmt(value);

// ── Model ─────────────────────────────────────────────────────────────────────
function calculateModel(revenueBase, paymentsBase, result2026) {
  const base = Number(revenueBase) || 0;
  const pmtBase = Number(paymentsBase) || 0;
  const res2026 = Number(result2026) || 0;
  const totalUnits = STATIC.indUnits + STATIC.poolUnits;

  const faturamentoInd = (base / 3 / totalUnits) * STATIC.indUnits;
  const faturamentoPool = (base / 3 / totalUnits) * STATIC.poolUnits;
  const pagamentosInd = (pmtBase / 3 / totalUnits) * STATIC.indUnits;
  const pagamentosPool = (pmtBase / 3 / totalUnits) * STATIC.poolUnits;

  const dist2026 =
    ((STATIC.dist2024 + STATIC.dist2025) / (STATIC.result2024 + STATIC.result2025)) * res2026;

  const predialDep = faturamentoPool * STATIC.depositRate;
  const predialInv = faturamentoPool * STATIC.investmentRate;
  const predialCob = STATIC.costBoletagem * STATIC.poolUnits;

  const pctDep = predialDep / (STATIC.contaDeposito + predialDep);
  const pctInv = predialInv / (STATIC.contaInvestimento + predialInv);
  const pctCob = predialCob / (STATIC.contaCobranca + predialCob);

  const rows = [
    {
      group: 'Boletagem',
      metric: 'Preço atribuído',
      rate: `R$ ${STATIC.priceBoletagem.toFixed(2)}/un`,
      indMonthly: (STATIC.priceBoletagem - STATIC.costBoletagem) * STATIC.indUnits,
      poolMonthly: (STATIC.priceBoletagem - STATIC.costBoletagem) * STATIC.poolUnits,
    },
    {
      group: 'Boletagem',
      metric: 'Emissão (Distribuição de resultado)',
      rate: `${(pctCob * 100).toFixed(4)}% da cobrança`,
      indMonthly: 0,
      poolMonthly: dist2026 * STATIC.collectionRateio * pctCob,
    },
    {
      group: 'Depósito à vista',
      metric: 'Saldo médio (Distribuição de resultado)',
      rate: `${(STATIC.depositRate * 100).toFixed(2)}% do faturamento`,
      indMonthly: 0,
      poolMonthly: dist2026 * STATIC.depositRateio * pctDep,
    },
    {
      group: 'Investimento',
      metric: 'Saldo médio (Distribuição de resultado)',
      rate: `${(STATIC.investmentRate * 100).toFixed(2)}% x faturamento`,
      indMonthly: 0,
      poolMonthly: dist2026 * STATIC.investmentRateio * pctInv,
    },
    {
      group: 'Pagamentos',
      metric: 'Boletos',
      rate: `${STATIC.paymentTickets} boletos × ${(STATIC.paymentSpread * 100).toFixed(0)}%`,
      indMonthly: 0,
      poolMonthly: STATIC.paymentTickets * STATIC.paymentSpread,
    },
    {
      group: 'Tarifa',
      metric: 'Preço',
      rate: `R$ ${STATIC.tariffPrice}/cond. (ind)`,
      indMonthly: (STATIC.tariffPrice - STATIC.tariffInd) * STATIC.indCondominiums,
      poolMonthly: 0,
    },
  ];

  const enriched = rows.map((r) => ({
    ...r,
    indQuarterly: r.indMonthly * 3,
    poolQuarterly: r.poolMonthly * 3,
    indAnnual: r.indMonthly * 12,
    poolAnnual: r.poolMonthly * 12,
    monthlyTotal: r.indMonthly + r.poolMonthly,
    quarterlyTotal: (r.indMonthly + r.poolMonthly) * 3,
    annualTotal: (r.indMonthly + r.poolMonthly) * 12,
  }));

  const sum = (fn) => enriched.reduce((t, r) => t + fn(r), 0);
  const totals = {
    indMonthly: sum((r) => r.indMonthly),
    poolMonthly: sum((r) => r.poolMonthly),
    indQuarterly: sum((r) => r.indQuarterly),
    poolQuarterly: sum((r) => r.poolQuarterly),
    indAnnual: sum((r) => r.indAnnual),
    poolAnnual: sum((r) => r.poolAnnual),
    monthlyTotal: sum((r) => r.monthlyTotal),
    quarterlyTotal: sum((r) => r.quarterlyTotal),
    annualTotal: sum((r) => r.annualTotal),
  };

  const resultados = [
    {
      conta: 'Depósito à vista',
      rateio: STATIC.depositRateio,
      valor: STATIC.contaDeposito,
      predial: predialDep,
      pct: pctDep,
    },
    {
      conta: 'Investimento',
      rateio: STATIC.investmentRateio,
      valor: STATIC.contaInvestimento,
      predial: predialInv,
      pct: pctInv,
    },
    {
      conta: 'Cobrança',
      rateio: STATIC.collectionRateio,
      valor: STATIC.contaCobranca,
      predial: predialCob,
      pct: pctCob,
    },
  ];

  return {
    faturamentoInd, faturamentoPool,
    pagamentosInd, pagamentosPool,
    dist2026, res2026,
    predialDep, predialInv, predialCob,
    rows: enriched,
    totals,
    resultados,
    totalPredialAnual: predialDep + predialInv + predialCob,
  };
}

// ── Subcomponents ─────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = 'primary' }) {
  return (
    <CCol sm={6} xl={3}>
      <CCard className="h-100 kpi-card border-0 shadow-sm">
        <CCardBody className="d-flex align-items-center gap-3 p-3">
          <div className={`kpi-icon text-${color}`} style={{ background: color === 'success' ? '#e8f6f1' : color === 'primary' ? '#e0f0ea' : color === 'info' ? '#e0f5ff' : '#fff8e1' }}>
            <CIcon icon={icon} size="xl" />
          </div>
          <div className="min-w-0 flex-grow-1">
            <div className="text-medium-emphasis small fw-semibold">{label}</div>
            <div className="kpi-value fw-bold fs-5 text-dark">{value}</div>
            {sub && <div className="text-medium-emphasis" style={{ fontSize: '0.75rem' }}>{sub}</div>}
          </div>
        </CCardBody>
      </CCard>
    </CCol>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="d-flex align-items-center gap-2 mb-3">
      <div className="section-icon">
        <CIcon icon={icon} size="sm" />
      </div>
      <div>
        <div className="section-title fw-bold">{title}</div>
        {subtitle && <div className="text-medium-emphasis" style={{ fontSize: '0.8rem' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="fw-bold mb-1" style={{ color: '#1b2a33' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="mb-0" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
function usePersistedParams() {
  const [revenueBase, setRevenueBase] = useState(0);
  const [paymentsBase, setPaymentsBase] = useState(0);
  const [result2026, setResult2026] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | saving | error
  const debounceRef = useRef(null);

  useEffect(() => {
    fetch('/api/params')
      .then((r) => r.json())
      .then((data) => {
        setRevenueBase(Number(data.revenue_base) || 0);
        setPaymentsBase(Number(data.payments_base) || 0);
        setResult2026(Number(data.result_2026) || 0);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  const persist = useCallback((revenue, payments, res2026) => {
    clearTimeout(debounceRef.current);
    setStatus('saving');
    debounceRef.current = setTimeout(() => {
      fetch('/api/params', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revenue_base: revenue, payments_base: payments, result_2026: res2026 }),
      })
        .then(() => setStatus('ready'))
        .catch(() => setStatus('error'));
    }, 800);
  }, []);

  const set = useCallback((field, value) => {
    const next = { revenue: revenueBase, payments: paymentsBase, res2026: result2026, [field]: value };
    if (field === 'revenue') setRevenueBase(value);
    if (field === 'payments') setPaymentsBase(value);
    if (field === 'res2026') setResult2026(value);
    persist(next.revenue, next.payments, next.res2026);
  }, [revenueBase, paymentsBase, result2026, persist]);

  const reset = useCallback(() => {
    setRevenueBase(DEFAULT_REVENUE_BASE);
    setPaymentsBase(DEFAULT_PAYMENTS_BASE);
    setResult2026(DEFAULT_RESULT_2026);
    persist(DEFAULT_REVENUE_BASE, DEFAULT_PAYMENTS_BASE, DEFAULT_RESULT_2026);
  }, [persist]);

  return { revenueBase, paymentsBase, result2026, status, set, reset };
}

const STATUS_LABEL = { loading: 'Carregando...', saving: 'Salvando...', ready: 'Salvo', error: 'Erro ao salvar' };
const STATUS_COLOR = { loading: 'secondary', saving: 'warning', ready: 'success', error: 'danger' };

export default function App() {
  const { revenueBase, paymentsBase, result2026, status, set, reset } = usePersistedParams();
  const [activeTab, setActiveTab] = useState('ganhos');

  const m = useMemo(
    () => calculateModel(revenueBase, paymentsBase, result2026),
    [revenueBase, paymentsBase, result2026]
  );

  const barData = m.rows.map((r) => ({
    name: r.group,
    Individual: r.indAnnual,
    Pool: r.poolAnnual,
  }));

  const pieData = m.rows
    .filter((r) => r.annualTotal > 0)
    .map((r) => ({ name: r.group, value: r.annualTotal }));

  const periodData = [
    { period: 'Mensal', Individual: m.totals.indMonthly, Pool: m.totals.poolMonthly, Total: m.totals.monthlyTotal },
    { period: 'Trimestral', Individual: m.totals.indQuarterly, Pool: m.totals.poolQuarterly, Total: m.totals.quarterlyTotal },
    { period: 'Anual', Individual: m.totals.indAnnual, Pool: m.totals.poolAnnual, Total: m.totals.annualTotal },
  ];

  const exportCsv = () => {
    const headers = ['Grupo', 'Métrica', 'Mensal Ind', 'Mensal Pool', 'Mensal Total', 'Trim. Ind', 'Trim. Pool', 'Trim. Total', 'Anual Ind', 'Anual Pool', 'Anual Total'];
    const rows = m.rows.map((r) => [r.group, r.metric, r.indMonthly, r.poolMonthly, r.monthlyTotal, r.indQuarterly, r.poolQuarterly, r.quarterlyTotal, r.indAnnual, r.poolAnnual, r.annualTotal]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'simulacao-predial.csv';
    a.click();
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <CHeader className="app-header">
        <CContainer fluid className="header-inner">
          <CHeaderBrand className="brand-mark">
            <span className="brand-symbol"><CIcon icon={cilBank} /></span>
            <span>Sicoob</span>
            <span className="brand-sub">Auxiliadora Predial</span>
          </CHeaderBrand>
          <div className="d-flex align-items-center gap-2">
            <CBadge color="success" shape="rounded-pill" className="env-badge">
              Simulador
            </CBadge>
          </div>
        </CContainer>
      </CHeader>

      <main className="main-content">
        <CContainer fluid="xl">

          {/* Hero + Parameters */}
          <CRow className="g-4 mb-4">
            <CCol lg={8}>
              <div className="hero-panel">
                <div className="hero-eyebrow">Modelo baseado na planilha Predial.xlsx</div>
                <h1 className="hero-title">Simulador de Ganhos<br /><span>Auxiliadora Predial</span></h1>
                <p className="hero-desc">
                  Ajuste os parâmetros e acompanhe automaticamente o impacto nos ganhos mensais,
                  trimestrais e anuais por modalidade Individual e Pool.
                </p>
              </div>
            </CCol>
            <CCol lg={4}>
              <CCard className="param-card border-0 shadow-sm h-100">
                <CCardBody className="p-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="fw-bold" style={{ color: '#007f5f' }}>⚙ Parâmetros Dinâmicos</div>
                    <div className="d-flex align-items-center gap-2">
                      <CBadge color={STATUS_COLOR[status]} shape="rounded-pill" style={{ fontSize: '0.7rem' }}>
                        {STATUS_LABEL[status]}
                      </CBadge>
                      <CButton color="secondary" variant="outline" size="sm" onClick={reset}
                        disabled={status === 'loading'}>
                        <CIcon icon={cilReload} className="me-1" />Restaurar
                      </CButton>
                    </div>
                  </div>

                  <CFormLabel className="small fw-semibold mb-1">Base Faturamento</CFormLabel>
                  <CInputGroup className="mb-3">
                    <CInputGroupText>R$</CInputGroupText>
                    <CFormInput type="number" min="0" step="1000000" value={revenueBase}
                      disabled={status === 'loading'}
                      onChange={(e) => set('revenue', Number(e.target.value) || 0)} />
                  </CInputGroup>

                  <CFormLabel className="small fw-semibold mb-1">Base Pagamentos</CFormLabel>
                  <CInputGroup className="mb-3">
                    <CInputGroupText>R$</CInputGroupText>
                    <CFormInput type="number" min="0" step="1000000" value={paymentsBase}
                      disabled={status === 'loading'}
                      onChange={(e) => set('payments', Number(e.target.value) || 0)} />
                  </CInputGroup>

                  <CFormLabel className="small fw-semibold mb-1">Resultado 2026</CFormLabel>
                  <CInputGroup>
                    <CInputGroupText>R$</CInputGroupText>
                    <CFormInput type="number" min="0" step="1000000" value={result2026}
                      disabled={status === 'loading'}
                      onChange={(e) => set('res2026', Number(e.target.value) || 0)} />
                  </CInputGroup>

                  <div className="mt-3 p-2 rounded" style={{ background: '#f0faf5', fontSize: '0.78rem', color: '#5a7a6e' }}>
                    <strong>Distribuição 2026 calculada:</strong> {fmt(m.dist2026)}
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          {/* KPI Cards */}
          <CRow className="g-3 mb-4">
            <KpiCard icon={cilMoney} label="Ganho Anual Total" value={fmt(m.totals.annualTotal, true)}
              sub={fmt(m.totals.annualTotal)} color="success" />
            <KpiCard icon={cilWallet} label="Ganho Mensal" value={fmt(m.totals.monthlyTotal, true)}
              sub={`Trim: ${fmt(m.totals.quarterlyTotal, true)}`} color="primary" />
            <KpiCard icon={cilBuilding} label="Condomínios / Unidades"
              value={`${fmtNum(STATIC.indCondominiums + STATIC.poolCondominiums)} cond.`}
              sub={`${fmtNum(STATIC.indUnits + STATIC.poolUnits)} unidades`} color="info" />
            <KpiCard icon={cilGraph} label="Participação Pool"
              value={`${((m.totals.poolAnnual / m.totals.annualTotal) * 100).toFixed(1)}%`}
              sub="do ganho anual total" color="warning" />
          </CRow>

          {/* Navigation Tabs */}
          <CNav variant="tabs" className="mb-0 app-tabs">
            {[
              { id: 'ganhos', label: 'Ganhos Detalhados', icon: cilCalculator },
              { id: 'graficos', label: 'Gráficos', icon: cilChart },
              { id: 'simulacao', label: 'Simulação', icon: cilSettings },
              { id: 'resultados', label: 'Resultados Predial', icon: cilChartLine },
            ].map((tab) => (
              <CNavItem key={tab.id}>
                <CNavLink active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} style={{ cursor: 'pointer' }}>
                  <CIcon icon={tab.icon} className="me-2" />{tab.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          <div className="tab-content-panel">

            {/* ── TAB: Ganhos ── */}
            {activeTab === 'ganhos' && (
              <CCard className="border-0 border-top-0 shadow-sm">
                <CCardBody>
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                    <SectionHeader icon={cilDollar} title="GANHOS AUXILIADORA PREDIAL"
                      subtitle="Calculado a partir das fórmulas da planilha Predial.xlsx" />
                    <CButton color="secondary" variant="outline" size="sm"
                      className="d-inline-flex align-items-center gap-2" onClick={exportCsv}>
                      <CIcon icon={cilCloudDownload} />Exportar CSV
                    </CButton>
                  </div>

                  <div className="table-responsive">
                    <CTable hover borderless className="result-table mb-0">
                      <CTableHead>
                        <CTableRow className="table-header-row">
                          <CTableHeaderCell rowSpan={2} className="align-middle">Categoria</CTableHeaderCell>
                          <CTableHeaderCell rowSpan={2} className="align-middle">Métrica</CTableHeaderCell>
                          <CTableHeaderCell colSpan={3} className="text-center period-header">Mensal</CTableHeaderCell>
                          <CTableHeaderCell colSpan={3} className="text-center period-header">Trimestral</CTableHeaderCell>
                          <CTableHeaderCell colSpan={3} className="text-center period-header annual-header">Anual</CTableHeaderCell>
                        </CTableRow>
                        <CTableRow className="table-subheader-row">
                          {['Individual', 'Pool', 'Total', 'Individual', 'Pool', 'Total', 'Individual', 'Pool', 'Total'].map((h, i) => (
                            <CTableHeaderCell key={i} className={`text-end ${i >= 6 ? 'annual-col' : ''}`}>{h}</CTableHeaderCell>
                          ))}
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {(() => {
                          const groups = [...new Set(m.rows.map((r) => r.group))];
                          return groups.flatMap((group) => {
                            const groupRows = m.rows.filter((r) => r.group === group);
                            return groupRows.map((row, idx) => (
                              <CTableRow key={`${row.group}-${row.metric}`} className="data-row">
                                {idx === 0 && (
                                  <CTableDataCell rowSpan={groupRows.length} className="group-cell align-middle">
                                    <CBadge className="group-badge">{row.group}</CBadge>
                                  </CTableDataCell>
                                )}
                                <CTableDataCell className="metric-cell">{row.metric}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell">{fmt(row.indMonthly)}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell">{fmt(row.poolMonthly)}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell fw-semibold">{fmt(row.monthlyTotal)}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell">{fmt(row.indQuarterly)}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell">{fmt(row.poolQuarterly)}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell fw-semibold">{fmt(row.quarterlyTotal)}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell annual-col">{fmt(row.indAnnual)}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell annual-col">{fmt(row.poolAnnual)}</CTableDataCell>
                                <CTableDataCell className="text-end num-cell annual-col fw-bold text-success">{fmt(row.annualTotal)}</CTableDataCell>
                              </CTableRow>
                            ));
                          });
                        })()}
                        <CTableRow className="total-row">
                          <CTableDataCell colSpan={2} className="fw-bold">TOTAL</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold">{fmt(m.totals.indMonthly)}</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold">{fmt(m.totals.poolMonthly)}</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold total-highlight">{fmt(m.totals.monthlyTotal)}</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold">{fmt(m.totals.indQuarterly)}</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold">{fmt(m.totals.poolQuarterly)}</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold total-highlight">{fmt(m.totals.quarterlyTotal)}</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold annual-col">{fmt(m.totals.indAnnual)}</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold annual-col">{fmt(m.totals.poolAnnual)}</CTableDataCell>
                          <CTableDataCell className="text-end fw-bold annual-col total-highlight-green">{fmt(m.totals.annualTotal)}</CTableDataCell>
                        </CTableRow>
                      </CTableBody>
                    </CTable>
                  </div>
                </CCardBody>
              </CCard>
            )}

            {/* ── TAB: Gráficos ── */}
            {activeTab === 'graficos' && (
              <div>
                <CRow className="g-4 mb-4">
                  {/* Bar Chart */}
                  <CCol xl={8}>
                    <CCard className="border-0 shadow-sm h-100">
                      <CCardBody>
                        <SectionHeader icon={cilChart} title="Ganho Anual por Categoria"
                          subtitle="Individual vs Pool — valores anuais" />
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={barData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6c757d' }} />
                            <YAxis tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 11, fill: '#6c757d' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="Individual" fill={COLORS.individual} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Pool" fill={COLORS.pool} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CCardBody>
                    </CCard>
                  </CCol>

                  {/* Pie Chart */}
                  <CCol xl={4}>
                    <CCard className="border-0 shadow-sm h-100">
                      <CCardBody>
                        <SectionHeader icon={cilChartLine} title="Composição Anual"
                          subtitle="Participação por categoria" />
                        <ResponsiveContainer width="100%" height={320}>
                          <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
                              dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false} fontSize={11}>
                              {pieData.map((entry, index) => (
                                <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => fmt(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CCardBody>
                    </CCard>
                  </CCol>
                </CRow>

                <CRow className="g-4">
                  {/* Period Area Chart */}
                  <CCol xl={6}>
                    <CCard className="border-0 shadow-sm h-100">
                      <CCardBody>
                        <SectionHeader icon={cilArrowThickFromBottom} title="Evolução por Período"
                          subtitle="Mensal → Trimestral → Anual" />
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={periodData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <defs>
                              <linearGradient id="gradInd" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.individual} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.individual} stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gradPool" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.pool} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS.pool} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#6c757d' }} />
                            <YAxis tickFormatter={(v) => fmt(v, true)} tick={{ fontSize: 11, fill: '#6c757d' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Area type="monotone" dataKey="Individual" stroke={COLORS.individual}
                              fill="url(#gradInd)" strokeWidth={2} />
                            <Area type="monotone" dataKey="Pool" stroke={COLORS.pool}
                              fill="url(#gradPool)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CCardBody>
                    </CCard>
                  </CCol>

                  {/* Ind vs Pool donut-style bar */}
                  <CCol xl={6}>
                    <CCard className="border-0 shadow-sm h-100">
                      <CCardBody>
                        <SectionHeader icon={cilGraph} title="Individual vs Pool — Total Anual"
                          subtitle="Distribuição entre modalidades" />
                        <div className="ind-pool-summary mt-2">
                          {[
                            { label: 'Pool', value: m.totals.poolAnnual, color: COLORS.pool },
                            { label: 'Individual', value: m.totals.indAnnual, color: COLORS.individual },
                          ].map((item) => {
                            const pct = (item.value / m.totals.annualTotal) * 100;
                            return (
                              <div key={item.label} className="mb-4">
                                <div className="d-flex justify-content-between mb-1">
                                  <span className="fw-semibold" style={{ color: item.color }}>{item.label}</span>
                                  <span className="fw-bold">{fmt(item.value)}</span>
                                </div>
                                <div className="progress-track">
                                  <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                                </div>
                                <div className="text-end mt-1" style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                  {pct.toFixed(1)}% do total
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="total-summary-box mt-2">
                          <span>Total Anual</span>
                          <strong className="text-success fs-5">{fmt(m.totals.annualTotal)}</strong>
                        </div>
                      </CCardBody>
                    </CCard>
                  </CCol>
                </CRow>
              </div>
            )}

            {/* ── TAB: Simulação ── */}
            {activeTab === 'simulacao' && (
              <CCard className="border-0 shadow-sm">
                <CCardBody>
                  <SectionHeader icon={cilSettings} title="Parâmetros da Simulação"
                    subtitle="Equivalente à aba Simulação da planilha" />
                  <CRow className="g-4 mt-1">
                    {[
                      { label: 'Individual', color: '#007f5f', items: [
                        { k: 'Condomínios', v: fmtNum(STATIC.indCondominiums) },
                        { k: 'Unidades', v: fmtNum(STATIC.indUnits) },
                        { k: 'Custo Boletagem', v: fmt(STATIC.costBoletagem) },
                        { k: 'Faturamento', v: fmt(m.faturamentoInd) },
                        { k: 'Pagamentos', v: fmt(m.pagamentosInd) },
                        { k: 'Tarifa (Sicoob)', v: fmt(STATIC.tariffInd) },
                      ]},
                      { label: 'Pool', color: '#2eb85c', items: [
                        { k: 'Condomínios', v: fmtNum(STATIC.poolCondominiums) },
                        { k: 'Unidades', v: fmtNum(STATIC.poolUnits) },
                        { k: 'Custo Boletagem', v: fmt(STATIC.costBoletagem) },
                        { k: 'Faturamento', v: fmt(m.faturamentoPool) },
                        { k: 'Pagamentos', v: fmt(m.pagamentosPool) },
                        { k: 'Tarifa (Sicoob)', v: fmt(STATIC.tariffPool || 0) },
                      ]},
                    ].map((section) => (
                      <CCol md={6} key={section.label}>
                        <div className="sim-card" style={{ borderTopColor: section.color }}>
                          <div className="sim-header" style={{ color: section.color }}>{section.label}</div>
                          <table className="sim-table">
                            <tbody>
                              {section.items.map((item) => (
                                <tr key={item.k}>
                                  <td className="sim-key">{item.k}</td>
                                  <td className="sim-val">{item.v}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CCol>
                    ))}
                  </CRow>

                  <div className="mt-4">
                    <div className="fw-bold mb-3" style={{ color: '#1b2a33' }}>Premissas das taxas</div>
                    <CRow className="g-3">
                      {[
                        { label: 'Preço Boletagem Atribuído', value: fmt(STATIC.priceBoletagem) + '/boleto' },
                        { label: 'Taxa Depósito à Vista', value: `${(STATIC.depositRate * 100).toFixed(2)}% do faturamento` },
                        { label: 'Taxa Investimento', value: `${(STATIC.investmentRate * 100).toFixed(2)}% do faturamento` },
                        { label: 'Tarifa Atribuída (Ind.)', value: fmt(STATIC.tariffPrice) + '/condomínio' },
                        { label: 'Rateio Depósito', value: `${(STATIC.depositRateio * 100).toFixed(0)}%` },
                        { label: 'Rateio Investimento', value: `${(STATIC.investmentRateio * 100).toFixed(0)}%` },
                        { label: 'Rateio Cobrança', value: `${(STATIC.collectionRateio * 100).toFixed(0)}%` },
                        { label: 'Boletos Pagamentos (Ind.)', value: `${fmtNum(STATIC.paymentTickets)} × ${(STATIC.paymentSpread * 100).toFixed(0)}%` },
                      ].map((item) => (
                        <CCol sm={6} lg={3} key={item.label}>
                          <div className="rate-card">
                            <div className="rate-label">{item.label}</div>
                            <div className="rate-value">{item.value}</div>
                          </div>
                        </CCol>
                      ))}
                    </CRow>
                  </div>
                </CCardBody>
              </CCard>
            )}

            {/* ── TAB: Resultados Predial ── */}
            {activeTab === 'resultados' && (
              <CCard className="border-0 shadow-sm">
                <CCardBody>
                  <SectionHeader icon={cilChartLine} title="Resultados Auxiliadora Predial"
                    subtitle="Equivalente à aba Resultados da planilha" />

                  {/* Historical Distribution */}
                  <div className="fw-bold mb-3 mt-2" style={{ color: '#1b2a33' }}>Histórico de Distribuição</div>
                  <CTable hover responsive borderless className="result-table mb-4">
                    <CTableHead>
                      <CTableRow className="table-header-row">
                        <CTableHeaderCell>Ano</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Distribuição</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Resultado</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">% Distribuição</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {[
                        { year: 2024, dist: STATIC.dist2024, result: STATIC.result2024 },
                        { year: 2025, dist: STATIC.dist2025, result: STATIC.result2025 },
                        { year: 2026, dist: m.dist2026, result: m.res2026, highlight: true },
                      ].map((row) => (
                        <CTableRow key={row.year} className={row.highlight ? 'highlight-row' : ''}>
                          <CTableDataCell className="fw-semibold">{row.year}{row.highlight && <CBadge color="success" className="ms-2">Projetado</CBadge>}</CTableDataCell>
                          <CTableDataCell className="text-end">{fmt(row.dist)}</CTableDataCell>
                          <CTableDataCell className="text-end">{fmt(row.result)}</CTableDataCell>
                          <CTableDataCell className="text-end">{fmtPct(row.dist / row.result)}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>

                  {/* Predial Income by Account */}
                  <div className="fw-bold mb-3" style={{ color: '#1b2a33' }}>Ganho Predial por Conta</div>
                  <CTable hover responsive borderless className="result-table mb-4">
                    <CTableHead>
                      <CTableRow className="table-header-row">
                        <CTableHeaderCell>Conta</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Rateio</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Saldo da Conta</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Ganho Predial</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">% Predial</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {m.resultados.map((row) => (
                        <CTableRow key={row.conta} className="data-row">
                          <CTableDataCell className="fw-semibold">{row.conta}</CTableDataCell>
                          <CTableDataCell className="text-end">{fmtPct(row.rateio)}</CTableDataCell>
                          <CTableDataCell className="text-end">{fmt(row.valor)}</CTableDataCell>
                          <CTableDataCell className="text-end text-success fw-bold">{fmt(row.predial)}</CTableDataCell>
                          <CTableDataCell className="text-end">{fmtPct(row.pct)}</CTableDataCell>
                        </CTableRow>
                      ))}
                      <CTableRow className="total-row">
                        <CTableDataCell colSpan={3} className="fw-bold">TOTAL PREDIAL ANUAL</CTableDataCell>
                        <CTableDataCell className="text-end fw-bold total-highlight-green">{fmt(m.totalPredialAnual)}</CTableDataCell>
                        <CTableDataCell />
                      </CTableRow>
                    </CTableBody>
                  </CTable>

                  {/* Summary Cards */}
                  <CRow className="g-3">
                    {m.resultados.map((row, i) => (
                      <CCol md={4} key={row.conta}>
                        <div className="predial-summary-card" style={{ borderTopColor: PIE_COLORS[i] }}>
                          <div className="predial-label">{row.conta}</div>
                          <div className="predial-value" style={{ color: PIE_COLORS[i] }}>{fmt(row.predial)}</div>
                          <div className="predial-pct">{fmtPct(row.pct)} da conta</div>
                        </div>
                      </CCol>
                    ))}
                  </CRow>
                </CCardBody>
              </CCard>
            )}

          </div>
        </CContainer>
      </main>

      <footer className="app-footer">
        <CContainer fluid="xl">
          <span>Sicoob Auxiliadora Predial — Simulador Predial </span>
          <span className="ms-auto">Base Faturamento: <strong>{fmt(revenueBase)}</strong></span>
        </CContainer>
      </footer>
    </div>
  );
}
