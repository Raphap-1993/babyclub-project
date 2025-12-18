-- Add doc_type/document support for persons, tickets, table_reservations
alter table persons add column if not exists doc_type text default 'dni';
alter table persons add column if not exists document text;

update persons
set document = coalesce(document, dni),
    doc_type = coalesce(doc_type, 'dni')
where document is null and dni is not null;

create unique index if not exists persons_document_unique on persons (lower(document)) where document is not null;

alter table tickets add column if not exists doc_type text default 'dni';
alter table tickets add column if not exists document text;

alter table table_reservations add column if not exists doc_type text default 'dni';
alter table table_reservations add column if not exists document text;
