require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE"
  });
  if (error) {
    console.log('Error adding column:', error.message);
    // Try direct SQL via REST
    const res = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ sql: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE" })
    });
    console.log('REST status:', res.status);
    const body = await res.text();
    console.log('REST body:', body.substring(0, 200));
  } else {
    console.log('Column added OK');
  }

  // Backfill
  const res2 = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ sql: "UPDATE profiles SET onboarding_completed = TRUE WHERE onboarding_completed IS FALSE OR onboarding_completed IS NULL" })
  });
  console.log('Backfill status:', res2.status);

  // Verify user
  const { data: profile, error: e3 } = await supabase.from('profiles').select('id, email, onboarding_completed').ilike('email', 'nizeragg@gmail.com').single();
  console.log('Profile:', JSON.stringify(profile, null, 2));
  if (e3) console.log('Error:', e3.message);
})();
