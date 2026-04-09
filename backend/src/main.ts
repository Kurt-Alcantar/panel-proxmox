import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AdminController } from '../src/controllers/admin.controller';
import { AuditService } from '../src/services/audit.service';
import { AuthController } from '../src/controllers/auth.controller';
import { ElasticsearchService } from '../src/services/elasticsearch.service';
import { KeycloakAdminService } from '../src/services/keycloak-admin.service';
import { ObservabilityNativeService } from '../src/services/observability-native.service';
import { PrismaService } from '../src/services/prisma.service';
import { ProxmoxService } from '../src/services/proxmox.service';
import { VmController } from '../src/controllers/vm.controller';

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
