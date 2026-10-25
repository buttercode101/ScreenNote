import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createGateway} from './gateway.js';
const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
// This server-to-server endpoint authenticates its own 256-bit gateway key.
// No browser receives the key or a service-role credential.
Deno.serve(createGateway(client));
