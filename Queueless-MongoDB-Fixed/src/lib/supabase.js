
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables.'
  )
}

// Store authentication separately per browser tab.
// Session survives refreshes in the same tab.
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
