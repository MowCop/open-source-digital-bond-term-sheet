import { describe,it,expect,vi } from 'vitest';
const invoke=vi.hoisted(()=>vi.fn());
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke}}}));
vi.mock('./document-reader',()=>({readDocument:vi.fn()}));
import { processCopilot } from './client';
describe('Co-Pilot review events',()=>{
  it('does not lose a new document event arriving during an active drain',async()=>{
    let resolve: (value:unknown)=>void = ()=>{};
    invoke.mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({data:{completed:[]},error:null});
    const first=processCopilot('thread-1');
    const second=processCopilot('thread-1');
    resolve({data:{completed:[]},error:null});
    await Promise.all([first,second]);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});