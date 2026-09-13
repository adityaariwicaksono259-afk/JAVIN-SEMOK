const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let socket = null;
let profile = null;
let activeTab = 'inbox';

function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2200);}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const params = new URLSearchParams(location.search);
let viewUser = params.get('u');
if(!viewUser){const m=location.pathname.match(/^\/u\/([a-z0-9_]+)/i);if(m)viewUser=m[1].toLowerCase();}

function initSocket(){
  socket = io({ auth: { userId: userId, token: localStorage.getItem('javachat_token') || '' } });
  socket.on('connect', () => socket.emit('join', userId));
  socket.on('me', () => {
    if (viewUser) renderPublicSend(viewUser);
    else checkMyProfile();
  });
  socket.on('auth-fail', (msg) => {
    $('sosMain').innerHTML = '<div class="sos-content"><div class="sos-card"><div class="sos-card-title">⚠️ Gagal</div><div class="sos-card-sub">' + esc(msg) + '</div></div></div>';
  });
  socket.on('anonim-new', () => {
    const b=$('inboxBadge');
    if(b){b.textContent=(parseInt(b.textContent)||0)+1;b.classList.remove('hidden');}
    if(activeTab==='inbox')renderInbox();
    else toast('📩 Pesan anonim baru!');
  });
}

function checkMyProfile(){
  socket.emit('anonim-profile-get',(res)=>{
    if(res.ok && res.profile){profile=res.profile;renderMain();}
    else renderCreateForm();
  });
}

function renderCreateForm(){
  $('sosMain').innerHTML='<div class="sos-content"><div class="sos-card">'+
    '<div class="sos-card-title">🎭 Bikin Username</div>'+
    '<div class="sos-card-sub">Username ini jadi link anonim lo. Sekali bikin, gak bisa ganti.</div>'+
    '<label class="sos-label">USERNAME</label>'+
    '<input id="anonUsername" class="sos-select" type="text" placeholder="contoh: javin" maxlength="20" autocomplete="off" />'+
    '<button id="anonCreate" class="sos-btn">✨ BUAT</button>'+
    '<div id="anonErr" class="err"></div>'+
  '</div></div>';
  const inp=$('anonUsername');
  inp.addEventListener('input',()=>{inp.value=inp.value.toLowerCase().replace(/[^a-z0-9_]/g,'');});
  $('anonCreate').onclick=()=>{
    const u=inp.value.trim();
    if(u.length<3)return $('anonErr').textContent='Minimal 3 karakter';
    $('anonErr').textContent='';$('anonCreate').disabled=true;
    socket.emit('anonim-create',{username:u},(r)=>{
      $('anonCreate').disabled=false;
      if(r.error)return $('anonErr').textContent=r.error;
      profile=r.profile;toast('✅ Username dibuat!');renderMain();
    });
  };
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')$('anonCreate').click();});
}

function renderMain(){
  $('sosMain').innerHTML='<div class="sos-tabs">'+
    '<button class="sos-tab active" data-tab="inbox">📥 Inbox <span class="sos-badge hidden" id="inboxBadge">0</span></button>'+
    '<button class="sos-tab" data-tab="link">🔗 Share</button>'+
    '<button class="sos-tab" data-tab="setting">⚙️ Setting</button>'+
  '</div><div class="sos-content" id="sosContent"></div>';
  document.querySelectorAll('.sos-tab').forEach(t=>{
    t.onclick=()=>{
      document.querySelectorAll('.sos-tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');activeTab=t.dataset.tab;
      if(activeTab==='inbox')renderInbox();
      else if(activeTab==='link')renderLink();
      else renderSetting();
    };
  });
  renderInbox();
}

