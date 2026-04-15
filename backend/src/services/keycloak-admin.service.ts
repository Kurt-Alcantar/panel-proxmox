import { Injectable, InternalServerErrorException } from '@nestjs/common'
import axios from 'axios'

interface CreateOrGetUserInput {
  username: string
  email: string
  firstName?: string
  lastName?: string
  password?: string
  enabled?: boolean
}

interface UpdateKeycloakUserInput {
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  enabled?: boolean
}

@Injectable()
export class KeycloakAdminService {
  private readonly baseUrl = process.env.KEYCLOAK_INTERNAL_URL || process.env.KEYCLOAK_URL || 'http://keycloak:8080'
  private readonly adminRealm = process.env.KEYCLOAK_ADMIN_REALM || 'master'
  private readonly realm = process.env.KEYCLOAK_REALM || 'master'
  private readonly clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli'
  private readonly username = process.env.KEYCLOAK_ADMIN_USERNAME || process.env.KEYCLOAK_ADMIN || 'admin'
  private readonly password = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin123'

  private describeAxiosError(error: any) {
    if (axios.isAxiosError(error)) {
      const response = error.response?.data
      if (typeof response === 'string') return response
      if (response?.error_description) return response.error_description
      if (response?.error) return response.error
      if (response?.message) return response.message
      return error.message
    }
    return error?.message || String(error)
  }

  private async getAdminAccessToken() {
    const params = new URLSearchParams()
    params.append('client_id', this.clientId)
    params.append('grant_type', 'password')
    params.append('username', this.username)
    params.append('password', this.password)

    try {
      const response = await axios.post(
        `${this.baseUrl}/realms/${this.adminRealm}/protocol/openid-connect/token`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
      )
      return response.data.access_token as string
    } catch (error) {
      throw new InternalServerErrorException(
        `No se pudo obtener token administrativo de Keycloak: ${this.describeAxiosError(error)}`
      )
    }
  }

  private async authHeaders() {
    const accessToken = await this.getAdminAccessToken()
    return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  }

  async findUserByUsername(username: string) {
    const headers = await this.authHeaders()
    const response = await axios.get(`${this.baseUrl}/admin/realms/${this.realm}/users`, {
      headers,
      params: { username, exact: true },
      timeout: 15000,
    })
    return Array.isArray(response.data) && response.data.length ? response.data[0] : null
  }

  async findUserByEmail(email: string) {
    const headers = await this.authHeaders()
    const response = await axios.get(`${this.baseUrl}/admin/realms/${this.realm}/users`, {
      headers,
      params: { email, exact: true },
      timeout: 15000,
    })
    return Array.isArray(response.data) && response.data.length ? response.data[0] : null
  }

  async createOrGetUser(input: CreateOrGetUserInput) {
    const headers = await this.authHeaders()
    const existingByUsername = await this.findUserByUsername(input.username)
    if (existingByUsername) return { id: existingByUsername.id as string, created: false, user: existingByUsername }

    const existingByEmail = await this.findUserByEmail(input.email)
    if (existingByEmail) return { id: existingByEmail.id as string, created: false, user: existingByEmail }

    const payload: Record<string, any> = {
      username: input.username,
      email: input.email,
      firstName: input.firstName || undefined,
      lastName: input.lastName || undefined,
      enabled: input.enabled ?? true,
      emailVerified: true,
    }

    if (input.password) {
      payload.credentials = [{ type: 'password', value: input.password, temporary: false }]
    }

    try {
      const response = await axios.post(`${this.baseUrl}/admin/realms/${this.realm}/users`, payload, {
        headers,
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 400,
      })

      const locationHeader = response.headers.location || response.headers.Location
      const id = locationHeader ? String(locationHeader).split('/').pop() : undefined
      if (!id) {
        const createdUser = await this.findUserByUsername(input.username)
        if (!createdUser?.id) throw new Error('No se pudo resolver el ID del usuario recién creado en Keycloak.')
        return { id: createdUser.id as string, created: true, user: createdUser }
      }

      return { id, created: true, user: payload }
    } catch (error) {
      throw new InternalServerErrorException(`No se pudo crear usuario en Keycloak: ${this.describeAxiosError(error)}`)
    }
  }

  async updateUser(userId: string, input: UpdateKeycloakUserInput) {
    const headers = await this.authHeaders()
    const payload: Record<string, any> = {}
    for (const field of ['username', 'email', 'firstName', 'lastName'] as const) {
      const value = input[field]
      if (value !== undefined) payload[field] = value
    }
    if (input.enabled !== undefined) payload.enabled = input.enabled

    try {
      await axios.put(`${this.baseUrl}/admin/realms/${this.realm}/users/${userId}`, payload, {
        headers,
        timeout: 15000,
      })
      return { ok: true }
    } catch (error) {
      throw new InternalServerErrorException(`No se pudo actualizar usuario en Keycloak: ${this.describeAxiosError(error)}`)
    }
  }

  async setUserEnabled(userId: string, enabled: boolean) {
    return this.updateUser(userId, { enabled })
  }

  async resetPassword(userId: string, password: string, temporary = false) {
    const headers = await this.authHeaders()
    try {
      await axios.put(
        `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/reset-password`,
        { type: 'password', value: password, temporary },
        { headers, timeout: 15000 }
      )
      return { ok: true }
    } catch (error) {
      throw new InternalServerErrorException(`No se pudo resetear password en Keycloak: ${this.describeAxiosError(error)}`)
    }
  }

  async deleteUser(userId: string) {
    const headers = await this.authHeaders()
    try {
      await axios.delete(`${this.baseUrl}/admin/realms/${this.realm}/users/${userId}`, {
        headers,
        timeout: 15000,
      })
      return { ok: true }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return { ok: true, alreadyMissing: true }
      throw new InternalServerErrorException(`No se pudo eliminar usuario en Keycloak: ${this.describeAxiosError(error)}`)
    }
  }
}
