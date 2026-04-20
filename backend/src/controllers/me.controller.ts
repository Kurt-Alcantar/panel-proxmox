import { Controller, Get, Patch, Body, Req, UseGuards, BadRequestException } from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'
import { PrismaService } from '../services/prisma.service'
import { AssetsService } from '../services/assets.service'
import { KeycloakAdminService } from '../services/keycloak-admin.service'

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly keycloak: KeycloakAdminService,
  ) {}

  @Get()
  async getMe(@Req() req: any) {
    const keycloakId = req.user?.sub
    if (!keycloakId) throw new BadRequestException('Token sin subject')

    const user = await this.prisma.users.findFirst({ where: { keycloak_id: keycloakId } })
    if (!user) return { role: null, tenantId: null, tenantType: null, displayName: '', email: '' }

    const ctx = await this.assets.getUserContext(keycloakId)

    // Obtener nombre del usuario desde Keycloak
    let displayName = user.email || ''
    let email = user.email || ''
    try {
      const kcUser = await this.keycloak.getUser(keycloakId)
      if (kcUser) {
        displayName = [kcUser.firstName, kcUser.lastName].filter(Boolean).join(' ') || kcUser.username || email
        email = kcUser.email || email
      }
    } catch { /* si falla Keycloak, usar lo que tenemos en BD */ }

    const role = ctx?.roleCodes?.[0] || null
    const tenantId = (user as any).tenant_id || null

    let tenantType = null
    if (tenantId) {
      const tenant = await this.prisma.tenants.findUnique({ where: { id: tenantId } }).catch(() => null)
      tenantType = (tenant as any)?.type || null
    }

    return {
      id: user.id,
      email,
      displayName,
      role,
      tenantId,
      tenantType,
    }
  }

  @Patch()
  async updateMe(@Req() req: any, @Body() body: any) {
    const keycloakId = req.user?.sub
    if (!keycloakId) throw new BadRequestException('Token sin subject')

    const firstName = body?.firstName != null ? String(body.firstName).trim() : undefined
    const lastName  = body?.lastName  != null ? String(body.lastName).trim()  : undefined

    if (firstName === undefined && lastName === undefined) {
      throw new BadRequestException('firstName o lastName son requeridos')
    }

    await this.keycloak.updateUser(keycloakId, {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName  !== undefined ? { lastName  } : {}),
    })

    return { ok: true }
  }

  @Patch('password')
  async changePassword(@Req() req: any, @Body() body: any) {
    const keycloakId = req.user?.sub
    if (!keycloakId) throw new BadRequestException('Token sin subject')

    const newPassword = body?.newPassword
    if (!newPassword || String(newPassword).length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres')
    }

    // Keycloak Admin API permite reset de password sin verificar la actual
    // Para verificar la actual habría que hacer un token request — saltamos eso
    // y confiamos en que el usuario ya está autenticado con sesión válida
    await this.keycloak.resetPassword(keycloakId, String(newPassword), false)

    return { ok: true }
  }
}
