/* ShakawShopper - etapa de autenticação e criação segura da família.
   A chave publishable é pública por definição; a segurança depende de RLS.
   Nunca inclua service_role/secret keys neste arquivo. */
const SHAKAW_SUPABASE_URL = 'https://xzarvousybfjwhnshzvn.supabase.co';
const SHAKAW_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4qM8qULmT8DzVHbpzqNO_Q_uyLNQeYf';
const sb = window.supabase.createClient(SHAKAW_SUPABASE_URL, SHAKAW_SUPABASE_PUBLISHABLE_KEY);
window.sb = sb; // compartilha a conexão com o módulo da lista
const byId = id => document.getElementById(id);
const authForm = byId('authForm');
const authMessage = byId('authMessage');
const authStatus = byId('authStatus');
const householdPanel = byId('householdPanel');
const householdStatus = byId('householdStatus');
let currentUser = null;
window.shakawAccount = { user: null, householdId: null, householdName: null };

function authMsg(text, isError=false) { authMessage.textContent=text; authMessage.style.color=isError?'#b42318':'#315d83'; }
function authBusy(busy) { authForm.querySelectorAll('button').forEach(b=>b.disabled=busy); }
async function refreshAccount() {
  const {data:{session}} = await sb.auth.getSession();
  currentUser = session?.user || null;
  window.shakawAccount.user = currentUser;
  if (!currentUser) {
    authStatus.textContent='Não conectado. Entre ou crie sua conta para configurar a família.';
    householdPanel.classList.add('hidden');
    byId('logoutBtn').classList.add('hidden');
    authForm.classList.remove('hidden');
    byId('signupBtn').classList.remove('hidden');
    byId('authToggle').textContent='Ocultar acesso';
    return;
  }
  authStatus.textContent=`Conectado como ${currentUser.email}`;
  authForm.classList.remove('hidden');
  byId('signupBtn').classList.add('hidden');
  byId('logoutBtn').classList.remove('hidden');
  byId('authToggle').textContent='Ocultar acesso';
  householdPanel.classList.remove('hidden');
  await loadHousehold();
}
async function loadHousehold() {
  householdStatus.textContent='Verificando sua família…';
  const {data:members,error} = await sb.from('household_members').select('household_id, role, households(name)').eq('user_id',currentUser.id);
  if (error) { householdStatus.textContent='Não foi possível consultar a família. Confira as políticas RLS e o esquema do banco.'; byId('householdForm').classList.add('hidden'); return; }
  if (members?.length) {
    const m=members[0]; window.shakawAccount.householdId=m.household_id; window.shakawAccount.householdName=m.households?.name || 'Família Shakaw'; window.dispatchEvent(new Event('shakaw-household-ready')); householdStatus.textContent=`Família conectada: ${m.households?.name || 'Família Shakaw'} · perfil: ${m.role}. ID: ${m.household_id}`;
    byId('householdForm').classList.add('hidden');
  } else {
    window.shakawAccount.householdId=null; window.shakawAccount.householdName=null; window.dispatchEvent(new Event('shakaw-household-ready'));
    householdStatus.textContent='Sua conta ainda não pertence a uma família. Você pode criar a família abaixo.';
    byId('householdForm').classList.remove('hidden');
  }
}
byId('authToggle').addEventListener('click',()=>authForm.classList.toggle('hidden'));
authForm.addEventListener('submit',async e=>{
  e.preventDefault(); authBusy(true); authMsg('Entrando…');
  const email=byId('authEmail').value.trim(); const password=byId('authPassword').value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  authBusy(false);
  if(error){authMsg(error.message,true);return;}
  authMsg('Login realizado.'); await refreshAccount();
});
byId('signupBtn').addEventListener('click',async()=>{
  authBusy(true); authMsg('Criando conta…');
  const email=byId('authEmail').value.trim(); const password=byId('authPassword').value;
  if(!email||password.length<8){authBusy(false);authMsg('Informe um e-mail válido e uma senha com pelo menos 8 caracteres.',true);return;}
  const {data,error}=await sb.auth.signUp({email,password});
  authBusy(false);
  if(error){authMsg(error.message,true);return;}
  if(!data.session){authMsg('Conta criada. Confirme o e-mail pelo link enviado e depois entre.');return;}
  authMsg('Conta criada e conectada.'); await refreshAccount();
});
byId('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut(); authMsg('Você saiu da conta.'); await refreshAccount();});
byId('householdForm').addEventListener('submit',async e=>{
  e.preventDefault(); if(!currentUser){householdStatus.textContent='Entre primeiro.';return;}
  const button=e.submitter; button.disabled=true; householdStatus.textContent='Criando família…';
  const name=byId('householdName').value.trim();
  const {data,error}=await sb.rpc('create_household',{p_name:name});
  button.disabled=false;
  if(error){householdStatus.textContent=`Não foi possível criar a família: ${error.message}`;return;}
  householdStatus.textContent=`Família criada. ID: ${data}`;
  await loadHousehold();
});
sb.auth.onAuthStateChange(()=>{setTimeout(()=>refreshAccount(),0);});
refreshAccount().catch(err=>{authStatus.textContent='Erro ao conectar ao Supabase: '+err.message;});
