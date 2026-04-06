import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { VmController } from './vm.controller';
import { PrismaService } from './prisma.service';
import { ProxmoxService } from './proxmox.service';
import { AuthController } from './auth.controller';

@Module({
  controllers: [VmController, AuthController],
  providers: [PrismaService, ProxmoxService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();