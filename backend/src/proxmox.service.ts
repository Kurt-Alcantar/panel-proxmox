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

  async getVMs(node: string) {
    const res = await axios.get(`${this.baseUrl}/nodes/${node}/qemu`, {
      headers: this.headers,
      httpsAgent: this.agent
    });

    return res.data.data;
  }

  async getAllVMs() {
    const nodes = await this.getNodes();
    const allVMs: any[] = [];

    for (const node of nodes) {
      const vms = await this.getVMs(node.node);

      for (const vm of vms) {
        allVMs.push({
          vmid: vm.vmid,
          name: vm.name ?? null,
          node: node.node,
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