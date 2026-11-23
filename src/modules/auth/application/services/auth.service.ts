import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { Env } from '../../../../config/env.validation.js';
import {
  ForbiddenError,
  UnauthorizedError,
} from '../../../../shared/domain/errors/domain.error.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { CanalVendaService } from '../../../canais/application/services/canal-venda.service.js';
import { ConfiguracaoCustosService } from '../../../configuracao-custos/application/services/configuracao-custos.service.js';
import {
  type EmpresaParaToken,
  montarPayloadJwt,
  tokenCadastroValido,
  type UsuarioParaToken,
} from '../../domain/auth.calculos.js';
import { EmpresaRepository } from '../../infra/repositories/empresa.repository.js';
import { UsuarioRepository } from '../../infra/repositories/usuario.repository.js';
import type { CreateEmpresaDto } from '../dto/create-empresa.dto.js';
import type { LoginDto } from '../dto/login.dto.js';
import type { EmpresaCriadaDto, LoginResponseDto } from '../dto/token.dto.js';

const credenciaisInvalidas = () =>
  new UnauthorizedError('CREDENCIAIS_INVALIDAS', 'Credenciais inválidas');

@Injectable()
export class AuthService {
  // Hash de uma senha descartável, conferido quando o e-mail não existe, para
  // o tempo de resposta não revelar quais e-mails estão cadastrados.
  private hashFicticio?: Promise<string>;

  constructor(
    private readonly empresaRepository: EmpresaRepository,
    private readonly usuarioRepository: UsuarioRepository,
    private readonly transactionManager: TransactionManager,
    private readonly jwtService: JwtService,
    private readonly configuracaoCustosService: ConfiguracaoCustosService,
    private readonly canalVendaService: CanalVendaService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  /**
   * Cria a empresa, o primeiro usuário, a configuração de custos padrão
   * (BE-24) e os canais de venda padrão (BE-25) na mesma transação. Exige o
   * token de cadastro (BE-36).
   */
  async criarEmpresa(dto: CreateEmpresaDto): Promise<EmpresaCriadaDto> {
    // O token é conferido antes de qualquer acesso ao banco (BE-36): sem ele,
    // a rota não revela se o e-mail ou o CNPJ já existem (403, nunca 409).
    const tokenEsperado = this.configService.get('CADASTRO_EMPRESA_TOKEN', {
      infer: true,
    });
    if (!tokenCadastroValido(dto.token_cadastro, tokenEsperado)) {
      throw new ForbiddenError(
        'TOKEN_CADASTRO_INVALIDO',
        'Token de cadastro inválido',
      );
    }

    const senha = await argon2.hash(dto.senha);

    // A empresa é criada antes do usuário: com CNPJ e e-mail repetidos, o
    // erro é o do CNPJ, como no auth-service (que conferia o CNPJ primeiro).
    const { empresa, usuario } = await this.transactionManager.run(
      async (tx) => {
        const empresa = await this.empresaRepository.create(
          {
            nome: dto.nome_empresa,
            cnpj: dto.cnpj ?? null,
            segmento: dto.segmento ?? null,
          },
          tx,
        );
        const usuario = await this.usuarioRepository.create(
          {
            empresaId: empresa.id,
            nome: dto.nome_usuario ?? null,
            email: dto.email,
            senha,
          },
          tx,
        );
        await this.configuracaoCustosService.criarPadrao(empresa.id, tx);
        await this.canalVendaService.criarPadrao(empresa.id, tx);
        return { empresa, usuario };
      },
    );

    const payload = montarPayloadJwt(usuario, empresa);
    return { ...payload, access_token: await this.assinar(usuario, empresa) };
  }

  /** Mesma resposta para e-mail inexistente e senha errada. */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const usuario = await this.usuarioRepository.findByEmailComEmpresa(
      dto.email,
    );
    if (!usuario) {
      await this.verificarSenha(await this.obterHashFicticio(), dto.senha);
      throw credenciaisInvalidas();
    }
    if (!(await this.verificarSenha(usuario.senha, dto.senha))) {
      throw credenciaisInvalidas();
    }
    return { access_token: await this.assinar(usuario, usuario.empresa) };
  }

  private assinar(
    usuario: UsuarioParaToken,
    empresa: EmpresaParaToken,
  ): Promise<string> {
    return this.jwtService.signAsync(montarPayloadJwt(usuario, empresa));
  }

  private async verificarSenha(hash: string, senha: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, senha);
    } catch {
      return false; // hash malformado: trata como senha errada
    }
  }

  private obterHashFicticio(): Promise<string> {
    this.hashFicticio ??= argon2.hash('senha-ficticia-para-tempo-constante');
    return this.hashFicticio;
  }
}
