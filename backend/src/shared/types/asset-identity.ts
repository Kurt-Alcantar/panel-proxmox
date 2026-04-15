export interface AssetIdentity {
  fleetAgentId: string | null
  elasticAgentId: string | null
  hostId: string | null
  hostName: string | null
  osType: 'windows' | 'linux' | null
}
