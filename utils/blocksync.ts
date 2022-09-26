import { Ixo } from '@ixo/ixo-apimodule';

const blocksyncApi = new Ixo(process.env.NEXT_PUBLIC_BLOCK_SYNC_URL as string);

export default blocksyncApi;
