// PARTÍCULAS LOGIN
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({length: 60}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 1.8 + 0.5,
    alpha: Math.random() * 0.5 + 0.1
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,200,255,${p.alpha})`;
      ctx.fill();
    });
    // Líneas entre partículas cercanas
    particles.forEach((p, i) => {
      particles.slice(i+1).forEach(q => {
        const d = Math.hypot(p.x-q.x, p.y-q.y);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(0,200,255,${0.08 * (1 - d/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });
    requestAnimationFrame(draw);
  }
  draw();
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}
initParticles();

// SPLASH BIENVENIDA
function mostrarWelcome(nombre) {
  const hoy = new Date().toDateString();
  const guardado = localStorage.getItem('welcomeDate_' + nombre);
  if (guardado === hoy) return;

  const hora = new Date().getHours();
  let saludo, emoji;
  if (hora >= 6 && hora < 12) { saludo = 'Buenos días'; emoji = '☀️'; }
  else if (hora >= 12 && hora < 20) { saludo = 'Buenas tardes'; emoji = '🌤️'; }
  else { saludo = 'Buenas noches'; emoji = '🌙'; }

  document.getElementById('welcome-saludo').textContent = emoji + ' ' + saludo + '!';
  document.getElementById('welcome-nombre').textContent = nombre.split(' ')[0];
  const splash = document.getElementById('welcome-splash');
  splash.style.display = 'flex';
  localStorage.setItem('welcomeDate_' + nombre, hoy);
}

window.cerrarWelcome = function() {
  const splash = document.getElementById('welcome-splash');
  if (splash) splash.style.display = 'none';
};

// MOSTRAR BANNER SI HAY ACTUALIZACIÓN
if (window.hayActualizacion) {
  document.getElementById('update-banner').style.display = 'flex';
}

window.mostrarNovedades = function() {
  document.getElementById('novedades-splash').style.display = 'flex';
};

window.cerrarNovedades = function() {
  document.getElementById('novedades-splash').style.display = 'none';
  document.getElementById('update-banner').style.display = 'none';
  localStorage.setItem('oillog_version', VERSION_ACTUAL);
  location.reload();
};

// TURNO
window.turnoActual = 'Mañana';
window.setTurno = function(t, btn) {
  window.turnoActual = t;
  document.querySelectorAll('.turno-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const esMañana = t === 'Mañana';
  const esNoche = t === 'Noche';
  // Colchon solo en turno mañana
  document.getElementById('colchon-23t').style.display = esMañana ? 'block' : 'none';
  document.getElementById('colchon-ec19').style.display = esMañana ? 'block' : 'none';
  // Mostrar/ocultar secciones de noche
  const container = document.querySelector('.container');
  if(esNoche) {
    container.classList.add('turno-noche');
  } else {
    container.classList.remove('turno-noche');
  }
};

// Colchon automático EC19
window.calcColchonEC19 = function() {
  const total = parseFloat(document.getElementById('ec19-nivel-total').value);
  const agua = parseFloat(document.getElementById('ec19-interfaz').value);
  const div = document.getElementById('ec19-colchon-calc');
  if(!isNaN(total) && !isNaN(agua)) {
    const c = ((total - agua) * 100).toFixed(1);
    div.textContent = c + ' cm';
    div.style.color = parseFloat(c) > 0 ? 'var(--green)' : 'var(--red)';
  } else {
    div.textContent = '— cm';
    div.style.color = 'var(--accent)';
  }
};

// Colchon automático 23T
window.calcColchon23T = function() {
  const total = parseFloat(document.getElementById('23t-nivel-total').value);
  const seteo = parseFloat(document.getElementById('23t-nivel-seteo').value);
  const div = document.getElementById('23t-colchon-calc');
  if(!isNaN(total) && !isNaN(seteo)) {
    const c = ((total - seteo) * 100).toFixed(1);
    div.textContent = c + ' cm';
    div.style.color = parseFloat(c) > 0 ? 'var(--green)' : 'var(--red)';
  } else {
    div.textContent = '— cm';
    div.style.color = 'var(--accent)';
  }
};

// VUELTA
window.vueltaActual = 1;
window.setVuelta = function(n, btn) {
  window.vueltaActual = n;
  document.querySelectorAll('.vuelta-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

// ESTADO
window.toggleEstado = function(btn, tipo) {
  const group = btn.closest('.estado-group');
  const isActive = btn.classList.contains(tipo);
  group.querySelectorAll('.estado-btn').forEach(b => b.classList.remove('es','er','fs'));
  if(!isActive) btn.classList.add(tipo);
};

// PILETA
window.togglePileta = function(btn, tipo) {
  const btns = btn.closest('.pileta-btns');
  const isActive = btn.classList.contains(tipo);
  btns.querySelectorAll('.pileta-btn').forEach(b => b.classList.remove('llena','vacia'));
  if(!isActive) btn.classList.add(tipo);
};

// MICROMOTION
window.micromotiondEstado = '';
window.setMicromotion = function(tipo) {
  window.micromotiondEstado = tipo;
  document.getElementById('mm-bombeando').className = 'mm-btn' + (tipo==='bombeando'?' bombeando':'');
  document.getElementById('mm-recirculando').className = 'mm-btn' + (tipo==='recirculando'?' recirculando':'');
  document.getElementById('mm-fields-bombeando').className = 'mm-fields' + (tipo==='bombeando'?' show':'');
};

// ACORDEON HISTORIAL
window.toggleAcordeon = function(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('.reg-arrow');
  const isOpen = body.classList.contains('show');
  body.classList.toggle('show', !isOpen);
  arrow.classList.toggle('open', !isOpen);
};

// MODAL HISTORIAL
window.cerrarModal = function() { document.getElementById('modal').classList.remove('show'); };
document.getElementById('modal').addEventListener('click', function(e) { if(e.target===this) window.cerrarModal(); });

// CAMBIO CONTRASEÑA — UI
window.togglePass = function(id, btn) {
  const input = document.getElementById(id);
  if(input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁️'; }
};
window.abrirCambioPass = function() {
  document.getElementById('modal-pass').classList.add('show');
  ['pass-actual','pass-nueva','pass-repetir'].forEach(id => document.getElementById(id).value='');
  document.getElementById('pass-error').style.display='none';
};
window.cerrarCambioPass = function() { document.getElementById('modal-pass').classList.remove('show'); };

// SYNC STATUS Y TOAST
function setSyncStatus(type, text) {
  const el = document.getElementById('sync-status');
  if(el) { el.className='sync-status '+type; el.textContent=text; }
}
function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(isError?' error':'');
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2800);
}

export { showToast, setSyncStatus, mostrarWelcome };
