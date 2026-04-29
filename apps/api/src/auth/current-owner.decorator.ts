import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedOwner } from './auth.types.js';

type OwnerRequest = {
  owner?: AuthenticatedOwner;
};

export const CurrentOwner = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<OwnerRequest>();
    return request.owner;
  },
);
