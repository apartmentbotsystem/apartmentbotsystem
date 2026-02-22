drop policy if exists admin_read_chat on public.chat;
drop policy if exists anon_read_own_conversation on public.chat;
alter table public.chat enable row level security;
create policy "admin_read_chat" on public.chat for select to authenticated using (true);
create policy "anon_read_own_conversation" on public.chat for select to anon using (conversation_id is not null);
create index if not exists idx_chat_conversation_id on public.chat(conversation_id);
create index if not exists idx_chat_created_at on public.chat(created_at desc);
alter table public.chat add constraint unique_line_message unique (external_message_id);
