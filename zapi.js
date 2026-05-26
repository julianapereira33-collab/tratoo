// api/zapi.js — Vercel API Route
// Proxy servidor → Z-API (evita bloqueio CORS/Host not in allowlist)

const ZAPI_BASE   = 'https://api.z-api.io/instances/3F3AAC987AC562521BA36E531F01401A/token/56C05C6E82E04F8EDD8EC48B';
const ZAPI_TOKEN  = 'Fcc11ab79e95a449994012380229a9a0cS'; // Security Token (Client-Token)

export default async function handler(req, res) {
  // CORS — permite chamadas do seu domínio
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Pega o endpoint desejado: /api/zapi?endpoint=send-text
  const endpoint = req.query.endpoint || 'status';

  const zapiUrl = `${ZAPI_BASE}/${endpoint}`;

  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_TOKEN,
      },
    };

    // Se for POST, repassa o body
    if (req.method === 'POST' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(zapiUrl, options);
    const data = await response.json().catch(() => ({}));

    return res.status(response.status).json(data);

  } catch (err) {
    console.error('[ZAPI Proxy] Erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
