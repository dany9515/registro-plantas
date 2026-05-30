import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from '/js/firebase-init.js';
import { showToast, setSyncStatus } from '/js/ui.js';
import { ultimoRegistroPorPlanta } from '/js/plantas.js';

function calcTotal(campo) {
  const ant = parseFloat(document.getElementById('p-'+campo+'-ant')?.value);
  const act = parseFloat(document.getElementById('p-'+campo+'-act')?.value);
  const totEl = document.getElementById('p-'+campo+'-tot');
  if(!totEl) return;
  if(!isNaN(ant) && !isNaN(act)) {
    const tot = (act - ant).toFixed(2);
    totEl.textContent = tot;
    totEl.style.color = parseFloat(tot) >= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    totEl.textContent = '—';
    totEl.style.color = 'var(--green)';
  }
  calcTotalGeneral();
}
window.calcTotal = calcTotal;

function calcTotalGeneral() {
  const campos = ['cargadero-ppa','23t-ppa','23t-17t','caudalimetro-23t','recirc-23t','17t-23t'];
  let suma = 0; let validos = 0;
  campos.forEach(c => {
    const txt = document.getElementById('p-'+c+'-tot')?.textContent;
    const n = parseFloat(txt);
    if(!isNaN(n)) { suma += n; validos++; }
  });
  const el = document.getElementById('p-interplantas-total');
  if(el) el.textContent = validos > 0 ? suma.toFixed(2) : '—';
}

async function cargarDatosParte() {
  const fecha = document.getElementById('meta-fecha').value;
  try {
    const q = query(collection(db,'partes'), where('fecha','==',fecha), orderBy('timestamp','desc'));
    const snap = await getDocs(q);
    if(!snap.empty) {
      cargarParteGuardado(snap.docs[0].data());
      bloquearParte();
      return;
    }
  } catch(e) { console.error(e); }

  const nombreRec = document.getElementById('meta-recorredor').value;
  if(nombreRec) document.getElementById('parte-rec1').value = nombreRec;

  await cargarAcumuladosActuales(fecha);
  await cargarAcumuladosAnteriores(fecha);
  cargarQuimicosAutomaticos();
  cargarCierreMicromotion();

  ['cargadero-ppa','23t-ppa','23t-17t','caudalimetro-23t','recirc-23t','17t-23t',
   'represa','o87-sal','ec19-sal'].forEach(c => calcTotal(c));
}
window.cargarDatosParte = cargarDatosParte;

async function cargarAcumuladosActuales(fecha) {
  try {
    const q23T = query(collection(db,'registros'),
      where('planta','==','23T'), where('fecha','==',fecha), where('turno','==','Noche'),
      orderBy('timestamp','desc'));
    const snap23T = await getDocs(q23T);
    if(!snap23T.empty) {
      const d = snap23T.docs[0].data().datos || {};
      setParteAct('p-23t-ppa-act', d['Acum. A PPA']);
      setParteAct('p-23t-17t-act', d['Acum. A 17T y ED']);
      setParteAct('p-recirc-23t-act', d['Acum. Recirculación']);
    }
  } catch(e) { console.error(e); }

  try {
    const qPPA = query(collection(db,'registros'),
      where('planta','==','PPA'), where('fecha','==',fecha), where('turno','==','Noche'),
      orderBy('timestamp','desc'));
    const snapPPA = await getDocs(qPPA);
    if(!snapPPA.empty) {
      const d = snapPPA.docs[0].data().datos || {};
      setParteAct('p-cargadero-ppa-act', d['Acum. Cargadero']);
    }
  } catch(e) { console.error(e); }

  try {
    const qAG = query(collection(db,'registros'),
      where('planta','==','AGUADA'), where('fecha','==',fecha), where('turno','==','Noche'),
      orderBy('timestamp','desc'));
    const snapAG = await getDocs(qAG);
    if(!snapAG.empty) {
      const d = snapAG.docs[0].data().datos || {};
      setParteAct('p-represa-act', d['Acum. Aguada']);
    }
  } catch(e) { console.error(e); }

  try {
    const qO87 = query(collection(db,'registros'),
      where('planta','==','O87'), where('fecha','==',fecha), where('turno','==','Noche'),
      orderBy('timestamp','desc'));
    const snapO87 = await getDocs(qO87);
    if(!snapO87.empty) {
      const d = snapO87.docs[0].data().datos || {};
      setParteAct('p-o87-sal-act', d['Acum. O87']);
    }
  } catch(e) { console.error(e); }
}

