import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ops from './src/db/operations.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'postgresql', cloudSql: true });
});

// Tenants
app.get('/api/tenants/:id', async (req, res) => {
  try {
    const tenant = await ops.getTenantById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching tenant' });
  }
});

app.post('/api/tenants', async (req, res) => {
  try {
    const tenant = await ops.upsertTenant(req.body);
    res.json(tenant);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error saving tenant' });
  }
});

// Users & Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { companyName, tradeName, cnpj, adminName, email, password, phone } = req.body;
    if (!email || !password || !companyName) {
      return res.status(400).json({ error: 'Dados incompletos para cadastro.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await ops.getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    }

    const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tenantId = `tenant_${uid.slice(0, 10)}`;

    const tenant = await ops.upsertTenant({
      id: tenantId,
      name: companyName,
      tradeName: tradeName || companyName,
      cnpj: cnpj || undefined,
      email: cleanEmail,
      phone: phone || undefined,
      maxStores: 10,
      createdAt: new Date().toISOString(),
    });

    const user = await ops.upsertUserProfile({
      uid,
      tenantId,
      email: cleanEmail,
      name: adminName || 'Administrador',
      role: 'admin',
      active: true,
      password,
      createdAt: new Date().toISOString(),
    });

    const settings = await ops.upsertCompanySettings({
      tenantId,
      legalName: companyName,
      tradeName: tradeName || companyName,
      cnpj: cnpj || '18.924.512/0001-44',
      phone: phone || '(81) 3456-7890',
      email: cleanEmail,
      cep: '51020-010',
      address: 'Avenida Engenheiro Domingos Ferreira',
      number: '1420',
      neighborhood: 'Boa Viagem',
      city: 'Recife',
      state: 'PE',
      timezone: 'America/Recife',
      shifts: ['Geral', 'Manhã', 'Almoço / Tarde', 'Noite', 'Madrugada'],
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      user,
      tenant,
      settings,
      token: `local_session_${uid}`,
    });
  } catch (error: any) {
    console.error('Error in /api/auth/register:', error);
    res.status(500).json({ error: error.message || 'Falha ao registrar empresa e usuário.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await ops.getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    if (user.password && user.password !== password) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const tenant = await ops.getTenantById(user.tenantId);
    const settings = await ops.getCompanySettingsByTenant(user.tenantId);

    res.json({
      success: true,
      user,
      tenant,
      settings,
      token: `local_session_${user.uid}`,
    });
  } catch (error: any) {
    console.error('Error in /api/auth/login:', error);
    res.status(500).json({ error: error.message || 'Falha na autenticação.' });
  }
});

app.get('/api/users/:uid', async (req, res) => {
  try {
    let user = await ops.getUserByUid(req.params.uid);
    if (!user && req.query.email) {
      user = await ops.getUserByEmail(String(req.query.email).trim().toLowerCase());
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching user' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = await ops.upsertUserProfile(req.body);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error saving user' });
  }
});

// Company Settings
app.get('/api/company-settings/:tenantId', async (req, res) => {
  try {
    const settings = await ops.getCompanySettingsByTenant(req.params.tenantId);
    if (!settings) return res.status(404).json({ error: 'Settings not found' });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching company settings' });
  }
});

app.post('/api/company-settings', async (req, res) => {
  try {
    const settings = await ops.upsertCompanySettings(req.body);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error saving company settings' });
  }
});

// Motoboys
app.get('/api/motoboys', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || '';
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });
    const list = await ops.getMotoboysByTenant(tenantId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching motoboys' });
  }
});

app.post('/api/motoboys', async (req, res) => {
  try {
    const item = await ops.upsertMotoboy(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error saving motoboy' });
  }
});

app.delete('/api/motoboys/:id', async (req, res) => {
  try {
    await ops.deleteMotoboyById(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting motoboy' });
  }
});

// Delivery Stores
app.get('/api/stores', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || '';
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });
    const list = await ops.getStoresByTenant(tenantId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching stores' });
  }
});

app.post('/api/stores', async (req, res) => {
  try {
    const item = await ops.upsertStore(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error saving store' });
  }
});

app.delete('/api/stores/:id', async (req, res) => {
  try {
    await ops.deleteStoreById(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting store' });
  }
});

// Neighborhood Rates
app.get('/api/rates', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || '';
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });
    const list = await ops.getRatesByTenant(tenantId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching rates' });
  }
});

app.post('/api/rates', async (req, res) => {
  try {
    const item = await ops.upsertRate(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error saving rate' });
  }
});

app.delete('/api/rates/:id', async (req, res) => {
  try {
    await ops.deleteRateById(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting rate' });
  }
});

// Delivery Orders
app.get('/api/orders', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || '';
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });
    const list = await ops.getOrdersByTenant(tenantId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const item = await ops.upsertOrder(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error saving order' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    await ops.deleteOrderById(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error deleting order' });
  }
});

