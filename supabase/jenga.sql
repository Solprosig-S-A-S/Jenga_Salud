-- Ejecutar completo en Supabase > SQL Editor. No requiere claves secretas en el HTML.
begin;
create table if not exists public.jenga_rooms (
  code text primary key,
  host_hash text not null,
  state jsonb not null,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create table if not exists public.jenga_players (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.jenga_rooms(code) on delete cascade,
  token_hash text not null,
  nickname text not null check (length(nickname) between 1 and 30),
  seat integer not null,
  unique(room_code, token_hash),
  unique(room_code, seat)
);
alter table public.jenga_rooms enable row level security;
alter table public.jenga_players enable row level security;
revoke all on public.jenga_rooms, public.jenga_players from anon, authenticated;

-- Todas las operaciones usan este punto de entrada. El bloqueo de fila y revision
-- impiden doble movimiento. No se reciben ni guardan indicadores de salud.
create or replace function public.jenga_room(
  p_action text, p_code text default '', p_token text default '',
  p_name text default '', p_expected integer default -1, p_payload jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.jenga_rooms%rowtype;
  player public.jenga_players%rowtype;
  token_hash_value text;
  roster jsonb; result jsonb; st jsonb; moves jsonb;
  code_value text; active uuid; chosen integer; cnt integer; level_value integer;
  highest integer; candidates integer[]; item record; idx integer; next_player uuid;
begin
  if p_token is null or length(p_token) < 40 or length(p_token) > 200 then
    raise exception 'Sesión inválida. Vuelve a entrar a la sala.';
  end if;
  token_hash_value := encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if p_action = 'create' then
    if p_name is null or length(trim(p_name)) not between 1 and 30 then raise exception 'Escribe un alias de 1 a 30 caracteres.'; end if;
    -- Reintentar create con el mismo token recupera la sala si se perdió la respuesta.
    select * into r from public.jenga_rooms where host_hash=token_hash_value and expires_at>now() order by created_at desc limit 1 for update;
    if not found then
      code_value := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
      st := jsonb_build_object('status','lobby','selectedId',null,'answered',false,'revealed',false,'turn',0,'moves','[]'::jsonb,'activeId',null);
      insert into public.jenga_rooms(code,host_hash,state) values(code_value,token_hash_value,st) returning * into r;
      insert into public.jenga_players(room_code,token_hash,nickname,seat) values(r.code,token_hash_value,trim(p_name),0);
    end if;
  else
    select * into r from public.jenga_rooms where code=upper(trim(p_code)) and expires_at>now() for update;
    if not found then raise exception 'La sala no existe o venció (24 horas).'; end if;
  end if;
  select * into player from public.jenga_players where room_code=r.code and token_hash=token_hash_value;
  if p_action='join' and player.id is null then
    if r.state->>'status'<>'lobby' then raise exception 'La partida ya comenzó. Pide al facilitador que abra una nueva ronda.'; end if;
    if p_name is null or length(trim(p_name)) not between 1 and 30 then raise exception 'Escribe un alias de 1 a 30 caracteres.'; end if;
    select count(*) into cnt from public.jenga_players where room_code=r.code;
    if cnt>=30 then raise exception 'La sala está llena (30 participantes).'; end if;
    if exists(select 1 from public.jenga_players where room_code=r.code and lower(nickname)=lower(trim(p_name))) then raise exception 'Ese alias ya está en uso.'; end if;
    insert into public.jenga_players(room_code,token_hash,nickname,seat) values(r.code,token_hash_value,trim(p_name),cnt) returning * into player;
    update public.jenga_rooms set revision=revision+1 where code=r.code returning * into r;
  end if;
  if player.id is null then raise exception 'No perteneces a esta sala.'; end if;
  if p_action is null or p_action not in ('create','join','sync','start','draw','answer','reveal','complete','reset','end') then raise exception 'Acción inválida.'; end if;
  st := r.state;
  if p_action in ('start','draw','answer','reveal','complete','reset','end') then
    if p_expected is distinct from r.revision then raise exception 'La sala cambió. Actualiza antes de repetir la acción.'; end if;
    if p_action in ('start','reset','end') then
      if r.host_hash<>token_hash_value then raise exception 'Solo el facilitador puede iniciar o reiniciar.'; end if;
      if p_action='start' then
        if st->>'status'<>'lobby' then raise exception 'La partida ya comenzó.'; end if;
        select count(*) into cnt from public.jenga_players where room_code=r.code;
        if cnt<2 then raise exception 'Se necesitan al menos dos participantes.'; end if;
        select id into active from public.jenga_players where room_code=r.code order by seat limit 1;
        st := st || jsonb_build_object('status','playing','activeId',active);
      elsif p_action='end' then
        if st->>'status'<>'playing' then raise exception 'La partida no está en curso.'; end if;
        st := st || jsonb_build_object('status','ended');
      else
        st := jsonb_build_object('status','lobby','selectedId',null,'answered',false,'revealed',false,'turn',0,'moves','[]'::jsonb,'activeId',null);
      end if;
    else
      if st->>'status'<>'playing' then raise exception 'La partida no está en curso.'; end if;
      if st->>'activeId'<>player.id::text then raise exception 'Espera tu turno.'; end if;
      if p_action='draw' then
        if st->>'selectedId' is not null then raise exception 'Ya hay una pieza asignada a este turno.'; end if;
        moves := st->'moves';
        highest := case when jsonb_array_length(moves)=0 then 17 else 18+(jsonb_array_length(moves)-1)/3 end;
        candidates := array[]::integer[];
        for idx in 1..54 loop
          level_value := (idx-1)/3;
          for item in select value, ordinality from jsonb_array_elements(moves) with ordinality loop
            if item.value::text::integer=idx then level_value:=18+(item.ordinality::integer-1)/3; end if;
          end loop;
          if level_value<highest-1 then candidates:=array_append(candidates,idx); end if;
        end loop;
        if cardinality(candidates)=0 then raise exception 'No quedan piezas elegibles.'; end if;
        if p_payload ? 'blockId' then
          chosen := (p_payload->>'blockId')::integer;
          if not chosen=any(candidates) then raise exception 'Esa pieza no se puede retirar.'; end if;
        else chosen:=candidates[1+floor(random()*cardinality(candidates))::integer]; end if;
        st := st || jsonb_build_object('selectedId',chosen,'answered',false,'revealed',false);
      else
        if st->>'selectedId' is null then raise exception 'Primero sortea una pieza.'; end if;
        if p_action='answer' then
          st := st || jsonb_build_object('answered',true);
        elsif p_action='reveal' then
          if not (st->>'answered')::boolean then raise exception 'Primero confirma que respondiste en voz alta.'; end if;
          st := st || jsonb_build_object('revealed',true);
        elsif p_action='complete' then
          if not (st->>'answered')::boolean then raise exception 'Debes responder antes de terminar tu turno.'; end if;
          select id into next_player from public.jenga_players where room_code=r.code and seat>player.seat order by seat limit 1;
          if next_player is null then select id into next_player from public.jenga_players where room_code=r.code order by seat limit 1; end if;
          st := st || jsonb_build_object('moves',(st->'moves')||jsonb_build_array((st->>'selectedId')::integer),'turn',(st->>'turn')::integer+1,'activeId',next_player,'selectedId',null,'answered',false,'revealed',false);
        end if;
      end if;
    end if;
    update public.jenga_rooms set state=st, revision=revision+1 where code=r.code returning * into r;
  end if;
  select jsonb_agg(jsonb_build_object('id',id,'name',nickname,'seat',seat) order by seat) into roster from public.jenga_players where room_code=r.code;
  result := r.state || jsonb_build_object('code',r.code,'revision',r.revision,'players',roster,'selfId',player.id,'isHost',r.host_hash=token_hash_value,'expiresAt',r.expires_at);
  return result;
end;
$$;
revoke all on function public.jenga_room(text,text,text,text,integer,jsonb) from public;
grant execute on function public.jenga_room(text,text,text,text,integer,jsonb) to anon, authenticated;
commit;
