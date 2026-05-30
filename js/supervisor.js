import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebase-init.js?v=20260530';

window.cargarNovedadesSupervisor = async function() {
  const fechaVal = document.getElementById('sup-fecha').value;
  const plantaFiltro = document.getElementById('sup-planta').value;
  const container = document.getElementById('sup-novedades-container');
  container.innerHTML = '<div class="no-registros">Cargando novedades...</div>';

  let fechaFiltro = '';
  if (fechaVal) {
    const [y, m, d] = fechaVal.split('-');
    fechaFiltro = `${d}/${m}/${y}`;
  }

  try {
    const q = query(collection(db,'registros'), orderBy('timestamp','desc'));
    const snap = await getDocs(q);
    if(snap.empty) { container.innerHTML='<div class="no-registros">Sin novedades aún.</div>'; return; }

    const novedades = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => {
        const nov = r.datos?.['Novedades'];
        if(!nov || nov === '—' || nov.trim() === '') return false;
        if(fechaFiltro && r.fecha !== fechaFiltro) return false;
        if(plantaFiltro !== 'todas' && r.planta !== plantaFiltro) return false;
        return true;
      });

    if(novedades.length === 0) {
      container.innerHTML = '<div class="no-registros">📭 Sin novedades en el período seleccionado.</div>';
      return;
    }

    container.innerHTML = novedades.map(r => {
      const turnoIcon = r.turno === 'Mañana' ? '☀' : r.turno === 'Tarde' ? '🌤' : '🌙';
      return `<div class="reg-card">
        <div style="padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <div style="font-family:var(--font-mono);font-size:0.85rem;color:var(--accent);">📅 ${r.fecha} — Planta ${r.planta}</div>
            <div style="font-family:var(--font-mono);font-size:0.8rem;color:var(--yellow)">${turnoIcon} Turno ${r.turno}</div>
          </div>
          <div style="background:rgba(0,200,255,0.06);border-radius:6px;padding:10px 12px;font-size:0.95rem;color:var(--text);line-height:1.5">
            📝 ${r.datos['Novedades']}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error(e);
    container.innerHTML = '<div class="no-registros">❌ Error al cargar. Intentá de nuevo.</div>';
  }
};
