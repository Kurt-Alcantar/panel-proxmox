import { Injectable } from '@nestjs/common';
import axios from 'axios';
import https from 'https';

@Injectable()
export class ProxmoxService {
  private baseUrl = 'https://192.168.10.20:8006/api2/json';

  private headers = {
    Authorization:
      'PVEAPIToken=root@pam!krts=7bd7045b-0ca8-4a8a-a477-3b892e5911ee'
  };
    async startVM(vmid: number) {
    const res = await axios.post(
      `${this.baseUrl}/nodes/hyperprox/qemu/${vmid}/status/start`,
      null,
      {
        headers: this.headers,
        httpsAgent: this.agent
      }
    );

    return res.data;
  }

  async stopVM(vmid: number) {
    const res = await axios.post(
      `${this.baseUrl}/nodes/hyperprox/qemu/${vmid}/status/stop`,
      null,
      {
        headers: this.headers,
        httpsAgent: this.agent
      }
    );

    return res.data;
  }

  async restartVM(vmid: number) {
    const res = await axios.post(
      `${this.baseUrl}/nodes/hyperprox/qemu/${vmid}/status/reboot`,
      null,
      {
        headers: this.headers,
        httpsAgent: this.agent
      }
    );

    return res.data;
  }
  private agent = new https.Agent({
    rejectUnauthorized: false
  });

  async getNodes() {
    const res = await axios.get(`${this.baseUrl}/nodes`, {
      headers: this.headers,
      httpsAgent: this.agent
    });
    return res.data.data;
  }
  async getVmConsole(vmid: number) {
    const res = await axios.post(
      `${this.baseUrl}/nodes/hyperprox/qemu/${vmid}/vncproxy`,
      null,
      {
        headers: this.headers,
        httpsAgent: this.agent
      }
    );

    return res.data.data;
  }

  async getVmConsoleWebSocket(vmid: number, vncticket: string, port: number) {
    return {
      host: '192.168.10.20',
      port,
      vncticket,
      path: `/api2/json/nodes/hyperprox/qemu/${vmid}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(vncticket)}`
    };
  }

  async getVMs(node: string) {
    const res = await axios.get(`${this.baseUrl}/nodes/${node}/qemu`, {
      headers: this.headers,
      httpsAgent: this.agent
    });
    return res.data.data;
  }

  async getPools() {
    const res = await axios.get(`${this.baseUrl}/pools`, {
      headers: this.headers,
      httpsAgent: this.agent
    });
    return res.data.data;
  }

  async getPool(poolId: string) {
    const res = await axios.get(`${this.baseUrl}/pools/${encodeURIComponent(poolId)}`, {
      headers: this.headers,
      httpsAgent: this.agent
    });
    return res.data.data;
  }

  async getAllVMs() {
    const nodes = await this.getNodes();
    const pools = await this.getPools();

    const vmPoolMap = new Map<number, string>();

    for (const pool of pools) {
      const detail = await this.getPool(pool.poolid);

      if (detail?.members?.length) {
        for (const member of detail.members) {
          if (member.type === 'qemu' && member.vmid) {
            vmPoolMap.set(member.vmid, pool.poolid);
          }
        }
      }
    }

    const allVMs: any[] = [];

    for (const node of nodes) {
      const vms = await this.getVMs(node.node);

      for (const vm of vms) {
        allVMs.push({
          vmid: vm.vmid,
          name: vm.name ?? null,
          node: node.node,
          pool_id: vmPoolMap.get(vm.vmid) ?? null,
          status: vm.status ?? null,
          cpu: vm.cpus ?? null,
          memory: vm.maxmem ?? null,
          disk: vm.maxdisk ?? null
        });
      }
    }

    return allVMs;
  }
}