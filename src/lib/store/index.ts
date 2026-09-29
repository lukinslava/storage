import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createCloudStore } from './cloud'
import { createLocalStore } from './local'
import type { Store } from './types'

export type { Store, Snapshot } from './types'

// Проект Supabase семьи. Ключ публичный (publishable): данные защищены входом и правилами доступа (RLS).
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY переопределяют эти значения;
// VITE_SUPABASE_URL=local включает локальный режим (всё в этом браузере).
const DEFAULT_URL = 'https://xluymkhepmzbokgrmjtq.supabase.co'
const DEFAULT_KEY = 'sb_publishable_uotdMosQAuI-lAEvO5nnKw_nP0zjifV'

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const url = envUrl === 'local' ? undefined : envUrl || DEFAULT_URL
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_KEY

/** Клиент Supabase, если облако настроено. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const store: Store = supabase ? createCloudStore(supabase) : createLocalStore()
