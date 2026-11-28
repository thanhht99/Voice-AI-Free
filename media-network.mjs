import { lookup } from 'node:dns/promises';
import { createServer } from 'node:http';
import { BlockList, connect, isIP } from 'node:net';

const blocked = new BlockList();
for (const range of ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16',
  '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16',
  '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/3']) {
  const [address, prefix] = range.split('/');
  blocked.addSubnet(address, Number(prefix));
}
blocked.addAddress('168.63.129.16');

let proxy;

export function mediaProxy() {
  proxy ??= new Promise((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.writeHead(403).end();
    });
    server.on('connect', async (request, client, head) => {
      let upstream;
      client.on('error', () => client.destroy());
      client.on('close', () => upstream?.destroy());
      client.setTimeout(35_000, () => client.destroy());
      try {
        const hostname = /^([a-z0-9.-]+):443$/i.exec(request.url)?.[1];
        if (!hostname?.includes('.') || isIP(hostname) || hostname.endsWith('.')) throw new Error('Blocked destination');
        const addresses = await lookup(hostname, { all: true, family: 4 });
        if (!addresses.length || addresses.some(({ address }) => blocked.check(address))) {
          throw new Error('Blocked destination');
        }
        if (client.destroyed) return;
        // Connect to the checked address without performing a second lookup.
        upstream = connect({ host: addresses[0].address, port: 443 });
        upstream.on('error', () => client.destroy());
        upstream.on('close', () => client.destroy());
        upstream.setTimeout(35_000, () => upstream.destroy());
        upstream.once('connect', () => {
          if (client.destroyed) return upstream.destroy();
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length) upstream.write(head);
          client.pipe(upstream).pipe(client);
        });
      } catch {
        if (!client.destroyed) client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      }
    });
    server.maxConnections = 24;
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.unref();
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  }).catch(error => {
    proxy = undefined;
    throw error;
  });
  return proxy;
}