async function cargarAcumuladosAnteriores(fechaHoy) {
  try {
    const q = query(collection(db,'partes'), orderBy('timestamp','desc'));
    const snap = await getDocs(q);
    if(snap.empty) return;
    const parteAnt = snap.docs.find(d => d.data().fecha !== fechaHoy);
    if(!parteAnt) return;
    const datos = parteAnt.data().acumulados || {};
    const mapAnt = {
      'p-cargadero-ppa-ant': datos['cargadero-ppa-act'],
      'p-23t-ppa-ant':       datos['23t-ppa-act'],
      'p-23t-17t-ant':       datos['23t-17t-act'],
      'p-caudalimetro-23t-ant': datos['caudalimetro-23t-act'],
      'p-recirc-23t-ant':    datos['recirc-23t-act'],
      'p-17t-23t-ant':       datos['17t-23t-act'],
      'p-represa-ant':       datos['represa-act'],
      'p-o87-sal-ant':       datos['o87-sal-act'],
      'p-ec19-sal-ant':      datos['ec19-sal-act'],
    };
    Object.entries(mapAnt).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if(el && val && val !== '—') el.value = val;
    });
  } catch(e) { console.error(e); }
}

function cargarQuimicosAutomaticos() {
  const d23 = ultimoRegistroPorPlanta['23T']?.datos || {};
  setParteQuim('p-23t-desem-nivel',  d23['Desemulsionante Nivel']);
  setParteQuim('p-23t-desem-dial',   d23['Desemulsionante Dial']);
  setParteQuim('p-23t-clar-nivel',   d23['Clarificante Nivel']);
  setParteQuim('p-23t-clar-dial',    d23['Clarificante Dial']);
  setParteQuim('p-23t-verza1-nivel', d23['Verza 2510(1) Nivel']);
  setParteQuim('p-23t-verza1-dial',  d23['Verza 2510(1) Dial']);
  setParteQuim('p-23t-verza2-nivel', d23['Verza 2510(2) Nivel']);
  setParteQuim('p-23t-verza2-dial',  d23['Verza 2510(2) Dial']);
  const dEC = ultimoRegistroPorPlanta['EC19']?.datos || {};
  setParteQuim('p-ec19-desem-nivel',  dEC['Desemulsionante Nivel']);
  setParteQuim('p-ec19-desem-dial',   dEC['Desemulsionante Dial']);
  setParteQuim('p-ec19-clar-nivel',   dEC['Clarificante Nivel']);
  setParteQuim('p-ec19-clar-dial',    dEC['Clarificante Dial']);
  setParteQuim('p-ec19-verza1-nivel', dEC['Verza 2510(1) Nivel']);
  setParteQuim('p-ec19-verza1-dial',  dEC['Verza 2510(1) Dial']);
  setParteQuim('p-ec19-verza2-nivel', dEC['Verza 2510(2) Nivel']);
  setParteQuim('p-ec19-verza2-dial',  dEC['Verza 2510(2) Dial']);
}

function cargarCierreMicromotion() {
  const d23 = ultimoRegistroPorPlanta['23T']?.datos || {};
  const dEC = ultimoRegistroPorPlanta['EC19']?.datos || {};
  const micro23 = d23['Cierre MicroMotion'];
  const microEC = dEC['Cierre MicroMotion'];
  const el23 = document.getElementById('p-23t-cierre-micro-display');
  const elEC = document.getElementById('p-ec19-cierre-micro-display');
  if(el23) el23.innerHTML = (micro23 && micro23!=='—') ? `<strong>${micro23}</strong> m³/día` : '— m³/día <span style="font-size:0.7rem;color:var(--muted)">(automático)</span>';
  if(elEC) elEC.innerHTML = (microEC && microEC!=='—') ? `<strong>${microEC}</strong> m³/día` : '— m³/día <span style="font-size:0.7rem;color:var(--muted)">(automático)</span>';
}

function setParteAct(id, val) {
  const el = document.getElementById(id);
  if(el && val && val !== '—') el.value = val;
}

function setParteQuim(id, val) {
  const el = document.getElementById(id);
  if(el) el.textContent = (val && val !== '—') ? val : '—';
}

