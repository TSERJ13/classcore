async function check() {
  const res = await fetch('http://localhost:3000/api/sync/state?slug=stdancestudio');
  const data = await res.json();
  console.log('SYNC STATE API RESPONSE:');
  console.log('studio:', JSON.stringify(data.studio, null, 2));
  console.log('settingsRecord._operations:', JSON.stringify(data.settingsRecord?.staff_data?._operations, null, 2));
}

// Start temporary server and check
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const app = next({ dev: false, dir: '/Users/sergitsivtsivadze/Downloads/studioflow' });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });
  server.listen(3001, async () => {
    try {
      const res = await fetch('http://localhost:3001/api/sync/state?slug=stdancestudio&isClientPortal=true');
      const data = await res.json();
      console.log('STUDIO:', JSON.stringify(data.studio, null, 2));
      console.log('BILLING IN STAFF_DATA:', JSON.stringify(data.settingsRecord?.staff_data?._operations?.cc_saas_billing, null, 2));
    } catch (e) {
      console.error(e);
    }
    server.close();
    process.exit(0);
  });
});
