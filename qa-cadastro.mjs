export default async function run(page, ui) {
  const out = { steps: [] };
  const snap = async (label) => {
    const s = await ui.snapshot();
    out.steps.push({ label, snapshot: s });
    return s;
  };

  // 1) Login page
  let s = await snap('login-page');
  const loginSnap = s;
  out.title = await page.title();
  out.url = page.url();
  return out;
}
