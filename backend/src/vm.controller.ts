import { Controller, Get } from '@nestjs/common';
import { ProxmoxService } from './proxmox.service';

@Controller('vms')
export class VmController {
  constructor(private proxmox: ProxmoxService) {}

  @Get()
  async list() {
    const nodes = await this.proxmox.getNodes();

    let allVMs = [];

    for (const node of nodes) {
      const vms = await this.proxmox.getVMs(node.node);
      allVMs.push(...vms);
    }

    return allVMs;
  }
}