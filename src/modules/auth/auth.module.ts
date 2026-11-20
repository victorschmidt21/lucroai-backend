import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './application/services/auth.service.js';
import { AuthController } from './infra/controllers/auth.controller.js';
import { AuthThrottlerGuard } from './infra/guards/auth-throttler.guard.js';
import { EmpresaRepository } from './infra/repositories/empresa.repository.js';
import { UsuarioRepository } from './infra/repositories/usuario.repository.js';

// O JwtService vem do JwtAuthModule (global, src/shared/infra/auth/): mesmo
// segredo, HS256 e 4 h do guard. Não registre o JwtModule aqui.
@Module({
  imports: [
    // Só o AuthController usa o ThrottlerGuard (as outras rotas exigem token):
    // 10 tentativas por minuto para cada IP e e-mail.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 10 }] }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmpresaRepository,
    UsuarioRepository,
    AuthThrottlerGuard,
  ],
})
export class AuthModule {}
