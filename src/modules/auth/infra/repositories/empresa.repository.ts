import { Injectable } from '@nestjs/common';
import { Prisma, type Empresa } from '../../../../generated/prisma/client.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface EmpresaData {
  nome: string;
  cnpj: string | null;
  segmento: string | null;
}

@Injectable()
export class EmpresaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** O `cnpj` é único no banco: duplicado vira 409 `CNPJ_JA_CADASTRADO`. */
  async create(data: EmpresaData, tx?: PrismaTransaction): Promise<Empresa> {
    const db = tx ?? this.prisma;
    try {
      return await db.empresa.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('CNPJ_JA_CADASTRADO', 'CNPJ já cadastrado');
      }
      throw error;
    }
  }
}
