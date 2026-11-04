-- Exercise real database functions and RLS under authenticated JWTs. No fixture persists.
begin;
select set_config('lenxiq.test_user',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('lenxiq.test_user')::uuid,'subscription-test@example.invalid');
select set_config('request.jwt.claim.sub',current_setting('lenxiq.test_user'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lenxiq.test_user'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r jsonb; n integer; room record;branch record;first_mock jsonb;second_mock jsonb;result jsonb;begin
 if private.has_paid_access() then raise exception 'free gained paid access';end if;
 r:=public.authorize_study_feature('teaching');if (r->>'allowed')::boolean then raise exception 'free LLM leakage';end if;
 select count(*) into n from public.questions q where not private.can_read_question(q.subject,q.division,q.type);if n<>0 then raise exception 'question RLS leakage';end if;
 begin update public.profiles set plan='intensive' where id=auth.uid();raise exception 'self upgrade permitted';exception when raise_exception then if sqlerrm='self upgrade permitted' then raise;end if;end;
 select * into room from public.reserve_live_class_session('test-free-room','Test',null);if room.allowed then raise exception 'free voice leakage';end if;
 select subject,division into branch from public.questions where type='mcq' limit 1;
 if found then
  first_mock:=public.begin_timed_mock(branch.subject,branch.division,10);
  second_mock:=public.begin_timed_mock(branch.subject,branch.division,10);
  if first_mock->>'id'<>second_mock->>'id' then raise exception 'mock resume consumed another attempt';end if;
  result:=public.submit_timed_mock((first_mock->>'id')::uuid,'{}'::jsonb);
  if (result->>'total')::integer<1 or (result->>'score')::integer<>0 then raise exception 'server mock grading incorrect';end if;
  result:=public.submit_timed_mock((first_mock->>'id')::uuid,'{}'::jsonb);
  select count(*) into n from public.exam_results where user_id=auth.uid();if n<>1 then raise exception 'duplicate mock result';end if;
 end if;
end$$;
reset role;
update public.profiles set plan='scholar',plan_expires_at=now()+interval '1 month',wallet_reset_at=now()+interval '1 month',text_teaching_balance=60,voice_minutes_balance=30,quiz_attempts_used=20 where id=current_setting('lenxiq.test_user')::uuid;
set local role authenticated;
do $$declare r jsonb;q record;i integer;begin
 for i in 1..60 loop r:=public.authorize_study_feature('explanation');if not (r->>'allowed')::boolean then raise exception 'scholar credit failure';end if;end loop;
 r:=public.authorize_study_feature('teaching');if (r->>'allowed')::boolean then raise exception 'credit exhaustion bypass';end if;
 r:=public.authorize_study_feature('quiz');if (r->>'allowed')::boolean then raise exception 'scholar mock cap bypass';end if;
 select * into q from public.reserve_live_class_session('test-scholar-room','Test',null);if not q.allowed or q.max_duration_seconds<>1800 then raise exception 'scholar voice reservation incorrect';end if;
 perform * from public.charge_live_class_session(q.session_id,120,false);
 perform * from public.charge_live_class_session(q.session_id,120,false);
 if (select voice_minutes_balance from public.profiles where id=auth.uid())<>28 then raise exception 'voice heartbeat double debit';end if;
end$$;
reset role;
update public.profiles set plan='all_access',quiz_attempts_used=99999,voice_minutes_balance=90 where id=current_setting('lenxiq.test_user')::uuid;
set local role authenticated;
do $$declare r jsonb;begin r:=public.authorize_study_feature('quiz');if not (r->>'allowed')::boolean then raise exception 'Scholar Plus mocks not unlimited';end if;end$$;
reset role;
update public.profiles set plan='intensive',voice_minutes_balance=360 where id=current_setting('lenxiq.test_user')::uuid;
set local role authenticated;
do $$declare r jsonb;q record;begin
 r:=public.authorize_study_feature('quiz');if not (r->>'allowed')::boolean then raise exception 'Mastery mocks not unlimited';end if;
 select * into q from public.reserve_live_class_session('test-mastery-room','Test',null);if not q.allowed or q.max_duration_seconds<>5400 then raise exception 'mastery session limit incorrect';end if;
end$$;
reset role;
update public.profiles set plan_expires_at=now()-interval '1 second' where id=current_setting('lenxiq.test_user')::uuid;
set local role authenticated;
do $$begin if private.has_paid_access() then raise exception 'expired access leakage';end if;end$$;
reset role;
update public.profiles set role='admin',text_teaching_balance=0,voice_minutes_balance=0 where id=current_setting('lenxiq.test_user')::uuid;
set local role authenticated;
do $$declare r jsonb;begin r:=public.authorize_study_feature('teaching');if not (r->>'allowed')::boolean or not (r->>'admin')::boolean then raise exception 'admin restricted';end if;end$$;
reset role;
do $$declare r record; balance integer;begin
 select * into r from public.settle_verified_payment('test-idempotent-'||current_setting('lenxiq.test_user'),current_setting('lenxiq.test_user')::uuid,'subscription_payment','intensive',1,29900);
 select * into r from public.settle_verified_payment('test-idempotent-'||current_setting('lenxiq.test_user'),current_setting('lenxiq.test_user')::uuid,'subscription_payment','intensive',1,29900);
 if not r.already_settled then raise exception 'duplicate payment not idempotent';end if;
 if (select count(*) from public.subscription_plans)<>4 then raise exception 'unexpected product count';end if;
 if (select voice_minutes from public.subscription_plans where id='intensive')<>360 then raise exception 'mastery monthly quota incorrect';end if;
end$$;
rollback;
select true as four_tier_verification_passed;
