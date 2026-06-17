const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS config (
      id               INTEGER PRIMARY KEY DEFAULT 1,
      resultado_2026   NUMERIC DEFAULT 15500000,
      faturamento_base NUMERIC DEFAULT 23000000,
      CHECK (id = 1)
    )
  `);
  await pool.query(`ALTER TABLE config ADD COLUMN IF NOT EXISTS faturamento_base NUMERIC DEFAULT 23000000`).catch(() => {});
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/api/params', async (_, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM config WHERE id = 1');
    if (rows.length === 0) return res.json({ resultado_2026: 15500000, faturamento_base: 23000000 });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/params', async (req, res) => {
  const { resultado_2026, faturamento_base } = req.body;
  try {
    await pool.query(`
      INSERT INTO config (id, resultado_2026, faturamento_base)
      VALUES (1, $1, $2)
      ON CONFLICT (id) DO UPDATE
        SET resultado_2026   = EXCLUDED.resultado_2026,
            faturamento_base = EXCLUDED.faturamento_base
    `, [resultado_2026 ?? 15500000, faturamento_base ?? 23000000]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

init()
  .then(() => app.listen(8080, () => console.log('Backend rodando na porta 8080')))
  .catch((err) => { console.error('Falha ao inicializar:', err); process.exit(1); });
