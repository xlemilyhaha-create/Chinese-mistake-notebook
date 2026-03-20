const fs = require('fs');
const path = require('path');

function getPidListeningOnPort(port) {
  const hexPort = port.toString(16).padStart(4, '0').toUpperCase();
  const tcpContent = fs.readFileSync('/proc/net/tcp', 'utf8');
  const lines = tcpContent.split('\n').slice(1);
  
  let targetInode = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    const localAddress = parts[1];
    const [, localPort] = localAddress.split(':');
    if (localPort === hexPort) {
      targetInode = parts[9];
      break;
    }
  }

  if (!targetInode) {
    console.log(`No process found listening on port ${port}`);
    return null;
  }

  const pids = fs.readdirSync('/proc').filter(f => /^\d+$/.test(f));
  for (const pid of pids) {
    try {
      const fdDir = path.join('/proc', pid, 'fd');
      const fds = fs.readdirSync(fdDir);
      for (const fd of fds) {
        try {
          const link = fs.readlinkSync(path.join(fdDir, fd));
          if (link === `socket:[${targetInode}]`) {
            return pid;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  return null;
}

const pid = getPidListeningOnPort(3000);
if (pid) {
  console.log(`Found PID ${pid} listening on port 3000. Killing it...`);
  process.kill(pid, 'SIGKILL');
  console.log('Killed.');
} else {
  console.log('No PID found.');
}
