import { createHash, randomUUID } from 'crypto';
import { networkInterfaces, hostname } from 'os';
import si from 'systeminformation';
import { AGENT_VERSION } from '../agent-version';

export async function collectDeviceInfo() {
  const [system, cpu, mem, osInfo, network] = await Promise.all([
    si.system(),
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.networkInterfaces(),
  ]);

  const primaryNet = (network as Array<{ mac?: string; ip4?: string }>).find(
    (n) => n.mac && n.mac !== '00:00:00:00:00:00',
  );

  let publicIp = '';
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { ip?: string };
    publicIp = data.ip ?? '';
  } catch {
    /* offline */
  }

  const fingerprint = [
    system.uuid,
    system.serial,
    hostname(),
    cpu.brand,
    String(mem.total),
  ].join('|');

  const deviceHash = createHash('sha256').update(fingerprint).digest('hex');

  return {
    deviceHash,
    machineFingerprint: createHash('sha256').update(fingerprint).digest('hex').slice(0, 32),
    machineUuid: system.uuid || randomUUID(),
    osVersion: `${osInfo.distro} ${osInfo.release}`,
    ipAddress: primaryNet?.ip4 ?? '',
    publicIp,
    ram: `${Math.round(mem.total / 1024 / 1024 / 1024)} GB`,
    cpu: cpu.brand,
    storage: '',
    macAddress: primaryNet?.mac ?? '',
    domainName: hostname(),
    agentVersion: AGENT_VERSION,
  };
}

export function getMacAddress(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        return net.mac;
      }
    }
  }
  return '';
}
