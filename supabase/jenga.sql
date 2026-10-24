-- Ejecutar completo en Supabase > SQL Editor. No requiere claves secretas en el HTML.
begin;

-- Las respuestas sobreviven al vencimiento o eliminación de una sala.
create table if not exists public.jenga_questions (
  id integer primary key check(id between 1 and 30), question text not null
);
alter table public.jenga_questions enable row level security;
revoke all on public.jenga_questions from public, anon, authenticated;
insert into public.jenga_questions(id,question) values
(1,'La presión arterial elevada siempre produce síntomas.'),
(2,'El IMC relaciona el peso con la ______.'),
(3,'¿Qué significan las letras IMC?'),
(4,'El exceso de alcohol puede elevar la presión arterial.'),
(5,'Nombren tres formas de moverse durante la jornada laboral.'),
(6,'¿Por qué es útil conocer el perímetro abdominal?'),
(7,'El número de arriba en la presión arterial se llama ______.'),
(8,'El número de abajo en la presión arterial se llama ______.'),
(9,'Un IMC habitual significa que ya no necesito controles de salud.'),
(10,'Inventa un lema que incluya la palabra “corazón”.'),
(11,'Digan cuatro alimentos que aporten fibra.'),
(12,'¿Cuántos minutos semanales de actividad moderada se recomiendan para adultos?'),
(13,'Estar sentado muchas horas sin pausas no importa si hago ejercicio un día a la semana.'),
(14,'Representa sin palabras una pausa activa que harías en la oficina.'),
(15,'¿Qué bebida conviene elegir con mayor frecuencia para hidratarnos?'),
(16,'El sueño también hace parte del cuidado cardiovascular.'),
(17,'Puedo saber si tengo hipertensión solo con mi peso.'),
(18,'Mencionen tres alternativas para compartir sin tomar alcohol.'),
(19,'Una forma de disminuir azúcar en bebidas es elegir más ______.'),
(20,'¿Qué harías si tienes una presión muy alta en una medición?'),
(21,'Caminar, bailar o montar bicicleta pueden contar como actividad física.'),
(22,'Inventa una frase corta para motivar a beber más agua.'),
(23,'¿Por qué una sola medición de presión no confirma hipertensión?'),
(24,'Propongan tres hábitos que apoyen la salud metabólica.'),
(25,'Fumar solo ocasionalmente no afecta la salud del corazón.'),
(26,'¿Quién debe interpretar IMC, perímetro abdominal y presión en conjunto?'),
(27,'En 15 segundos, inventa una campaña para cambiar una gaseosa por agua.'),
(28,'Reducir el consumo excesivo de sal puede apoyar el control de la presión.'),
(29,'La torre se mueve: mencionen tres cambios saludables fáciles de sostener.'),
(30,'¿Qué significa cuidar tu salud “bloque a bloque”?')
on conflict(id) do update set question=excluded.question;
create table if not exists public.jenga_answers (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  mode text not null check(mode in ('online','local')),
  room_code text,
  local_session uuid,
  request_id uuid unique,
  alias text not null check(length(alias) between 1 and 30),
  round_no integer not null check(round_no>=1),
  turn_no integer not null check(turn_no>=0),
  block_id integer not null check(block_id between 1 and 54),
  question_no integer not null check(question_no between 1 and 30),
  question text not null,
  response text not null check(length(trim(response)) between 1 and 500),
  unique(room_code,round_no,turn_no),
  unique(local_session,round_no,turn_no)
);
create index if not exists jenga_answers_created_at on public.jenga_answers(created_at);
alter table public.jenga_answers enable row level security;
revoke all on public.jenga_answers from public, anon, authenticated;

-- En modo local el facilitador declara los alias; no es una identidad verificada.
-- request_id y sesión/ronda/turno hacen seguros los reintentos tras reconectar.
create or replace function public.jenga_save_local_answer(p_answer jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  question_id integer;
begin
  if jsonb_typeof(p_answer->'response') is distinct from 'string'
    or length(trim(p_answer->>'response')) not between 1 and 500 then
    raise exception 'Escribe una respuesta de 1 a 500 caracteres.';
  end if;
  if p_answer->>'id' is null or p_answer->>'session' is null then
    raise exception 'Falta identificar la respuesta local.';
  end if;
  question_id := (((p_answer->>'block')::integer-1)%30)+1;
  insert into public.jenga_answers(mode,local_session,request_id,alias,round_no,turn_no,block_id,question_no,question,response)
  values('local',(p_answer->>'session')::uuid,(p_answer->>'id')::uuid,trim(p_answer->>'alias'),
    (p_answer->>'round')::integer,(p_answer->>'turn')::integer,(p_answer->>'block')::integer,
    question_id,(select question from public.jenga_questions where id=question_id),trim(p_answer->>'response'))
  on conflict do nothing;
end;
$$;
revoke all on function public.jenga_save_local_answer(jsonb) from public;
grant execute on function public.jenga_save_local_answer(jsonb) to anon, authenticated;
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
      st := jsonb_build_object('status','lobby','selectedId',null,'answered',false,'revealed',false,'round',1,'turn',0,'moves','[]'::jsonb,'activeId',null);
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
        st := jsonb_build_object('status','lobby','selectedId',null,'answered',false,'revealed',false,'round',coalesce((st->>'round')::integer,1)+1,'turn',0,'moves','[]'::jsonb,'activeId',null);
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
          if (st->>'answered')::boolean then raise exception 'Este turno ya tiene una respuesta.'; end if;
          if jsonb_typeof(p_payload->'response') is distinct from 'string'
            or length(trim(p_payload->>'response')) not between 1 and 500 then
            raise exception 'Escribe una respuesta de 1 a 500 caracteres.';
          end if;
          insert into public.jenga_answers(mode,room_code,alias,round_no,turn_no,block_id,question_no,question,response)
          values('online',r.code,player.nickname,coalesce((st->>'round')::integer,1),
            (st->>'turn')::integer,(st->>'selectedId')::integer,((st->>'selectedId')::integer-1)%30+1,
            (select question from public.jenga_questions where id=((st->>'selectedId')::integer-1)%30+1),trim(p_payload->>'response'));
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

notify pgrst, 'reload schema';
