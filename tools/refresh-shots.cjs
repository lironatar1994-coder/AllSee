// Re-take site screenshots: node tools/refresh-shots.cjs "<Work>/Portfolio/node_modules/playwright" shots "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
const { chromium } = require(process.argv[2]);
const out = process.argv[3];
const list = [
 ['lawebs','https://lawebs.co.il/'],['pinhas','https://pinhasratzon.co.il/'],['miryam','https://miryamzelig.co.il/'],
 ['libi','https://www.libidiamonds.co.il/'],['dfus','https://www.dfusreuven.co.il/'],['alenu','https://lawebs.co.il/alenu/'],
 ['maavar','https://vee-app.co.il/maavar'],['milatova','https://lawebs.co.il/cv/'],['pizza','https://lawebs.co.il/PizzaManager/'],
 ['seder','https://lawebs.co.il/seder/'],['koral','https://lawebs.co.il/Koralevents'],['vee','https://vee-app.co.il/'],
 ['pdf','https://vee-app.co.il/pdf-studio/'],['manager','https://vee-app.co.il/Manager_Site/login'],['videos','https://lawebs.co.il/videos/'],
 ['sos','https://sosbaderech.co.il/'],['lawebs-lp','https://lawebs.co.il/lp/']
];
(async () => {
  const b = await chromium.launch({ executablePath: process.argv[4] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'he-IL' });
  for (const [k, u] of list) {
    const p = await ctx.newPage();
    try {
      await p.goto(u, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
      await p.waitForTimeout(2500);
      await p.screenshot({ path: `${out}/${k}.jpg`, type: 'jpeg', quality: 72 });
      console.log('ok', k);
    } catch (e) { console.log('fail', k, e.message); }
    await p.close();
  }
  await b.close();
})();
