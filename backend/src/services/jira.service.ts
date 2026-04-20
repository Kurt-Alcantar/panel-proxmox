import { Injectable, ServiceUnavailableException, BadGatewayException } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

@Injectable()
export class JiraService {
  private readonly baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '')
  private readonly email = process.env.JIRA_EMAIL || ''
  private readonly token = process.env.JIRA_API_TOKEN || ''
  private readonly projectKey = process.env.JIRA_PROJECT_KEY || 'CM'
  private readonly defaultIssueTypeName = process.env.JIRA_DEFAULT_ISSUE_TYPE_NAME || ''
  private readonly client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 20000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.email && this.token
          ? { Authorization: `Basic ${Buffer.from(`${this.email}:${this.token}`).toString('base64')}` }
          : {}),
      },
    })
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.email && this.token && this.projectKey)
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Integración Jira no configurada en el backend')
    }
  }

  private async request<T = any>(method: 'GET' | 'POST', path: string, data?: any, params?: Record<string, any>): Promise<T> {
    this.assertConfigured()
    try {
      const response = await this.client.request<T>({ method, url: path, data, params })
      return response.data
    } catch (error: any) {
      const status = error?.response?.status
      const details = error?.response?.data?.errorMessages?.join('; ') || error?.response?.data?.errors
      const msg = typeof details === 'string' ? details : JSON.stringify(details || error?.message || 'Jira request failed')
      throw new BadGatewayException(`Jira API ${status || ''}: ${msg}`.trim())
    }
  }

  private normalizeIssue(issue: any, transitions: any[] = []) {
    const fields = issue?.fields || {}
    return {
      id: issue?.id,
      key: issue?.key,
      url: `${this.baseUrl}/browse/${issue?.key}`,
      title: fields.summary,
      description: this.extractAdfText(fields.description) || null,
      status: fields.status?.name,
      statusCategory: fields.status?.statusCategory?.name,
      priority: fields.priority?.name || 'Medium',
      issueType: fields.issuetype?.name,
      assignee: fields.assignee ? {
        displayName: fields.assignee.displayName,
        accountId: fields.assignee.accountId,
      } : null,
      reporter: fields.reporter ? {
        displayName: fields.reporter.displayName,
        accountId: fields.reporter.accountId,
      } : null,
      labels: Array.isArray(fields.labels) ? fields.labels : [],
      createdAt: fields.created,
      updatedAt: fields.updated,
      transitions: transitions.map((t: any) => ({ id: t.id, name: t.name, to: t.to?.name, category: t.to?.statusCategory?.name })),
    }
  }

  private async getProjectId() {
    const project: any = await this.request('GET', `/rest/api/3/project/${encodeURIComponent(this.projectKey)}`)
    return project?.id
  }

  async getIssueTypes() {
    const projectId = await this.getProjectId()
    const data: any[] = await this.request('GET', `/rest/api/3/issuetype/project`, undefined, { projectId })
    return (data || []).filter((item: any) => !item.subtask).map((item: any) => ({ id: item.id, name: item.name, description: item.description || '' }))
  }

  private async resolveIssueTypeId(issueTypeName?: string) {
    const types = await this.getIssueTypes()
    const preferred = issueTypeName || this.defaultIssueTypeName
    const exact = preferred ? types.find((t: any) => t.name.toLowerCase() === preferred.toLowerCase()) : null
    if (exact) return exact.id
    return types[0]?.id || null
  }

  async listTickets(search?: string, status?: string) {
    const clauses = [`project = ${this.projectKey}`]
    if (status) clauses.push(`status = "${String(status).replace(/"/g, '\\"')}"`)
    if (search) clauses.push(`(summary ~ "${String(search).replace(/"/g, '\\"')}" OR text ~ "${String(search).replace(/"/g, '\\"')}")`)
    const jql = `${clauses.join(' AND ')} ORDER BY updated DESC`
    const data: any = await this.request('POST', '/rest/api/3/search/jql', {
      jql,
      maxResults: 50,
      fields: [
        'summary',
        'status',
        'priority',
        'issuetype',
        'assignee',
        'reporter',
        'labels',
        'created',
        'updated',
        'description',
      ],
    })
    return {
      projectKey: this.projectKey,
      total: data?.total || 0,
      items: (data?.issues || []).map((issue: any) => this.normalizeIssue(issue)),
    }
  }

  async getTicket(key: string) {
    const issue: any = await this.request('GET', `/rest/api/3/issue/${encodeURIComponent(key)}`, undefined, {
      fields: 'summary,status,priority,issuetype,assignee,reporter,labels,created,updated,description,comment',
    })
    const transitions: any = await this.request('GET', `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`)
    const comments = (issue?.fields?.comment?.comments || []).map((row: any) => ({
      id: row.id,
      author: row.author?.displayName || 'Unknown',
      createdAt: row.created,
      bodyText: this.extractAdfText(row.body),
    }))
    return {
      ...this.normalizeIssue(issue, transitions?.transitions || []),
      comments,
    }
  }

  private extractAdfText(node: any): string {
    if (!node) return ''
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(n => this.extractAdfText(n)).join('')
    const text = node.text ? String(node.text) : ''
    const content = node.content ? this.extractAdfText(node.content) : ''
    const joiner = ['paragraph', 'heading'].includes(node.type) ? '\n' : ''
    return `${text}${content}${joiner}`
  }

  private textToAdf(text: string) {
    const lines = String(text || '').split(/\r?\n/)
    return {
      version: 1,
      type: 'doc',
      content: lines.map(line => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : [],
      })),
    }
  }

  async createTicket(payload: { title: string; description?: string; priority?: string; issueTypeName?: string; labels?: string[] }) {
    const issueTypeId = await this.resolveIssueTypeId(payload.issueTypeName)
    if (!issueTypeId) throw new ServiceUnavailableException('No se pudo resolver issue type para el proyecto Jira')

    const body: any = {
      fields: {
        project: { key: this.projectKey },
        summary: payload.title,
        issuetype: { id: issueTypeId },
        labels: payload.labels || [],
      },
    }

    if (payload.description) body.fields.description = this.textToAdf(payload.description)

    if (payload.priority) {
      body.fields.priority = { name: payload.priority }
    }

    const created: any = await this.request('POST', '/rest/api/3/issue', body)
    return this.getTicket(created.key)
  }

  async addComment(key: string, comment: string) {
    await this.request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
      body: this.textToAdf(comment),
    })
    return this.getTicket(key)
  }

  async transitionTicket(key: string, transitionId: string) {
    await this.request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, {
      transition: { id: transitionId },
    })
    return this.getTicket(key)
  }

  async getMeta() {
    const types = await this.getIssueTypes().catch(() => [])
    return {
      configured: this.isConfigured(),
      projectKey: this.projectKey,
      issueTypes: types,
    }
  }
}