-- Mapa oficial de salas para o Identificador de Provas.
-- Projeto Supabase: MapaDeAulas (yncpicdkrntvwfdxrvab).
--
-- NÃO APLICAR este arquivo automaticamente. Ele ainda não foi aplicado
-- no banco. Quem cuida do sistema cola o conteúdo no SQL Editor do
-- projeto MapaDeAulas quando a gestão autorizar.
--
-- O que grava: o último sorteio do Randomizador, no formato
-- malu-mapa-salas versão 1, dentro da coluna mapa.
-- O Identificador lê o mais recente:
--   select mapa from public.mapas_salas_ultimo;
--
-- Os nomes dos alunos ficam só neste banco da escola.
-- Só uma conta ativa com papel gestao (tabela montador_perfis) pode
-- gravar e ler. Professor e visitante não entram.
-- A chave usada no site é a chave pública (anon / publishable).
-- Não há chave secreta neste arquivo.

create table public.mapas_salas (
  id uuid primary key default gen_random_uuid(),
  avaliacao text not null,
  periodo jsonb not null,
  mapa jsonb not null,
  criado_por uuid not null default auth.uid() references public.montador_perfis (id),
  criado_em timestamptz not null default now(),
  constraint mapas_salas_avaliacao_tamanho
    check (char_length(btrim(avaliacao)) between 1 and 200),
  constraint mapas_salas_periodo_ok
    check (
      periodo ? 'inicio'
      and periodo ? 'fim'
      and (periodo->>'inicio') ~ '^\d{4}-\d{2}-\d{2}$'
      and (periodo->>'fim') ~ '^\d{4}-\d{2}-\d{2}$'
      and (periodo->>'fim') >= (periodo->>'inicio')
    ),
  constraint mapas_salas_mapa_ok
    check (
      mapa->>'formato' = 'malu-mapa-salas'
      and mapa->>'versao' = '1'
      and jsonb_typeof(mapa->'salas') = 'array'
      and octet_length(mapa::text) < 2000000
    )
);

comment on table public.mapas_salas is
  'Mapa oficial de salas de prova (malu-mapa-salas v1). Contém nomes de alunos e fica só no banco da escola. O Identificador usa o registro mais recente.';

comment on column public.mapas_salas.mapa is
  'Documento inteiro no formato malu-mapa-salas versão 1.';

comment on column public.mapas_salas.periodo is
  'Objeto {"inicio":"AAAA-MM-DD","fim":"AAAA-MM-DD"}.';

create index mapas_salas_criado_em_idx
  on public.mapas_salas (criado_em desc);

alter table public.mapas_salas enable row level security;

revoke all on table public.mapas_salas from public, anon, authenticated;
grant select, insert on table public.mapas_salas to authenticated;

create policy "gestao le mapas de salas"
  on public.mapas_salas
  for select
  to authenticated
  using (montador_priv.montador_papel() = 'gestao');

create policy "gestao grava mapas de salas"
  on public.mapas_salas
  for insert
  to authenticated
  with check (
    montador_priv.montador_papel() = 'gestao'
    and criado_por = (select auth.uid())
  );

-- Uma linha: o mapa que o Identificador deve usar agora.
-- security_invoker: vale a mesma regra da tabela (só gestão).
create view public.mapas_salas_ultimo
  with (security_invoker = true) as
  select id, avaliacao, periodo, mapa, criado_por, criado_em
  from public.mapas_salas
  order by criado_em desc
  limit 1;

comment on view public.mapas_salas_ultimo is
  'Último mapa oficial gravado. O Identificador lê a coluna mapa.';

revoke all on table public.mapas_salas_ultimo from public, anon, authenticated;
grant select on table public.mapas_salas_ultimo to authenticated;
