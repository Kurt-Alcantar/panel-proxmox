import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ProxmoxService } from './proxmox.service';
import { AuthGuard } from './auth.guard';
import { AuditService } from './audit.service';
import { getVmObservability } from './observability';

@Controller()
export class VmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proxmox: ProxmoxService,
    private readonly audit: AuditService
  ) {}

  private serializeVm(vm: any) {
    return {
      ...vm,
      memory: vm.memory !== null ? vm.memory.toString() : null,
      disk: vm.disk !== null ? vm.disk.toString() : null
    }
  }

  @UseGuards(AuthGuard)
  @Get('vms/:vmid')
  async getVmDetail(@Param('vmid') vmid: string, @Req() req: any) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      return null;
    }

    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: keycloakId }
    });

    if (!user?.tenant_group_id) {
      return null;
    }

    const bindings = await this.prisma.tenant_group_pools.findMany({
      where: { tenant_group_id: user.tenant_group_id }
    });

    const poolIds = bindings.map((b) => b.proxmox_pool_id);

    const pools = await this.prisma.proxmox_pools.findMany({
      where: { id: { in: poolIds } }
    });

    const poolNames = pools.map((p) => p.external_id);

    const vm = await this.prisma.vm_inventory.findFirst({
      where: {
        vmid: Number(vmid),
        pool_id: { in: poolNames }
      }
    });

    if (!vm) {
      return null;
    }

    return {
      ...this.serializeVm(vm),
      observability: getVmObservability(vm)
    };
  }

  @UseGuards(AuthGuard)
  @Get('vms')
  async list() {
    const vms = await this.prisma.vm_inventory.findMany({
      orderBy: { vmid: 'asc' }
    });

    return vms.map((vm) => this.serializeVm(vm));
  }

  @UseGuards(AuthGuard)
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

    return vms.map((vm) => this.serializeVm(vm));
  }

  @UseGuards(AuthGuard)
  @Get('my/vms')
  async myVMs(@Req() req: any) {
    const keycloakId = req.user?.sub;

    if (!keycloakId) {
      return [];
    }

    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: keycloakId }
    });

    if (!user?.tenant_group_id) {
      return [];
    }

    const bindings = await this.prisma.tenant_group_pools.findMany({
      where: { tenant_group_id: user.tenant_group_id }
    });

    const poolIds = bindings.map((b) => b.proxmox_pool_id);

    if (!poolIds.length) {
      return [];
    }

    const pools = await this.prisma.proxmox_pools.findMany({
      where: {
        id: {
          in: poolIds
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

    return vms.map((vm) => this.serializeVm(vm));
  }

  @UseGuards(AuthGuard)
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

  @UseGuards(AuthGuard)
  @Get('pools')
  async listPools() {
    return this.prisma.proxmox_pools.findMany({
      orderBy: { name: 'asc' }
    });
  }

  @UseGuards(AuthGuard)
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

  @UseGuards(AuthGuard)
  @Post('vms/:vmid/start')
  async startVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: req.user?.sub }
    });

    await this.proxmox.startVM(Number(vmid));

    await this.audit.log({
      userId: user?.id ?? null,
      action: 'vm.start',
      target: `vm:${vmid}`,
      result: 'success'
    });

    return { status: 'started', vmid: Number(vmid) };
  }

  @UseGuards(AuthGuard)
  @Post('vms/:vmid/stop')
  async stopVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: req.user?.sub }
    });

    await this.proxmox.stopVM(Number(vmid));

    await this.audit.log({
      userId: user?.id ?? null,
      action: 'vm.stop',
      target: `vm:${vmid}`,
      result: 'success'
    });

    return { status: 'stopped', vmid: Number(vmid) };
  }

  @UseGuards(AuthGuard)
  @Post('vms/:vmid/restart')
  async restartVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: req.user?.sub }
    });

    await this.proxmox.restartVM(Number(vmid));

    await this.audit.log({
      userId: user?.id ?? null,
      action: 'vm.restart',
      target: `vm:${vmid}`,
      result: 'success'
    });

    return { status: 'restarted', vmid: Number(vmid) };
  }

  @UseGuards(AuthGuard)
  @Post('vms/:vmid/console')
  async openConsole(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: req.user?.sub }
    });

    const consoleData = await this.proxmox.getVmConsole(Number(vmid));

    await this.audit.log({
      userId: user?.id ?? null,
      action: 'vm.console.open',
      target: `vm:${vmid}`,
      result: 'success'
    });

    return {
      vmid: Number(vmid),
      ...consoleData,
      url: `https://192.168.10.20:8006/?console=kvm&novnc=1&vmid=${vmid}&node=hyperprox&resize=scale`
    };
  }

  @UseGuards(AuthGuard)
  @Get('vms/:vmid/audit')
  async getVmAudit(@Param('vmid') vmid: string) {
    return this.prisma.audit_logs.findMany({
      where: { target: `vm:${vmid}` },
      orderBy: { created_at: 'desc' },
      take: 100
    });
  }

  @UseGuards(AuthGuard)
  @Get('audit')
  async listAudit() {
    return this.prisma.audit_logs.findMany({
      orderBy: { created_at: 'desc' },
      take: 100
    });
  }
}