function renderInbox(){
  const box=$('sosContent');box.innerHTML='<div class="sos-loading">Memuat...</div>';
  socket.emit('anonim-inbox',(res)=>{
    if(!res.ok){box.innerHTML='<div class="sos-loading">⚠️ '+esc(res.error)+'</div>';return;}
    const msgs=res.messages||[];
    if(!msgs.length){box.innerHTML='<div class="sos-empty">📭 Belum ada pesan.<br><br>Share link di tab 🔗 Share.</div>';return;}
    let h='';
    msgs.forEach(m=>{
      const dt=new Date(m.time);
      const time=dt.toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      h+='<div class="anon-card'+(m.read?'':' unread')+(m.reported?' reported':'')+'">'+
        '<div class="anon-head"><span class="anon-anon">🕶️ Anonim</span><span class="anon-time">'+time+'</span></div>'+
        '<div class="anon-text">'+esc(m.text)+'</div>'+
        '<div class="anon-actions">'+
          (m.reported?'<span class="anon-flag">⚠️ Dilaporkan</span>':'')+
          '<button class="anon-btn anon-share" data-act="share" data-id="'+m.id+'">📤 Share</button>'+
          '<button class="anon-btn anon-report" data-act="report" data-id="'+m.id+'">🚨</button>'+
          '<button class="anon-btn anon-del" data-act="delete" data-id="'+m.id+'">🗑️</button>'+
        '</div></div>';
    });
    box.innerHTML=h;
    box.querySelectorAll('button[data-act]').forEach(b=>{
      b.onclick=()=>{
        const id=b.dataset.id;
        if(b.dataset.act==='delete'){
          if(!confirm('Hapus?'))return;
          socket.emit('anonim-delete',{msgId:id},()=>{toast('Dihapus');renderInbox();});
        }else if(b.dataset.act==='report'){
          if(!confirm('Lapor?'))return;
          socket.emit('anonim-report',{msgId:id},()=>{toast('Dilaporkan');renderInbox();});
        }else if(b.dataset.act==='share'){
          shareMessage(id);
        }
      };
    });
    msgs.forEach(m=>{if(!m.read)socket.emit('anonim-mark-read',{msgId:m.id});});
  });
}

function shareMessage(msgId){
  const link=location.origin+'/m/'+msgId;
  const text='Cek ini! '+link;
  if(navigator.share){
    navigator.share({title:'Pesan anonim',text:'Cek pesan anonim ini!',url:link}).catch(()=>{});
  }else{
    const waUrl='https://wa.me/?text='+encodeURIComponent(text);
    window.location.href=waUrl;
  }
}

function renderLink(){
  const link=location.origin+'/u/'+profile.username;
  const customTitle=profile.customTitle||'kirimi aku pesan anonim!';
  const shareText=customTitle+' → '+link;
  const wa='https://wa.me/?text='+encodeURIComponent(shareText);
  const tg='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(customTitle);
  const tw='https://twitter.com/intent/tweet?text='+encodeURIComponent(shareText);
  const isOn=profile.isActive!==false;
  $('sosContent').innerHTML=
    '<div class="sos-card">'+
      '<div class="sos-status '+(isOn?'on':'off')+'">'+(isOn?'🟢 ANONIM AKTIF':'🔴 ANONIM MATI')+'</div>'+
      '<div class="sos-card-sub">'+(isOn?'Orang bisa kirim pesan ke lo.':'Orang gak bisa kirim pesan.')+'</div>'+
      '<label class="sos-label">LINK ANONIM LO</label>'+
      '<div class="sos-link-box"><input id="myLink" class="sos-link-input" type="text" readonly value="'+esc(link)+'" /><button id="copyLink" class="sos-copy-btn">📋</button></div>'+
      '<div class="sos-share-title">SHARE:</div>'+
      '<div class="sos-share-grid">'+
        '<a href="'+wa+'" class="sos-share wa"><span>💬</span><span>WhatsApp</span></a>'+
        '<a href="'+tg+'" class="sos-share tg"><span>✈️</span><span>Telegram</span></a>'+
        '<a href="'+tw+'" class="sos-share tw"><span>🐦</span><span>Twitter</span></a>'+
        '<button id="shareNative" class="sos-share native"><span>📤</span><span>Lainnya</span></button>'+
      '</div>'+
    '</div>';
  $('copyLink').onclick=()=>{
    const inp=$('myLink');
    if(navigator.clipboard){navigator.clipboard.writeText(link).then(()=>toast('✅ Copied')).catch(()=>{inp.select();document.execCommand('copy');toast('✅ Copied');});}
    else{inp.select();document.execCommand('copy');toast('✅ Copied');}
  };
  $('shareNative').onclick=()=>{
    if(navigator.share)navigator.share({title:customTitle,text:'Kirim anonim ke gue!',url:link}).catch(()=>{});
    else $('copyLink').click();
  };
}

