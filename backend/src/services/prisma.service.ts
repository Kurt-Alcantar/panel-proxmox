import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    let retries = 10;

    while (retries) {
      try {
        await this.$connect();
        console.log('✅ Connected to DB');
        break;
      } catch (err) {
        console.log('⏳ Waiting for DB...');
        await new Promise(res => setTimeout(res, 3000));
        retries--;
      }
    }
  }
}