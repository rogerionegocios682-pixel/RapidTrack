/**
 * QA: login real com o administrador e verificação do dashboard.
 */
export default async function run(page, ui) {
  const result = { steps: [] };

  // 1) Preenche as credenciais do administrador semeado.
  await ui.fill('@e1', 'admin@deliveryos.com');
  await ui.fill('@e2', 'admin123');
  result.steps.push('credenciais preenchidas');

  // 2) Envia o formulário.
  await ui.click('@e3');
  await page.waitForTimeout(4000);

  result.urlAfterLogin = page.url();
  result.titleAfterLogin = await page.title();

  // 3) Confirma que chegou ao dashboard e lê os indicadores.
  const body = await page.evaluate(() => document.body.innerText);
  result.hasDashboardHeading = body.includes('Corridas de hoje');
  result.hasTaxas = body.includes('Taxas do dia');
  result.hasMotoboys = body.includes('Motoboys');
  result.hasEmpresas = body.includes('Empresas');
  result.hasMenuCorridas = body.includes('Corridas');
  result.hasMenuRelatorios = body.includes('Relatórios');
  result.hasMenuCadastro = body.includes('Cadastro');
  result.hasMenuComunicacao = body.includes('Comunicação Interna');

  // 4) Snapshot da navegação para checar a estrutura do menu.
  const snap = await ui.snapshot();
  result.snapshot = snap;

  return result;
}
