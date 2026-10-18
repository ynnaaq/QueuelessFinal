import { createClient } from '@supabase/supabase-js'



const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables are missing')
}
const tabIdKey = 'queueless-tab-id'
let tabId = sessionStorage.getItem(tabIdKey)

if (!tabId) {
  tabId = crypto.randomUUID()
  sessionStorage.setItem(tabIdKey, tabId)
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
)
