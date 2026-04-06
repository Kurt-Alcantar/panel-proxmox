import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { VmController } from './vm.controller';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [VmController],
  providers: [PrismaService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();