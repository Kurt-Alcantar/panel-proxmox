import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

// Controllers
import { AssetsController, AdminAssetsController } from './controllers/assets.controller'
import { FleetController } from './controllers/fleet.controller'
import { InfrastructureController } from './controllers/infrastructure.controller'
import { AuthController } from './controllers/auth.controller'
import { AdminController } from './controllers/admin.controller'

// Services
import { PrismaService } from './services/prisma.service'
import { AuditService } from './services/audit.service'
import { ElasticsearchService } from './services/elasticsearch.service'
import { ObservabilityNativeService } from './services/observability-native.service'
import { IdentityResolverService } from './services/identity-resolver.service'
import { AssetsService } from './services/assets.service'
import { FleetService } from './services/fleet.service'
import { FleetSyncJob } from './services/fleet-sync.job'
import { ProxmoxService } from './services/proxmox.service'
import { KeycloakAdminService } from './services/keycloak-admin.service'

@Module({
  controllers: [
    // Dominio B: observabilidad (nuevos)
    AssetsController,
    AdminAssetsController,
    FleetController,
    // Dominio A: infraestructura + capa compat /vms/*
    InfrastructureController,
    // Auth y Admin sin cambios
    AuthController,
    AdminController,
  ],
  providers: [
    PrismaService,
    AuditService,
    ElasticsearchService,
    IdentityResolverService,
    ObservabilityNativeService,
    AssetsService,
    FleetService,
    FleetSyncJob,
    ProxmoxService,
    KeycloakAdminService,
  ],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  })

  const port = parseInt(process.env.PORT || '3000', 10)
  await app.listen(port)
  console.log(`Backend corriendo en puerto ${port}`)
}

bootstrap()
