-- Keep this bucket private; raise only ScreenNote's per-file ceiling.
update storage.buckets set file_size_limit = 50000000
where id = 'screennote-media' and public = false;
