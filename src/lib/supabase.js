import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vlzqfxtogmsjdplcwuat.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rD3WWobAKW70QfqQSZVcrw_aZ8XOpoK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
