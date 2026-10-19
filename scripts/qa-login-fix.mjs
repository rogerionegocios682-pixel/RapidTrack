/**
 * QA do fix de build: login real em modo produção.
 * Verifica que a Server Action de login NÃO quebra mais com
 * "Cannot set properties of undefined (setting 'exports')" (sql.js no bundle browser).
 */
export default async function run(page, ui) {
  const result = { steps: [] };

  const snapshot = await ui.snapshot();
  result.steps.push('snapshot inicial obtido');

  // Descobre os refs dos campos de e-mail e senha.
  const refs = [...snapshot.matchAll(/@(e\d+) textbox[^\n]*/g)].map((m) => m[0]);
  result.textboxes = refs;

  if (refs.length < 2) {
    return { ...result, error: 'não encontrei os dois campos de texto', snapshot };
  }

  // Ordem típica: e-mail primeiro, senha depois.
  const emailCode = refs[0].match(/@(e\d+)/)[1];
  const passCode = refs[1].match(/@(e\d+)/)[1];

  await ui.fill(`@${emailCode}`, 'rogerionegocios682@gmail.com');
  result.steps.push('email preenchido');
  await ui.fill(`@${passCode}`, '@eRro404');
  result.steps.push('senha preenchida');

  const afterFill = await ui.snapshot();
  const submitRef = afterFill.match(/@(e\d+) button "Entrar"/i)?.[1]
    ?? afterFill.match(/@(e\d+) button/i)?.[1];
  if (!submitRef) return { ...result, error: 'botão de entrar não encontrado', afterFill };

  await ui.click(`@${submitRef}`);
  result.steps.push('clique em Entrar');

  // Espera o dashboard (pós-login) ou um erro.
  try {
    await page.waitForURL('**/dashboard', { timeout: 90000 });
    result.steps.push('redirecionou para /dashboard');
  } catch {
    result.steps.push('NÃO redirecionou para /dashboard');
  }

  await page.waitForTimeout(2500);
  result.urlAfterLogin = page.url();
  result.titleAfterLogin = await page.title();

  const tree = await ui.snapshot({ full: true });
  result.dashboardVisible = /Dashboard|Painel|Corridas|Motoboys/i.test(tree);
  result.treeSample = tree.slice(0, 1200);

  return result;
}
