-- ScreenNote only. Private media and service-only metadata access.
create table public.screennote_records (
  path text primary key,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
create table public.screennote_comments (
  record_path text not null references public.screennote_records(path) on delete cascade,
  id text not null,
  position integer not null,
  data jsonb not null,
  primary key (record_path, id)
);
create table public.screennote_reactions (
  record_path text not null references public.screennote_records(path) on delete cascade,
  viewer_hash text not null,
  reaction text not null check (reaction in ('like','thanks','idea')),
  primary key (record_path, viewer_hash)
);
create table public.screennote_gateway_keys (hash text primary key);
alter table public.screennote_records enable row level security;
alter table public.screennote_comments enable row level security;
alter table public.screennote_reactions enable row level security;
alter table public.screennote_gateway_keys enable row level security;
revoke all on public.screennote_records, public.screennote_comments, public.screennote_reactions, public.screennote_gateway_keys from anon, authenticated;
grant all on public.screennote_records, public.screennote_comments, public.screennote_reactions, public.screennote_gateway_keys to service_role;

create function public.screennote_read(p_path text) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('etag',r.revision::text,'data',r.data ||
   case when r.path = 'screennote/capacity.json' then '{}'::jsonb else
     jsonb_build_object(
       'comments',coalesce((select jsonb_agg(c.data order by c.position) from public.screennote_comments c where c.record_path=r.path),'[]'::jsonb),
       'votes',coalesce((select jsonb_object_agg(v.viewer_hash,v.reaction) from public.screennote_reactions v where v.record_path=r.path),'{}'::jsonb)) end)
 from public.screennote_records r where r.path=p_path;
$$;

create function public.screennote_write(p_path text,p_data jsonb,p_revision text default null) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint;
begin
 if p_path !~ '^screennote/(capacity\.json|[a-f0-9-]{36}/record\.json)$' or octet_length(p_data::text)>2097152 then
   raise exception 'Invalid ScreenNote record';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_path,0));
 select revision into current_revision from public.screennote_records where path=p_path for update;
 if (p_revision is null and current_revision is not null) or
    (p_revision is not null and (current_revision is null or p_revision <> current_revision::text)) then return false; end if;
 insert into public.screennote_records(path,data) values(p_path,p_data-'comments'-'votes')
 on conflict(path) do update set data=excluded.data,revision=screennote_records.revision+1,updated_at=now();
 delete from public.screennote_comments where record_path=p_path;
 insert into public.screennote_comments(record_path,id,position,data)
 select p_path,entry->>'id',ordinality::integer,entry
 from jsonb_array_elements(coalesce(p_data->'comments','[]'::jsonb)) with ordinality as items(entry,ordinality);
 delete from public.screennote_reactions where record_path=p_path;
 insert into public.screennote_reactions(record_path,viewer_hash,reaction)
 select p_path,key,value from jsonb_each_text(coalesce(p_data->'votes','{}'::jsonb));
 return true;
end;
$$;
revoke all on function public.screennote_read(text),public.screennote_write(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.screennote_read(text),public.screennote_write(text,jsonb,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('screennote-media','screennote-media',false,26214400,array['video/mp4','video/webm','application/octet-stream']);
