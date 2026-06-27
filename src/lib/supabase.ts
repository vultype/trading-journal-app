'use client'

import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://lmoduthkogsystlnljlb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2R1dGhrb2dzeXN0bG5samxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDA1MDEsImV4cCI6MjA5ODExNjUwMX0.bVWD_H9bYzvE4lK6hg-mjw5nA0_qYi1D2vzROzhL-4Q'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
