const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });
  await page.goto('http://localhost:3000/calendar');
  await page.waitForTimeout(3000);
  const errText = await page.evaluate(() => {
     const nextErr = document.querySelector('nextjs-portal');
     if (!nextErr) return 'No portal';
     return nextErr.shadowRoot ? nextErr.shadowRoot.textContent : 'ShadowRoot empty';
  });
  console.log('Error Content:', errText.substring(0, 1000));
  await browser.close();
})();
