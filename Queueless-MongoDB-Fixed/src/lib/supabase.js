
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables are missing')
}

// Supabase uses localStorage by default, which makes every browser tab share
// one account. Keep an ID and the auth session in sessionStorage instead: it
// survives refreshes in this tab but remains isolated from other tabs.
const tabIdKey = 'queueless-tab-id'
let tabId = sessionStorage.getItem(tabIdKey)

if (!tabId) {
  tabId = crypto.randomUUID()
  sessionStorage.setItem(tabIdKey, tabId)
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      storage: sessionStorage,
      storageKey: `queueless-auth-${tabId}`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