// Shift Closings
app.get('/api/shift-closings', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || '';
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });
    const list = await ops.getShiftClosingsByTenant(tenantId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching shift closings' });
  }
});

app.post('/api/shift-closings', async (req, res) => {
  try {
    const item = await ops.insertShiftClosing(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error saving shift closing' });
  }
});

// Audit Logs
app.get('/api/audit-logs', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || '';
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });
    const list = await ops.getAuditLogsByTenant(tenantId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching audit logs' });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  try {
    const item = await ops.insertAuditLog(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating audit log' });
  }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || '';
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });
    const list = await ops.getNotificationsByTenant(tenantId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching notifications' });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const item = await ops.insertNotification(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error creating notification' });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await ops.updateNotificationRead(req.params.id, req.body.read ?? true);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error updating notification' });
  }
});

app.post('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });
    await ops.markAllNotificationsRead(tenantId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error marking all notifications read' });
  }
});

// Seed Demo data endpoint
app.post('/api/seed-demo', async (req, res) => {
  try {
    const { tenantId, tradeName } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' });

    // Check if tenant already has stores/motoboys
    const existingStores = await ops.getStoresByTenant(tenantId);
    if (existingStores.length > 0) {
      return res.json({ message: 'Already seeded' });
    }

    const name = tradeName || 'JC Logística & Entregas';

    // Seed Motoboys
    const motoboys = [
      { id: `mb_1_${tenantId}`, tenantId, name: 'Lucas Silva', cpf: '111.222.333-44', phone: '(81) 98765-4321', active: true, notes: 'Principal - Turno Tarde/Noite', createdAt: new Date().toISOString() },
      { id: `mb_2_${tenantId}`, tenantId, name: 'Carlos Eduardo', cpf: '222.333.444-55', phone: '(81) 98111-2233', active: true, notes: 'Moto Bros 160 - Bag Térmica', createdAt: new Date().toISOString() },
      { id: `mb_3_${tenantId}`, tenantId, name: 'Rafael Santos', cpf: '333.444.555-66', phone: '(81) 99222-3344', active: true, notes: 'Experiente em Boa Viagem/Pina', createdAt: new Date().toISOString() },
      { id: `mb_4_${tenantId}`, tenantId, name: 'Mateus Oliveira', cpf: '444.555.666-77', phone: '(81) 97333-4455', active: true, notes: 'Turno Geral', createdAt: new Date().toISOString() },
      { id: `mb_5_${tenantId}`, tenantId, name: 'Bruno Alencar', cpf: '555.666.777-88', phone: '(81) 98444-5566', active: false, notes: 'Afastado temporariamente', createdAt: new Date().toISOString() },
    ];
    for (const mb of motoboys) await ops.upsertMotoboy(mb);

    // Seed Stores
    const stores = [
      { id: `st_1_${tenantId}`, tenantId, name: 'Hamburgueria Artesanal Prime', code: 'LOJA-01', cnpj: '21.000.111/0001-22', phone: '(81) 3333-1111', active: true, notes: 'Embalagens padrão grande', createdAt: new Date().toISOString() },
      { id: `st_2_${tenantId}`, tenantId, name: 'Pizzaria Napolitana Express', code: 'LOJA-02', cnpj: '32.111.222/0001-33', phone: '(81) 3333-2222', active: true, notes: 'Pizzas família necessitam baú', createdAt: new Date().toISOString() },
      { id: `st_3_${tenantId}`, tenantId, name: 'Sushi Zen Japanese Food', code: 'LOJA-03', cnpj: '43.222.333/0001-44', phone: '(81) 3333-3333', active: true, notes: 'Cuidado extra com barcas e molhos', createdAt: new Date().toISOString() },
      { id: `st_4_${tenantId}`, tenantId, name: 'Açaí Tropical Raiz', code: 'LOJA-04', cnpj: '54.333.444/0001-55', phone: '(81) 3333-4444', active: true, notes: 'Média de 3 copos por entrega', createdAt: new Date().toISOString() },
    ];
    for (const st of stores) await ops.upsertStore(st);

    // Seed Rates
    const rates = [
      { id: `rt_1_${tenantId}`, tenantId, storeId: stores[0].id, storeName: stores[0].name, neighborhood: 'Boa Viagem', rate: 7.0, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_2_${tenantId}`, tenantId, storeId: stores[0].id, storeName: stores[0].name, neighborhood: 'Pina', rate: 8.5, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_3_${tenantId}`, tenantId, storeId: stores[0].id, storeName: stores[0].name, neighborhood: 'Imbiribeira', rate: 9.0, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_4_${tenantId}`, tenantId, storeId: stores[0].id, storeName: stores[0].name, neighborhood: 'Setúbal', rate: 7.5, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_5_${tenantId}`, tenantId, storeId: stores[1].id, storeName: stores[1].name, neighborhood: 'Boa Viagem', rate: 8.0, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_6_${tenantId}`, tenantId, storeId: stores[1].id, storeName: stores[1].name, neighborhood: 'Pina', rate: 9.0, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_7_${tenantId}`, tenantId, storeId: stores[1].id, storeName: stores[1].name, neighborhood: 'Candeias', rate: 12.0, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_8_${tenantId}`, tenantId, storeId: stores[2].id, storeName: stores[2].name, neighborhood: 'Boa Viagem', rate: 8.5, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_9_${tenantId}`, tenantId, storeId: stores[2].id, storeName: stores[2].name, neighborhood: 'Espinheiro', rate: 14.0, active: true, updatedAt: new Date().toISOString() },
      { id: `rt_10_${tenantId}`, tenantId, storeId: stores[3].id, storeName: stores[3].name, neighborhood: 'Boa Viagem', rate: 6.5, active: true, updatedAt: new Date().toISOString() },
    ];
    for (const rt of rates) await ops.upsertRate(rt);

    // Seed Orders
    const today = new Date().toISOString().split('T')[0];
    const orders = [
      {
        id: `ord_1_${tenantId}`,
        tenantId,
        orderNumber: '#1041',
        dispatchTime: '12:15',
        operationalDate: today,
        shiftName: 'Almoço',
        storeId: stores[0].id,
        storeName: stores[0].name,
        clientName: 'Juliana Cavalcanti',
        clientPhone: '(81) 98888-1111',
        address: 'Rua Navegantes, 1540, Apto 802',
        neighborhood: 'Boa Viagem',
        rate: 7.0,
        motoboyId: motoboys[0].id,
        motoboyName: motoboys[0].name,
        status: 'completed' as const,
        completionTime: '12:35',
        completedByName: 'Sistema Automático',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `ord_2_${tenantId}`,
        tenantId,
        orderNumber: '#1042',
        dispatchTime: '12:30',
        operationalDate: today,
        shiftName: 'Almoço',
        storeId: stores[2].id,
        storeName: stores[2].name,
        clientName: 'Fernando Albuquerque',
        clientPhone: '(81) 97777-2222',
        address: 'Av. Boa Viagem, 3200, Bloco B',
        neighborhood: 'Boa Viagem',
        rate: 8.5,
        motoboyId: motoboys[1].id,
        motoboyName: motoboys[1].name,
        status: 'completed' as const,
        completionTime: '12:55',
        completedByName: 'Carlos Eduardo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `ord_3_${tenantId}`,
        tenantId,
        orderNumber: '#1043',
        dispatchTime: '13:00',
        operationalDate: today,
        shiftName: 'Almoço',
        storeId: stores[1].id,
        storeName: stores[1].name,
        clientName: 'Mariana Duarte',
        clientPhone: '(81) 96666-3333',
        address: 'Rua Capitão Zuzinha, 450',
        neighborhood: 'Setúbal',
        rate: 8.0,
        motoboyId: motoboys[2].id,
        motoboyName: motoboys[2].name,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `ord_4_${tenantId}`,
        tenantId,
        orderNumber: '#1044',
        dispatchTime: '13:10',
        operationalDate: today,
        shiftName: 'Almoço',
        storeId: stores[0].id,
        storeName: stores[0].name,
        clientName: 'Rodrigo Lima',
        clientPhone: '(81) 95555-4444',
        address: 'Rua Barão de Souza Leão, 980',
        neighborhood: 'Boa Viagem',
        rate: 7.0,
        motoboyId: motoboys[0].id,
        motoboyName: motoboys[0].name,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    for (const ord of orders) await ops.upsertOrder(ord);

    // Seed Notification
    const notif = {
      id: `notif_init_${tenantId}`,
      tenantId,
      title: 'Sistema Conectado ao PostgreSQL/Cloud SQL',
      body: 'Banco de dados relacional ativado com suporte completo a relatórios, corridas e fechamentos!',
      type: 'new_order' as const,
      targetRole: 'all' as const,
      read: false,
      timestamp: new Date().toISOString(),
    };
    await ops.insertNotification(notif);

    res.json({ success: true, message: 'Dados de demonstração inicializados com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error seeding demo data' });
  }
});

// Vite Middleware for Full-stack development
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
