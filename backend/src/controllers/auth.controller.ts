import { Controller, Post, Body, BadRequestException } from '@nestjs/common'
import axios from 'axios'

const KEYCLOAK_URL = process.env.KEYCLOAK_INTERNAL_URL || 'http://keycloak:8080'
const REALM = process.env.KEYCLOAK_REALM || 'master'
// IMPORTANTE: usar cliente público dedicado, NO admin-cli
// Crear en Keycloak: cliente 'hyperox-panel', tipo Public, grant_type password habilitado
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'hyperox-panel'

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() body: any) {
    if (!body?.username || !body?.password) {
      throw new BadRequestException('username y password son requeridos')
    }

    const params = new URLSearchParams()
    params.append('client_id', CLIENT_ID)
    params.append('grant_type', 'password')
    params.append('username', body.username)
    params.append('password', body.password)

    try {
      const response = await axios.post(
        `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
      return response.data
    } catch (err: any) {
      const status = err?.response?.status
      const desc = err?.response?.data?.error_description || 'Credenciales inválidas'
      if (status === 401) throw new BadRequestException(desc)
      throw new BadRequestException('Error de autenticación')
    }
  }

  @Post('refresh')
  async refresh(@Body() body: any) {
    if (!body?.refresh_token) throw new BadRequestException('refresh_token requerido')

    const params = new URLSearchParams()
    params.append('client_id', CLIENT_ID)
    params.append('grant_type', 'refresh_token')
    params.append('refresh_token', body.refresh_token)

    try {
      const response = await axios.post(
        `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
      return response.data
    } catch {
      throw new BadRequestException('Sesión expirada. Inicia sesión nuevamente.')
    }
  }
}
