import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CIcon from '@coreui/icons-react';
import {
  cilBank, cilBuilding, cilChart, cilCloudDownload,
  cilGraph, cilMoney, cilReload, cilSettings, cilUser
} from '@coreui/icons';
import {
  CBadge, CButton, CCard, CCardBody, CCol, CContainer,
  CFormInput, CFormLabel, CHeader, CHeaderBrand, CInputGroup,
  CInputGroupText, CRow, CNav, CNavItem, CNavLink
} from '@coreui/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, PieChart, Pie
} from 'recharts';

// ── Constantes fixas do sistema (da planilha Resultados) ──────────────────────
const HIST = {
  dist2024: 2751739.53, res2024: 11370764,
  dist2025: 1326211.70, res2025: 22876889,
};
const CONTA = { dv: 102559246.79, inv: 359016883.85, cob: 4339523.32 };
const PRECO_BOLETAGEM = 1.7;
const PRECO_TARIFA    = 50;
const BOLETOS_FIXO    = 3750;

// ── Modelo de cálculo (idêntico às fórmulas da planilha) ─────────────────────
function calcular(ind, pool, params) {
  const { resultado2026alvo } = params;

  const fatInd  = ind.faturamento;
  const fatPool = pool.faturamento;

  // Resultado 2026 estimado (formula Resultados B4)
  const distHist = HIST.dist2024 + HIST.dist2025;
  const resHist  = HIST.res2024  + HIST.res2025;
  const resultado2026 = resHist > 0 ? distHist / resHist * resultado2026alvo : 0;

  // Shares do pool (formulas Resultados M2, M3, M4)
  const saldoDV  = fatPool * 0.0913;
  const saldoInv = fatPool * 0.096;
  const boletosPool = pool.custoBoletagem * pool.unidades;

  const shareDV  = (CONTA.dv  + saldoDV)    > 0 ? saldoDV    / (CONTA.dv  + saldoDV)    : 0;
  const shareInv = (CONTA.inv + saldoInv)   > 0 ? saldoInv   / (CONTA.inv + saldoInv)   : 0;
  const shareCob = (CONTA.cob + boletosPool) > 0 ? boletosPool / (CONTA.cob + boletosPool) : 0;

  // Valores MENSAIS (fórmulas da aba Resultado)
  const m = {
    bolagemPrecoInd:  (PRECO_BOLETAGEM - ind.custoBoletagem)  * ind.unidades,
    bolagemPrecoPool: (PRECO_BOLETAGEM - pool.custoBoletagem) * pool.unidades,
    bolagemEmissaoInd:  0,
    bolagemEmissaoPool: resultado2026 * 0.2 * shareCob,
    dvInd:  0,
    dvPool: resultado2026 * 0.4 * shareDV,
    invInd:  0,
    invPool: resultado2026 * 0.25 * shareInv,
    boletosInd:  0,
    boletosPool: BOLETOS_FIXO * 0.2,
    tarifaInd:  (PRECO_TARIFA - ind.tarifa)  * ind.condominios,
    tarifaPool: (0            - pool.tarifa) * pool.condominios,
  };
  m.totalInd  = m.bolagemPrecoInd  + m.tarifaInd;
  m.totalPool = m.bolagemPrecoPool + m.bolagemEmissaoPool + m.dvPool + m.invPool + m.boletosPool + m.tarifaPool;
  m.total     = m.totalInd + m.totalPool;

  const q = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v * 3]));
  const a = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v * 12]));

  return { fatInd, fatPool, resultado2026, m, q, a, shareDV, shareInv, shareCob };
}

// ── Formatadores ───────────────────────────────────────────────────────────────
const fmt   = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(v ?? 0);
const fmtC  = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v ?? 0);
const fmtN  = (v) => new Intl.NumberFormat('pt-BR').format(v ?? 0);

// ── Hook de persistência ──────────────────────────────────────────────────────
const STATUS_LABEL = { loading: 'Carregando...', saving: 'Salvando...', ready: 'Salvo', error: 'Erro' };
const STATUS_COLOR = { loading: 'secondary', saving: 'warning', ready: 'success', error: 'danger' };

