import * as legacy from './vercel-store.js';
import {createSupabaseStore} from './supabase-store.js';
export const key=legacy.key,media=legacy.media;
// Explicit Supabase configuration takes precedence; never silently fall back to
// a different store after a write failure or split one recording across stores.
const backend=process.env.SUPABASE_URL||process.env.SCREENNOTE_STORAGE_KEY
 ?createSupabaseStore({url:process.env.SUPABASE_URL,secret:process.env.SCREENNOTE_STORAGE_KEY})
 :legacy;
export const {configured,read,write,mutate,mediaInfo,mediaMagic,mediaURL,removeMedia,uploadSmall,uploadPart,assemble,clearParts}=backend;
export const uploadedParts=backend.uploadedParts||(()=>Promise.resolve([]));
export const usingSupabase=backend!==legacy;
