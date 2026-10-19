/**
 * QA da validação front-end do login.
 *  1. Campos vazios -> botão desabilitado / erro ao tentar enviar.
 *  2. E-mail inválido -> mensagem de erro visível.
 *  3. Preenchimento válido -> sem erro, botão habilitado.
 *  4. Links de "Esqueci minha senha" e "Novo cadastro" presentes.
 */
export default async function run(page, ui) {
  const out = {};
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const snap = await ui.snapshot();
  out.hasForgotLink = /ESQUECI MINHA SENHA/i.test(snap);
  out.hasRegisterLink = /NOVO CADASTRO/i.test(snap);
  out.hasEmailField = /textbox "E-mail"/i.test(snap);
  out.hasPasswordField = /textbox "Senha"/i.test(snap);

  const emailBox = snap.match(/@(e\d+) textbox "E-mail"/i)?.[1];
  const passBox = snap.match(/@(e\d+) textbox "Senha"/i)?.[1];
  const submitBtn = snap.match(/@(e\d+) button[^\n]*ENTRAR/i)?.[1];

  out.initialSubmitDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /ENTRAR/i.test(x.textContent));
    return b ? b.disabled : null;
  });

  // --- 1. Tenta enviar vazio: clica e confere erros visíveis ---
  if (submitBtn) {
    await ui.click(`@${submitBtn}`).catch(() => { });
    await page.waitForTimeout(600);
  }
  out.emptyErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.field-error')].map((e) => e.innerText.trim()),
  );
  out.urlAfterEmptySubmit = page.url();

  // --- 2. E-mail inválido ---
  if (emailBox) await ui.fill(`@${emailBox}`, 'nao-e-email');
  if (passBox) await ui.fill(`@${passBox}`, 'senha123');
  await page.evaluate(() => {
    document.querySelector('input[name="email"]')?.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  await page.waitForTimeout(600);
  out.invalidEmailErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.field-error')].map((e) => e.innerText.trim()),
  );

  // --- 3. Preenchimento válido ---
  if (emailBox) await ui.fill(`@${emailBox}`, 'teste@exemplo.com');
  await page.waitForTimeout(600);
  out.validEmailErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.field-error')].map((e) => e.innerText.trim()),
  );
  out.submitEnabledWhenValid = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /ENTRAR/i.test(x.textContent));
    return b ? !b.disabled : null;
  });

  return out;
}