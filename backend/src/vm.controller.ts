@Get('my/vms')
async myVMs() {
  // TEMP: usuario hardcodeado
  const user = await this.prisma.users.findFirst({
    where: { email: 'test@hyperox.com' }
  });

  if (!user?.tenant_group_id) {
    return [];
  }

  const bindings = await this.prisma.tenant_group_pools.findMany({
    where: { tenant_group_id: user.tenant_group_id }
  });

  const poolIds = bindings.map(b => b.proxmox_pool_id);

  const pools = await this.prisma.proxmox_pools.findMany({
    where: { id: { in: poolIds } }
  });

  const poolNames = pools.map(p => p.external_id);

  const vms = await this.prisma.vm_inventory.findMany({
    where: {
      pool_id: {
        in: poolNames
      }
    }
  });

  return vms.map(vm => ({
    ...vm,
    memory: vm.memory?.toString() ?? null,
    disk: vm.disk?.toString() ?? null
  }));
}