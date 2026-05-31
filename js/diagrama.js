import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js?v=20260531';
import { showToast, setSyncStatus } from './ui.js?v=20260531';

let diagramaActual = null;
let diagramaActualId = null;
let vistaActual = 'inteligente';

const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const EMAILS_ADMIN = ['daniel.aguilar@registroplantas.com'];

const HORA_FIN_TURNO = {
  '6':    14,
  '14':   22,
  '22':   6,
  '6-12': 18,
  '18-12':6,
  'FT':   14,
  'FT12': 18,
};


const CFG = {
  MANANA:     { emoji:'☀️',  label:'Mañana 8hs (06-14)',    color:'#38bdf8', bg:'rgba(56,189,248,0.1)',   estrabajo:true  },
  TARDE:      { emoji:'🌤',  label:'Tarde 8hs (14-22)',     color:'#fbbf24', bg:'rgba(251,191,36,0.1)',   estrabajo:true  },
  NOCHE:      { emoji:'🌙',  label:'Noche 8hs (22-06)',     color:'#c4b5fd', bg:'rgba(196,181,253,0.1)', estrabajo:true  },
  MANANA12:   { emoji:'☀️⚡', label:'Mañana 12hs (06-18)',  color:'#7dd3fc', bg:'rgba(125,211,252,0.1)', estrabajo:true  },
  NOCHE12:    { emoji:'🌙⚡', label:'Noche 12hs (18-06)',   color:'#a78bfa', bg:'rgba(167,139,250,0.1)', estrabajo:true  },
  FT:         { emoji:'⚡',   label:'Franco trab. 8hs',     color:'#34d399', bg:'rgba(52,211,153,0.1)',  estrabajo:true  },
  FT12:       { emoji:'⚡⚡',  label:'Franco trab. 12hs',   color:'#10b981', bg:'rgba(16,185,129,0.1)',  estrabajo:true  },
  FRANCO:     { emoji:'🏖',  label:'Franco',                color:'#94a3b8', bg:'rgba(148,163,184,0.08)', puedeC:true    },
  FC:         { emoji:'🔄',  label:'Franco compensatorio',  color:'#64748b', bg:'rgba(100,116,139,0.08)', puedeC:false   },
  BOLETA:     { emoji:'🏥',  label:'Boleta médica',         color:'#f87171', bg:'rgba(248,113,113,0.1)', puedeC:false   },
  VACACIONES: { emoji:'🌴',  label:'Vacaciones',            color:'#fb923c', bg:'rgba(251,146,60,0.1)',  puedeC:false   },
  MD:         { emoji:'🚗',  label:'Manejo defensivo',      color:'#94a3b8', bg:'rgba(148,163,184,0.06)', puedeC:false  },
  PG:         { emoji:'📋',  label:'Permiso gremial',       color:'#94a3b8', bg:'rgba(148,163,184,0.06)', puedeC:false  },
  RM:         { emoji:'🩺',  label:'Revisión médica',       color:'#94a3b8', bg:'rgba(148,163,184,0.06)', puedeC:false  },
  LIBRE:      { emoji:'',    label:'Sin asignación',        color:'#334155', bg:'transparent',            puedeC:false  },
};

function esAdmin() { return EMAILS_ADMIN.includes(auth.currentUser?.email || ''); }

function normalizarTurno(val) {
  if(!val || val.toString().trim() === '') return 'LIBRE';
  const v = val.toString().trim().toUpperCase();
  if(v === '6')     return 'MANANA';
  if(v === '14')    return 'TARDE';
  if(v === '22')    return 'NOCHE';
  if(v === '6-12')  return 'MANANA12';
  if(v === '18-12') return 'NOCHE12';
  if(v === 'FT')    return 'FT';
  if(v === 'FT12')  return 'FT12';
  if(v === 'F')     return 'FRANCO';
  if(v === 'FC')    return 'FC';
  if(v === 'B')     return 'BOLETA';
  if(v === 'V')     return 'VACACIONES';
  if(v === 'MD')    return 'MD';
  if(v === 'PG')    return 'PG';
  if(v === 'RM')    return 'RM';
  return 'LIBRE';
}

