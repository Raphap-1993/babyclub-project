alter table public.codes
  drop constraint if exists codes_person_index_check;

alter table public.codes
  add constraint codes_person_index_check
  check (person_index >= 1);

update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/avif',
    'application/pdf'
  ],
  updated_at = now()
where id = 'event-assets';
