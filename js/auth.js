import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js?v=20260604';
import { showToast, mostrarWelcome } from './ui.js?v=20260604';
import { cargarUltimoNivel, cargarUltimoRegistro } from './plantas.js?v=20260604';
import { cargarNovedadesSupervisor } from './supervisor.js?v=20260604';

async function iniciarConUsuario(user) {
  let nombre, rol;

  try {
    const docSnap = await getDoc(doc(db, 'usuarios', user.uid));
    if (docSnap.exists()) {
      nombre = docSnap.data().nombre;
      rol    = docSnap.data().rol;
    }
  } catch(e) {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('supervisor-screen').style.display = 'none';
    const err = document.getElementById('login-error');
    err.textContent = 'Sin conexión. Reintentando cuando vuelva la red...';
    err.style.display = 'block';
    window.addEventListener('online', () => iniciarConUsuario(user), { once: true });
    return;
  }

  if (!nombre) {
    await signOut(auth);
    const err = document.getElementById('login-error');
    err.textContent = 'Usuario no habilitado. Contactá al administrador.';
    err.style.display = 'block';
    return;
  }

  document.getElementById('login-error').style.display = 'none';

  if (rol === 'supervisor') {
    document.getElementById('sup-user').textContent = '👤 ' + nombre;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('supervisor-screen').style.display = 'block';
    cargarNovedadesSupervisor();
    return;
  }

  document.getElementById('header-user').textContent = '👤 ' + nombre;
  document.getElementById('meta-recorredor').value = nombre;
  mostrarWelcome(nombre);
  const now2 = new Date();
  const dd = String(now2.getDate()).padStart(2,'0');
  const mm = String(now2.getMonth()+1).padStart(2,'0');
  const yyyy = now2.getFullYear();
  document.getElementById('meta-fecha').value = `${dd}/${mm}/${yyyy}`;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('supervisor-screen').style.display = 'none';
  const horaActual = new Date().getHours();
  let turnoAuto, btnIndex;
  if(horaActual >= 6 && horaActual < 14)       { turnoAuto = 'Mañana'; btnIndex = 0; }
  else if(horaActual >= 14 && horaActual < 22) { turnoAuto = 'Tarde';  btnIndex = 1; }
  else                                          { turnoAuto = 'Noche';  btnIndex = 2; }
  const turnoBtns = document.querySelectorAll('.turno-btn');
  turnoBtns.forEach(b => b.classList.remove('active'));
  turnoBtns[btnIndex].classList.add('active');
  window.turnoActual = turnoAuto;
  const esNocheAuto = turnoAuto === 'Noche';
  const esMañanaAuto = turnoAuto === 'Mañana';
  document.querySelector('.container').classList.toggle('turno-noche', esNocheAuto);
  document.getElementById('colchon-23t').style.display = esMañanaAuto ? 'block' : 'none';
  document.getElementById('colchon-ec19').style.display = esMañanaAuto ? 'block' : 'none';
  ['23T','PPA','17T','ED1'].forEach(p => cargarUltimoNivel(p));
  cargarUltimoRegistro();
}

onAuthStateChanged(auth, async user => {
  document.getElementById('loading').classList.add('hidden');
  if (user) {
    await iniciarConUsuario(user);
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('supervisor-screen').style.display = 'none';
    const btn = document.getElementById('login-btn');
    if(btn) { btn.disabled = false; btn.textContent = 'ENTRAR'; }
  }
});

window.doLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'INGRESANDO...';
  try { await signInWithEmailAndPassword(auth, email, pass); }
  catch(e) { err.textContent = 'Correo o contraseña incorrectos.'; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'ENTRAR'; }
};
document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') window.doLogin(); });

window.doLogout = async function() {
  if(confirm('¿Estás seguro que querés cerrar sesión?')) {
    await signOut(auth);
    const btn = document.getElementById('login-btn');
    if(btn) { btn.disabled = false; btn.textContent = 'ENTRAR'; }
    document.getElementById('login-email').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-error').style.display = 'none';
  }
};

window.cambiarPassword = async function() {
  const actual = document.getElementById('pass-actual').value;
  const nueva = document.getElementById('pass-nueva').value;
  const repetir = document.getElementById('pass-repetir').value;
  const err = document.getElementById('pass-error');
  const btn = document.getElementById('btn-cambiar-pass');
  err.style.display='none';
  if(nueva!==repetir) { err.textContent='Las contraseñas nuevas no coinciden.'; err.style.display='block'; return; }
  if(nueva.length<6) { err.textContent='La contraseña debe tener al menos 6 caracteres.'; err.style.display='block'; return; }
  btn.disabled=true; btn.textContent='Cambiando...';
  try {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, actual);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, nueva);
    window.cerrarCambioPass();
    showToast('✔ Contraseña cambiada', false);
  } catch(e) { err.textContent='Contraseña actual incorrecta.'; err.style.display='block'; }
  btn.disabled=false; btn.textContent='CAMBIAR CONTRASEÑA';
};
