import { collection, query, orderBy, where, limit, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebase-init.js?v=20260604';

let keywordTimer = null;

function getNDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function getDayRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: Timestamp.fromDate(new Date(y, m - 1, d, 0, 0, 0, 0)),
    end:   Timestamp.fromDate(new Date(y, m - 1, d, 23, 59, 59, 999))
  };
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export async function cargarNovedadesSupervisor() {
  const fechaVal     = document.getElementById('sup-fecha').value;
  const plantaFiltro = document.getElementById('sup-planta').value;
  const keyword      = (document.getElementById('sup-keyword')?.value || '').trim().toLowerCase();
  const rangoVal     = document.querySelector('input[name="sup-rango"]:checked')?.value || 'semana';
  const container    = document.getElementById('sup-novedades-container');
  container.innerHTML = '<div class="no-registros">Cargando novedades...</div>';

  let q;

  if (keyword) {
    const desde = getNDaysAgo(rangoVal === 'mes' ? 30 : 7);
    q = query(collection(db,'registros'), where('timestamp','>=',desde), orderBy('timestamp','desc'), limit(500));
  } else if (fechaVal) {
    const { start, end } = getDayRange(fechaVal);
    q = query(collection(db,'registros'), where('timestamp','>=',start), where('timestamp','<=',end), orderBy('timestamp','desc'), limit(200));
  } else {
    q = query(collection(db,'registros'), where('timestamp','>=',getNDaysAgo(7)), orderBy('timestamp','desc'), limit(500));
  }

  try {
    const snap = await getDocs(q);
    if (snap.empty) {
      container.innerHTML = '<div class="no-registros">📭 Sin registros en el período.</div>';
      return;
    }

    const novedades = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => {
        const nov = r.datos?.['Novedades'];
        if (!nov || nov === '—' || nov.trim() === '') return false;
        if (plantaFiltro !== 'todas' && r.planta !== plantaFiltro) return false;
        if (keyword && !nov.toLowerCase().includes(keyword)) return false;
        return true;
      });

    if (novedades.length === 0) {
      container.innerHTML = '<div class="no-registros">📭 Sin novedades en el período seleccionado.</div>';
      return;
    }

    container.innerHTML = novedades.map(r => {
      const turnoIcon = r.turno === 'Mañana' ? '☀' : r.turno === 'Tarde' ? '🌤' : '🌙';
      let novContent;
      if (keyword) {
        const safeKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        novContent = escapeHtml(r.datos['Novedades']).replace(
          new RegExp(safeKw, 'gi'),
          m => `<mark style="background:rgba(255,214,0,0.2);color:var(--yellow);border-radius:2px;padding:0 2px">${m}</mark>`
        );
      } else {
        novContent = r.datos['Novedades'];
      }
      return `<div class="reg-card">
        <div style="padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <div style="font-family:var(--font-mono);font-size:0.85rem;color:var(--accent)">📅 ${r.fecha} — Planta ${r.planta}</div>
            <div style="font-family:var(--font-mono);font-size:0.8rem;color:var(--yellow)">${turnoIcon} Turno ${r.turno}</div>
          </div>
          <div style="background:rgba(0,200,255,0.06);border-radius:6px;padding:10px 12px;font-size:0.95rem;color:var(--text);line-height:1.5">
            📝 ${novContent}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error(e);
    container.innerHTML = '<div class="no-registros">❌ Error al cargar. Intentá de nuevo.</div>';
  }
}

window.cargarNovedadesSupervisor = cargarNovedadesSupervisor;

window.supOnFecha = function() {
  document.getElementById('sup-keyword').value = '';
  document.getElementById('sup-rango-container').style.display = 'none';
  cargarNovedadesSupervisor();
};

window.supOnKeyword = function() {
  document.getElementById('sup-fecha').value = '';
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(cargarNovedadesSupervisor, 400);
};
