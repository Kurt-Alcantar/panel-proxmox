import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

// Controllers
import { AssetsController, AdminAssetsController } from './controllers/assets.controller'
import { FleetController } from './controllers/fleet.controller'
import { InfrastructureController } from './controllers/infrastructure.controller'
import { AuthController } from './controllers/auth.controller'
import { AdminController } from './controllers/admin.controller'
import { SupportController } from './controllers/support.controller'
import { MeController } from './controllers/me.controller'
import { SearchController } from './controllers/search.controller'
import { OverviewController } from './controllers/overview.controller'
import { VeeamController } from './controllers/veeam.controller'

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
import { VeeamJobsService } from './services/veeam-jobs.service'
import { KeycloakAdminService } from './services/keycloak-admin.service'
import { JiraService } from './services/jira.service'

@Module({
  controllers: [
    AssetsController,
    AdminAssetsController,
    FleetController,
    VeeamController,
    InfrastructureController,
    AuthController,
    AdminController,
    SupportController,
    MeController,
    SearchController,
    OverviewController,
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
    VeeamJobsService,
    ProxmoxService,
    KeycloakAdminService,
    JiraService,
  ],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // CORS restringido al dominio del panel — nunca '*' en producción
  const allowedOrigins = (process.env.CORS_ORIGIN || 'https://mxdr.hyperox.mx').split(',').map(s => s.trim())
  app.enableCors({
    origin: (origin: string | undefined, callback: Function) => {
      // Permitir requests sin origin (Nginx, curl interno, health checks)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS bloqueado para origen: ${origin}`))
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
  })

  const port = parseInt(process.env.PORT || '3000', 10)
  await app.listen(port)
  console.log(`Backend corriendo en puerto ${port}`)

  // Auto-sync Fleet cada 5 minutos
  const syncJob = app.get(FleetSyncJob)
  const syncInterval = parseInt(process.env.FLEET_SYNC_INTERVAL_MS || '300000', 10)

  const runSync = async () => {
    try {
      const result = await syncJob.run()
      console.log(`Fleet auto-sync: +${result.created} creados, ~${result.updated} actualizados, ${result.unenrolled} unenrolled`)
    } catch (e: any) {
      console.error(`Fleet auto-sync error: ${e.message}`)
    }
  }

  setTimeout(runSync, 30000)
  setInterval(runSync, syncInterval)
}

bootstrap()
