import { Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ProxmoxService } from './proxmox.service';

@Controller()
export class VmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proxmox: ProxmoxService
  ) {}

  @Get('vms')
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

  @Post('vms/sync')
  async syncVMs() {
    const vms = await this.proxmox.getAllVMs();

    for (const vm of vms) {
      await this.prisma.vm_inventory.upsert({
        where: { vmid: vm.vmid },
        update: {
          name: vm.name,
          node: vm.node,
          pool_id: vm.pool_id,
          status: vm.status,
          cpu: vm.cpu,
          memory: vm.memory,
          disk: vm.disk
        },
        create: {
          vmid: vm.vmid,
          name: vm.name,
          node: vm.node,
          pool_id: vm.pool_id,
          status: vm.status,
          cpu: vm.cpu,
          memory: vm.memory,
          disk: vm.disk
        }
      });
    }

    return { synced: vms.length };
  }

  @Get('pools')
  async listPools() {
    return this.prisma.proxmox_pools.findMany({
      orderBy: { name: 'asc' }
    });
  }

  @Post('pools/sync')
  async syncPools() {
    const pools = await this.proxmox.getPools();

    for (const pool of pools) {
      await this.prisma.proxmox_pools.upsert({
        where: { external_id: pool.poolid },
        update: {
          name: pool.poolid
        },
        create: {
          external_id: pool.poolid,
          name: pool.poolid
        }
      });
    }

    return { synced: pools.length };
  }
}