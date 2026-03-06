import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Fintoc } from 'fintoc';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

// Configuración
const FINTOC_SECRET_KEY = process.env.FINTOC_SECRET_KEY;
const FINTOC_LINK_TOKEN = process.env.FINTOC_LINK_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const fintocClient = new Fintoc(FINTOC_SECRET_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 1. Endpoint para intercambiar public_token por link_token y guardarlo
app.post('/api/fintoc/exchange', async (req, res) => {
  try {
    const { public_token } = req.body;

    // Intercambiar token con Fintoc
    const link = await fintocClient.links.exchange(public_token);
    
    // Guardar en Supabase
    const { error } = await supabase.from('fintoc_links').insert({
      link_token: link.id,
      holder_id: link.holderId,
      institution_id: link.institution.id,
      institution_name: link.institution.name
    });

    if (error) throw error;

    res.json({ success: true, message: 'Cuenta vinculada exitosamente', link_id: link.id });
  } catch (error) {
    console.error('Error en exchange:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Endpoint directo — usa el link token guardado en .env (cuenta Santander ya vinculada)
app.get('/api/fintoc/movements', async (req, res) => {
  try {
    if (!FINTOC_LINK_TOKEN) return res.status(500).json({ error: 'FINTOC_LINK_TOKEN no configurado en .env' });

    const accounts = await fintocClient.accounts.list({ link_token: FINTOC_LINK_TOKEN, lazy: false });
    const allMovements = [];

    for (const account of accounts) {
      const movements = await fintocClient.accounts.movements.list({
        account_id: account.id,
        link_token: FINTOC_LINK_TOKEN,
        lazy: false,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      allMovements.push({
        account_name: account.name,
        account_number: account.number,
        currency: account.currency,
        movements: movements
      });
    }

    res.json(allMovements);
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Endpoint para extraer movimientos por link_id dinámico (desde el widget)
app.get('/api/fintoc/movements/:link_id', async (req, res) => {
  try {
    const { link_id } = req.params;

    const accounts = await fintocClient.accounts.list({ link_token: link_id, lazy: false });
    const allMovements = [];

    for (const account of accounts) {
      const movements = await fintocClient.accounts.movements.list({
        account_id: account.id,
        link_token: link_id,
        lazy: false,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      allMovements.push({
        account_name: account.name,
        account_number: account.number,
        currency: account.currency,
        movements: movements
      });
    }

    res.json(allMovements);
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
