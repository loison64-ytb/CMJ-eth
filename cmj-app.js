const cmjDb = supabase.createClient(window.CMJ_SUPABASE_URL, window.CMJ_SUPABASE_KEY);

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function frDate(v){return new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short'}).format(new Date(v));}
function setMsg(el,msg,type='ok'){if(!el)return;el.textContent=msg;el.className='form-message '+type;}

async function initApplications(){
 const form=document.querySelector('#cmj-application'); if(!form)return;
 const msg=document.querySelector('#application-message');
 form.addEventListener('submit',async e=>{e.preventDefault(); const fd=new FormData(form);
  const payload={first_name:fd.get('prenom'),last_name:fd.get('nom'),birthdate:fd.get('naissance'),school:fd.get('ecole')||null,address:fd.get('adresse'),guardian_email:fd.get('email'),guardian_phone:fd.get('telephone'),motivation:fd.get('motivation'),consent:true,status:'new'};
  const {error}=await cmjDb.from('cmj_applications').insert(payload);
  if(error){setMsg(msg,"Impossible d'envoyer la candidature. Réessaie dans quelques instants.",'error');return;}
  form.reset(); setMsg(msg,'Candidature envoyée avec succès. Le CMJ pourra te recontacter.');
 });
}

async function initEvents(){
 const root=document.querySelector('#events-list'); if(!root)return;
 root.innerHTML='<p>Chargement des événements…</p>';
 const {data,error}=await cmjDb.rpc('list_public_events');
 if(error){root.innerHTML='<div class="notice">Impossible de charger les événements pour le moment.</div>';return;}
 if(!data?.length){root.innerHTML='<div class="notice">Aucun événement ouvert aux inscriptions pour le moment.</div>';return;}
 root.innerHTML=data.map(ev=>{
  const full=ev.capacity!==null&&Number(ev.remaining_places)<=0;
  const deadline=ev.registration_deadline&&new Date(ev.registration_deadline)<new Date();
  const closed=full||deadline;
  const places=ev.capacity===null?'Places non limitées':`${ev.remaining_places} place(s) restante(s) sur ${ev.capacity}`;
  return `<article class="event-card" data-event="${ev.id}"><div class="event-visual">📅</div><div class="event-content"><span class="event-date">${esc(frDate(ev.event_date))}</span><h2>${esc(ev.title)}</h2><p>${esc(ev.description)}</p><div class="event-meta"><span>📍 ${esc(ev.location||'Lieu à préciser')}</span><span>👥 ${esc(places)}</span></div><button class="btn primary event-register-toggle" ${closed?'disabled':''}>${closed?'Inscriptions fermées':"S'inscrire"}</button><form class="form-grid event-register-form" hidden><div class="two-col"><label>Prénom du participant<input required name="first"></label><label>Nom du participant<input required name="last"></label></div><label>Date de naissance<input type="date" name="birth"></label><label>Nom du responsable légal<input name="guardian"></label><div class="two-col"><label>E-mail du responsable<input required type="email" name="email"></label><label>Téléphone<input type="tel" name="phone"></label></div><label>Informations utiles<textarea name="notes" placeholder="Allergies, besoins particuliers…"></textarea></label><label class="consent"><input required type="checkbox"> J'autorise l'utilisation de ces informations uniquement pour gérer cette inscription.</label><button class="btn primary" type="submit">Confirmer l'inscription</button><p class="form-message"></p></form></div></article>`;
 }).join('');
 root.querySelectorAll('.event-register-toggle').forEach(b=>b.addEventListener('click',()=>{const f=b.closest('.event-content').querySelector('.event-register-form');f.hidden=!f.hidden;}));
 root.querySelectorAll('.event-register-form').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();const card=f.closest('.event-card');const fd=new FormData(f);const msg=f.querySelector('.form-message');
  const {error}=await cmjDb.from('event_registrations').insert({event_id:card.dataset.event,participant_first_name:fd.get('first'),participant_last_name:fd.get('last'),participant_birthdate:fd.get('birth')||null,guardian_name:fd.get('guardian')||null,guardian_email:fd.get('email'),guardian_phone:fd.get('phone')||null,notes:fd.get('notes')||null,consent:true});
  if(error){setMsg(msg,error.message.includes('EVENT_FULL')?'Désolé, cet événement est maintenant complet.':"Impossible d'enregistrer l'inscription.",'error');return;}
  f.reset();setMsg(msg,'Inscription enregistrée avec succès.');
 }));
}

