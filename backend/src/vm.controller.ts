import { Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ProxmoxService } from './proxmox.service';

@Controller('vms')
export class VmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proxmox: ProxmoxService
  ) {}

  @Get()
  async list() {
    const vms = await this.prisma.vm_inventory.findMany({
      orderBy: { vmid: 'asc' }
    });

    return vms.map((vm) => ({
      ...vm,
      memory: vm.memory !== null ? vm.memory.toString() : null,
      disk: vm.disk !== null ? vm.disk.toString() : null
    }));
  }

  @Post('sync')
  async sync() {
    const vms = await this.proxmox.getAllVMs();

    for (const vm of vms) {
      await this.prisma.vm_inventory.upsert({
        where: {
          vmid: vm.vmid
        },
        update: {
          name: vm.name,
          node: vm.node,
          status: vm.status,
          cpu: vm.cpu,
          memory: vm.memory,
          disk: vm.disk
        },
        create: {
          vmid: vm.vmid,
          name: vm.name,
          node: vm.node,
          status: vm.status,
          cpu: vm.cpu,
          memory: vm.memory,
          disk: vm.disk
        }
      });
    }

    return {
      synced: vms.length
    };
  }
}