"""Real overlapping authenticated sessions; isolated local Docker database only.
Run: python3 supabase/tests/concurrency/run.py
No hosted connection parameter is accepted. Owner access is fixture setup/cleanup
and lock-observation only; all lifecycle operations run SET ROLE authenticated.
"""
import os
import re
import subprocess
import threading
import time
import unittest

CONTAINER = os.environ.get('SUPABASE_TEST_CONTAINER', 'supabase_db_tennis-nextsteps-codex')
if CONTAINER != 'supabase_db_tennis-nextsteps-codex' and not (
    os.environ.get('CI') == 'true' and re.fullmatch(r'supabase_db_[A-Za-z0-9_-]+', CONTAINER)
):
    raise RuntimeError('Concurrency tests require the isolated test container or an explicit CI container.')
A = 'a1111111-1111-1111-1111-111111111111'
B = 'a2222222-2222-2222-2222-222222222222'
C = 'a3333333-3333-3333-3333-333333333333'
G = 'a7777777-7777-7777-7777-777777777777'
H = 'a8888888-8888-8888-8888-888888888888'

def sql(query):
    result = subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

class Session:
    def __init__(self, actor, name):
        self.proc = subprocess.Popen(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-U','postgres'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        self.name = name
        self.query(f"set application_name='{name}'; begin; set local role authenticated; set local request.jwt.claims='{{\"sub\":\"{actor}\",\"role\":\"authenticated\"}}';")
    def query(self, query):
        self.proc.stdin.write(query + '\n\\echo __END__\n')
        self.proc.stdin.flush()
        lines=[]
        while True:
            line=self.proc.stdout.readline()
            if not line: raise RuntimeError('Session ended unexpectedly')
            if line.strip()=='__END__': return '\n'.join(lines).strip()
            lines.append(line.rstrip())
    def close(self):
        if self.proc.poll() is None:
            self.query('rollback;')
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
            self.proc.stdout.close()

def pending(group, opponent):
    s=Session(A,'concurrency_submit')
    try:
        match=s.query(f"select (public.submit_match('{group}','{opponent}','completed','{A}','[{{\"set_number\":1,\"games_a\":6,\"games_b\":0,\"complete\":true}},{{\"set_number\":2,\"games_a\":6,\"games_b\":0,\"complete\":true}}]')).id;")
        s.query('commit;')
        return match
    finally: s.close()

class Concurrency(unittest.TestCase):
    def setUp(self):
        self.sessions=[]
        sql(f"delete from public.groups where id in ('{G}','{H}'); delete from auth.users where id in ('{A}','{B}','{C}');")
        sql(f"""insert into auth.users(id,email,raw_user_meta_data) values
        ('{A}','concurrency-a@example.test','{{"display_name":"Race A"}}'),
        ('{B}','concurrency-b@example.test','{{"display_name":"Race B"}}'),
        ('{C}','concurrency-c@example.test','{{"display_name":"Race C"}}');
        insert into public.groups(id,name,invite_code,created_by) values
        ('{G}','Concurrent one','CONCUR01','{A}'),('{H}','Concurrent two','CONCUR02','{A}');
        insert into public.group_members(group_id,user_id,role) values ('{G}','{B}','organizer'),('{H}','{C}','player');""")
    def tearDown(self):
        for session in self.sessions: session.close()
        sql(f"delete from public.groups where id in ('{G}','{H}'); delete from auth.users where id in ('{A}','{B}','{C}');")
    def session(self, actor, name):
        s=Session(actor,name); self.sessions.append(s); return s
    def overlap(self, first, second, second_query):
        box={}
        thread=threading.Thread(target=lambda:box.update(result=second.query(second_query)),daemon=True)
        thread.start()
        deadline=time.monotonic()+5
        blocked=False
        while time.monotonic()<deadline and thread.is_alive():
            if sql(f"select count(*) from pg_stat_activity where application_name='{second.name}' and wait_event_type='Lock'")=='1':
                blocked=True; break
            time.sleep(.03)
        first.query('commit;')
        thread.join(10)
        self.assertFalse(thread.is_alive(), 'second session must finish after first commits')
        return blocked,box.get('result','')
    def test_cross_group_confirmation_commit_order(self):
        m1=pending(G,B); m2=pending(H,C)
        first=self.session(B,'concurrency_confirm_first')
        second=self.session(C,'concurrency_confirm_second')
        self.assertNotIn('ERROR',first.query(f"select (public.confirm_match('{m1}')).id;"))
        blocked,result=self.overlap(first,second,f"select (public.confirm_match('{m2}')).id;")
        self.assertTrue(blocked,'second confirmation must wait for first COMMIT even in a different group')
        self.assertNotIn('ERROR',result)
        second.query('commit;')
        reader=self.session(A,'concurrency_history_reader')
        self.assertEqual(reader.query(f"select (select confirmed_at from public.matches where id='{m1}') < (select confirmed_at from public.matches where id='{m2}');"),'t')
        self.assertEqual(reader.query(f"select rating_before::int || ',' || rating_after::int from public.get_rating_history('{A}') where match_id='{m1}';"),'1500,1520')
    def organizer_race(self, operation, expected_error):
        first=self.session(A,'concurrency_org_first')
        second=self.session(B,'concurrency_org_second')
        if operation=='leave':
            q1=q2=f"select public.leave_group('{G}');"
        elif operation=='demote':
            q1=f"select public.set_group_member_role('{G}','{A}','player');"
            q2=f"select public.set_group_member_role('{G}','{B}','player');"
        else:
            q1=f"select public.remove_group_member('{G}','{B}');"
            q2=f"select public.remove_group_member('{G}','{A}');"
        self.assertNotIn('ERROR',first.query(q1))
        blocked,result=self.overlap(first,second,q2)
        self.assertTrue(blocked,'second membership RPC overlaps first transaction')
        self.assertIn(expected_error,result)
        second.query('rollback;')
        self.assertEqual(sql(f"select count(*) from public.group_members where group_id='{G}' and role='organizer' and left_at is null"),'1')
    def test_last_organizers_cannot_both_leave(self): self.organizer_race('leave','Transfer the organizer role')
    def test_last_organizers_cannot_both_demote(self): self.organizer_race('demote','A group must keep at least one organizer')
    def test_removed_organizer_cannot_remove_other(self): self.organizer_race('remove','Only an organizer can remove')

if __name__=='__main__': unittest.main(verbosity=2)
