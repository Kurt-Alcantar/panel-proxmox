import { Controller, Get, Param, Post } from '@nestjs/common';
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

  @Get('tenant-groups/:code/vms')
  async listByTenantGroup(@Param('code') code: string) {
    const tenantGroup = await this.prisma.tenant_groups.findFirst({
      where: { code }
    });

    if (!tenantGroup) {
      return [];
    }

    const bindings = await this.prisma.tenant_group_pools.findMany({
      where: { tenant_group_id: tenantGroup.id }
    });

    const proxmoxPoolIds = bindings.map((b) => b.proxmox_pool_id);

    if (!proxmoxPoolIds.length) {
      return [];
    }

    const pools = await this.prisma.proxmox_pools.findMany({
      where: {
        id: {
          in: proxmoxPoolIds
        }
      }
    });

    const poolNames = pools.map((p) => p.external_id);

    const vms = await this.prisma.vm_inventory.findMany({
      where: {
        pool_id: {
          in: poolNames
        }
      },
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
          name: vm.name ?? null,
          node: vm.node ?? null,
          pool_id: vm.pool_id ?? null,
          status: vm.status ?? null,
          cpu: vm.cpu ?? null,
          memory: vm.memory !== null && vm.memory !== undefined ? BigInt(vm.memory) : null,
          disk: vm.disk !== null && vm.disk !== undefined ? BigInt(vm.disk) : null
        },
        create: {
          vmid: vm.vmid,
          name: vm.name ?? null,
          node: vm.node ?? null,
          pool_id: vm.pool_id ?? null,
          status: vm.status ?? null,
          cpu: vm.cpu ?? null,
          memory: vm.memory !== null && vm.memory !== undefined ? BigInt(vm.memory) : null,
          disk: vm.disk !== null && vm.disk !== undefined ? BigInt(vm.disk) : null
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