async function isAdmin(){const {data:{session}}=await cmjDb.auth.getSession();if(!session)return false;const {data,error}=await cmjDb.rpc('is_cmj_admin');return !error&&data===true;}
async function initAdmin(){
 const login=document.querySelector('#admin-login'); if(!login)return;
 const dashboard=document.querySelector('#admin-dashboard'); const loginMsg=document.querySelector('#admin-login-message');
 async function refreshAuth(){const ok=await isAdmin();login.hidden=ok;dashboard.hidden=!ok;if(ok){await loadAdmin();}}
 document.querySelector('#admin-signin').addEventListener('click',async()=>{const email=document.querySelector('#admin-email').value.trim();const password=document.querySelector('#admin-password').value;const {error}=await cmjDb.auth.signInWithPassword({email,password});if(error){setMsg(loginMsg,'Connexion impossible : vérifie tes identifiants.','error');return;}await refreshAuth();});
 document.querySelector('#admin-signup').addEventListener('click',async()=>{const email=document.querySelector('#admin-email').value.trim();const password=document.querySelector('#admin-password').value;if(password.length<8){setMsg(loginMsg,'Le mot de passe doit contenir au moins 8 caractères.','error');return;}const {error}=await cmjDb.auth.signUp({email,password});if(error){setMsg(loginMsg,error.message,'error');return;}setMsg(loginMsg,"Compte créé. Si Supabase t'envoie un e-mail de confirmation, clique sur le lien puis reconnecte-toi.");});
 document.querySelector('#admin-logout').addEventListener('click',async()=>{await cmjDb.auth.signOut();location.reload();});
 document.querySelector('#event-create-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const {error}=await cmjDb.from('events').insert({title:fd.get('title'),description:fd.get('description'),event_date:new Date(fd.get('date')).toISOString(),location:fd.get('location'),capacity:fd.get('capacity')?Number(fd.get('capacity')):null,registration_deadline:fd.get('deadline')?new Date(fd.get('deadline')).toISOString():null,status:fd.get('status')});const msg=document.querySelector('#event-create-message');if(error){setMsg(msg,error.message,'error');return;}e.currentTarget.reset();setMsg(msg,'Événement enregistré.');await loadAdmin();});
 await refreshAuth();
}
async function loadAdmin(){
 const eventsBox=document.querySelector('#admin-events'); const appsBox=document.querySelector('#admin-applications'); const regsBox=document.querySelector('#admin-registrations');
 const [evRes,appRes,regRes]=await Promise.all([cmjDb.from('events').select('*').order('event_date'),cmjDb.from('cmj_applications').select('*').order('created_at',{ascending:false}),cmjDb.from('event_registrations').select('*,events(title)').order('created_at',{ascending:false})]);
 eventsBox.innerHTML=(evRes.data||[]).map(e=>`<div class="admin-row"><div><strong>${esc(e.title)}</strong><small>${esc(frDate(e.event_date))} • ${esc(e.status)}</small></div><button class="small-btn" data-close-event="${e.id}">${e.status==='closed'?'Fermé':'Fermer'}</button></div>`).join('')||'<p>Aucun événement.</p>';
 appsBox.innerHTML=(appRes.data||[]).map(a=>`<div class="admin-row"><div><strong>${esc(a.first_name)} ${esc(a.last_name)}</strong><small>${esc(a.guardian_email)} • ${esc(a.guardian_phone)} • ${esc(a.status)}</small><p>${esc(a.motivation)}</p></div></div>`).join('')||'<p>Aucune candidature.</p>';
 regsBox.innerHTML=(regRes.data||[]).map(r=>`<div class="admin-row"><div><strong>${esc(r.participant_first_name)} ${esc(r.participant_last_name)}</strong><small>${esc(r.events?.title||'Événement')} • ${esc(r.guardian_email)} • ${esc(r.guardian_phone||'')}</small></div></div>`).join('')||'<p>Aucune inscription.</p>';
 eventsBox.querySelectorAll('[data-close-event]').forEach(b=>b.addEventListener('click',async()=>{await cmjDb.from('events').update({status:'closed',updated_at:new Date().toISOString()}).eq('id',b.dataset.closeEvent);await loadAdmin();}));
}

document.addEventListener('DOMContentLoaded',()=>{initApplications();initEvents();initAdmin();});