import { cargarUltimoNivel } from '/js/plantas.js';
import '/js/supervisor.js';
import '/js/auth.js';
import '/js/parte.js';
import '/js/diagrama.js';

const plantNavBtns = document.querySelectorAll('.plant-tab');
plantNavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const planta = btn.textContent.trim();
    if(['23T','PPA','17T','ED1'].includes(planta)) {
      cargarUltimoNivel(planta);
    }
  });
});

const plantMap = {'23t':'panel-23t','17t':'panel-17t','ppa':'panel-ppa','ed1':'panel-ed1','ec19':'panel-ec19','aguada':'panel-aguada','o87':'panel-o87','parte':'panel-parte','diagrama':'panel-diagrama'};
window.showPlant = function(id, btn) {
  document.querySelectorAll('.plant-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.plant-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(plantMap[id]).classList.add('active');
  btn.classList.add('active');
  if(id === 'parte') window.cargarDatosParte();
  if(id === 'diagrama') window.renderDiagrama();
};
