import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import https from 'https'

@Injectable()
export class FleetService {
  private readonly http: AxiosInstance
  private readonly logger = new Logger(FleetService.name)

  constructor() {
    const baseURL = (process.env.FLEET_URL || process.env.KIBANA_BASE_URL || 'http://localhost:5601').replace(/\/$/, '')
    const apiKey = process.env.FLEET_API_KEY || process.env.ELASTICSEARCH_API_KEY || ''
    const insecure = (process.env.ELASTICSEARCH_INSECURE || 'false').toLowerCase() === 'true'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'kbn-xsrf': 'true',
    }

    if (apiKey) {
      headers.Authorization = apiKey.startsWith('ApiKey ') ? apiKey : `ApiKey ${apiKey}`
    } else if (process.env.ELASTICSEARCH_USERNAME) {
      // basic auth via axios auth
    }

    this.http = axios.create({
      baseURL: `${baseURL}/api/fleet`,
      timeout: 30000,
      headers,
      auth:
        !apiKey && process.env.ELASTICSEARCH_USERNAME
          ? {
              username: process.env.ELASTICSEARCH_USERNAME,
              password: process.env.ELASTICSEARCH_PASSWORD || '',
            }
          : undefined,
      httpsAgent: insecure ? new https.Agent({ rejectUnauthorized: false }) : undefined,
    })
  }

  async listAgents(page = 1, perPage = 100, showInactive = true): Promise<any[]> {
    try {
      const res = await this.http.get('/agents', {
        params: { page, perPage, showInactive },
      })
      return res.data?.items || []
    } catch (error: any) {
      this.logger.error(`Fleet listAgents error: ${error?.message}`)
      return []
    }
  }

  async listPolicies(): Promise<any[]> {
    try {
      const res = await this.http.get('/agent_policies', {
        params: { perPage: 100 },
      })
      return res.data?.items || []
    } catch (error: any) {
      this.logger.error(`Fleet listPolicies error: ${error?.message}`)
      return []
    }
  }

  async getAgent(agentId: string): Promise<any | null> {
    try {
      const res = await this.http.get(`/agents/${agentId}`)
      return res.data?.item || null
    } catch (error: any) {
      this.logger.error(`Fleet getAgent(${agentId}) error: ${error?.message}`)
      return null
    }
  }

  /**
   * Pagina todos los agentes de Fleet (maneja pagination automáticamente)
   */
  async getAllAgents(): Promise<any[]> {
    const all: any[] = []
    let page = 1

    while (true) {
      const items = await this.listAgents(page, 100)
      if (!items.length) break
      all.push(...items)
      if (items.length < 100) break
      page++
    }

    return all
  }
}