function horasDescanso(valAntes, valDespues) {
  if(!valAntes || !valDespues) return 99;
  const finAntes = HORA_FIN_TURNO[valAntes.toString().trim()];
  const inicDespues = parseInt(valDespues.toString().trim());
  if(finAntes === undefined || isNaN(inicDespues)) return 99;
  let diff = inicDespues - finAntes;
  if(diff < 0) diff += 24;
  return diff;
}

function puedeCubrir(miVal, valAntSuyo, valSigSuyo) {
  const descAntes = horasDescanso(valAntSuyo, miVal);
  const descDespues = horasDescanso(miVal, valSigSuyo);
  return descAntes >= 8 && descDespues >= 8;
}

function nombreCorto(nombre) {
  const p = nombre.split(' ');
  return p.length >= 2 ? p[0]+' '+p[1] : nombre;
}

function setVistasDiagrama(vista) {
  vistaActual = vista;
  const btnInt = document.getElementById('btn-vista-inteligente');
  const btnTab = document.getElementById('btn-vista-tabla');
  const contInt = document.getElementById('diagrama-semana-container');
  const contTab = document.getElementById('diagrama-tabla-container');
  const ctrlInt = document.getElementById('controles-inteligente');
  const ctrlTab = document.getElementById('controles-tabla');
  if(vista === 'inteligente') {
    btnInt.style.background = 'rgba(167,139,250,0.2)'; btnInt.style.color = '#a78bfa';
    btnTab.style.background = 'transparent'; btnTab.style.color = 'var(--muted)';
    contInt.style.display = 'block'; contTab.style.display = 'none';
    ctrlInt.style.display = 'flex'; ctrlTab.style.display = 'none';
    renderDiagramaSemana();
  } else {
    btnTab.style.background = 'rgba(167,139,250,0.2)'; btnTab.style.color = '#a78bfa';
    btnInt.style.background = 'transparent'; btnInt.style.color = 'var(--muted)';
    contTab.style.display = 'block'; contInt.style.display = 'none';
    ctrlTab.style.display = 'block'; ctrlInt.style.display = 'none';
    renderDiagramaTabla();
  }
}
window.setVistasDiagrama = setVistasDiagrama;

