import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { FleetService } from './fleet.service'

@Injectable()
export class FleetSyncJob {
  private readonly logger = new Logger(FleetSyncJob.name)

  constructor(
    private readonly fleet: FleetService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Sincroniza todos los agentes de Fleet con managed_assets.
   * Llamar desde un cron job o manualmente via POST /fleet/sync
   */
  async run(): Promise<{ created: number; updated: number; errors: number }> {
    this.logger.log('Iniciando sincronización Fleet...')

    const agents = await this.fleet.getAllAgents()
    let created = 0
    let updated = 0
    let errors = 0

    for (const agent of agents) {
      try {
        const result = await this.upsertAgent(agent)
        if (result === 'created') created++
        else updated++
      } catch (err: any) {
        this.logger.error(`Error procesando agente ${agent?.id}: ${err?.message}`)
        errors++
      }
    }

    this.logger.log(`Sync completado: ${created} creados, ${updated} actualizados, ${errors} errores`)
    return { created, updated, errors }
  }

  private async upsertAgent(agent: any): Promise<'created' | 'updated'> {
    const fleetAgentId: string = agent.id
    if (!fleetAgentId) throw new Error('Agente sin id')

    const localMetadata = agent.local_metadata || {}
    const hostMeta = localMetadata.host || {}
    const osMeta = localMetadata.os || {}

    const data = {
      fleet_agent_id: fleetAgentId,
      elastic_agent_id: agent.agent?.id ?? null,
      fleet_policy_id: agent.policy_id ?? null,
      fleet_policy_name: agent.policy_name ?? null,
      host_name: hostMeta.hostname ?? hostMeta.name ?? localMetadata.hostname ?? null,
      host_id: hostMeta.id ?? null,
      os_type: this.normalizeOs(osMeta.type ?? osMeta.platform),
      os_name: osMeta.name ?? null,
      os_version: osMeta.version ?? null,
      architecture: osMeta.arch ?? null,
      ip_addresses: this.extractIps(agent),
      last_checkin_at: agent.last_checkin ? new Date(agent.last_checkin) : null,
      agent_status: agent.status ?? null,
      agent_version: agent.agent?.version ?? null,
      last_synced_at: new Date(),
      source: 'fleet',
    }

    const existing = await this.prisma.managed_assets.findUnique({
      where: { fleet_agent_id: fleetAgentId },
    })

    if (!existing) {
      const created = await this.prisma.managed_assets.create({
        data: {
          ...data,
          display_name: data.host_name ?? `Agent ${fleetAgentId.slice(0, 8)}`,
        },
      })
      await this.logEvent(created.id, 'created', { fleet_agent_id: fleetAgentId })
      return 'created'
    }

    // Detectar cambios relevantes para auditoría
    const statusChanged = existing.agent_status !== data.agent_status
    const policyChanged = existing.fleet_policy_id !== data.fleet_policy_id
    const hostnameChanged = existing.host_name !== data.host_name && data.host_name

    await this.prisma.managed_assets.update({
      where: { fleet_agent_id: fleetAgentId },
      data,
    })

    if (statusChanged) {
      await this.logEvent(existing.id, 'status_changed', {
        from: existing.agent_status,
        to: data.agent_status,
      })
    }
    if (policyChanged) {
      await this.logEvent(existing.id, 'policy_changed', {
        from: existing.fleet_policy_id,
        to: data.fleet_policy_id,
      })
    }
    if (hostnameChanged) {
      await this.logEvent(existing.id, 'hostname_changed', {
        from: existing.host_name,
        to: data.host_name,
      })
    }

    return 'updated'
  }

  private normalizeOs(value?: string | null): 'windows' | 'linux' | null {
    if (!value) return null
    const v = value.toLowerCase()
    if (v.includes('windows')) return 'windows'
    if (v.includes('linux') || v.includes('darwin') || v.includes('unix')) return 'linux'
    return null
  }

  private extractIps(agent: any): string[] {
    const ips = new Set<string>()
    const details = agent.local_metadata?.elastic?.agent?.complete_ip_details ?? []
    for (const iface of details) {
      if (iface.ip) ips.add(iface.ip)
    }
    return Array.from(ips)
  }

  private async logEvent(assetId: string | null, eventType: string, payload: any) {
    await this.prisma.asset_sync_events.create({
      data: { asset_id: assetId, event_type: eventType, payload },
    })
  }
}