function useParams() {
  const [resultado2026alvo, setResultado] = useState(15500000);
  const [faturamentoBase, setFaturamento] = useState(23000000);
  const [status, setStatus] = useState('loading');
  const timer = useRef(null);

  useEffect(() => {
    fetch('/api/params')
      .then((r) => r.json())
      .then((d) => {
        setResultado(Number(d.resultado_2026) || 15500000);
        setFaturamento(Number(d.faturamento_base) || 23000000);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  const persist = useCallback((res, fat) => {
    clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(() => {
      fetch('/api/params', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultado_2026: res, faturamento_base: fat }),
      }).then(() => setStatus('ready')).catch(() => setStatus('error'));
    }, 800);
  }, []);

  const setRes = useCallback((v) => { setResultado(v); persist(v, faturamentoBase); }, [faturamentoBase, persist]);
  const setFat = useCallback((v) => { setFaturamento(v); persist(resultado2026alvo, v); }, [resultado2026alvo, persist]);
  const reset  = useCallback(() => { setResultado(15500000); setFaturamento(23000000); persist(15500000, 23000000); }, [persist]);

  return { resultado2026alvo, faturamentoBase, status, setRes, setFat, reset };
}

// ── Subcomponentes ─────────────────────────────────────────────────────────────
function InputCard({ title, color, value, onChange }) {
  const set = (field, v) => onChange({ ...value, [field]: Number(v) || 0 });
  return (
    <CCard className="border-0 shadow-sm h-100">
      <CCardBody className="p-4">
        <div className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color }}>
          <CIcon icon={cilUser} />{title}
        </div>
        <CFormLabel className="small fw-semibold mb-1">Faturamento Médio Mensal</CFormLabel>
        <CInputGroup className="mb-3">
          <CInputGroupText>R$</CInputGroupText>
          <CFormInput type="number" min="0" step="10000" placeholder="Ex: 1650391"
            value={value.faturamento || ''} onChange={(e) => set('faturamento', e.target.value)} />
        </CInputGroup>
        <CFormLabel className="small fw-semibold mb-1">Condomínios</CFormLabel>
        <CInputGroup className="mb-3">
          <CInputGroupText>Cond.</CInputGroupText>
          <CFormInput type="number" min="0" step="1" placeholder="Ex: 46"
            value={value.condominios || ''} onChange={(e) => set('condominios', e.target.value)} />
        </CInputGroup>
        <CFormLabel className="small fw-semibold mb-1">Unidades</CFormLabel>
        <CInputGroup className="mb-3">
          <CInputGroupText>Un.</CInputGroupText>
          <CFormInput type="number" min="0" step="1" placeholder="Ex: 1768"
            value={value.unidades || ''} onChange={(e) => set('unidades', e.target.value)} />
        </CInputGroup>
        <CFormLabel className="small fw-semibold mb-1">Custo boletagem</CFormLabel>
        <CInputGroup className="mb-3">
          <CInputGroupText>R$</CInputGroupText>
          <CFormInput type="number" min="0" step="0.10" placeholder="Ex: 1.00"
            value={value.custoBoletagem || ''} onChange={(e) => set('custoBoletagem', e.target.value)} />
        </CInputGroup>
        <CFormLabel className="small fw-semibold mb-1">Tarifa atual (R$/cond/mês)</CFormLabel>
        <CInputGroup>
          <CInputGroupText>R$</CInputGroupText>
          <CFormInput type="number" min="0" step="1" placeholder="Ex: 14"
            value={value.tarifa || ''} onChange={(e) => set('tarifa', e.target.value)} />
        </CInputGroup>
      </CCardBody>
    </CCard>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="info-pill">
      <span className="info-pill-label">{label}</span>
      <span className="info-pill-value">{value}</span>
    </div>
  );
}

