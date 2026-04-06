import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './auth.guard';

@Controller('vms')
export class VmController {
  constructor(private prisma: PrismaService) {}

  //@UseGuards(AuthGuard)
  @Get()
  async list() {
    return this.prisma.vm_inventory.findMany();
  }
}