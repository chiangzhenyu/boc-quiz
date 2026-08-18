const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase 已配置');
} else {
  console.log('⚠️ Supabase 未配置，同步功能不可用');
}

/**
 * Generate a random sync code (8 characters, easy to type)
 */
function generateSyncCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Save user progress to Supabase
 */
async function saveProgress(syncCode, wrongBook, stats) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase
    .from('user_progress')
    .upsert({
      sync_code: syncCode,
      wrong_book: wrongBook,
      stats: stats,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Load user progress from Supabase
 */
async function loadProgress(syncCode) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('sync_code', syncCode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    throw error;
  }

  return data;
}

module.exports = {
  supabase,
  generateSyncCode,
  saveProgress,
  loadProgress,
  isConfigured: !!supabase,
};