function bloquearParte() {
  const panel = document.getElementById('panel-parte');
  panel.classList.add('parte-bloqueado');
  panel.querySelectorAll('input').forEach(i => { i.readOnly = true; i.style.opacity='0.6'; });
  const banner = document.getElementById('parte-banner-bloqueado');
  if(banner) banner.style.display = 'flex';
  const btnPdf = document.getElementById('btn-parte-pdf');
  if(btnPdf) { btnPdf.textContent = '✅ PARTE YA GENERADO — Ver PDF'; btnPdf.style.background = 'linear-gradient(135deg,#059669,#047857)'; btnPdf.onclick = verUltimoPDF; }
}

function cargarParteGuardado(datos) {
  const ac = datos.acumulados || {};
  Object.entries(ac).forEach(([id, val]) => {
    const el = document.getElementById('p-'+id);
    if(el && val) {
      if(el.tagName === 'INPUT') el.value = val;
      else el.textContent = val;
    }
  });
  ['cargadero-ppa','23t-ppa','23t-17t','caudalimetro-23t','recirc-23t','17t-23t',
   'represa','o87-sal','ec19-sal'].forEach(c => calcTotal(c));
  const niv = datos.niveles || {};
  Object.entries(niv).forEach(([id, val]) => {
    const el = document.getElementById('p-'+id);
    if(el && val) { if(el.tagName==='INPUT') el.value=val; else el.textContent=val; }
  });
  const quim = datos.quimicos || {};
  Object.entries(quim).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if(el && val) el.textContent = val;
  });
  const bannerFecha = document.getElementById('parte-banner-fecha');
  if(bannerFecha) bannerFecha.textContent = `Generado el ${datos.fecha} a las ${datos.hora}`;
}

async function generarPartePDF() {
  const fecha = document.getElementById('meta-fecha').value;
  const rec1 = document.getElementById('parte-rec1').value || '—';
  const rec2 = document.getElementById('parte-rec2').value || '—';
  const now = new Date();
  const hora = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');

  const acumulados = {};
  ['cargadero-ppa','23t-ppa','23t-17t','caudalimetro-23t','recirc-23t','17t-23t',
   'represa','o87-sal','ec19-sal'].forEach(campo => {
    ['ant','act','pres','caudal'].forEach(suf => {
      const el = document.getElementById('p-'+campo+'-'+suf);
      if(el) acumulados[campo+'-'+suf] = el.value || '—';
    });
    const tot = document.getElementById('p-'+campo+'-tot');
    if(tot) acumulados[campo+'-tot'] = tot.textContent;
  });

  const niveles = {};
  ['23t-tk-skimmer','23t-tk-inyector','23t-interfaz','23t-psi','23t-despacho',
   'ec19-tk-cortador','ec19-interfaz','ec19-psi','ec19-despacho',
   'ppa-altura','ppa-psi','17t-altura','17t-psi','ed-altura','ed-psi'].forEach(id => {
    const el = document.getElementById('p-'+id);
    if(el) niveles[id] = el.value || '—';
  });
  niveles['23t-cierre-micro'] = document.getElementById('p-23t-cierre-micro-display')?.textContent || '—';
  niveles['ec19-cierre-micro'] = document.getElementById('p-ec19-cierre-micro-display')?.textContent || '—';

  const quimicos = {};
  ['p-23t-desem-nivel','p-23t-desem-dial','p-23t-clar-nivel','p-23t-clar-dial',
   'p-23t-verza1-nivel','p-23t-verza1-dial','p-23t-verza2-nivel','p-23t-verza2-dial',
   'p-ec19-desem-nivel','p-ec19-desem-dial','p-ec19-clar-nivel','p-ec19-clar-dial',
   'p-ec19-verza1-nivel','p-ec19-verza1-dial','p-ec19-verza2-nivel','p-ec19-verza2-dial'].forEach(id => {
    quimicos[id] = document.getElementById(id)?.textContent || '—';
  });

  try {
    setSyncStatus('syncing','🔄 Guardando parte...');
    await addDoc(collection(db,'partes'), {
      fecha, hora, rec1, rec2,
      acumulados, niveles, quimicos,
      timestamp: serverTimestamp(),
      userEmail: auth.currentUser?.email || ''
    });
    setSyncStatus('online','🟢 Online');
    showToast('✔ Parte guardado correctamente', false);
  } catch(e) {
    showToast('❌ Error al guardar parte', true);
    console.error(e);
    return;
  }

  generarPDFVisual({ fecha, hora, rec1, rec2, acumulados, niveles, quimicos });
  bloquearParte();
}
window.generarPartePDF = generarPartePDF;

