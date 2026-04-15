import { Injectable } from '@nestjs/common'
import { AssetIdentity } from '../shared/types/asset-identity'

@Injectable()
export class IdentityResolverService {
  /**
   * Construye un AssetIdentity desde un managed_asset de Prisma.
   */
  resolve(asset: {
    fleet_agent_id?: string | null
    elastic_agent_id?: string | null
    host_id?: string | null
    host_name?: string | null
    os_type?: string | null
  }): AssetIdentity {
    return {
      fleetAgentId: asset.fleet_agent_id ?? null,
      elasticAgentId: asset.elastic_agent_id ?? null,
      hostId: asset.host_id ?? null,
      hostName: asset.host_name ?? null,
      osType: (asset.os_type as 'windows' | 'linux' | null) ?? null,
    }
  }

  /**
   * Construye el filtro Elasticsearch óptimo según qué identificadores
   * están disponibles. Prioridad: elastic_agent_id > fleet_agent_id >
   * host.id > host.name (fallback).
   */
  buildElasticFilter(identity: AssetIdentity) {
    // Prioridad 1: agent.id desde Elastic (más preciso, campo indexado)
    if (identity.elasticAgentId) {
      return {
        bool: {
          should: [
            { term: { 'agent.id': identity.elasticAgentId } },
            { term: { 'elastic_agent.id': identity.elasticAgentId } },
          ],
          minimum_should_match: 1,
        },
      }
    }

    // Prioridad 2: fleet_agent_id (también aparece como agent.id en docs)
    if (identity.fleetAgentId) {
      return {
        bool: {
          should: [
            { term: { 'agent.id': identity.fleetAgentId } },
            { term: { 'elastic_agent.id': identity.fleetAgentId } },
          ],
          minimum_should_match: 1,
        },
      }
    }

    // Prioridad 3: host.id (más estable que host.name)
    if (identity.hostId) {
      return { term: { 'host.id': identity.hostId } }
    }

    // Fallback: host.name — solo si no hay nada mejor
    if (identity.hostName) {
      return this.legacyHostNameFilter(identity.hostName)
    }

    throw new Error('AssetIdentity no tiene identificadores válidos para Elasticsearch')
  }

  /**
   * Filtro legacy por hostname — se mantiene para compatibilidad con
   * datos históricos sin agent.id.
   */
  legacyHostNameFilter(hostName: string) {
    const raw = String(hostName || '').trim()
    const lower = raw.toLowerCase()

    return {
      bool: {
        should: [
          { term: { 'host.hostname': raw } },
          { term: { 'host.name': raw } },
          { term: { 'host.name': lower } },
          { wildcard: { 'host.hostname': { value: `*${raw}*`, case_insensitive: true } } },
          { wildcard: { 'host.name': { value: `*${raw}*`, case_insensitive: true } } },
        ],
        minimum_should_match: 1,
      },
    }
  }
}
