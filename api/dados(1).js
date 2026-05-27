// api/dados.js — Vercel API Route
// Endpoint consultado pelo Super Agente para obter dados reais do TRATOO
// URL: https://SEU-SITE.vercel.app/api/dados

const SUPA_URL = 'https://adgmmtlgygjwbmcmhvbu.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkZ21tdGxneWdqd2JtY21odmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTc1NTEsImV4cCI6MjA5NDE5MzU1MX0.qrAniI_5Q419e-cn2ZTvS_xdb0s3EaeTlGd7XsLXTBQ';

// Busca os dados do Supabase
async function getDados() {
  const r = await fetch(`${SUPA_URL}/rest/v1/erp_dados?id=eq.1&select=dados`, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`
    }
  });
  if (!r.ok) throw new Error('Erro ao buscar dados: ' + r.status);
  const rows = await r.json();
  if (!rows.length) throw new Error('Sem dados');
  let dados = rows[0].dados;
  if (typeof dados === 'string') dados = JSON.parse(dados);
  return dados;
}

// Formata data DD/MM/YYYY
function fDt(d) {
  if (!d) return '-';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

// Formata moeda
function R(v) {
  return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function hoje() {
  return new Date().toISOString().split('T')[0];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const D = await getDados();
    const hj = hoje();

    // ============================================================
    // RESUMO GERAL
    // ============================================================
    const faturamento = D.obras?.reduce((s, o) => s + (o.valor || 0), 0) || 0;
    const aReceber    = D.receber?.filter(r => r.status !== 'Recebido').reduce((s, r) => s + r.valor, 0) || 0;
    const aPagar      = D.pagar?.filter(p => p.status === 'Aberto').reduce((s, p) => s + p.valor, 0) || 0;
    const vencidos    = D.pagar?.filter(p => p.status === 'Aberto' && p.venc < hj) || [];
    const cxR         = D.caixa?.filter(c => c.tipo === 'Receita').reduce((s, c) => s + c.valor, 0) || 0;
    const cxD         = D.caixa?.filter(c => c.tipo === 'Despesa').reduce((s, c) => s + c.valor, 0) || 0;
    const saldoCaixa  = cxR - cxD;

    // ============================================================
    // OS ABERTAS
    // ============================================================
    const osAbertas = D.ordens?.filter(o => o.status !== 'Finalizada') || [];
    const osFinaliz = D.ordens?.filter(o => o.status === 'Finalizada') || [];

    // ============================================================
    // ORÇAMENTOS PENDENTES
    // ============================================================
    const orcPendentes = D.orcamentos?.filter(o => o.status === 'Enviado') || [];
    const orcAprovados = D.orcamentos?.filter(o => o.status === 'Aprovado') || [];

    // ============================================================
    // CONTAS VENCIDAS
    // ============================================================
    const contasVencidas = D.pagar?.filter(p => p.status === 'Aberto' && p.venc < hj) || [];
    const recVencidos    = D.receber?.filter(r => r.status !== 'Recebido' && r.venc < hj) || [];

    // ============================================================
    // MONTA RESPOSTA COMPLETA PARA O AGENTE
    // ============================================================
    const resposta = {
      empresa: 'TRATOO',
      data_consulta: new Date().toLocaleDateString('pt-BR'),
      hora_consulta: new Date().toLocaleTimeString('pt-BR'),

      resumo_financeiro: {
        faturamento_total: R(faturamento),
        a_receber: R(aReceber),
        a_pagar: R(aPagar),
        saldo_caixa: R(saldoCaixa),
        contas_vencidas_count: contasVencidas.length,
        contas_vencidas_valor: R(contasVencidas.reduce((s, p) => s + p.valor, 0)),
        receber_vencidos_count: recVencidos.length,
      },

      ordens_servico: {
        abertas_count: osAbertas.length,
        finalizadas_count: osFinaliz.length,
        abertas: osAbertas.map(o => ({
          numero: o.num,
          cliente: o.cN,
          operador: o.opN || '-',
          data_inicio: fDt(o.di),
          local: o.lc || '-',
          valor: R(o.total || 0),
          status: o.status
        }))
      },

      orcamentos: {
        pendentes_count: orcPendentes.length,
        aprovados_count: orcAprovados.length,
        pendentes: orcPendentes.map(o => ({
          numero: o.num,
          cliente: o.cN,
          valor: R(o.total),
          data: fDt(o.dt),
          validade: fDt(o.val)
        }))
      },

      clientes: {
        total: D.clientes?.length || 0,
        lista: D.clientes?.map(c => ({
          nome: c.nome,
          telefone: c.tel || '-',
          cidade: c.cid || '-',
          email: c.email || '-'
        })) || []
      },

      contas_a_pagar: {
        total_aberto: R(aPagar),
        vencidas: contasVencidas.map(p => ({
          beneficiario: p.ben,
          descricao: p.desc,
          valor: R(p.valor),
          vencimento: fDt(p.venc),
          dias_atraso: Math.floor((new Date(hj) - new Date(p.venc)) / 86400000)
        })),
        proximas: D.pagar?.filter(p => p.status === 'Aberto' && p.venc >= hj)
          .sort((a, b) => a.venc.localeCompare(b.venc))
          .slice(0, 5)
          .map(p => ({
            beneficiario: p.ben,
            descricao: p.desc,
            valor: R(p.valor),
            vencimento: fDt(p.venc)
          })) || []
      },

      contas_a_receber: {
        total_pendente: R(aReceber),
        vencidas: recVencidos.map(r => ({
          cliente: r.cli,
          descricao: r.desc,
          valor: R(r.valor),
          vencimento: fDt(r.venc)
        })),
        proximas: D.receber?.filter(r => r.status !== 'Recebido' && r.venc >= hj)
          .sort((a, b) => a.venc.localeCompare(b.venc))
          .slice(0, 5)
          .map(r => ({
            cliente: r.cli,
            valor: R(r.valor),
            vencimento: fDt(r.venc)
          })) || []
      },

      equipamentos: {
        total: D.maquinas?.length || 0,
        ativos: D.maquinas?.filter(m => m.status === 'Ativa').length || 0,
        em_manutencao: D.maquinas?.filter(m => m.status === 'Manutencao').length || 0,
        lista: D.maquinas?.map(m => ({
          nome: m.nome,
          tipo: m.tipo,
          status: m.status
        })) || []
      },

      operadores: {
        total: D.operadores?.length || 0,
        lista: D.operadores?.map(o => ({
          nome: o.nome,
          funcao: o.func || '-',
          telefone: o.tel || '-'
        })) || []
      },

      obras: {
        total: D.obras?.length || 0,
        faturamento_total: R(faturamento),
        lista: D.obras?.slice(-5).map(o => ({
          os: o.osN,
          cliente: o.cN,
          data: fDt(o.dt),
          horas: (o.ht || 0) + 'h',
          valor: R(o.valor)
        })) || []
      },

      diesel: {
        total_litros: (D.diesel?.reduce((s, d) => s + d.litros, 0) || 0).toFixed(0) + 'L',
        total_gasto: R(D.diesel?.reduce((s, d) => s + d.valor, 0) || 0)
      }
    };

    return res.status(200).json(resposta);

  } catch (err) {
    console.error('[TRATOO API] Erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
