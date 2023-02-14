import { createQueryClient } from '@ixo/impactxclient-sdk';

export type QUERY_CLIENT = Awaited<ReturnType<typeof createQueryClient>>;
