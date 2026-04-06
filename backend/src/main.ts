import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { VmController } from './vm.controller';
import { PrismaService } from './prisma.service';
import { ProxmoxService } from './proxmox.service';
import { AuthController } from './auth.controller';
import { AuditService } from './audit.service';

@Module({
  controllers: [VmController, AuthController],
  providers: [PrismaService, ProxmoxService,AuditService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();