function renderSetting(){
  const isOn=profile.isActive!==false;
  const title=profile.customTitle||'kirimi aku pesan anonim!';
  $('sosContent').innerHTML=
    '<div class="sos-card">'+
      '<div class="sos-card-title">⚙️ Setting Anonim</div>'+
      '<div class="sos-card-sub">Atur pesan yang muncul di preview link + on/off kan anonim lo.</div>'+
      '<label class="sos-label">PESAN CUSTOM (muncul di preview)</label>'+
      '<input id="customTitle" class="sos-select" type="text" value="'+esc(title)+'" maxlength="80" />'+
      '<div class="sos-hint">Contoh: "isi dong, gua gabut nih"</div>'+
      '<div class="sos-toggle-row">'+
        '<div><div class="sos-toggle-label">ANONIM AKTIF</div><div class="sos-toggle-sub">'+(isOn?'Orang bisa kirim':'Orang gak bisa kirim')+'</div></div>'+
        '<label class="sos-switch"><input id="activeToggle" type="checkbox" '+(isOn?'checked':'')+' /><span class="sos-slider"></span></label>'+
      '</div>'+
      '<button id="saveSettings" class="sos-btn">💾 SIMPAN</button>'+
    '</div>';
  $('saveSettings').onclick=()=>{
    const ct=$('customTitle').value.trim();
    const active=$('activeToggle').checked;
    socket.emit('anonim-settings',{customTitle:ct,isActive:active},(r)=>{
      if(r.error)return toast('❌ '+r.error);
      profile=r.profile;
      toast('✅ Settings disimpan');
      renderLink();
      document.querySelectorAll('.sos-tab').forEach(t=>t.classList.remove('active'));
      document.querySelector('.sos-tab[data-tab="link"]').classList.add('active');
      activeTab='link';
      renderLink();
    });
  };
}

function renderPublicSend(username){
  socket.emit('anonim-profile-get',()=>{});
  $('sosMain').innerHTML='<div class="sos-content"><div class="sos-card"><div class="sos-loading">Memuat...</div></div></div>';
  socket.emit('anonim-public-info',{username},(res)=>{
    if(!res.ok){
      $('sosMain').innerHTML='<div class="sos-content"><div class="sos-card"><div class="sos-card-title">⚠️ Link Gak Valid</div><div class="sos-card-sub">User @'+esc(username)+' gak ada atau lagi matiin anonim.</div><a href="/sosial.html" class="sos-btn" style="display:block;text-align:center;text-decoration:none;margin-top:14px">BUAT ANONIM SENDIRI</a></div></div>';
      return;
    }
    const title=res.customTitle||'kirimi aku pesan anonim!';
    $('sosMain').innerHTML='<div class="sos-content"><div class="sos-card">'+
      '<div class="sos-public-title">'+esc(title)+'</div>'+
      '<div class="sos-card-sub">Kirim pesan rahasia ke <b>@'+esc(username)+'</b>. Dia gak akan tau siapa lo.</div>'+
      '<textarea id="anonText" class="sos-textarea" placeholder="Tulis pesan lo di sini... (rahasia 😉)" maxlength="500" rows="6"></textarea>'+
      '<div class="sos-count"><span id="anonCount">0</span>/500</div>'+
      '<button id="anonSend" class="sos-btn">🚀 KIRIM ANONIM</button>'+
      '<div class="sos-warn">⚠️ Max 30 pesan/hari.</div>'+
      '<div id="anonSent" class="sos-sent hidden"><div style="font-size:64px">✅</div><div style="font-size:18px;font-weight:800;color:#25d366;margin-top:8px">Terkirim!</div><div style="font-size:12px;color:#667781;margin-top:4px">Mau kirim lagi?</div><button id="sendAgain" class="sos-btn" style="margin-top:16px">🔁 KIRIM LAGI</button></div>'+
    '</div></div>';
    const ta=$('anonText');
    ta.addEventListener('input',()=>{$('anonCount').textContent=ta.value.length;});
    $('anonSend').onclick=()=>{
      const text=ta.value.trim();
      if(!text)return toast('Pesan kosong');
      $('anonSend').disabled=true;
      socket.emit('anonim-send-to',{username,text},(r)=>{
        $('anonSend').disabled=false;
        if(r.error)return toast('❌ '+r.error);
        $('anonSend').classList.add('hidden');
        ta.classList.add('hidden');
        $('anonCount').classList.add('hidden');
        $('anonSent').classList.remove('hidden');
        $('sendAgain').onclick=()=>renderPublicSend(username);
      });
    };
    ta.focus();
  });
}

initSocket();
setTimeout(()=>{
  const m=document.getElementById('sosMain');
  if(m && m.innerHTML.trim()===''){
    if(viewUser)renderPublicSend(viewUser);
    else if(socket&&socket.connected)checkMyProfile();
    else renderCreateForm();
  }
}, 3000);
