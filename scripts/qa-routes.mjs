/**
 * QA de navegação: loga e visita todas as novas rotas do menu,
 * registrando o título, o texto visível e eventuais erros por página.
 */
export default async function run(page, ui) {
  const result = { pages: [], errors: [] };

  const snap = await ui.snapshot();
  const refs = [...snap.matchAll(/@(e\d+) textbox[^\n]*/g)].map((m) => m[0]);
  if (refs.length < 2) return { error: 'campos de login não encontrados', snap };

  await ui.fill(`@${refs[0].match(/@(e\d+)/)[1]}`, 'rogerionegocios682@gmail.com');
  await ui.fill(`@${refs[1].match(/@(e\d+)/)[1]}`, '@eRro404');

  const afterFill = await ui.snapshot();
  const btn = afterFill.match(/@(e\d+) button "Entrar"/i)?.[1];
  if (!btn) return { error: 'botão entrar não encontrado', afterFill };
  await ui.click(`@${btn}`);

  try {
    await page.waitForURL('**/dashboard', { timeout: 60000 });
  } catch {
    return { error: 'não redirecionou para /dashboard', url: page.url() };
  }

  const routes = [
    '/dashboard/corridas/nova',
    '/dashboard/corridas/hoje',
    '/dashboard/corridas',
    '/dashboard/relatorios/diario',
    '/dashboard/relatorios/semanal',
    '/dashboard/relatorios/mensal',
    '/dashboard/relatorios/anual',
    '/dashboard/relatorios/motoboy',
    '/dashboard/relatorios/empresa',
    '/dashboard/cadastro/empresas',
    '/dashboard/cadastro/motoboys',
    '/dashboard/cadastro/bairros',
    '/dashboard/cadastro/taxas',
    '/dashboard/comunicacao',
    '/dashboard/comunicacao/comunicados',
    '/dashboard/perfil',
    '/dashboard/configuracoes',
  ];

  for (const route of routes) {
    const consoleErrors = [];
    const onConsole = (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    };
    page.on('console', onConsole);

    try {
      await page.goto(`http://localhost:3000${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1500);
      const title = await page.title();
      const h1 = await page.evaluate(() => document.querySelector('h1')?.innerText ?? '');
      const bodyChars = await page.evaluate(() => document.body.innerText.length);
      result.pages.push({ route, title, h1, bodyChars, consoleErrors });
    } catch (e) {
      result.errors.push({ route, error: String(e).slice(0, 200) });
    } finally {
      page.off('console', onConsole);
    }
  }

  return result;
}