async function renderDiagrama() {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('diagrama-fecha-sel').value = hoy;
  document.getElementById('diagrama-carga-section').style.display = esAdmin() ? 'block' : 'none';
  diagramaActual = null;
  diagramaActualId = null;
  try {
    const q = query(collection(db, 'diagramas'), orderBy('timestamp', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      diagramaActual = snap.docs[0].data();
      diagramaActualId = snap.docs[0].id;
    }
  } catch(e) {
    console.error('Error al leer diagrama:', e);
  }
  setVistasDiagrama('inteligente');
}
window.renderDiagrama = renderDiagrama;

function irHoy() {
  document.getElementById('diagrama-fecha-sel').value = new Date().toISOString().split('T')[0];
  renderDiagramaSemana();
}
window.irHoy = irHoy;

function renderDiagramaSemana() {
  if(!diagramaActual) {
    document.getElementById('diagrama-semana-container').innerHTML =
      `<div style="text-align:center;padding:40px 16px;font-family:var(--font-mono);font-size:0.85rem;color:var(--muted);">Sin diagrama cargado</div>`;
    return;
  }
  const fechaStr = document.getElementById('diagrama-fecha-sel').value;
  if(!fechaStr) return;
  const fechaBase = new Date(fechaStr+'T12:00:00');
  const hoy = new Date();
  const datos = diagramaActual.datos || [];
  const nombreUsuario = document.getElementById('meta-recorredor')?.value || '';
  const miPersona = datos.find(p => nombreUsuario && p.nombre.toUpperCase().includes(nombreUsuario.split(' ')[0].toUpperCase()));

  let html = '';

  for(let i=0; i<3; i++) {
    const fecha = new Date(fechaBase);
    fecha.setDate(fechaBase.getDate()+i);
    const diaNum = String(fecha.getDate());
    const diaAnt = String(fecha.getDate()-1);
    const diaSig = String(fecha.getDate()+1);
    const esHoy = fecha.getDate()===hoy.getDate() && fecha.getMonth()===hoy.getMonth() && fecha.getFullYear()===hoy.getFullYear();

    const miVal = miPersona ? (miPersona.dias[diaNum]||'') : '';
    const miTurno = normalizarTurno(miVal);
    const miCfg = CFG[miTurno] || CFG.LIBRE;

    const grupos = {};
    Object.keys(CFG).forEach(k => grupos[k] = []);

    datos.forEach(p => {
      const val = p.dias[diaNum] || '';
      const turno = normalizarTurno(val);
      const esMio = miPersona && p.nombre === miPersona.nombre;
      const valAnt = p.dias[diaAnt] || '';
      const valSig = p.dias[diaSig] || '';

      let puedeC = false;
      if(!esMio && miCfg.estrabajo && turno === 'FRANCO') {
        puedeC = puedeCubrir(miVal, valAnt, valSig);
      }

      if(grupos[turno]) grupos[turno].push({ nombre: nombreCorto(p.nombre), esMio, puedeC, val });
    });

    let miTurnoHTML = '';
    if(miPersona) {
      const col = miCfg.color || '#475569';
      const label = miTurno === 'LIBRE' ? 'Sin asignación' : `${miCfg.emoji} ${miCfg.label}`;
      miTurnoHTML = `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:13px 15px;margin-bottom:10px;">
        <div style="font-family:var(--font-mono);font-size:0.6rem;color:#64748b;letter-spacing:2px;margin-bottom:6px;text-transform:uppercase;">Tu turno</div>
        <div style="font-family:var(--font-head);font-size:1.1rem;font-weight:700;color:${col};">${label}</div>
        <div style="font-family:var(--font-head);font-size:0.88rem;color:#cbd5e1;margin-top:4px;">👤 ${nombreCorto(miPersona.nombre)}</div>
      </div>`;
    }

    let otrosHTML = '';
    Object.entries(CFG).forEach(([key, cfg]) => {
      if(key === 'LIBRE') return;
      const personas = grupos[key]?.filter(p => !p.esMio) || [];
      if(!personas.length) return;
      const nombresHTML = personas.map(p => {
        const badge = p.puedeC
          ? `<span style="font-size:0.58rem;background:rgba(52,211,153,0.2);color:#34d399;padding:1px 7px;border-radius:8px;margin-left:5px;font-weight:600;">puede cubrir</span>`
          : '';
        return `<span style="font-family:var(--font-head);font-size:0.88rem;color:${cfg.color};font-weight:500;">${p.nombre}${badge}</span>`;
      }).join(`<span style="color:#1e293b;padding:0 5px;">·</span>`);
      otrosHTML += `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-family:var(--font-mono);font-size:0.68rem;color:${cfg.color};white-space:nowrap;min-width:160px;font-weight:600;padding-top:2px;">${cfg.emoji} ${cfg.label}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${nombresHTML}</div>
      </div>`;
    });

    const sinAsig = grupos['LIBRE']?.filter(p => !p.esMio) || [];
    if(sinAsig.length) {
      const nombres = sinAsig.map(p=>`<span style="font-family:var(--font-head);font-size:0.88rem;color:#334155;font-weight:400;">${p.nombre}</span>`).join(`<span style="color:#1e293b;padding:0 5px;">·</span>`);
      otrosHTML += `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;">
        <div style="font-family:var(--font-mono);font-size:0.68rem;color:#334155;white-space:nowrap;min-width:160px;font-weight:500;padding-top:2px;">— Sin asignación</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${nombres}</div>
      </div>`;
    }

    if(otrosHTML) otrosHTML = `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:4px 14px 2px;">
      <div style="font-family:var(--font-mono);font-size:0.58rem;color:#475569;letter-spacing:2px;padding:10px 0 4px;text-transform:uppercase;">Para cambiar con</div>
      ${otrosHTML}</div>`;

    html += `<div style="background:${esHoy?'rgba(167,139,250,0.07)':'rgba(17,25,40,0.8)'};border:1px solid ${esHoy?'rgba(167,139,250,0.45)':'rgba(255,255,255,0.08)'};border-radius:14px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <span style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;color:${esHoy?'#c4b5fd':'#e2eaf6'};">${DIAS_SEMANA[fecha.getDay()]} ${diaNum}</span>
        <span style="font-family:var(--font-mono);font-size:0.72rem;color:#64748b;">${MESES[fecha.getMonth()]} ${fecha.getFullYear()}</span>
        ${esHoy?'<span style="font-family:var(--font-mono);font-size:0.62rem;background:rgba(167,139,250,0.25);color:#c4b5fd;padding:2px 10px;border-radius:10px;letter-spacing:1px;font-weight:600;">HOY</span>':''}
      </div>
      ${miTurnoHTML}${otrosHTML}
    </div>`;
  }

  document.getElementById('diagrama-semana-container').innerHTML = html;
  document.getElementById('diagrama-mes-label').textContent = `${DIAS_SEMANA[fechaBase.getDay()]} ${fechaBase.getDate()} de ${MESES[fechaBase.getMonth()]}`;
}
window.renderDiagramaSemana = renderDiagramaSemana;

function renderDiagramaTabla() {
  if(!diagramaActual) {
    document.getElementById('diagrama-tabla-inner').innerHTML =
      `<div style="text-align:center;padding:40px 16px;font-family:var(--font-mono);font-size:0.85rem;color:var(--muted);">Sin diagrama cargado</div>`;
    return;
  }
  const datos = diagramaActual.datos || [];
  if(!datos.length) return;

  const diasSet = new Set();
  datos.forEach(p => Object.keys(p.dias||{}).forEach(d => diasSet.add(parseInt(d))));
  const diasOrdenados = Array.from(diasSet).map(Number).sort((a,b)=>a-b);
  // Si el diagrama abarca dos meses (ej: días 22-31 + 1-6), Object.keys siempre
  // devuelve las claves numéricas en orden ascendente, rompiendo el orden cronológico.
  // Detectamos la frontera de mes como el mayor salto entre días consecutivos.
  let dias;
  if (diasOrdenados.length > 1) {
    let maxGap = 0, maxGapIdx = 0;
    for (let i = 1; i < diasOrdenados.length; i++) {
      const gap = diasOrdenados[i] - diasOrdenados[i-1];
      if (gap > maxGap) { maxGap = gap; maxGapIdx = i; }
    }
    dias = maxGap > 5
      ? [...diasOrdenados.slice(maxGapIdx), ...diasOrdenados.slice(0, maxGapIdx)].map(String)
      : diasOrdenados.map(String);
  } else {
    dias = diasOrdenados.map(String);
  }
  const diaHoy = String(new Date().getDate());
  const nombreUsuario = document.getElementById('meta-recorredor')?.value || '';

  let html = '<table style="width:max-content;border-collapse:collapse;">';
  html += '<thead><tr><th style="text-align:left;padding:8px 10px;font-family:var(--font-mono);font-size:0.68rem;color:#64748b;font-weight:500;border-bottom:1px solid rgba(255,255,255,0.08);min-width:130px;">NOMBRE</th>';
  dias.forEach(d => {
    const esHoy = d === diaHoy;
    html += `<th style="padding:6px 3px;font-family:var(--font-mono);font-size:0.65rem;color:${esHoy?'#c4b5fd':'#64748b'};font-weight:${esHoy?'700':'400'};border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;min-width:34px;${esHoy?'background:rgba(167,139,250,0.08);':''}">${d}</th>`;
  });
  html += '</tr></thead><tbody>';

  datos.forEach(p => {
    const esMiFila = nombreUsuario && p.nombre.toUpperCase().includes(nombreUsuario.split(' ')[0].toUpperCase());
    html += `<tr style="${esMiFila?'background:rgba(167,139,250,0.06);':''}">`;
    html += `<td style="padding:7px 10px;font-family:var(--font-head);font-size:0.8rem;color:${esMiFila?'#c4b5fd':'#cbd5e1'};font-weight:${esMiFila?'700':'400'};white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.04);">${esMiFila?'👤 ':''}${nombreCorto(p.nombre)}</td>`;
    dias.forEach(d => {
      const val = p.dias[d] || '';
      const turno = normalizarTurno(val);
      const cfg = CFG[turno] || CFG.LIBRE;
      const esHoy = d === diaHoy;
      const es12h = turno === 'MANANA12' || turno === 'NOCHE12';
      const bg12h = es12h ? cfg.bg.replace('0.1)', '0.3)') : (esHoy ? 'rgba(167,139,250,0.06)' : 'transparent');
      const extra12h = es12h ? `box-shadow:inset 0 0 0 1.5px ${cfg.color};border-radius:3px;` : '';
      html += `<td style="padding:5px 2px;text-align:center;font-family:var(--font-mono);font-size:0.72rem;color:${val?cfg.color:'#1e293b'};font-weight:${es12h?'700':cfg.estrack?'700':'500'};border-bottom:1px solid rgba(255,255,255,0.04);background:${bg12h};${extra12h}">${val||'—'}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';

  const refs = [
    {v:'6',label:'Mañana 8hs'},{v:'14',label:'Tarde 8hs'},{v:'22',label:'Noche 8hs'},
    {v:'6-12',label:'Mañana 12hs'},{v:'18-12',label:'Noche 12hs'},
    {v:'F',label:'Franco'},{v:'FC',label:'Franco comp.'},{v:'FT',label:'Franco trab.'},
    {v:'FT12',label:'Franco trab. 12hs'},{v:'B',label:'Boleta'},{v:'V',label:'Vacaciones'},
    {v:'MD',label:'Manejo def.'},{v:'PG',label:'Perm. gremial'},{v:'RM',label:'Rev. médica'},
  ];
  let refsHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding:8px 0;">';
  refs.forEach(r => {
    const t = normalizarTurno(r.v);
    const col = CFG[t]?.color || '#475569';
    refsHTML += `<span style="font-family:var(--font-mono);font-size:0.6rem;color:${col};background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);padding:3px 8px;border-radius:6px;">${r.v} — ${r.label}</span>`;
  });
  refsHTML += '</div>';

  document.getElementById('diagrama-tabla-inner').innerHTML = html + refsHTML;
  if(document.getElementById('diagrama-mes-label-tabla'))
    document.getElementById('diagrama-mes-label-tabla').textContent = diagramaActual.mesNombre || '';
}

async function cargarDiagrama() {
  const mesInput = document.getElementById('diagrama-mes-input').value;
  const jsonInput = document.getElementById('diagrama-json-input').value.trim();
  if(!mesInput) { showToast('Ingresá el mes y año', true); return; }
  if(!jsonInput) { showToast('Pegá el JSON del diagrama', true); return; }
  let datos;
  try { datos = JSON.parse(jsonInput); }
  catch(e) { showToast('El JSON no es válido', true); return; }
  const [anio, mes] = mesInput.split('-');
  const mesNombre = MESES[parseInt(mes)-1]+' '+anio;
  try {
    setSyncStatus('syncing','🔄 Guardando...');
    const ref = await addDoc(collection(db,'diagramas'), {
      mes: mesInput, mesNombre, datos,
      timestamp: serverTimestamp(),
      cargadoPor: auth.currentUser?.email || ''
    });
    setSyncStatus('online','🟢 Online');
    showToast('✔ Diagrama guardado', false);
    document.getElementById('diagrama-json-input').value = '';
    diagramaActual = { mes: mesInput, mesNombre, datos };
    diagramaActualId = ref.id;
    setVistasDiagrama(vistaActual);
  } catch(e) {
    showToast('Error al guardar diagrama', true);
    console.error(e);
  }
}
window.cargarDiagrama = cargarDiagrama;

async function eliminarDiagrama() {
  if(!diagramaActualId) { showToast('No hay diagrama cargado', true); return; }
  if(!confirm('¿Eliminar el diagrama actual de Firestore? Esta acción no se puede deshacer.')) return;
  try {
    setSyncStatus('syncing','🔄 Eliminando...');
    await deleteDoc(doc(db,'diagramas',diagramaActualId));
    setSyncStatus('online','🟢 Online');
    showToast('Diagrama eliminado', false);
    diagramaActual = null;
    diagramaActualId = null;
    setVistasDiagrama(vistaActual);
  } catch(e) {
    showToast('Error al eliminar diagrama', true);
    setSyncStatus('online','🟢 Online');
    console.error(e);
  }
}
window.eliminarDiagrama = eliminarDiagrama;
