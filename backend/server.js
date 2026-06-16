const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS params (
      id   INTEGER PRIMARY KEY DEFAULT 1,
      revenue_base  NUMERIC,
      payments_base NUMERIC,
      result_2026   NUMERIC,
      CHECK (id = 1)
    )
  `);
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/api/params', async (_, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM params WHERE id = 1');
    if (rows.length === 0) return res.json({ revenue_base: 0, payments_base: 0, result_2026: 0 });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/params', async (req, res) => {
  const { revenue_base, payments_base, result_2026 } = req.body;
  try {
    await pool.query(`
      INSERT INTO params (id, revenue_base, payments_base, result_2026)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id) DO UPDATE
        SET revenue_base  = EXCLUDED.revenue_base,
            payments_base = EXCLUDED.payments_base,
            result_2026   = EXCLUDED.result_2026
    `, [revenue_base ?? 0, payments_base ?? 0, result_2026 ?? 0]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

init()
  .then(() => app.listen(8080, () => console.log('Backend rodando na porta 8080')))
  .catch((err) => { console.error('Falha ao inicializar:', err); process.exit(1); });
