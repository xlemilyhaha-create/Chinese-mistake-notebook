import { spawn } from 'child_process';
import fetch from 'node-fetch';

const server = spawn('npx', ['tsx', 'server.ts']);

server.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
  if (data.toString().includes('Server running')) {
    runTest();
  }
});

server.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

async function runTest() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 1000);
  }
}
