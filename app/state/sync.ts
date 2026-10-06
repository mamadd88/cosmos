import { createClient } from '@supabase/supabase-js';
import { createSync } from '../../cosmos-sync.js';
export type PublicConfig = { supabaseUrl?: string; supabaseKey?: string; assist?: boolean };
declare const __COSMOS_CONFIG__: PublicConfig;
export const publicConfig: PublicConfig = typeof __COSMOS_CONFIG__ === 'undefined' ? {} : __COSMOS_CONFIG__;
export function connectSync(options: { author?: string } = {}) {
  return createSync({ ...options, config: publicConfig, clientFactory: createClient });
}
