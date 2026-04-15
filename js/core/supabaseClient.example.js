// js/core/supabaseClient.example.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 🔴 REEMPLAZA con tus valores de Supabase
const SUPABASE_URL = 'https://cdiwriptqmqnexxukqaf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vX6RQCfPpA14Pg9ZVgDrFg_l3jY7KVw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Resto del código...