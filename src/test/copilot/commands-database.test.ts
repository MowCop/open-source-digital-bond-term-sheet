// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { prepareCommand, COMMAND_FIELDS, type CommandSnapshot } from '../../../supabase/functions/_shared/copilot-commands';
const db = new PGlite();
const editor = '11111111-1111-4111-8111-111111111111', member = '22222222-2222-4222-8222-222222222222', outsider = '33333333-3333-4333-8333-333333333333';
const q = async (sql: string, params: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, params)).rows;
const identity = async (id: string) => { await q("select set_config('request.jwt.claim.sub',$1,false)", [id]); };
let count = 0;
async function seed(bulletin?: string) {
  await identity(editor);
  const id = `command-${count++}`;
  const snapshot: CommandSnapshot = {
    bdt_state: { f: { [COMMAND_FIELDS.size[0]]: '500000000', [COMMAND_FIELDS.size[1]]: '500000000', [COMMAND_FIELDS.currency[0]]: 'USD' }, parties: [{ PartyName: 'Test Issuer', Roles: ['ISSUER'] }] },
    deal_workspace: { version: 1, tranches: [{ id: 'a', label: 'A', currency: 'USD', amount: 500000000, rateType: 'fixed', values: {} }, { id: 'b', label: 'B', currency: 'USD', amount: 350000000, rateType: 'fixed', values: {} }], aggregateUsd: 2000000000 },
    notes: { intro: '', notes: 'Manual text\n<<HASH>>old\n<<LEGAL>>\nLegal original' },
  };
  await q('insert into deals(id,bdt_state,deal_workspace,size,currency) values($1,$2,$3,$4,$5)', [id, JSON.stringify(snapshot.bdt_state), JSON.stringify(snapshot.deal_workspace), 'USD 500m', 'USD']);
  await q('insert into deal_bulletin_notes(deal_id,intro,notes) values($1,$2,$3)', [id, '', snapshot.notes?.notes]);
  const tid = (await q('select copilot_open($1) id', [id]))[0].id;
  const plan = prepareCommand(snapshot, { edits: [{ tranche: 'A', field: 'size', before: '500m', after: '600m' }], ...(bulletin ? { bulletin } : {}) });
  const command = (await q('insert into copilot_commands(thread_id,request_text,plan,created_by) values($1,$2,$3,$4) returning id', [tid, 'Change Tranche A 500m to 600m', JSON.stringify(plan), editor]))[0].id;
  return { id, command };
}
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  CREATE TABLE deals(id text PRIMARY KEY,bdt_state jsonb,deal_workspace jsonb,issuer_name text,currency text,size text,coupon text,maturity_date text,isin text,governing_law text,tenor text,interest_type text,settlement_date text,pricing_date text,issue_price text,reoffer_price text,reoffer_yield text,ipt text,guidance text,updated_at timestamptz default now());
  CREATE TABLE deal_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),deal_id text,uploaded_by uuid);
  CREATE TABLE audit_log(id text,action text,entity_type text,entity_id text,user_id text,timestamp timestamptz,details text);
  CREATE TABLE deal_bulletin_notes(deal_id text PRIMARY KEY,intro text,notes text,updated_by uuid,updated_at timestamptz);
  CREATE FUNCTION is_approved(id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT id IS NOT NULL $$;
  CREATE FUNCTION is_admin(id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT id='${editor}'::uuid $$;
  CREATE FUNCTION can_access_deal(deal text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid() IN ('${editor}'::uuid,'${member}'::uuid) $$;`);
  for (const file of ['0001_vdr_deal_copilot.sql', '0002_copilot_atomic_approval_cache.sql', '0003_copilot_review_event_entrypoints.sql', '0004_copilot_grouped_commands.sql', '0005_copilot_command_amount_display.sql']) {
    await db.exec(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8').replace(/CREATE POLICY copilot_members_upload_files[^;]+;/g, ''));
  }
}, 60000);
afterAll(async () => { await db.close(); });
describe('Grouped commands human execution guarantees', () => {
  it('preview does not mutate the 500m deal', async () => {
    const { id } = await seed();
    expect((await q('select deal_workspace->\'tranches\'->0->>\'amount\' amount from deals where id=$1', [id]))[0].amount).toBe('500000000');
  });
  it('human Execute atomically writes 600m to workspace and BDT, preserves B and audits', async () => {
    const { id, command } = await seed();
    expect((await q('select copilot_execute_command($1,true) result', [command]))[0].result).toBe('executed');
    const d = (await q('select bdt_state,deal_workspace from deals where id=$1', [id]))[0];
    const st = d.bdt_state as CommandSnapshot['bdt_state'], ws = d.deal_workspace as CommandSnapshot['deal_workspace'];
    expect(ws?.tranches[0].amount).toBe(600000000);
    expect(ws?.tranches[1].amount).toBe(350000000);
    for (const path of COMMAND_FIELDS.size) expect(st.f[path]).toBe('600000000');
    expect((await q('select size from deals where id=$1', [id]))[0].size).toBe('USD 600m');
    expect((await q("select user_id from audit_log where entity_id=$1 and action='copilot_command_executed'", [id]))[0].user_id).toBe(editor);
    await expect(q('select copilot_execute_command($1,true)', [command])).rejects.toThrow('already decided');
  });
  it('read-only member cannot Execute', async () => {
    const { command } = await seed(); await identity(member);
    await expect(q('select copilot_execute_command($1,true)', [command])).rejects.toThrow('Term-edit rights');
  });
  it('non-member sees no commands under RLS', async () => {
    await seed(); await identity(outsider); await db.exec('SET ROLE authenticated');
    try { expect((await q('select * from copilot_commands')).length).toBe(0); } finally { await db.exec('RESET ROLE'); }
  });
  it('browser cannot alter pending snapshots directly', async () => {
    const { command } = await seed(); await db.exec('SET ROLE authenticated');
    try { await expect(q("update copilot_commands set status='executed' where id=$1", [command])).rejects.toThrow('permission denied'); } finally { await db.exec('RESET ROLE'); }
  });
  it('stale workspace blocks all writes', async () => {
    const { command, id } = await seed();
    await q("update deals set deal_workspace=jsonb_set(deal_workspace,'{aggregateUsd}','2100000000') where id=$1", [id]);
    await expect(q('select copilot_execute_command($1,true)', [command])).rejects.toThrow('fresh command preview');
    expect((await q('select bdt_state->\'f\'->>$2 amount from deals where id=$1', [id, COMMAND_FIELDS.size[0]]))[0].amount).toBe('500000000');
  });
  it('stale manually edited bulletin blocks all writes', async () => {
    const { command, id } = await seed('Suggested text');
    await q("update deal_bulletin_notes set notes='New manual text' where deal_id=$1", [id]);
    await expect(q('select copilot_execute_command($1,true)', [command])).rejects.toThrow('fresh command preview');
    expect((await q('select notes from deal_bulletin_notes where deal_id=$1', [id]))[0].notes).toBe('New manual text');
  });
  it('Reject leaves 500m and manual text unchanged', async () => {
    const { command, id } = await seed();
    expect((await q('select copilot_execute_command($1,false) result', [command]))[0].result).toBe('rejected');
    expect((await q('select size from deals where id=$1', [id]))[0].size).toBe('USD 500m');
    expect((await q('select notes from deal_bulletin_notes where deal_id=$1', [id]))[0].notes).toContain('Manual text');
  });
  it('Execute saves suggested Terms and preserves legal text without sending', async () => {
    const { command, id } = await seed('Whole-deal suggestion');
    await q('select copilot_execute_command($1,true)', [command]);
    const notes = (await q('select notes from deal_bulletin_notes where deal_id=$1', [id]))[0].notes as string;
    expect(notes).toContain('Whole-deal suggestion'); expect(notes).toContain('Legal original');
  });
});