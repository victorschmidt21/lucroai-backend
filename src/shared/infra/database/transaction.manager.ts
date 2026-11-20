import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import type { PrismaTransaction } from './prisma.transaction.js';

/**
 * Abre transações interativas do Prisma para os services da camada
 * application, sem que eles dependam do PrismaService diretamente. Quem
 * orquestra repassa o `tx` aos services de outros módulos e aos repositórios
 * (ver docs/architecture.md#comunicação-entre-módulos).
 */
@Injectable()
export class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
