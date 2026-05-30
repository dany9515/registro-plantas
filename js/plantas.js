import { collection, addDoc, updateDoc, doc, query, where, orderBy, limit, startAfter, getDocs, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from '/js/firebase-init.js';
import { showToast, setSyncStatus } from '/js/ui.js';

// ── Variación de nivel en tiempo real ────────────────────────────────────────
const ultimoNivel = {};

export async function cargarUltimoNivel(planta) {
  const campoNivel = {'23T':'TK Inyector','PPA':'Nivel TK','17T':'Nivel TK','ED1':'Nivel TK'}[planta];
  if(!campoNivel) return;
  try {
    const q = query(collection(db,'registros'), where('planta','==',planta), orderBy('timestamp','desc'), limit(1));
    const snap = await getDocs(q);
    if(snap.empty) return;
    const ultimo = snap.docs[0].data();
    const nivel = parseFloat(ultimo.datos?.[campoNivel]);
    const ts = ultimo.timestamp?.toMillis ? ultimo.timestamp.toMillis() : 0;
    if(!isNaN(nivel) && ts) {
      ultimoNivel[planta] = { nivel, ts };
    }
  } catch(e) { console.error(e); }
}

window.calcVariacion = function(planta, inputId, divId) {
  const input = document.getElementById(inputId);
  const div = document.getElementById(divId);
  const nivelActual = parseFloat(input.value);
  if(isNaN(nivelActual) || !ultimoNivel[planta]) { div.style.display='none'; return; }

  const { nivel: nivelAnterior, ts } = ultimoNivel[planta];
  const ahora = Date.now();
  const diffMin = (ahora - ts) / 60000;
  if(diffMin <= 0) { div.style.display='none'; return; }

  const horas = Math.round(diffMin / 60);
  if(horas <= 0) { div.style.display='none'; return; }

  const diffCm = (nivelActual - nivelAnterior) * 100;
  const cmPorHora = (diffCm / horas).toFixed(1);
  const flecha = diffCm > 0 ? '⬆️' : diffCm < 0 ? '⬇️' : '➡️';
  const color = diffCm > 0 ? 'rgba(0,230,118,0.15)' : diffCm < 0 ? 'rgba(255,23,68,0.15)' : 'rgba(255,214,0,0.15)';
  const textColor = diffCm > 0 ? 'var(--green)' : diffCm < 0 ? 'var(--red)' : 'var(--yellow)';

  div.style.display = 'block';
  div.style.background = color;
  div.style.color = textColor;
  div.textContent = `${flecha} ${Math.abs(cmPorHora)} cm/hr (en ${horas}hs)`;
};

// ── Helpers DOM ──────────────────────────────────────────────────────────────
function getEstado(groupId) {
  const g = document.getElementById(groupId);
  if(!g) return '—';
  const a = g.querySelector('.es,.er,.fs');
  if(!a) return '—';
  if(a.classList.contains('es')) return 'En Servicio';
  if(a.classList.contains('er')) return 'En Reserva';
  return 'Fuera de Servicio';
}

function getPileta(panelId, nombre) {
  const panel = document.getElementById(panelId);
  if(!panel) return '—';
  const rows = panel.querySelectorAll('.pileta-row');
  for(const row of rows) {
    if(row.querySelector('.pileta-name').textContent.trim() === nombre) {
      const active = row.querySelector('.llena,.vacia');
      if(!active) return '—';
      return active.textContent.trim();
    }
  }
  return '—';
}

function getVal(id) { const el = document.getElementById(id); return el ? (el.value||'—') : '—'; }

function setEstado(groupId, val) {
  const g = document.getElementById(groupId);
  if(!g || val==='—' || !val) return;
  g.querySelectorAll('.estado-btn').forEach(b => b.classList.remove('es','er','fs'));
  const btns = g.querySelectorAll('.estado-btn');
  for(const b of btns) {
    const txt = b.textContent.trim();
    if(val==='En Servicio' && txt==='ES') { b.classList.add('es'); break; }
    if(val==='En Reserva' && txt==='ER') { b.classList.add('er'); break; }
    if(val==='Fuera de Servicio' && txt==='FS') { b.classList.add('fs'); break; }
  }
}

function setPileta(panelId, nombre, val) {
  const panel = document.getElementById(panelId);
  if(!panel || val==='—' || !val) return;
  for(const row of panel.querySelectorAll('.pileta-row')) {
    if(row.querySelector('.pileta-name').textContent.trim()===nombre) {
      row.querySelectorAll('.pileta-btn').forEach(b => b.classList.remove('llena','vacia'));
      const btns = row.querySelectorAll('.pileta-btn');
      for(const b of btns) {
        if(b.textContent.trim() === val) {
          if(b === btns[0]) b.classList.add('llena');
          else b.classList.add('vacia');
          break;
        }
      }
    }
  }
}

// ── Cache último registro por planta ────────────────────────────────────────
let ultimoRegistroPorPlanta = {};

export async function cargarUltimoRegistro() {
  const plantas = ['23T','17T','PPA','ED1','EC19','AGUADA','O87'];
  for(const planta of plantas) {
    try {
      const q = query(collection(db,'registros'), where('planta','==',planta), orderBy('timestamp','desc'), limit(1));
      const snap = await getDocs(q);
      if(!snap.empty) ultimoRegistroPorPlanta[planta] = snap.docs[0].data();
    } catch(e) {}
  }
}

// ── Autocompletar ────────────────────────────────────────────────────────────
window.autocompletar = function(planta, seccion) {
  const ultimo = ultimoRegistroPorPlanta[planta];
  if(!ultimo) { showToast('Sin registro anterior', true); return; }
  const d = ultimo.datos || {};

  if(planta==='23T') {
    if(seccion==='iny') { setEstado('23t-bj1-est', d['BJ1 Estado']); setEstado('23t-bj2-est', d['BJ2 Estado']); }
    else if(seccion==='transf') { setEstado('23t-bba1-est', d['BBA1 Estado']); setEstado('23t-bba2-est', d['BBA2 Estado']); }
    else if(seccion==='stork') { setEstado('23t-stork1-est', d['Stork 1']); setEstado('23t-stork2-est', d['Stork 2']); setEstado('23t-stork3-est', d['Stork 3']); }
    else if(seccion==='neum') { setEstado('23t-neum-ppa', d['Neumática PPA']); setEstado('23t-neum-17t', d['Neumática 17T/ED']); setEstado('23t-neum-tk', d['Neumática Entre TK']); }
    else if(seccion==='pil') { setPileta('panel-23t','Pileta Bomba BJ', d['Pileta BJ']); setPileta('panel-23t','Pileta Stork', d['Pileta Stork']); setPileta('panel-23t','Pileta KSB', d['Pileta KSB']); }
  } else if(planta==='17T') {
    if(seccion==='iny') { setEstado('17t-bj-est', d['B.Jackson Estado']); setEstado('17t-quint-est', d['Quintuplex Estado']); }
    else if(seccion==='neum') { setEstado('17t-neum-ing', d['Neumática Ingreso TK']); setEstado('17t-neum-recir', d['Neumática Recirculación']); setEstado('17t-neum-contra', d['Neumática Contra Presión']); }
    else if(seccion==='pil') { setPileta('panel-17t','Pileta General', d['Pileta General']); }
  } else if(planta==='PPA') {
    if(seccion==='iny') { setEstado('ppa-siam1-est', d['SIAM1 Estado']); setEstado('ppa-siam2-est', d['SIAM2 Estado']); setEstado('ppa-siam3-est', d['SIAM3 Estado']); setEstado('ppa-bj1-est', d['BJ1 Estado']); }
    else if(seccion==='pil') { setPileta('panel-ppa','Pileta Bomba BJ', d['Pileta BJ']); setPileta('panel-ppa','Pileta Bomba SIAM', d['Pileta SIAM']); }
  } else if(planta==='ED1') {
    if(seccion==='iny') { setEstado('ed1-siam1-est', d['SIAM1 Estado']); setEstado('ed1-siam2-est', d['SIAM2 Estado']); setEstado('ed1-siam3-est', d['SIAM3 Estado']); setEstado('ed1-siam4-est', d['SIAM4 Estado']); }
    else if(seccion==='neum') { setEstado('ed1-neum-recir', d['Neumática Recirculación']); setEstado('ed1-neum-ing', d['Neumática Ingreso TK']); }
    else if(seccion==='pil') { setPileta('panel-ed1','Pileta General', d['Pileta General']); }
  } else if(planta==='EC19') {
    if(seccion==='iny') { setEstado('ec19-siam1-est', d['SIAM1 Estado']); setEstado('ec19-siam2-est', d['SIAM2 Estado']); setEstado('ec19-siam3-est', d['SIAM3 Estado']); setEstado('ec19-siam4-est', d['SIAM4 Estado']); }
    else if(seccion==='stork') { setEstado('ec19-stork1-est', d['Stork1 Estado']); setEstado('ec19-stork2-est', d['Stork2 Estado']); }
    else if(seccion==='neum') { setEstado('ec19-neum-despacho', d['Neumática Recirculación Despacho']); setEstado('ec19-neum-iny', d['Neumática Recirculación Inyección']); }
    else if(seccion==='pil') { setPileta('panel-ec19','Pileta SIAM', d['Pileta SIAM']); setPileta('panel-ec19','Pileta Stork', d['Pileta Stork']); }
  }
  showToast('✔ Autocompletado', false);
};

// ── Recolectar datos del formulario ──────────────────────────────────────────
function recolectarDatos(p) {
  const d = {};
  if(p==='23T') {
    d['Presión Inyección']=getVal('23t-pres-iny');
    d['BJ1 Estado']=getEstado('23t-bj1-est'); d['BJ1 AMP']=getVal('23t-bj1-amp'); d['BJ1 Contra Presión']=getVal('23t-bj1-contra');
    d['BJ2 Estado']=getEstado('23t-bj2-est'); d['BJ2 AMP']=getVal('23t-bj2-amp'); d['BJ2 Contra Presión']=getVal('23t-bj2-contra');
    d['BBA1 Estado']=getEstado('23t-bba1-est'); d['BBA1 AMP']=getVal('23t-bba1-amp');
    d['BBA2 Estado']=getEstado('23t-bba2-est'); d['BBA2 AMP']=getVal('23t-bba2-amp');
    d['Caudal a 17T']=getVal('23t-caudal17t'); d['Presión Línea Transf.']=getVal('23t-presl-transf');
    d['Envío a PPA']=getVal('23t-envio-ppa'); d['Presión Colectora KSB']=getVal('23t-pres-colect');
    d['Stork 1']=getEstado('23t-stork1-est'); d['Stork 2']=getEstado('23t-stork2-est'); d['Stork 3']=getEstado('23t-stork3-est');
    d['TK Cortador Nivel Seteo']=getVal('23t-nivel-seteo'); d['TK Cortador Nivel Total']=getVal('23t-nivel-total');
    d['Colchón TK Cortador (calc)']=document.getElementById('23t-colchon-calc').textContent;
    d['TK Inyector']=getVal('23t-tk-inyector'); d['TK Despacho']=getVal('23t-nivel-despacho2');
    d['Presión Aire']=getVal('23t-pres-aire');
    d['Neumática PPA']=getEstado('23t-neum-ppa'); d['Neumática 17T/ED']=getEstado('23t-neum-17t'); d['Neumática Entre TK']=getEstado('23t-neum-tk');
    d['Pileta BJ']=getPileta('panel-23t','Pileta Bomba BJ'); d['Pileta Stork']=getPileta('panel-23t','Pileta Stork'); d['Pileta KSB']=getPileta('panel-23t','Pileta KSB');
    d['Muestra Agua']=getPileta('panel-23t','Muestra de Agua'); d['Muestra Micro Motion']=getPileta('panel-23t','Muestra Micro Motion'); d['Muestra Colchón']=getPileta('panel-23t','Muestra Colchón');
    d['Desemulsionante Nivel']=getVal('23t-q1-nivel'); d['Desemulsionante Dial']=getVal('23t-q1-dial');
    d['Clarificante Nivel']=getVal('23t-q2-nivel'); d['Clarificante Dial']=getVal('23t-q2-dial');
    d['Verza 2510(1) Nivel']=getVal('23t-q3-nivel'); d['Verza 2510(1) Dial']=getVal('23t-q3-dial');
    d['Verza 2510(2) Nivel']=getVal('23t-q4-nivel'); d['Verza 2510(2) Dial']=getVal('23t-q4-dial');
    d['Novedades']=getVal('23t-novedades');
    if(window.turnoActual==='Noche'){
      d['Acum. A PPA']=getVal('23t-acum-ppa'); d['Acum. A 17T y ED']=getVal('23t-acum-17t');
      d['Acum. Purga']=getVal('23t-acum-purga'); d['Acum. Recirculación']=getVal('23t-acum-recirc');
      d['Cierre MicroMotion']=getVal('23t-cierre-micro');
    }
  } else if(p==='17T') {
    d['Presión Inyección']=getVal('17t-pres-iny');
    d['B.Jackson Estado']=getEstado('17t-bj-est'); d['B.Jackson AMP']=getVal('17t-bj-amp'); d['B.Jackson Contra Presión']=getVal('17t-bj-contra');
    d['Quintuplex Estado']=getEstado('17t-quint-est'); d['Quintuplex AMP']=getVal('17t-quint-amp');
    d['Nivel TK']=getVal('17t-nivel-tk'); d['Caudal Ingreso']=getVal('17t-caudal-ingreso'); d['Presión Gas']=getVal('17t-pres-gas');
    d['Neumática Ingreso TK']=getEstado('17t-neum-ing'); d['Neumática Recirculación']=getEstado('17t-neum-recir'); d['Neumática Contra Presión']=getEstado('17t-neum-contra');
    d['Pileta General']=getPileta('panel-17t','Pileta General');
    d['Muestra Agua']=getPileta('panel-17t','Muestra de Agua');
    d['Novedades']=getVal('17t-novedades');
    if(window.turnoActual==='Noche'){
      d['Acum. Ingreso']=getVal('17t-acum-ingreso');
    }
  } else if(p==='PPA') {
    d['Presión Inyección']=getVal('ppa-pres-iny'); d['Presión Aire']=getVal('ppa-pres-aire');
    d['SIAM1 Estado']=getEstado('ppa-siam1-est'); d['SIAM1 AMP']=getVal('ppa-siam1-amp');
    d['SIAM2 Estado']=getEstado('ppa-siam2-est'); d['SIAM2 AMP']=getVal('ppa-siam2-amp');
    d['SIAM3 Estado']=getEstado('ppa-siam3-est'); d['SIAM3 AMP']=getVal('ppa-siam3-amp');
    d['BJ1 Estado']=getEstado('ppa-bj1-est'); d['BJ1 AMP']=getVal('ppa-bj1-amp'); d['BJ1 Contra Presión']=getVal('ppa-bj1-contra');
    d['Nivel TK']=getVal('ppa-nivel-tk'); d['Depósito Aceite']=getVal('ppa-aceite');
    d['Pileta BJ']=getPileta('panel-ppa','Pileta Bomba BJ'); d['Pileta SIAM']=getPileta('panel-ppa','Pileta Bomba SIAM');
    d['Muestra Agua']=getPileta('panel-ppa','Muestra de Agua');
    d['Novedades']=getVal('ppa-novedades');
    if(window.turnoActual==='Noche'){
      d['Acum. Cargadero']=getVal('ppa-acum-cargadero');
    }
  } else if(p==='ED1') {
    d['Presión Inyección']=getVal('ed1-pres-iny'); d['Presión Ingreso']=getVal('ed1-pres-ingreso'); d['Presión Compresor']=getVal('ed1-pres-compresor');
    d['SIAM1 Estado']=getEstado('ed1-siam1-est'); d['SIAM1 AMP']=getVal('ed1-siam1-amp');
    d['SIAM2 Estado']=getEstado('ed1-siam2-est'); d['SIAM2 AMP']=getVal('ed1-siam2-amp');
    d['SIAM3 Estado']=getEstado('ed1-siam3-est'); d['SIAM3 AMP']=getVal('ed1-siam3-amp');
    d['SIAM4 Estado']=getEstado('ed1-siam4-est'); d['SIAM4 AMP']=getVal('ed1-siam4-amp');
    d['Nivel TK']=getVal('ed1-nivel-tk'); d['Cuba Aceite']=getVal('ed1-aceite');
    d['Neumática Recirculación']=getEstado('ed1-neum-recir'); d['Neumática Ingreso TK']=getEstado('ed1-neum-ing');
    d['Pileta General']=getPileta('panel-ed1','Pileta General');
    d['Muestra Agua']=getPileta('panel-ed1','Muestra de Agua');
    d['Novedades']=getVal('ed1-novedades');
  } else if(p==='EC19') {
    d['Presión Inyección']=getVal('ec19-pres-iny');
    d['SIAM1 Estado']=getEstado('ec19-siam1-est'); d['SIAM1 AMP']=getVal('ec19-siam1-amp');
    d['SIAM2 Estado']=getEstado('ec19-siam2-est'); d['SIAM2 AMP']=getVal('ec19-siam2-amp');
    d['SIAM3 Estado']=getEstado('ec19-siam3-est'); d['SIAM3 AMP']=getVal('ec19-siam3-amp');
    d['SIAM4 Estado']=getEstado('ec19-siam4-est'); d['SIAM4 AMP']=getVal('ec19-siam4-amp');
    d['Stork1 Estado']=getEstado('ec19-stork1-est'); d['Stork1 AMP']=getVal('ec19-stork1-amp');
    d['Stork2 Estado']=getEstado('ec19-stork2-est'); d['Stork2 AMP']=getVal('ec19-stork2-amp');
    d['Stork Presión Línea']=getVal('ec19-stork-pres');
    d['Micro Motion']=window.micromotiondEstado||'—';
    if(window.micromotiondEstado==='bombeando') { d['MM Caudal']=getVal('ec19-mm-caudal'); d['MM Presión Oleoducto']=getVal('ec19-mm-presion'); }
    d['Nivel Total TK']=getVal('ec19-nivel-total'); d['Interfaz']=getVal('ec19-interfaz');
    d['TK Despacho']=getVal('ec19-nivel-despacho'); d['Depósito Aceite']=getVal('ec19-aceite');
    d['Neumática Recirculación Despacho']=getEstado('ec19-neum-despacho'); d['Neumática Recirculación Inyección']=getEstado('ec19-neum-iny');
    d['Pileta SIAM']=getPileta('panel-ec19','Pileta SIAM'); d['Pileta Stork']=getPileta('panel-ec19','Pileta Stork');
    d['Muestra Agua']=getPileta('panel-ec19','Muestra de Agua'); d['Muestra Micro Motion']=getPileta('panel-ec19','Muestra Micro Motion'); d['Muestra Colchón']=getPileta('panel-ec19','Muestra Colchón');
    d['Desemulsionante Nivel']=getVal('ec19-q1-nivel'); d['Desemulsionante Dial']=getVal('ec19-q1-dial');
    d['Clarificante Nivel']=getVal('ec19-q2-nivel'); d['Clarificante Dial']=getVal('ec19-q2-dial');
    d['Verza 2510(1) Nivel']=getVal('ec19-q3-nivel'); d['Verza 2510(1) Dial']=getVal('ec19-q3-dial');
    d['Verza 2510(2) Nivel']=getVal('ec19-q4-nivel'); d['Verza 2510(2) Dial']=getVal('ec19-q4-dial');
    d['Novedades']=getVal('ec19-novedades');
    if(window.turnoActual==='Noche'){
      d['Acum. Recirculación']=getVal('ec19-acum-recirc');
      d['Cierre MicroMotion']=getVal('ec19-cierre-micro');
    }
  } else if(p==='AGUADA') {
    d['Caudal Salida']=getVal('aguada-caudal'); d['AMP Bomba KSB']=getVal('aguada-amp'); d['Presión Impulsión']=getVal('aguada-pres');
    d['Novedades']=getVal('aguada-novedades');
    if(window.turnoActual==='Noche'){
      d['Acum. Aguada']=getVal('aguada-acum');
    }
  } else if(p==='O87') {
    d['Caudal Actual']=getVal('o87-caudal');
    d['Novedades']=getVal('o87-novedades');
    if(window.turnoActual==='Noche'){
      d['Acum. O87']=getVal('o87-acum-noche');
    }
  }
  return d;
}

// ── Limpiar campos de una planta ─────────────────────────────────────────────
function limpiarPlanta(planta) {
  const panel = document.getElementById('panel-' + planta.toLowerCase());
  if(!panel) return;
  panel.querySelectorAll('input[type="number"], textarea').forEach(el => { el.value = ''; });
  panel.querySelectorAll('.estado-btn').forEach(b => b.classList.remove('es','er','fs'));
  panel.querySelectorAll('.pileta-btn').forEach(b => b.classList.remove('llena','vacia'));
  panel.querySelectorAll('[id^="var-"]').forEach(d => d.style.display='none');
  if(planta==='EC19') {
    window.micromotiondEstado = '';
    document.getElementById('mm-bombeando').className = 'mm-btn';
    document.getElementById('mm-recirculando').className = 'mm-btn';
    document.getElementById('mm-fields-bombeando').className = 'mm-fields';
    const colchonCalc = document.getElementById('ec19-colchon-calc');
    if(colchonCalc) { colchonCalc.textContent = '— cm'; colchonCalc.style.color = 'var(--accent)'; }
  }
  if(planta==='23T') {
    const colchon23T = document.getElementById('23t-colchon-calc');
    if(colchon23T) { colchon23T.textContent = '— cm'; colchon23T.style.color = 'var(--accent)'; }
  }
}

// ── Guardar planta ───────────────────────────────────────────────────────────
window.guardarPlanta = async function(planta) {
  const btn = document.getElementById('btn-'+planta.toLowerCase());
  btn.disabled=true; btn.textContent='⏳ Guardando...';
  setSyncStatus('syncing','🔄 Guardando...');
  const fecha = document.getElementById('meta-fecha').value;
  const recorredor = document.getElementById('meta-recorredor').value||'—';
  const now = new Date();
  const hora = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  try {
    await addDoc(collection(db,'registros'), {
      planta, fecha, turno:window.turnoActual, recorredor,
      vuelta:window.vueltaActual, hora,
      datos:recolectarDatos(planta),
      timestamp:serverTimestamp(),
      editado:false,
      userEmail: auth.currentUser?.email||''
    });
    setSyncStatus('online','🟢 Online');
    showToast(`✔ ${planta} — Vuelta ${window.vueltaActual} (${hora})`, false);
    document.querySelectorAll('.plant-tab').forEach(t => { if(t.textContent.trim()===planta) t.classList.add('saved'); });
    await cargarUltimoNivel(planta);
    await cargarUltimoRegistro();
    limpiarPlanta(planta);
  } catch(e) {
    setSyncStatus('offline','🔴 Error');
    showToast('❌ Error al guardar', true);
    console.error(e);
  }
  btn.disabled=false; btn.textContent=`💾 GUARDAR PLANTA ${planta}`;
};

// ── SECCIONES para vista de historial ───────────────────────────────────────
const SECCIONES = {
  '23T':[
    {titulo:'🌅 Medición Mañana', campos:['Colchón TK Cortador']},
    {titulo:'💉 Inyección', campos:['Presión Inyección','BJ1 Estado','BJ1 AMP','BJ1 Contra Presión','BJ2 Estado','BJ2 AMP','BJ2 Contra Presión']},
    {titulo:'🔄 Transferencia', campos:['BBA1 Estado','BBA1 AMP','BBA2 Estado','BBA2 AMP','Caudal a 17T','Presión Línea Transf.','Envío a PPA','Presión Colectora KSB']},
    {titulo:'📦 Despacho Stork', campos:['Stork 1','Stork 2','Stork 3','Nivel TK Despacho']},
    {titulo:'🛢 Tanques', campos:['TK Cortador Nivel Seteo','TK Cortador Nivel Total','Colchón TK Cortador (calc)','TK Inyector','Presión Aire']},
    {titulo:'⚙️ Neumáticas', campos:['Neumática PPA','Neumática 17T/ED','Neumática Entre TK']},
    {titulo:'🔵 Piletas', campos:['Pileta BJ','Pileta Stork','Pileta KSB']},
    {titulo:'🟡 Muestras', campos:['Muestra Agua','Muestra Micro Motion','Muestra Colchón']},
    {titulo:'🧪 Químicos', campos:['Desemulsionante Nivel','Desemulsionante Dial','Clarificante Nivel','Clarificante Dial','Verza 2510(1) Nivel','Verza 2510(1) Dial','Verza 2510(2) Nivel','Verza 2510(2) Dial']},
    {titulo:'📝 Novedades', campos:['Novedades']},
  ],
  '17T':[
    {titulo:'💉 Inyección', campos:['Presión Inyección','B.Jackson Estado','B.Jackson AMP','B.Jackson Contra Presión','Quintuplex Estado','Quintuplex AMP']},
    {titulo:'🛢 Tanque', campos:['Nivel TK','Caudal Ingreso','Presión Gas']},
    {titulo:'⚙️ Neumáticas', campos:['Neumática Ingreso TK','Neumática Recirculación','Neumática Contra Presión']},
    {titulo:'🔵 Piletas', campos:['Pileta General']},
    {titulo:'🟡 Muestras', campos:['Muestra Agua']},
    {titulo:'📝 Novedades', campos:['Novedades']},
  ],
  'PPA':[
    {titulo:'💉 Inyección', campos:['Presión Inyección','Presión Aire','SIAM1 Estado','SIAM1 AMP','SIAM2 Estado','SIAM2 AMP','SIAM3 Estado','SIAM3 AMP','BJ1 Estado','BJ1 AMP','BJ1 Contra Presión']},
    {titulo:'🛢 Tanque', campos:['Nivel TK','Depósito Aceite']},
    {titulo:'🔵 Piletas', campos:['Pileta BJ','Pileta SIAM']},
    {titulo:'🟡 Muestras', campos:['Muestra Agua']},
    {titulo:'📝 Novedades', campos:['Novedades']},
  ],
  'ED1':[
    {titulo:'💉 Inyección', campos:['Presión Inyección','Presión Ingreso','Presión Compresor','SIAM1 Estado','SIAM1 AMP','SIAM2 Estado','SIAM2 AMP','SIAM3 Estado','SIAM3 AMP','SIAM4 Estado','SIAM4 AMP']},
    {titulo:'🛢 Tanque', campos:['Nivel TK','Cuba Aceite']},
    {titulo:'⚙️ Neumáticas', campos:['Neumática Recirculación','Neumática Ingreso TK']},
    {titulo:'🔵 Piletas', campos:['Pileta General']},
    {titulo:'🟡 Muestras', campos:['Muestra Agua']},
    {titulo:'📝 Novedades', campos:['Novedades']},
  ],
  'EC19':[
    {titulo:'🌅 Medición Mañana', campos:['Colchón TK Cortador']},
    {titulo:'💉 Inyección', campos:['Presión Inyección','SIAM1 Estado','SIAM1 AMP','SIAM2 Estado','SIAM2 AMP','SIAM3 Estado','SIAM3 AMP','SIAM4 Estado','SIAM4 AMP']},
    {titulo:'📦 Despacho Stork', campos:['Stork1 Estado','Stork1 AMP','Stork2 Estado','Stork2 AMP']},
    {titulo:'🔮 Micro Motion', campos:['Micro Motion','MM Caudal','MM Presión Oleoducto']},
    {titulo:'🛢 Tanques', campos:['Nivel Total TK','Interfaz','Colchón Petróleo','TK Despacho','Depósito Aceite']},
    {titulo:'⚙️ Neumáticas', campos:['Neumática Recirculación Despacho','Neumática Recirculación Inyección']},
    {titulo:'🔵 Piletas', campos:['Pileta SIAM','Pileta Stork']},
    {titulo:'🟡 Muestras', campos:['Muestra Agua','Muestra Micro Motion','Muestra Colchón']},
    {titulo:'🧪 Químicos', campos:['Desemulsionante Nivel','Desemulsionante Dial','Clarificante Nivel','Clarificante Dial','Verza 2510(1) Nivel','Verza 2510(1) Dial','Verza 2510(2) Nivel','Verza 2510(2) Dial']},
    {titulo:'📝 Novedades', campos:['Novedades']},
  ],
  'AGUADA':[
    {titulo:'📊 Datos', campos:['Caudal Salida','AMP Bomba KSB','Presión Impulsión']},
    {titulo:'📝 Novedades', campos:['Novedades']},
  ],
  'O87':[
    {titulo:'📊 Datos', campos:['Caudal Actual','Acumulado']},
    {titulo:'📝 Novedades', campos:['Novedades']},
  ],
};

// ── Historial ────────────────────────────────────────────────────────────────
const historialState = {};

function renderHistorial(planta, docs, ahora) {
  const currentUser = auth.currentUser?.email||'';
  const secciones = SECCIONES[planta]||[];
  const campoNivel = {'23T':'TK Inyector','PPA':'Nivel TK','17T':'Nivel TK','ED1':'Nivel TK'}[planta];

  const variaciones = {};
  if(campoNivel) {
    for(let i=0; i<docs.length-1; i++) {
      const curr = docs[i].data(), prev = docs[i+1].data();
      const n1 = parseFloat(curr.datos?.[campoNivel]), n2 = parseFloat(prev.datos?.[campoNivel]);
      if(isNaN(n1)||isNaN(n2)) continue;
      const ts1 = curr.timestamp?.toMillis?curr.timestamp.toMillis():0;
      const ts2 = prev.timestamp?.toMillis?prev.timestamp.toMillis():0;
      if(!ts1||!ts2||ts1===ts2) continue;
      const diffMin = (ts1-ts2)/60000;
      const horas = Math.round(diffMin/60);
      if(horas<=0) continue;
      const diffCm = (n1-n2)*100;
      const cmH = (diffCm/horas).toFixed(1);
      const flecha = diffCm>0?'⬆️':diffCm<0?'⬇️':'➡️';
      variaciones[docs[i].id] = `${flecha} ${Math.abs(cmH)} cm/hr (en ${horas}hs)`;
    }
  }

  const cards = docs.map(docSnap => {
    const r = docSnap.data();
    const ts = r.timestamp?.toMillis?r.timestamp.toMillis():0;
    const puedeEditar = r.userEmail===currentUser && (ahora-ts)<30*60*1000;
    const editadoLabel = r.editado ? ' <span class="reg-editado">✏️ editado</span>' : '';
    const varHtml = variaciones[docSnap.id] ? `<div class="reg-variacion">📊 ${variaciones[docSnap.id]}</div>` : '';

    const secHtml = secciones.map(sec => {
      const camposHtml = sec.campos.filter(c => r.datos?.[c] && r.datos[c]!=='—').map(c => {
        if(c==='Novedades') return `<div class="reg-novedades">${r.datos[c]}</div>`;
        return `<div class="reg-campo"><span class="reg-campo-nombre">${c}</span><span class="reg-campo-valor">${r.datos[c]}</span></div>`;
      }).join('');
      if(!camposHtml) return '';
      return `<div class="reg-seccion"><div class="reg-seccion-title">${sec.titulo}</div>${camposHtml}</div>`;
    }).join('');

    const editBtn = puedeEditar ? `<button class="reg-edit-btn" onclick="editarRegistro('${docSnap.id}','${planta}')">✏️ Editar registro</button>` : '';

    return `<div class="reg-card">
      <div class="reg-header" onclick="toggleAcordeon(this)">
        <div class="reg-header-left">
          <div class="reg-meta">📅 ${r.fecha} | ${r.turno} | 👤 ${r.recorredor}${editadoLabel}</div>
          <div class="reg-vuelta">🔄 Vuelta ${r.vuelta||'—'} &nbsp;⏱ ${r.hora||'—'}hs</div>
        </div>
        <div class="reg-arrow">▼</div>
      </div>
      <div class="reg-body">
        ${varHtml}
        ${secHtml}
        ${editBtn}
      </div>
    </div>`;
  }).join('');

  const state = historialState[planta];
  const pie = state?.exhausted
    ? '<div class="no-registros" style="padding:12px 0;font-size:0.82rem;">No hay registros anteriores.</div>'
    : `<button class="historial-cargar-mas" onclick="cargarMasHistorial('${planta}')">+ Ver registros anteriores</button>`;

  document.getElementById('modal-body').innerHTML = cards + pie;
}

async function cargarHistorialDesde(planta, append) {
  const state = historialState[planta] || { allDocs: [], exhausted: false };
  try {
    const ahora = Date.now();
    let q;

    if (!append) {
      const desde = Timestamp.fromMillis(ahora - 48 * 60 * 60 * 1000);
      q = query(collection(db,'registros'), where('planta','==',planta), where('timestamp','>=',desde), orderBy('timestamp','desc'));
    } else if (state.allDocs.length > 0) {
      q = query(collection(db,'registros'), where('planta','==',planta), orderBy('timestamp','desc'), startAfter(state.allDocs[state.allDocs.length-1]), limit(20));
    } else {
      q = query(collection(db,'registros'), where('planta','==',planta), orderBy('timestamp','desc'), limit(20));
    }

    const snap = await getDocs(q);

    if (!append && snap.empty) {
      historialState[planta] = { allDocs: [], exhausted: false };
      document.getElementById('modal-body').innerHTML =
        `<div class="no-registros">Sin registros en las últimas 48hs.</div>` +
        `<button class="historial-cargar-mas" onclick="cargarMasHistorial('${planta}')">+ Buscar registros anteriores</button>`;
      return;
    }

    const allDocs = append ? [...state.allDocs, ...snap.docs] : snap.docs;
    historialState[planta] = { allDocs, exhausted: snap.empty };

    renderHistorial(planta, allDocs, ahora);
  } catch(e) {
    document.getElementById('modal-body').innerHTML='<div class="no-registros">Error al cargar. Intentá de nuevo.</div>';
    console.error(e);
  }
}

window.verHistorial = async function(planta) {
  historialState[planta] = { allDocs: [], exhausted: false };
  document.getElementById('modal-title').textContent = 'Historial — ' + planta;
  document.getElementById('modal-body').innerHTML = '<div class="no-registros">Cargando...</div>';
  document.getElementById('modal').classList.add('show');
  await cargarHistorialDesde(planta, false);
};

window.cargarMasHistorial = async function(planta) {
  document.getElementById('modal-body').innerHTML = '<div class="no-registros">Cargando...</div>';
  await cargarHistorialDesde(planta, true);
};

// ── Editar registro ──────────────────────────────────────────────────────────
let editDocId = '', editPlanta = '';

window.editarRegistro = async function(docId, planta) {
  editDocId = docId; editPlanta = planta;
  try {
    const q = query(collection(db,'registros'), where('planta','==',planta), orderBy('timestamp','desc'));
    const snap = await getDocs(q);
    let registro = null;
    snap.docs.forEach(d => { if(d.id === docId) registro = d.data(); });
    if(!registro) { showToast('No se encontró el registro', true); return; }

    const datos = registro.datos || {};
    const camposHtml = Object.entries(datos).map(([campo, valor]) => {
      const idCampo = 'edit-' + campo.replace(/[^a-zA-Z0-9]/g, '_');
      if(campo === 'Novedades') {
        return `<div style="margin-bottom:12px">
          <label style="display:block;font-family:var(--font-mono);font-size:0.78rem;color:var(--muted);margin-bottom:5px;text-transform:uppercase">${campo}</label>
          <textarea id="${idCampo}" data-campo="${campo}" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:var(--font-body);font-size:0.95rem;padding:10px;outline:none;min-height:70px;resize:vertical">${valor==='—'?'':valor}</textarea>
        </div>`;
      }
      return `<div style="margin-bottom:10px">
        <label style="display:block;font-family:var(--font-mono);font-size:0.78rem;color:var(--muted);margin-bottom:4px;text-transform:uppercase">${campo}</label>
        <input type="text" id="${idCampo}" data-campo="${campo}" value="${valor==='—'?'':valor}" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:var(--font-mono);font-size:1rem;padding:10px;outline:none">
      </div>`;
    }).join('');

    document.getElementById('modal-edit-body').innerHTML = `
      <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--accent);margin-bottom:14px;padding:8px;background:rgba(0,200,255,0.08);border-radius:6px">
        📅 ${registro.fecha} | ${registro.turno} | 🔄 Vuelta ${registro.vuelta} | ⏱ ${registro.hora}hs
      </div>
      ${camposHtml}
    `;
    document.getElementById('modal-edit').classList.add('show');
  } catch(e) {
    showToast('Error al cargar registro', true);
    console.error(e);
  }
};

window.cerrarEdicion = function() {
  document.getElementById('modal-edit').classList.remove('show');
};

window.confirmarEdicion = async function() {
  try {
    const inputs = document.querySelectorAll('#modal-edit-body input, #modal-edit-body textarea');
    const update = { editado: true, editadoEn: serverTimestamp() };
    inputs.forEach(input => {
      const campo = input.getAttribute('data-campo');
      const valor = input.value.trim() || '—';
      update[`datos.${campo}`] = valor;
    });
    await updateDoc(doc(db,'registros',editDocId), update);
    showToast('✔ Registro actualizado', false);
    document.getElementById('modal-edit').classList.remove('show');
    window.verHistorial(editPlanta);
  } catch(e) {
    showToast('❌ Error al actualizar', true);
    console.error(e);
  }
};