function ResultRow({ label, hint, mInd, mPool, qInd, qPool, aInd, aPool, isTotal, isSubtotal }) {
  const cls = isTotal ? 'result-total-tr' : isSubtotal ? 'result-sub-tr' : 'result-data-tr';
  const vfmt = isTotal || isSubtotal ? (v) => <strong>{fmt(v)}</strong> : fmt;
  return (
    <tr className={cls}>
      <td className="result-label-cell">
        <span className="fw-semibold">{label}</span>
        {hint && <span className="result-hint d-block">{hint}</span>}
      </td>
      <td className="num-cell">{vfmt(mInd)}</td>
      <td className="num-cell">{vfmt(mPool)}</td>
      <td className="num-cell period-sep">{vfmt(mInd + mPool)}</td>
      <td className="num-cell">{vfmt(qInd)}</td>
      <td className="num-cell">{vfmt(qPool)}</td>
      <td className="num-cell period-sep">{vfmt(qInd + qPool)}</td>
      <td className="num-cell">{vfmt(aInd)}</td>
      <td className="num-cell">{vfmt(aPool)}</td>
      <td className="num-cell period-sep">{vfmt(aInd + aPool)}</td>
    </tr>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="fw-bold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="mb-0" style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

// ── App principal ─────────────────────────────────────────────────────────────
const EMPTY_PROFILE = { faturamento: 0, condominios: 0, unidades: 0, custoBoletagem: 1, tarifa: 0 };

export default function App() {
  const { resultado2026alvo, faturamentoBase, status, setRes, setFat, reset } = useParams();
  const [activeTab, setActiveTab] = useState('resultados');
  const [ind,  setInd]  = useState({ ...EMPTY_PROFILE });
  const [pool, setPool] = useState({ ...EMPTY_PROFILE });
  const [nomeAdm, setNomeAdm] = useState('');

  const c = useMemo(
    () => calcular(ind, pool, { resultado2026alvo }),
    [ind, pool, resultado2026alvo]
  );

  const exportCsv = () => {
    const n = (v) => (v ?? 0).toFixed(2).replace('.', ',');
    const s = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ['Categoria', 'Item', 'Mensal Ind', 'Mensal Pool', 'Mensal Total', 'Trim Ind', 'Trim Pool', 'Trim Total', 'Anual Ind', 'Anual Pool', 'Anual Total'],
      ['Boletagem', 'Preço atribuído',       c.m.bolagemPrecoInd,   c.m.bolagemPrecoPool,   c.m.bolagemPrecoInd+c.m.bolagemPrecoPool,     c.q.bolagemPrecoInd,   c.q.bolagemPrecoPool,   c.q.bolagemPrecoInd+c.q.bolagemPrecoPool,     c.a.bolagemPrecoInd,   c.a.bolagemPrecoPool,   c.a.bolagemPrecoInd+c.a.bolagemPrecoPool],
      ['Boletagem', 'Emissão (Distrib.)',    c.m.bolagemEmissaoInd, c.m.bolagemEmissaoPool, c.m.bolagemEmissaoInd+c.m.bolagemEmissaoPool, c.q.bolagemEmissaoInd, c.q.bolagemEmissaoPool, c.q.bolagemEmissaoInd+c.q.bolagemEmissaoPool, c.a.bolagemEmissaoInd, c.a.bolagemEmissaoPool, c.a.bolagemEmissaoInd+c.a.bolagemEmissaoPool],
      ['Depósito à Vista', 'Saldo médio',   c.m.dvInd,             c.m.dvPool,             c.m.dvInd+c.m.dvPool,                         c.q.dvInd,             c.q.dvPool,             c.q.dvInd+c.q.dvPool,                         c.a.dvInd,             c.a.dvPool,             c.a.dvInd+c.a.dvPool],
      ['Investimento', 'Saldo médio',       c.m.invInd,            c.m.invPool,            c.m.invInd+c.m.invPool,                       c.q.invInd,            c.q.invPool,            c.q.invInd+c.q.invPool,                       c.a.invInd,            c.a.invPool,            c.a.invInd+c.a.invPool],
      ['Pagamentos', 'Boletos',             c.m.boletosInd,        c.m.boletosPool,        c.m.boletosInd+c.m.boletosPool,               c.q.boletosInd,        c.q.boletosPool,        c.q.boletosInd+c.q.boletosPool,               c.a.boletosInd,        c.a.boletosPool,        c.a.boletosInd+c.a.boletosPool],
      ['Tarifa', 'Preço',                  c.m.tarifaInd,         c.m.tarifaPool,         c.m.tarifaInd+c.m.tarifaPool,                 c.q.tarifaInd,         c.q.tarifaPool,         c.q.tarifaInd+c.q.tarifaPool,                 c.a.tarifaInd,         c.a.tarifaPool,         c.a.tarifaInd+c.a.tarifaPool],
      ['TOTAL', '',                        c.m.totalInd,          c.m.totalPool,          c.m.total,                                    c.q.totalInd,          c.q.totalPool,          c.q.total,                                    c.a.totalInd,          c.a.totalPool,          c.a.total],
    ];
    const csv = rows.map((r, ri) =>
      r.map((v, ci) => ri === 0 || ci < 2 ? s(v) : s(n(v))).join(';')
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `ganhos-${nomeAdm || 'simulacao'}.csv`;
    a.click();
  };

  const barAnual = [
    { name: 'Boletagem\nPreço', ind: c.a.bolagemPrecoInd, pool: c.a.bolagemPrecoPool },
    { name: 'Boletagem\nEmissão', ind: c.a.bolagemEmissaoInd, pool: c.a.bolagemEmissaoPool },
    { name: 'Dep. Vista', ind: c.a.dvInd, pool: c.a.dvPool },
    { name: 'Investimento', ind: c.a.invInd, pool: c.a.invPool },
    { name: 'Pagamentos', ind: c.a.boletosInd, pool: c.a.boletosPool },
    { name: 'Tarifa', ind: c.a.tarifaInd, pool: c.a.tarifaPool },
  ];

  return (
    <div className="app-shell">
      <CHeader className="app-header">
        <CContainer fluid className="header-inner">
          <CHeaderBrand className="brand-mark">
            <span className="brand-symbol"><CIcon icon={cilBank} /></span>
            <span>Sicoob Imob.vc</span>
            <span className="brand-sub">Calculadora de Ganhos</span>
          </CHeaderBrand>
          <CBadge color="success" shape="rounded-pill" className="env-badge">Cooperativa</CBadge>
        </CContainer>
      </CHeader>

      <main className="main-content">
        <CContainer fluid="xl">

          {/* Título + nome da administradora */}
          <div className="hero-panel mb-4">
            <div className="hero-eyebrow">Ferramenta de simulação para administradoras de condomínio</div>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <h1 className="hero-title mb-0">GANHOS</h1>
              <CFormInput
                className="hero-name-input"
                placeholder="Nome da administradora..."
                value={nomeAdm}
                onChange={(e) => setNomeAdm(e.target.value)}
              />
            </div>
          </div>

          {/* Inputs: Individual + Pool */}
          <CRow className="g-4 mb-4">
            <CCol md={6}>
              <InputCard title="Individual" color="#00AE9D" value={ind} onChange={setInd} />
            </CCol>
            <CCol md={6}>
              <InputCard title="Pool" color="#7DB61C" value={pool} onChange={setPool} />
            </CCol>
          </CRow>

          {/* Info derivada */}
          <div className="derived-bar mb-4">
            <InfoPill label="Resultado 2026 Estimado" value={fmt(c.resultado2026)} />
            <InfoPill label="Share DV Pool" value={`${(c.shareDV * 100).toFixed(4)}%`} />
            <InfoPill label="Share Inv Pool" value={`${(c.shareInv * 100).toFixed(4)}%`} />
            <InfoPill label="Share Cob Pool" value={`${(c.shareCob * 100).toFixed(4)}%`} />
          </div>

          {/* Tabs */}
          <CNav variant="tabs" className="mb-0 app-tabs">
            {[
              { id: 'resultados', label: 'Resultado',   icon: cilMoney },
              { id: 'graficos',   label: 'Gráficos',    icon: cilChart },
              { id: 'parametros', label: 'Parâmetros',  icon: cilSettings },
            ].map((t) => (
              <CNavItem key={t.id}>
                <CNavLink active={activeTab === t.id} onClick={() => setActiveTab(t.id)} style={{ cursor: 'pointer' }}>
                  <CIcon icon={t.icon} className="me-2" />{t.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>

          <div className="tab-content-panel">

            {/* ── TAB: Resultado ── */}
            {activeTab === 'resultados' && (
              <CCard className="border-0 shadow-sm">
                <CCardBody className="p-0">
                  <div className="d-flex align-items-center justify-content-between gap-3 p-4 pb-2">
                    <div>
                      <div className="fw-bold fs-5 text-dark">
                        GANHOS {nomeAdm ? nomeAdm.toUpperCase() : 'ADMINISTRADORA'}
                      </div>
                      <div className="text-medium-emphasis small">Valores calculados conforme fórmulas da planilha</div>
                    </div>
                    <CButton color="secondary" variant="outline" size="sm"
                      className="d-inline-flex align-items-center gap-2" onClick={exportCsv}>
                      <CIcon icon={cilCloudDownload} />Exportar CSV
                    </CButton>
                  </div>

                  <div className="table-responsive px-2 pb-4">
                    <table className="ganhos-table">
                      <thead>
                        <tr>
                          <th rowSpan={2} className="item-header">Item</th>
                          <th colSpan={3} className="period-header">Mensal</th>
                          <th colSpan={3} className="period-header">Trimestral</th>
                          <th colSpan={3} className="period-header annual-header">Anual</th>
                        </tr>
                        <tr>
                          <th className="sub-header">Individual</th>
                          <th className="sub-header">Pool</th>
                          <th className="sub-header total-sub">Total</th>
                          <th className="sub-header">Individual</th>
                          <th className="sub-header">Pool</th>
                          <th className="sub-header total-sub">Total</th>
                          <th className="sub-header annual-col">Individual</th>
                          <th className="sub-header annual-col">Pool</th>
                          <th className="sub-header total-sub annual-col">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="category-row"><td colSpan={10}>Boletagem</td></tr>
                        <ResultRow
                          label="Preço atribuído"
                          hint={`(R$${PRECO_BOLETAGEM} − custo) × unidades`}
                          mInd={c.m.bolagemPrecoInd}   mPool={c.m.bolagemPrecoPool}
                          qInd={c.q.bolagemPrecoInd}   qPool={c.q.bolagemPrecoPool}
                          aInd={c.a.bolagemPrecoInd}   aPool={c.a.bolagemPrecoPool}
                        />
                        <ResultRow
                          label="Emissão (Distrib. resultado)"
                          hint="Pool · 20% do resultado · share cobrança"
                          mInd={c.m.bolagemEmissaoInd}   mPool={c.m.bolagemEmissaoPool}
                          qInd={c.q.bolagemEmissaoInd}   qPool={c.q.bolagemEmissaoPool}
                          aInd={c.a.bolagemEmissaoInd}   aPool={c.a.bolagemEmissaoPool}
                        />
                        <tr className="category-row"><td colSpan={10}>Depósito à vista</td></tr>
                        <ResultRow
                          label="Saldo médio (Distrib. resultado)"
                          hint="Pool · 40% do resultado · share DV (9,13% fat.)"
                          mInd={c.m.dvInd}   mPool={c.m.dvPool}
                          qInd={c.q.dvInd}   qPool={c.q.dvPool}
                          aInd={c.a.dvInd}   aPool={c.a.dvPool}
                        />
                        <tr className="category-row"><td colSpan={10}>Investimento</td></tr>
                        <ResultRow
                          label="Saldo médio (Distrib. resultado)"
                          hint="Pool · 25% do resultado · share Inv (9,6% fat.)"
                          mInd={c.m.invInd}   mPool={c.m.invPool}
                          qInd={c.q.invInd}   qPool={c.q.invPool}
                          aInd={c.a.invInd}   aPool={c.a.invPool}
                        />
                        <tr className="category-row"><td colSpan={10}>Pagamentos</td></tr>
                        <ResultRow
                          label="Boletos"
                          hint={`Pool fixo: ${fmtN(BOLETOS_FIXO)} × 20%`}
                          mInd={c.m.boletosInd}   mPool={c.m.boletosPool}
                          qInd={c.q.boletosInd}   qPool={c.q.boletosPool}
                          aInd={c.a.boletosInd}   aPool={c.a.boletosPool}
                        />
                        <tr className="category-row"><td colSpan={10}>Tarifa</td></tr>
                        <ResultRow
                          label="Preço"
                          hint={`(R$${PRECO_TARIFA} − tarifa atual) × condomínios`}
                          mInd={c.m.tarifaInd}   mPool={c.m.tarifaPool}
                          qInd={c.q.tarifaInd}   qPool={c.q.tarifaPool}
                          aInd={c.a.tarifaInd}   aPool={c.a.tarifaPool}
                        />
                        <ResultRow
                          label="TOTAL"
                          mInd={c.m.totalInd}   mPool={c.m.totalPool}
                          qInd={c.q.totalInd}   qPool={c.q.totalPool}
                          aInd={c.a.totalInd}   aPool={c.a.totalPool}
                          isTotal
                        />
                      </tbody>
                    </table>
                  </div>
                </CCardBody>
              </CCard>
            )}

            {/* ── TAB: Gráficos ── */}
            {activeTab === 'graficos' && (
              <CCard className="border-0 shadow-sm">
                <CCardBody>
                  <div className="fw-bold fs-6 mb-1">Ganhos Anuais por Categoria</div>
                  <div className="text-medium-emphasis small mb-4">Individual vs Pool</div>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={barAnual} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                      <YAxis tickFormatter={(v) => fmtC(v)} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" />
                      <Bar dataKey="ind" name="Individual" fill="#00AE9D" radius={[4,4,0,0]} />
                      <Bar dataKey="pool" name="Pool" fill="#7DB61C" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <CRow className="g-3 mt-2">
                    {[
                      { label: 'Total Individual Anual', value: c.a.totalInd, color: '#00AE9D' },
                      { label: 'Total Pool Anual',       value: c.a.totalPool, color: '#7DB61C' },
                      { label: 'TOTAL GERAL Anual',      value: c.a.total,     color: '#003641' },
                    ].map((item) => (
                      <CCol md={4} key={item.label}>
                        <div className="summary-pill" style={{ borderColor: item.color }}>
                          <div className="summary-pill-label">{item.label}</div>
                          <div className="summary-pill-value" style={{ color: item.color }}>{fmt(item.value)}</div>
                        </div>
                      </CCol>
                    ))}
                  </CRow>

                  {/* Gráfico de rosca */}
                  {(() => {
                    const donutData = [
                      { name: 'Boletagem Preço',   value: c.a.bolagemPrecoInd + c.a.bolagemPrecoPool, color: '#00AE9D' },
                      { name: 'Boletagem Emissão', value: c.a.bolagemEmissaoPool,                     color: '#00AE9D' },
                      { name: 'Depósito à Vista',  value: c.a.dvPool,                                 color: '#7DB61C' },
                      { name: 'Investimento',      value: c.a.invPool,                                color: '#C9D200' },
                      { name: 'Pagamentos',        value: c.a.boletosPool,                            color: '#49479D' },
                      { name: 'Tarifa',            value: c.a.tarifaInd + c.a.tarifaPool,            color: '#003641' },
                    ].filter((d) => d.value > 0);
                    if (donutData.length === 0) return null;
                    return (
                      <div className="mt-4">
                        <div className="fw-bold fs-6 mb-1">Composição dos Ganhos Anuais</div>
                        <div className="text-medium-emphasis small mb-3">Participação de cada fonte no total</div>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={donutData}
                              cx="50%" cy="50%"
                              innerRadius={75} outerRadius={120}
                              dataKey="value"
                              label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                              fontSize={12}
                            >
                              {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(v) => fmt(v)} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {/* Barras de progresso por categoria */}
                  <div className="fw-bold fs-6 mt-4 mb-3">Participação por Categoria (Anual)</div>
                  {(() => {
                    const cats = [
                      { label: 'Boletagem — Preço atribuído', value: c.a.bolagemPrecoInd + c.a.bolagemPrecoPool, color: '#00AE9D' },
                      { label: 'Boletagem — Emissão',         value: c.a.bolagemEmissaoPool,                     color: '#00AE9D' },
                      { label: 'Depósito à Vista',            value: c.a.dvPool,                                 color: '#7DB61C' },
                      { label: 'Investimento',                value: c.a.invPool,                                color: '#C9D200' },
                      { label: 'Pagamentos — Boletos',        value: c.a.boletosPool,                            color: '#49479D' },
                      { label: 'Tarifa',                      value: c.a.tarifaInd + c.a.tarifaPool,            color: '#003641' },
                    ].filter((d) => d.value > 0);
                    const total = cats.reduce((s, d) => s + d.value, 0);
                    if (total === 0) return <div className="empty-chart">Preencha os dados para ver o gráfico</div>;
                    return cats.map((item) => {
                      const pct = (item.value / total) * 100;
                      return (
                        <div key={item.label} className="mb-3">
                          <div className="d-flex justify-content-between mb-1">
                            <span className="fw-semibold" style={{ color: item.color }}>{item.label}</span>
                            <span className="fw-bold">{fmt(item.value)}</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                          </div>
                          <div className="text-end mt-1" style={{ fontSize: '0.78rem', color: '#6c757d' }}>{pct.toFixed(1)}% do total</div>
                        </div>
                      );
                    });
                  })()}

                </CCardBody>
              </CCard>
            )}

            {/* ── TAB: Parâmetros ── */}
            {activeTab === 'parametros' && (
              <CCard className="border-0 shadow-sm">
                <CCardBody>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div>
                      <div className="fw-bold fs-6">Parâmetros do Sistema</div>
                      <div className="text-medium-emphasis small">Salvos no banco de dados — afetam todos os cálculos</div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <CBadge color={STATUS_COLOR[status]} shape="rounded-pill">{STATUS_LABEL[status]}</CBadge>
                      <CButton color="secondary" variant="outline" size="sm" onClick={reset}>
                        <CIcon icon={cilReload} className="me-1" />Restaurar padrões
                      </CButton>
                    </div>
                  </div>

                  <CRow className="g-4">
                    <CCol md={6}>
                      <div className="sim-card" style={{ borderTopColor: '#00AE9D' }}>
                        <div className="sim-header" style={{ color: '#00AE9D' }}>Resultado 2026 Alvo (C4)</div>
                        <p className="text-medium-emphasis small mb-3">
                          Meta de resultado da cooperativa para 2026. O resultado estimado de distribuição é calculado proporcionalmente ao histórico de 2024–2025.
                        </p>
                        <CInputGroup>
                          <CInputGroupText>R$</CInputGroupText>
                          <CFormInput type="number" min="0" step="100000"
                            disabled={status === 'loading'}
                            value={resultado2026alvo || ''}
                            onChange={(e) => setRes(Number(e.target.value) || 0)} />
                        </CInputGroup>
                        <div className="mt-2 p-2 rounded" style={{ background: '#f0faf5', fontSize: '0.8rem', color: '#5a7a6e' }}>
                          Distribuição estimada 2026: <strong>{fmt(c.resultado2026)}</strong>
                        </div>
                      </div>
                    </CCol>

                    <CCol md={6}>
                      <div className="sim-card" style={{ borderTopColor: '#7DB61C' }}>
                        <div className="sim-header" style={{ color: '#7DB61C' }}>Faturamento Base (23M)</div>
                        <p className="text-medium-emphasis small mb-3">
                          Base de cálculo para derivar o faturamento de cada perfil proporcionalmente às unidades.
                          Fórmula: base ÷ 3 ÷ total_unidades × unidades_perfil
                        </p>
                        <CInputGroup>
                          <CInputGroupText>R$</CInputGroupText>
                          <CFormInput type="number" min="0" step="1000000"
                            disabled={status === 'loading'}
                            value={faturamentoBase || ''}
                            onChange={(e) => setFat(Number(e.target.value) || 0)} />
                        </CInputGroup>
                        <div className="mt-2 p-2 rounded" style={{ background: '#f0faf5', fontSize: '0.8rem', color: '#5a7a6e' }}>
                          Fat. Individual: <strong>{fmt(c.fatInd)}</strong> &nbsp;|&nbsp;
                          Fat. Pool: <strong>{fmt(c.fatPool)}</strong>
                        </div>
                      </div>
                    </CCol>

                    <CCol xs={12}>
                      <div className="sim-card" style={{ borderTopColor: '#6c757d' }}>
                        <div className="sim-header" style={{ color: '#6c757d' }}>Dados Históricos (fixos)</div>
                        <table className="w-100" style={{ fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ano</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Distribuição</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Resultado</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>% Distribuído</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { ano: 2024, dist: HIST.dist2024, res: HIST.res2024 },
                              { ano: 2025, dist: HIST.dist2025, res: HIST.res2025 },
                            ].map((r) => (
                              <tr key={r.ano} style={{ borderTop: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '8px 12px' }}>{r.ano}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#7DB61C', fontWeight: 600 }}>{fmt(r.dist)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(r.res)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6c757d' }}>
                                  {((r.dist / r.res) * 100).toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            )}

          </div>
        </CContainer>
      </main>

      <footer className="app-footer">
        <CContainer fluid="xl" className="d-flex flex-wrap align-items-center gap-3">
          <span>Sicoob Imob.vc — Calculadora de Ganhos para Administradoras</span>
          <span className="ms-auto">Resultado 2026 alvo: <strong>{fmt(resultado2026alvo)}</strong></span>
        </CContainer>
      </footer>
    </div>
  );
}
