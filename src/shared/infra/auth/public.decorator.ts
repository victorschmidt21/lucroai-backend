import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Dispensa o token JWT na rota ou no controller. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
