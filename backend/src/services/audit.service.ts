import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string | null;
    action: string;
    target: string;
    result: string;
  }) {
    return this.prisma.audit_logs.create({
      data: {
        user_id: params.userId ?? null,
        action: params.action,
        target: params.target,
        result: params.result
      }
    });
  }
}