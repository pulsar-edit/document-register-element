const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

function createServer(root) {
  return http.createServer((req, res) => {
    const filePath = path.join(root, req.url.split('?')[0]);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

(async () => {
  const server = createServer(__dirname);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  await page.goto(`http://127.0.0.1:${port}/index.html`);

  // wru prepends a summary div with class pass/fail/error when done
  await page.waitForSelector('#wru strong', { timeout: 30000 });

  const results = await page.evaluate(() => {
    const passed = Math.max(0, document.querySelectorAll('.pass').length - 1);
    let testCount = document.querySelector('#wru strong')?.textContent.replace(/\D/g, '');
    return {
      total: `${passed} blocks (${testCount} individual tests)`,
      passed,
      failed: Math.max(0, document.querySelectorAll('.fail').length - 1),
      failures: [].map.call(document.querySelectorAll('.fail'), n => n.textContent),
      errored: Math.max(0, document.querySelectorAll('.error').length - 1),
      errors: [].map.call(document.querySelectorAll('.error'), n => n.textContent),
    };
  });

  console.log('- - - - - - - - - -');
  console.log('total:   ' + results.total);
  console.log('- - - - - - - - - -');
  console.log('passed:  ' + results.passed);
  if (results.failed) console.log('failures:\n' + results.failures.join('\n'));
  else console.log('failed:  ' + results.failed);
  if (results.errored) console.log('errors:\n' + results.errors.join('\n'));
  else console.log('errored: ' + results.errored);
  console.log('- - - - - - - - - -');

  await browser.close();
  server.close();
  process.exit(results.failed + results.errored > 0 ? 1 : 0);
})();