function generarPDFVisual(datos) {
  const { fecha, hora, rec1, rec2, acumulados: ac, niveles: niv, quimicos: quim } = datos;

  const td = (v, extra) => '<td style="padding:5px 8px;border:1px solid #ddd;text-align:center;font-size:12px;'+(extra||'')+'">'+( v||'—')+'<\/td>';
  const tdL = (v) => '<td style="padding:5px 8px;border:1px solid #ddd;font-size:12px;">'+(v||'—')+'<\/td>';

  const fila = (nombre, campo) => {
    const ant = ac[campo+'-ant']||'—', act = ac[campo+'-act']||'—';
    const tot = ac[campo+'-tot']||'—', pres = ac[campo+'-pres']||'—', caudal = ac[campo+'-caudal']||'—';
    return '<tr>'+tdL(nombre)+td(ant)+td(act)+td(tot,'font-weight:700;color:#16a34a;')+td(pres)+td(caudal)+'<\/tr>';
  };
  const filaQuim = (nombre, idNivel, idDial) =>
    '<tr>'+tdL(nombre)+td(quim[idNivel]||'—')+td(quim[idDial]||'—')+'<\/tr>';

  const seccion = (titulo) => '<div style="background:#e8f4ff;padding:6px 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1e3a5f;border-left:3px solid #1e3a5f;margin:12px 0 6px;">'+titulo+'<\/div>';
  const thRow = (...cols) => '<thead><tr>'+cols.map(c=>'<th style="background:#1e3a5f;color:#fff;padding:6px 8px;font-size:11px;text-transform:uppercase;border:1px solid #1e3a5f;">'+c+'<\/th>').join('')+'<\/tr><\/thead>';
  const tabla = (cabecera, cuerpo) => '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">'+cabecera+'<tbody>'+cuerpo+'<\/tbody><\/table>';

  const partes = [];
  partes.push('<!DOCTYPE html>');
  partes.push('<html lang="es"><head><meta charset="UTF-8">');
  partes.push('<title>Parte Nocturno '+fecha+'<\/title>');
  partes.push('<style>body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#111;font-size:13px;}h1{font-size:15px;text-align:center;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;}.sub{text-align:center;font-size:11px;color:#555;margin-bottom:16px;}.meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;background:#f3f4f6;padding:8px 12px;border-radius:6px;margin-bottom:14px;font-size:12px;}.firmas{display:flex;gap:40px;margin-top:24px;}.firma-box{flex:1;border-top:1px solid #333;padding-top:8px;text-align:center;font-size:11px;color:#555;}@media print{body{padding:10px;}}<\/style>');
  partes.push('<\/head><body>');
  partes.push('<h1>Parte de Cierre Producción — Pozos de Captación<\/h1>');
  partes.push('<div class="sub">TURNO NOCHE<\/div>');
  partes.push('<div class="meta"><span>Fecha: <strong>'+fecha+'<\/strong><\/span><span>Hora: <strong>'+hora+' hs<\/strong><\/span><span>Rec. 1: <strong>'+rec1+'<\/strong><\/span><span>Rec. 2: <strong>'+rec2+'<\/strong><\/span><\/div>');

  const camposInter = ['cargadero-ppa','23t-ppa','23t-17t','caudalimetro-23t','recirc-23t','17t-23t'];
  const totalInter = camposInter.reduce((s,c) => { const v=parseFloat(ac[c+'-tot']); return s+(isNaN(v)?0:v); },0).toFixed(2);
  partes.push(seccion('Medidores de Acueductos Interplantas'));
  partes.push(tabla(
    thRow('Caudalímetro','Acum. Ant.','Acum. Actual','Total (m³)','Presión (kg/cm²)','Caudal'),
    fila('Cargadero PPA','cargadero-ppa')+
    fila('Salida 23T → PPA','23t-ppa')+
    fila('Salida 23T → 17T/ED','23t-17t')+
    fila('Caudalímetro 23T','caudalimetro-23t')+
    fila('Recirculación 23T','recirc-23t')+
    fila('Ingreso 17T','17t-23t')+
    '<tr style="background:#f0fdf4;"><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;font-weight:700;letter-spacing:0.5px;">TOTAL INTERPLANTAS<\/td><td colspan="2" style="border:1px solid #ccc;"><\/td><td style="padding:5px 8px;border:1px solid #ccc;text-align:center;font-weight:700;color:#16a34a;font-size:13px;">'+totalInter+'<\/td><td colspan="2" style="border:1px solid #ccc;"><\/td><\/tr>'
  ));

  partes.push(seccion('Medidores de Salida a Plantas'));
  partes.push(tabla(
    thRow('Caudalímetro','Acum. Ant.','Acum. Actual','Total (m³)','Presión (kg/cm²)','Caudal'),
    fila('Represa (AGNorte)','represa')+
    fila('O87','o87-sal')+
    fila('EC19','ec19-sal')
  ));

  partes.push(seccion('Niveles Planta 23T'));
  partes.push(tabla(
    thRow('TK Skimmer (m)','TK Inyector (m)','Interfaz (m)','PSI','Despacho (m)','Cierre MicroMotion (m³/día)'),
    '<tr>'+td(niv['23t-tk-skimmer'])+td(niv['23t-tk-inyector'])+td(niv['23t-interfaz'])+td(niv['23t-psi'])+td(niv['23t-despacho'])+td(niv['23t-cierre-micro'],'font-weight:700;')+'<\/tr>'
  ));

  partes.push(seccion('Niveles Planta EC19'));
  partes.push(tabla(
    thRow('TK Cortador (m)','Interfaz (m)','PSI','Despacho (m)','Cierre MicroMotion (m³/día)'),
    '<tr>'+td(niv['ec19-tk-cortador'])+td(niv['ec19-interfaz'])+td(niv['ec19-psi'])+td(niv['ec19-despacho'])+td(niv['ec19-cierre-micro'],'font-weight:700;')+'<\/tr>'
  ));

  partes.push(seccion('PPA / 17T / ED'));
  partes.push(tabla(
    thRow('Planta','Altura TK','PSI'),
    '<tr>'+tdL('PPA')+td(niv['ppa-altura'])+td(niv['ppa-psi'])+'<\/tr>'+
    '<tr>'+tdL('17T')+td(niv['17t-altura'])+td(niv['17t-psi'])+'<\/tr>'+
    '<tr>'+tdL('ED')+td(niv['ed-altura'])+td(niv['ed-psi'])+'<\/tr>'
  ));

  partes.push(seccion('Dosificación Químicos — 23T'));
  partes.push(tabla(
    thRow('Químico','Nivel (cm)','Dial bomba'),
    filaQuim('Desemulsionante','p-23t-desem-nivel','p-23t-desem-dial')+
    filaQuim('Clarificante','p-23t-clar-nivel','p-23t-clar-dial')+
    filaQuim('Verza 2510 (1)','p-23t-verza1-nivel','p-23t-verza1-dial')+
    filaQuim('Verza 2510 (2)','p-23t-verza2-nivel','p-23t-verza2-dial')
  ));

  partes.push(seccion('Dosificación Químicos — EC19'));
  partes.push(tabla(
    thRow('Químico','Nivel (cm)','Dial bomba'),
    filaQuim('Desemulsionante','p-ec19-desem-nivel','p-ec19-desem-dial')+
    filaQuim('Clarificante','p-ec19-clar-nivel','p-ec19-clar-dial')+
    filaQuim('Verza 2510 (1)','p-ec19-verza1-nivel','p-ec19-verza1-dial')+
    filaQuim('Verza 2510 (2)','p-ec19-verza2-nivel','p-ec19-verza2-dial')
  ));

  partes.push('<div class="firmas"><div class="firma-box">Firma y Aclaracion<br><strong>'+rec1+'<\/strong><\/div><div class="firma-box">Firma y Aclaracion<br><strong>'+rec2+'<\/strong><\/div><\/div>');
  partes.push('<div style="text-align:center;margin-top:20px;font-size:10px;color:#aaa;">Generado por OilLog — OperLog · '+fecha+' '+hora+'hs<\/div>');
  partes.push('<\/body><\/html>');

  const html = partes.join('\n');
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const win = window.open(url,'_blank');
  if(win) setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 800);
  else { const a = document.createElement('a'); a.href=url; a.download='Parte_Noche_'+fecha.replace(/\//g,'-')+'.html'; a.click(); URL.revokeObjectURL(url); }
}

async function verUltimoPDF() {
  const fecha = document.getElementById('meta-fecha').value;
  try {
    const q = query(collection(db,'partes'), where('fecha','==',fecha), orderBy('timestamp','desc'));
    const snap = await getDocs(q);
    if(!snap.empty) generarPDFVisual(snap.docs[0].data());
  } catch(e) { showToast('Error al cargar parte', true); }
}
window.verUltimoPDF = verUltimoPDF;
