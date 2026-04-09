import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AdminController } from './controllers/admin.controller';
import { AuditService } from './services/audit.service';
import { AuthController } from './controllers/auth.controller';
import { ElasticsearchService } from './services/elasticsearch.service';
import { KeycloakAdminService } from './services/keycloak-admin.service';
import { ObservabilityNativeService } from './services/observability-native.service';
import { PrismaService } from './services/prisma.service';
import { ProxmoxService } from './services/proxmox.service';
import { VmController } from './controllers/vm.controller';

@Module({
  controllers: [VmController, AuthController, AdminController],
  providers: [
    PrismaService,
    ProxmoxService,
    AuditService,
    ElasticsearchService,
    ObservabilityNativeService,
    KeycloakAdminService,
  ],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
