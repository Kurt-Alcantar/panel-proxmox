import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { FleetService } from './fleet.service'

// Último sync en memoria (consultable desde /api/fleet/sync-status)
let lastSyncAt: Date | null = null
export function getLastSyncAt() { return lastSyncAt }

@Injectable()
export class FleetSyncJob {
  private readonly logger = new Logger(FleetSyncJob.name)

  constructor(
    private readonly fleet: FleetService,
    private readonly prisma: PrismaService,
  ) {}

  async run(): Promise<{ created: number; updated: number; unenrolled: number; errors: number }> {
    this.logger.log('Iniciando sincronización Fleet...')

    const agents = await this.fleet.getAllAgents()
    const activeIds = new Set(agents.map((a: any) => a.id).filter(Boolean))

    let created = 0, updated = 0, unenrolled = 0, errors = 0

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

    // Marcar como unenrolled los activos que ya no están en Fleet
    try {
      const allLocal = await this.prisma.managed_assets.findMany({
        where: { source: 'fleet', agent_status: { not: 'unenrolled' }, fleet_agent_id: { not: null } },
        select: { id: true, fleet_agent_id: true, agent_status: true },
      })

      for (const local of allLocal) {
        if (local.fleet_agent_id && !activeIds.has(local.fleet_agent_id)) {
          await this.prisma.managed_assets.update({
            where: { id: local.id },
            data: { agent_status: 'unenrolled', last_synced_at: new Date() },
          })
          await this.logEvent(local.id, 'status_changed', { from: local.agent_status, to: 'unenrolled', reason: 'not_in_fleet' })
          unenrolled++
        }
      }
    } catch (err: any) {
      this.logger.error(`Error marcando unenrolled: ${err?.message}`)
    }

    lastSyncAt = new Date()
    this.logger.log(`Sync completado: ${created} creados, ${updated} actualizados, ${unenrolled} unenrolled, ${errors} errores`)
    return { created, updated, unenrolled, errors }
  }

  private async upsertAgent(agent: any): Promise<'created' | 'updated'> {
    const fleetAgentId: string = agent.id
    if (!fleetAgentId) throw new Error('Agente sin id')

    const localMetadata = agent.local_metadata || {}
    const hostMeta = localMetadata.host || {}
    const osMeta = localMetadata.os || {}

    const data = {
      fleet_agent_id:    fleetAgentId,
      elastic_agent_id:  agent.agent?.id ?? null,
      fleet_policy_id:   agent.policy_id ?? null,
      fleet_policy_name: agent.policy_name ?? null,
      host_name:         hostMeta.hostname ?? hostMeta.name ?? localMetadata.hostname ?? null,
      host_id:           hostMeta.id ?? null,
      os_type:           this.normalizeOs(osMeta.type ?? osMeta.platform),
      os_name:           osMeta.name ?? null,
      os_version:        osMeta.version ?? null,
      architecture:      osMeta.arch ?? null,
      ip_addresses:      this.extractIps(agent),
      last_checkin_at:   agent.last_checkin ? new Date(agent.last_checkin) : null,
      agent_status:      agent.status ?? null,
      agent_version:     agent.agent?.version ?? null,
      last_synced_at:    new Date(),
      source:            'fleet',
    }

    const existing = await this.prisma.managed_assets.findUnique({ where: { fleet_agent_id: fleetAgentId } })

    if (!existing) {
      const created = await this.prisma.managed_assets.create({
        data: { ...data, display_name: data.host_name ?? `Agent ${fleetAgentId.slice(0, 8)}` },
      })
      await this.logEvent(created.id, 'created', { fleet_agent_id: fleetAgentId })
      return 'created'
    }

    const statusChanged  = existing.agent_status !== data.agent_status
    const policyChanged  = existing.fleet_policy_id !== data.fleet_policy_id
    const hostnameChanged = existing.host_name !== data.host_name && data.host_name

    await this.prisma.managed_assets.update({ where: { fleet_agent_id: fleetAgentId }, data })

    if (statusChanged)   await this.logEvent(existing.id, 'status_changed',   { from: existing.agent_status,    to: data.agent_status })
    if (policyChanged)   await this.logEvent(existing.id, 'policy_changed',   { from: existing.fleet_policy_id, to: data.fleet_policy_id })
    if (hostnameChanged) await this.logEvent(existing.id, 'hostname_changed', { from: existing.host_name,       to: data.host_name })

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
    for (const iface of details) { if (iface.ip) ips.add(iface.ip) }
    return Array.from(ips)
  }

  private async logEvent(assetId: string | null, eventType: string, payload: any) {
    await this.prisma.asset_sync_events.create({ data: { asset_id: assetId, event_type: eventType, payload } })
  }
}
