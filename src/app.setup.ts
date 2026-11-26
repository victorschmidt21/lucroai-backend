import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ErrorResponseDto } from './shared/infra/http/dto/error-response.dto.js';
import { AllExceptionsFilter } from './shared/infra/http/filters/all-exceptions.filter.js';
import { validationExceptionFactory } from './shared/infra/http/validation-exception.factory.js';

// Sem CORS: o navegador nunca chama esta API, só o servidor do frontend (BFF).
// Sem prefixo de versão nem envelope: o contrato do frontend usa rotas como
// /insumos e lê o JSON do recurso como está.
export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Doce Fatia API')
    .setDescription(
      'API do Doce Fatia: custos, preço sugerido, estoque, produções e vendas para quem produz doces e salgados.',
    )
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config, {
      extraModels: [ErrorResponseDto],
    }),
  );
}
