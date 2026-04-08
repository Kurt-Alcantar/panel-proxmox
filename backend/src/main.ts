import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { AuditService } from './audit.service';
import { AuthController } from './auth.controller';
import { ElasticsearchService } from './elasticsearch.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import { ObservabilityNativeService } from './observability-native.service';
import { PrismaService } from './prisma.service';
import { ProxmoxService } from './proxmox.service';
import { VmController } from './vm.controller';

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
