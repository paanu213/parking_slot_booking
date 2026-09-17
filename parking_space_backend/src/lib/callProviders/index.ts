import { env } from '../../config/env.js';
import type { CallProvider } from './types.js';
import { mockProvider } from './mock.js';
import { exotelProvider } from './exotel.js';

const providers: Record<string, CallProvider> = {
  mock: mockProvider,
  exotel: exotelProvider,
  // tata: tataProvider,
};

export const getProvider = (name: string = env.CALL_PROVIDER): CallProvider => {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown call provider "${name}" — check CALL_PROVIDER / the webhook URL`);
  return provider;
};

export type { CallProvider, InitiateMaskedCallParams, InitiateMaskedCallResult, NormalizedCallEvent } from './types.js';
