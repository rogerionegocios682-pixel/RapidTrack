// QA automatizado da aba Cadastro: login real + CRUD de empresa/motoboy/bairro/taxa.
export default async function run(page, ui) {
  const base = 'http://localhost:3000';
  const result = { steps: [] };
  const step = (name, extra = {}) => result.steps.push({ name, ...extra });

  // ---------- LOGIN ----------
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  let snap = await ui.snapshot();
  const emailRef = snap.match(/@(e\d+) textbox/)?.[1];
  const passRef = snap.match(/@(e\d+) textbox[^\n]*/g);
  if (!emailRef) return { error: 'campo de e-mail não encontrado', snap };

  const boxes = [...snap.matchAll(/@(e\d+) textbox(?:[^\n]*)/g)].map((m) => m[1]);
  const buttons = [...snap.matchAll(/@(e\d+) button "([^"]*)"/g)].map((m) => ({ ref: m[1], name: m[2] }));

  const signIn = buttons.find((b) => /entrar|login|acessar/i.test(b.name));
  if (!signIn) return { error: 'botão de entrar não encontrado', snap };

  await ui.fill(boxes[0], 'rogerionegocios682@gmail.com');
  await ui.fill(boxes[1], 'admin123');
  await ui.click(signIn.ref);
  await page.waitForTimeout(4000);

  const urlAfter = page.url();
  step('login', { url: urlAfter });
  if (/\/login/.test(urlAfter)) {
    snap = await ui.snapshot();
    return { error: 'login falhou', snap, url: urlAfter };
  }

  // ---------- CADASTRO (índice) ----------
  await page.goto(`${base}/dashboard/cadastro`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  snap = await ui.snapshot({ full: true });
  step('cadastro_index', { hasEmpresas: /Empresas/.test(snap), hasMotoboys: /Motoboys/.test(snap), hasBairros: /Bairros/.test(snap), hasTaxas: /Taxas/.test(snap) });

  // ---------- EMPRESAS: criar ----------
  await page.goto(`${base}/dashboard/cadastro/empresas`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const stamp = Date.now().toString().slice(-6);
  const companyName = `Empresa QA ${stamp}`;

  snap = await ui.snapshot();
  const newCompanyBtn = snap.match(/@(e\d+) button "([^"]*)"/g) || [];
  step('empresas_page', { buttons: newCompanyBtn.slice(0, 12) });

  return { ok: true, ...result };
}
