/* Shakaw Lista de Compras — MVP local/offline.
   Para sincronização real entre aparelhos, configure o Supabase conforme README.md.
   Nunca coloque a chave service_role neste arquivo. */
const SUPABASE_URL = ''; // ex.: https://seu-projeto.supabase.co
const SUPABASE_PUBLIC_KEY = ''; // chave pública anon/publishable, com RLS habilitado
const STORAGE_KEY = 'shakaw-shopping-v1';
const $ = id => document.getElementById(id);
const money = value => (Number(value)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
let state = loadState(); let activeView='list'; let deferredInstall=null;
function loadState(){try{return {...{items:[],products:[],history:[],budget:0},...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return {items:[],products:[],history:[],budget:0}}}
let cloudListId=null, cloudReady=false, cloudBusy=false, cloudTimer=null;
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render();scheduleCloudSave();}
function cloudStatus(msg){const el=$('syncMessage');if(el)el.textContent=msg;}
async function initCloud(){
  if(!window.sb || !window.shakawAccount?.user || !window.shakawAccount?.householdId) { cloudStatus('Aguardando login e família para iniciar a nuvem.'); return; }
  if(cloudBusy) return;
  cloudBusy=true;
  try{
    const hid=window.shakawAccount.householdId;
    let {data:lists,error}=await window.sb.from('shopping_lists').select('*').eq('household_id',hid).eq('status','active').limit(1);
    if(error) throw error;
    let list=lists?.[0];
    if(!list){
      const made=await window.sb.from('shopping_lists').insert({household_id:hid,name:'Compra atual',budget:Number(state.budget)||0,status:'active',created_by:window.shakawAccount.user.id}).select().single();
      if(made.error) throw made.error; list=made.data;
    }
    cloudListId=list.id;
    const {data:rows,error:itemsError}=await window.sb.from('shopping_items').select('*').eq('list_id',cloudListId);
    if(itemsError) throw itemsError;
    const cloudItems=(rows||[]).map(r=>({id:r.id,name:r.name,qty:Number(r.quantity)||1,unit:r.unit||'un.',price:Number(r.estimated_unit_price)||0,actualPrice:r.actual_unit_price==null?null:Number(r.actual_unit_price),category:r.category||'Outros',aisle:r.aisle||'',checked:!!r.checked,createdAt:r.created_at}));
    const cloudHasItems=cloudItems.length>0;
    if(cloudHasItems || state.items.length===0){state.items=cloudItems;state.budget=Number(list.budget)||0;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
    cloudReady=true; render(); cloudStatus('☁ Sincronização ativa: lista e orçamento compartilhados com a família.');
    const shouldUploadLocal = !cloudHasItems && state.items.length>0;
    cloudBusy=false;
    if(shouldUploadLocal) await syncCloud();
  }catch(e){cloudReady=false;cloudStatus('Falha na nuvem: '+(e.message||e.details||e.hint||'verifique o Console.'));console.error('Shakaw cloud sync',e);}
  finally{cloudBusy=false;}
}
function scheduleCloudSave(){if(!cloudReady||!cloudListId)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>syncCloud(),700);}
async function syncCloud(){
  if(!cloudReady||!cloudListId||cloudBusy)return;
  cloudBusy=true;
  try{
    const hid=window.shakawAccount.householdId;
    const {error:listError}=await window.sb.from('shopping_lists').update({budget:Number(state.budget)||0}).eq('id',cloudListId);
    if(listError) throw listError;
    const {error:delError}=await window.sb.from('shopping_items').delete().eq('list_id',cloudListId);
    if(delError) throw delError;
    if(state.items.length){
      const rows=state.items.map(i=>({list_id:cloudListId,name:i.name,quantity:Number(i.qty)||1,unit:i.unit||'un.',estimated_unit_price:Number(i.price)||0,actual_unit_price:i.actualPrice==null?null:Number(i.actualPrice),category:i.category||'Outros',aisle:i.aisle||'',checked:!!i.checked,updated_by:window.shakawAccount.user.id}));
      const {error:insError}=await window.sb.from('shopping_items').insert(rows);
      if(insError) throw insError;
    }
    cloudStatus('☁ Lista sincronizada com a família.');
  }catch(e){cloudStatus('Erro ao sincronizar: '+(e.message||'verifique o Supabase.'));console.error('Shakaw sync',e);}
  finally{cloudBusy=false;}
}
window.addEventListener('shakaw-household-ready',()=>{cloudReady=false;cloudListId=null;initCloud();});
window.addEventListener('online',()=>{if(window.shakawAccount?.householdId)initCloud();});

const CATALOG=[
['Arroz','Mercearia','kg'],['Feijão carioca','Mercearia','kg'],['Feijão preto','Mercearia','kg'],['Macarrão espaguete','Mercearia','pacote'],['Macarrão parafuso','Mercearia','pacote'],['Farinha de trigo','Mercearia','kg'],['Farinha de mandioca','Mercearia','kg'],['Açúcar refinado','Mercearia','kg'],['Açúcar mascavo','Mercearia','kg'],['Sal','Mercearia','kg'],['Óleo de soja','Mercearia','un.'],['Azeite','Mercearia','un.'],['Vinagre','Mercearia','un.'],['Molho de tomate','Mercearia','un.'],['Extrato de tomate','Mercearia','un.'],['Milho em conserva','Mercearia','un.'],['Ervilha em conserva','Mercearia','un.'],['Atum em lata','Mercearia','un.'],['Sardinha em lata','Mercearia','un.'],['Café','Mercearia','pacote'],['Achocolatado','Mercearia','un.'],['Aveia','Mercearia','pacote'],['Granola','Mercearia','pacote'],['Biscoito doce','Mercearia','pacote'],['Biscoito salgado','Mercearia','pacote'],['Pão de forma','Padaria','pacote'],['Pão francês','Padaria','un.'],['Torrada','Padaria','pacote'],['Farofa pronta','Mercearia','pacote'],['Tempero pronto','Mercearia','un.'],
['Leite integral','Laticínios','L'],['Leite sem lactose','Laticínios','L'],['Leite em pó','Laticínios','lata'],['Queijo muçarela','Laticínios','kg'],['Queijo parmesão','Laticínios','un.'],['Presunto','Carnes e frios','kg'],['Peito de peru','Carnes e frios','kg'],['Manteiga','Laticínios','un.'],['Margarina','Laticínios','un.'],['Requeijão','Laticínios','un.'],['Iogurte','Laticínios','un.'],['Creme de leite','Laticínios','un.'],['Leite condensado','Laticínios','un.'],['Ovos','Laticínios','dúzia'],
['Frango','Carnes e frios','kg'],['Peito de frango','Carnes e frios','kg'],['Carne moída','Carnes e frios','kg'],['Carne bovina','Carnes e frios','kg'],['Bife','Carnes e frios','kg'],['Linguiça','Carnes e frios','kg'],['Salsicha','Carnes e frios','kg'],['Bacon','Carnes e frios','kg'],['Peixe','Carnes e frios','kg'],['Hambúrguer congelado','Carnes e frios','pacote'],
['Batata','Hortifruti','kg'],['Tomate','Hortifruti','kg'],['Cebola','Hortifruti','kg'],['Alho','Hortifruti','kg'],['Cenoura','Hortifruti','kg'],['Alface','Hortifruti','un.'],['Couve','Hortifruti','maço'],['Brócolis','Hortifruti','un.'],['Abobrinha','Hortifruti','kg'],['Pimentão','Hortifruti','kg'],['Banana','Hortifruti','kg'],['Maçã','Hortifruti','kg'],['Laranja','Hortifruti','kg'],['Limão','Hortifruti','kg'],['Mamão','Hortifruti','un.'],['Melancia','Hortifruti','un.'],['Uva','Hortifruti','bandeja'],['Morango','Hortifruti','bandeja'],
['Água mineral','Bebidas','un.'],['Água com gás','Bebidas','un.'],['Refrigerante','Bebidas','un.'],['Suco','Bebidas','L'],['Chá','Bebidas','caixa'],['Energético','Bebidas','un.'],
['Detergente','Limpeza','un.'],['Esponja de louça','Limpeza','un.'],['Sabão em pó','Limpeza','un.'],['Amaciante','Limpeza','un.'],['Água sanitária','Limpeza','L'],['Desinfetante','Limpeza','L'],['Limpador multiuso','Limpeza','un.'],['Saco de lixo','Limpeza','pacote'],['Papel toalha','Limpeza','pacote'],['Papel higiênico','Higiene','pacote'],['Sabonete','Higiene','un.'],['Shampoo','Higiene','un.'],['Condicionador','Higiene','un.'],['Creme dental','Higiene','un.'],['Escova de dentes','Higiene','un.'],['Desodorante','Higiene','un.'],['Fio dental','Higiene','un.'],['Absorvente','Higiene','pacote'],['Fralda','Higiene','pacote'],['Lenço umedecido','Higiene','pacote'],['Ração para cachorro','Pets','pacote'],['Ração para gato','Pets','pacote'],['Pilhas','Casa','pacote'],['Lâmpada','Casa','un.']
];
function seedCatalog(){let changed=false;const known=new Set(state.products.map(p=>p.key||String(p.name||'').trim().toLocaleLowerCase('pt-BR')));for(const [name,category,unit] of CATALOG){const key=name.trim().toLocaleLowerCase('pt-BR');if(known.has(key))continue;state.products.push({id:uid(),key,name,unit,price:0,category,aisle:'',favorite:false,uses:0,builtin:true});known.add(key);changed=true;}if(changed)localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.shakawToastTimer);window.shakawToastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
function persistProduct(item){const key=item.name.trim().toLocaleLowerCase('pt-BR');let p=state.products.find(x=>x.key===key);if(!p){p={id:uid(),key,name:item.name,unit:item.unit,price:item.price,category:item.category,aisle:item.aisle||'',favorite:false,uses:0};state.products.push(p)}p.price=Number(item.price)||p.price||0;p.category=item.category||p.category;p.aisle=item.aisle||p.aisle;p.uses=(p.uses||0)+1;}
function totals(){const estimated=state.items.reduce((s,i)=>s+(Number(i.price)||0)*(Number(i.qty)||0),0);const actual=state.items.filter(i=>i.checked).reduce((s,i)=>s+(Number(i.actualPrice ?? i.price)||0)*(Number(i.qty)||0),0);return {estimated,actual}}
function render(){renderSummary();renderItems();renderProducts();renderHistory();renderCategoryFilter();$('budget').value=state.budget||'';updateConnection();}
function renderSummary(){const t=totals();$('estimated').textContent=money(t.estimated);$('actual').textContent=money(t.actual);const done=state.items.filter(i=>i.checked).length;$('itemsProgress').textContent=`${done} de ${state.items.length} itens concluídos`;$('listMeta').textContent=state.items.length?`${state.items.length} item(ns) • ${done} concluído(s)`:'Sua lista começa aqui.';const b=Number(state.budget)||0;const remaining=b-t.actual;$('remaining').textContent=b?`${remaining>=0?'Restam':'Excedido'} ${money(Math.abs(remaining))}`:'Defina um orçamento';const bar=$('budgetBar');bar.style.width=b?`${Math.min(100,t.actual/b*100)}%`:'0%';bar.classList.toggle('over',b>0&&t.actual>b);}
function renderCategoryFilter(){const select=$('filterCategory'),old=select.value;const categories=[...new Set(state.items.map(i=>i.category).filter(Boolean))].sort();select.innerHTML='<option value="">Todas as categorias</option>'+categories.map(c=>`<option>${esc(c)}</option>`).join('');select.value=categories.includes(old)?old:'';}
function renderItems(){const filter=$('filterCategory').value;const items=state.items.filter(i=>!filter||i.category===filter);if(!items.length){$('items').innerHTML='<div class="empty">'+(state.items.length?'Nenhum produto nesta categoria.':'Sua lista está vazia. Adicione o primeiro produto acima.')+'</div>';return}const groups=new Map();items.forEach(i=>{const k=i.category||'Outros';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i)});$('items').innerHTML=[...groups].map(([cat,arr])=>`<div class="item-group"><div style="padding:10px 16px;background:#f8fafd;color:#52647d;font-size:12px;font-weight:800;border-bottom:1px solid #edf0f5">${esc(cat)}</div>${arr.map(itemHTML).join('')}</div>`).join('');}
function itemHTML(i){const total=(Number(i.qty)||0)*(Number(i.price)||0);return `<div class="item ${i.checked?'done':''}" data-id="${esc(i.id)}"><label class="item-check" title="Marcar ${esc(i.name)} como comprado"><input type="checkbox" aria-label="Marcar ${esc(i.name)} como comprado" data-action="check" ${i.checked?'checked':''}></label><div class="item-main"><div class="item-name">${esc(i.name)}</div><div class="item-meta">${fmtQty(i.qty)} ${esc(i.unit)} · ${esc(i.aisle||i.category||'Sem corredor')}${i.note?' · '+esc(i.note):''}</div></div><div class="item-price"><strong>${money(total)}</strong><div style="font-size:11px;color:#7a8498;margin-top:4px">${money(i.price)} / un.</div></div><div class="item-actions"><button class="icon-btn ${isFavorite(i.name)?'favorite':''}" data-action="favorite" title="Favoritar">${isFavorite(i.name)?'★':'☆'}</button><button class="icon-btn" data-action="edit" title="Editar preço real">✎</button><button class="icon-btn" data-action="delete" title="Remover">×</button></div></div>`}
function renderProducts(){const q=($('productSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');const cat=$('productCategory')?.value||'';const products=[...state.products].filter(p=>(!q||p.name.toLocaleLowerCase('pt-BR').includes(q))&&(!cat||p.category===cat)).sort((a,b)=>(Number(b.favorite)-Number(a.favorite))||(b.uses||0)-(a.uses||0)||a.name.localeCompare(b.name,'pt-BR'));const cats=[...new Set(state.products.map(p=>p.category||'Outros'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));const sel=$('productCategory');if(sel){const old=sel.value;sel.innerHTML='<option value="">Todas as categorias</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');sel.value=cats.includes(old)?old:'';}const count=$('catalogCount');if(count)count.textContent=`${products.length} produto(s)${q||cat?' encontrados':' no catálogo'}`;$('frequentItems').innerHTML=products.length?products.map(p=>`<article class="product-card"><div class="product-info"><div class="item-name">${esc(p.name)} ${p.favorite?'<span class="favorite-star">★</span>':''}</div><div class="item-meta">${esc(p.category||'Outros')} · ${esc(p.unit||'un.')}${p.uses?` · Usado ${p.uses} vez(es)`: ' · Pré-cadastrado'}</div><div class="product-price">${Number(p.price)>0?`Último preço: ${money(p.price)}`:'Preço não informado'}</div></div><div class="product-actions"><button class="icon-btn ${p.favorite?'favorite':''}" data-product-action="favorite" data-id="${esc(p.id)}" title="${p.favorite?'Remover favorito':'Favoritar'}" aria-label="Favoritar ${esc(p.name)}">${p.favorite?'★':'☆'}</button><button class="primary product-add" data-product-action="add" data-id="${esc(p.id)}">＋ Adicionar</button></div></article>`).join(''):'<div class="empty">Nenhum produto encontrado. Tente outra busca ou cadastre o produto pela aba Lista atual.</div>';}

function renderHistory(){$('historyItems').innerHTML=state.history.length?[...state.history].reverse().map(h=>`<article class="history-card"><h3>Compra de ${new Date(h.date).toLocaleDateString('pt-BR')}</h3><p>${new Date(h.date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · ${h.count} item(ns)</p><strong>${money(h.total)}</strong><button class="ghost" data-history-action="restore" data-id="${esc(h.id)}" style="margin-top:12px">Reutilizar esta lista</button></article>`).join(''):'<div class="empty">Nenhuma compra finalizada ainda.</div>';}
function fmtQty(q){return Number(q).toLocaleString('pt-BR',{maximumFractionDigits:2})}function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function isFavorite(name){return !!state.products.find(p=>p.key===String(name).trim().toLocaleLowerCase('pt-BR')&&p.favorite)}
function updateConnection(){const el=$('connection');if(navigator.onLine){el.textContent=cloudReady?'● Online · nuvem ativa':'● Online · aguardando nuvem';el.className='status online'}else{el.textContent='● Offline · dados locais';el.className='status pending'}if(!cloudReady)$('syncMessage').textContent='Entre na conta e aguarde a conexão com a família para ativar a sincronização.';}
$('addForm').addEventListener('submit',e=>{e.preventDefault();const name=$('name').value.trim();if(!name)return;const item={id:uid(),name,qty:Number($('qty').value)||1,unit:$('unit').value,price:Number($('price').value)||0,actualPrice:null,category:$('category').value,aisle:$('aisle').value.trim(),checked:false,createdAt:new Date().toISOString()};state.items.push(item);persistProduct(item);e.target.reset();$('qty').value=1;$('unit').value='un.';$('category').value=item.category;save();toast(`${item.name} adicionado à lista!`);$('name').focus();});
$('budget').addEventListener('change',e=>{state.budget=Math.max(0,Number(e.target.value)||0);save()});$('filterCategory').addEventListener('change',renderItems);$('clearChecked').addEventListener('click',()=>{state.items=state.items.filter(i=>!i.checked);save()});$('newList').addEventListener('click',()=>{if(!state.items.length||confirm('Começar uma nova lista? Os itens atuais serão removidos, mas o histórico ficará salvo.')){state.items=[];save()}});
$('finishList').addEventListener('click',()=>{if(!state.items.length){alert('Adicione pelo menos um produto antes de finalizar.');return}if(!confirm('Salvar esta compra no histórico e começar uma lista vazia?'))return;const t=totals();state.history.push({id:uid(),date:new Date().toISOString(),count:state.items.length,total:t.actual||t.estimated,items:state.items.map(i=>({...i}))});state.items=[];save();setView('history');});
$('items').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const row=btn.closest('[data-id]');const item=state.items.find(i=>i.id===row.dataset.id);if(!item)return;switch(btn.dataset.action){case'favorite':persistProduct(item);const p=state.products.find(x=>x.key===item.name.trim().toLocaleLowerCase('pt-BR'));p.favorite=!p.favorite;break;case'delete':state.items=state.items.filter(i=>i.id!==item.id);break;case'edit':{const val=prompt(`Preço real por ${item.unit} para ${item.name}:`,String(item.actualPrice??item.price??0));if(val!==null&&val.trim()!==''&&!Number.isNaN(Number(val))){item.actualPrice=Math.max(0,Number(val));item.checked=true}}break;}save()});
document.addEventListener('change',e=>{
  const checkbox=e.target;
  if(!(checkbox instanceof HTMLInputElement) || !checkbox.matches('#items input[type="checkbox"][data-action="check"]')) return;
  const row=checkbox.closest('.item[data-id]');
  if(!row) return;
  const item=state.items.find(i=>String(i.id)===row.dataset.id);
  if(!item) return;
  item.checked=checkbox.checked;
  if(item.checked && item.actualPrice==null) item.actualPrice=Number(item.price)||0;
  save();
  toast(item.checked ? `${item.name} marcado como concluído.` : `${item.name} desmarcado.`);
},{capture:true});
$('frequentItems').addEventListener('click',e=>{const b=e.target.closest('[data-product-action]');if(!b)return;const p=state.products.find(x=>x.id===b.dataset.id);if(!p)return;if(b.dataset.productAction==='favorite'){p.favorite=!p.favorite;save();toast(p.favorite?`${p.name} marcado como favorito.`:`${p.name} removido dos favoritos.`);}else{state.items.push({id:uid(),name:p.name,qty:1,unit:p.unit||'un.',price:Number(p.price)||0,actualPrice:null,category:p.category||'Outros',aisle:p.aisle||'',checked:false,createdAt:new Date().toISOString()});p.uses=(p.uses||0)+1;save();toast(`${p.name} adicionado à lista!`);}});$('productSearch').addEventListener('input',renderProducts);$('productCategory').addEventListener('change',renderProducts);
$('historyItems').addEventListener('click',e=>{const b=e.target.closest('[data-history-action="restore"]');if(!b)return;const h=state.history.find(x=>x.id===b.dataset.id);if(!h)return;if(state.items.length&&!confirm('Adicionar os produtos da compra anterior à lista atual?'))return;state.items.push(...h.items.map(i=>({...i,id:uid(),checked:false,actualPrice:null})));save();setView('list')});
function setView(view){activeView=view;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('listView').classList.toggle('hidden',view!=='list');$('productsView').classList.toggle('hidden',view!=='products');$('historyView').classList.toggle('hidden',view!=='history')};document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('setupInfo').addEventListener('click',()=>$('setupDialog').showModal());$('installBtn').addEventListener('click',async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').classList.add('hidden')}});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').classList.remove('hidden')});window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});seedCatalog();render();setTimeout(()=>{if(window.shakawAccount?.householdId)initCloud()},1200);
