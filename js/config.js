// Verbindung zum Supabase-Projekt der Familie.
// Der Schlüssel hier ist der öffentliche ("publishable"). Er darf im Browser stehen:
// Was jemand damit lesen oder ändern darf, regelt die Datenbank selbst (siehe supabase/01_schema.sql).
// Der geheime Schlüssel (sb_secret_…) gehört NIE in diese App.
export const SUPABASE_URL = 'https://efhqvenhmzppnzetcjnd.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_EAvFcTvkTSLqth-tq8ivZA_mQOusRJg';

// Öffentlicher Teil des Schlüsselpaars für Push. Der private Teil liegt nur als Secret in Supabase.
export const VAPID_PUBLIC = 'BPTB6WwdFCytixkjEuxIPNRKnL1gcuDidBU559XhH5S0AHzEojLLG3yVxnI6jeyVBLANajIS3STR2Vm0Q8YSU6E';
