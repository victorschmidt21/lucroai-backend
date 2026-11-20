import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Empresa,
  type Usuario,
} from '../../../../generated/prisma/client.js';
import { ConflictError } from '../../../../shared/domain/errors/domain.error.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';

interface UsuarioData {
  empresaId: number;
  nome: string | null;
  email: string;
  senha: string;
}

@Injectable()
export class UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Usuário com a empresa (as duas tabelas são do módulo `auth`). */
  findByEmailComEmpresa(
    email: string,
  ): Promise<(Usuario & { empresa: Empresa }) | null> {
    return this.prisma.usuario.findUnique({
      where: { email },
      include: { empresa: true },
    });
  }

  /** O `email` é único no banco: duplicado vira 409 `EMAIL_JA_CADASTRADO`. */
  async create(data: UsuarioData, tx?: PrismaTransaction): Promise<Usuario> {
    const db = tx ?? this.prisma;
    try {
      return await db.usuario.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado');
      }
      throw error;
    }
  }
}
