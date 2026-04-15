import { Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import https from 'https'

@Injectable()
export class ElasticsearchService {
  private readonly client: AxiosInstance

  constructor() {
    const baseURL = (process.env.ELASTICSEARCH_URL || 'http://localhost:9200').replace(/\/$/, '')
    const insecure = (process.env.ELASTICSEARCH_INSECURE || 'false').toLowerCase() === 'true'
    const username = process.env.ELASTICSEARCH_USERNAME || ''
    const password = process.env.ELASTICSEARCH_PASSWORD || ''
    const apiKey = process.env.ELASTICSEARCH_API_KEY || ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      headers.Authorization = apiKey.startsWith('ApiKey ') ? apiKey : `ApiKey ${apiKey}`
    }

    this.client = axios.create({
      baseURL,
      timeout: 45000,
      auth: !apiKey && username ? { username, password } : undefined,
      headers,
      httpsAgent: insecure ? new https.Agent({ rejectUnauthorized: false }) : undefined,
    })
  }

  async search(index: string, body: any) {
    const res = await this.client.post(`/${index}/_search`, body)
    return res.data
  }
}
