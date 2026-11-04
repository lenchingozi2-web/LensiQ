begin;
select set_config('lenxiq.reliability_user',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('lenxiq.reliability_user')::uuid,'subscription-reliability@example.invalid');
select set_config('request.jwt.claim.sub',current_setting('lenxiq.reliability_user'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('lenxiq.reliability_user'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.reserve_ai_request('teaching',gen_random_uuid());if (r->>'allowed')::boolean then raise exception 'free AI reservation allowed';end if;
 if has_function_privilege('authenticated','public.finish_ai_request(uuid,boolean)','execute') then raise exception 'client can refund itself';end if;
 begin perform public.admin_monthly_financials(date_trunc('month',now())::date);raise exception 'non-admin finance access allowed';exception when raise_exception then if sqlerrm='non-admin finance access allowed' then raise;end if;end;
end$$;
reset role;
update public.profiles set plan='scholar',plan_expires_at=now()+interval '2 months',wallet_reset_at=now()+interval '1 month',text_teaching_balance=60,voice_minutes_balance=30 where id=current_setting('lenxiq.reliability_user')::uuid;
select set_config('lenxiq.test_request',gen_random_uuid()::text,true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.reserve_ai_request('teaching',current_setting('lenxiq.test_request')::uuid);if not (r->>'allowed')::boolean then raise exception 'paid AI reservation failed';end if;
 r:=public.reserve_ai_request('teaching',current_setting('lenxiq.test_request')::uuid);if (r->>'allowed')::boolean then raise exception 'AI reservation replay accepted';end if;
end$$;
reset role;
select public.finish_ai_request(current_setting('lenxiq.test_request')::uuid,false);
select public.finish_ai_request(current_setting('lenxiq.test_request')::uuid,false);
do $$begin if (select text_teaching_balance from public.profiles where id=current_setting('lenxiq.reliability_user')::uuid)<>60 then raise exception 'AI credit refund not exactly once';end if;end$$;
-- An old-cycle refund must never increase a freshly granted allowance.
update public.ai_request_reservations set status='reserved' where id=current_setting('lenxiq.test_request')::uuid;
update public.profiles set wallet_reset_at=wallet_reset_at+interval '1 month',text_teaching_balance=60 where id=current_setting('lenxiq.reliability_user')::uuid;
select public.finish_ai_request(current_setting('lenxiq.test_request')::uuid,false);
do $$begin if (select text_teaching_balance from public.profiles where id=current_setting('lenxiq.reliability_user')::uuid)<>60 then raise exception 'old-cycle refund inflation';end if;end$$;
-- A stale class is charged against the old cycle, then allowances reset once.
insert into public.live_class_sessions(user_id,room_name,course_name,status,started_at,voice_reserved_minutes) values(current_setting('lenxiq.reliability_user')::uuid,'reliability-stale-'||gen_random_uuid(),'Test','active',now()-interval '40 minutes',30);
update public.profiles set wallet_reset_at=now()-interval '1 minute',voice_minutes_balance=30 where id=current_setting('lenxiq.reliability_user')::uuid;
set local role authenticated;
select public.refresh_my_subscription();
reset role;
do $$begin
 if (select voice_minutes_balance from public.profiles where id=current_setting('lenxiq.reliability_user')::uuid)<>30 then raise exception 'old class charged against new cycle';end if;
 if exists(select 1 from public.live_class_sessions where user_id=current_setting('lenxiq.reliability_user')::uuid and status='active') then raise exception 'stale class left active';end if;
end$$;
-- A paid downgrade is visible as scheduled and does not erase the current tier.
update public.profiles set plan='intensive',plan_expires_at=now()+interval '1 month',wallet_reset_at=now()+interval '1 month',voice_minutes_balance=360 where id=current_setting('lenxiq.reliability_user')::uuid;
select * from public.settle_verified_payment('reliability-downgrade-'||current_setting('lenxiq.reliability_user'),current_setting('lenxiq.reliability_user')::uuid,'subscription_payment','scholar',1,4570);
do $$begin
 if (select plan from public.profiles where id=current_setting('lenxiq.reliability_user')::uuid)<>'intensive' then raise exception 'downgrade erased paid benefits';end if;
 if not exists(select 1 from public.scheduled_subscriptions where user_id=current_setting('lenxiq.reliability_user')::uuid and plan_id='scholar' and status='scheduled') then raise exception 'downgrade was not scheduled';end if;
end$$;
update public.profiles set plan_expires_at=now()-interval '1 second' where id=current_setting('lenxiq.reliability_user')::uuid;
update public.scheduled_subscriptions set starts_at=now()-interval '1 second',ends_at=now()+interval '1 month' where user_id=current_setting('lenxiq.reliability_user')::uuid;
set local role authenticated;
select public.refresh_my_subscription();
reset role;
do $$begin if (select plan from public.profiles where id=current_setting('lenxiq.reliability_user')::uuid)<>'scholar' then raise exception 'scheduled paid access did not activate';end if;end$$;
-- Idempotent receipt ownership must not be changed by a repeated reference.
do $$begin
 begin perform * from public.settle_verified_payment('reliability-downgrade-'||current_setting('lenxiq.reliability_user'),current_setting('lenxiq.reliability_user')::uuid,'subscription_payment','intensive',1,29900);raise exception 'reference collision accepted';exception when raise_exception then if sqlerrm='reference collision accepted' then raise;end if;end;
end$$;
update public.profiles set role='admin' where id=current_setting('lenxiq.reliability_user')::uuid;
set local role authenticated;
do $$declare r jsonb;begin r:=public.admin_monthly_financials(date_trunc('month',now())::date);if not r?'revenueNgn' or not r?'usage' then raise exception 'monthly finance report incomplete';end if;end$$;
reset role;
rollback;
select true as subscription_reliability_verified;
