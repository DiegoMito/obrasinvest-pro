/* ===================================================
   ObrasInvest Pro — app.js
   Clean rewrite · No console errors
   =================================================== */

'use strict';

// ─── PALETTE ────────────────────────────────────────────────────
var PALETTE = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

// ─── STATE ──────────────────────────────────────────────────────
var KEY = 'obrasinvest_pro_v1';
var db = { obras: [], socios: [], lancamentos: [] };
var chartPizza = null;
var chartBar   = null;
var confirmCb  = null;

function dbLoad() {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) db = JSON.parse(raw);
  } catch (e) { /* ignore */ }
}
function dbSave() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

// ─── HELPERS ────────────────────────────────────────────────────
function uid(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
}

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(n) {
  return (Number(n) * 100).toFixed(1) + '%';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(str) {
  if (!str) return '—';
  var p = str.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function initials(name) {
  return (name || '??').trim().slice(0, 2).toUpperCase();
}

function colorFor(i) {
  return PALETTE[i % PALETTE.length];
}

function getEl(id) { return document.getElementById(id); }

// ─── CALCULOS ───────────────────────────────────────────────────
function calcObra(obraId) {
  var obra  = db.obras.find(function(o) { return o.id === obraId; });
  var lancs = db.lancamentos.filter(function(l) { return l.obraId === obraId; });

  var totalAportes  = 0;
  var totalDespesas = 0;

  lancs.forEach(function(l) {
    if (l.tipo === 'Aporte')  totalAportes  += l.valor;
    else                      totalDespesas += l.valor;
  });

  var custoTotal   = totalAportes + totalDespesas;
  var valorVenda   = obra ? (obra.valorVenda || 0) : 0;
  var temCorr      = obra ? (obra.corretagem === 'sim') : false;
  var percCorr     = obra ? (obra.percCorretagem || 0) : 0;
  var vlrCorr      = temCorr ? (valorVenda * percCorr / 100) : 0;
  var vendaLiquida = valorVenda - vlrCorr;
  var lucro        = vendaLiquida > 0 ? vendaLiquida - custoTotal : (valorVenda > 0 ? valorVenda - custoTotal : 0);
  if (valorVenda === 0) lucro = 0;

  // por socio
  var porSocio = {};
  db.socios.forEach(function(s) { porSocio[s.id] = 0; });
  lancs.forEach(function(l) {
    if (!porSocio[l.socioId]) porSocio[l.socioId] = 0;
    porSocio[l.socioId] += l.valor;
  });

  var totalGeral = Object.values(porSocio).reduce(function(a, b) { return a + b; }, 0);

  var percentual = {};
  var lucroPorSocio = {};
  Object.keys(porSocio).forEach(function(id) {
    percentual[id]    = totalGeral > 0 ? porSocio[id] / totalGeral : 0;
    lucroPorSocio[id] = percentual[id] * lucro;
  });

  return {
    totalAportes: totalAportes,
    totalDespesas: totalDespesas,
    custoTotal: custoTotal,
    valorVenda: valorVenda,
    vlrCorr: vlrCorr,
    percCorr: percCorr,
    temCorr: temCorr,
    vendaLiquida: vendaLiquida,
    lucro: lucro,
    porSocio: porSocio,
    percentual: percentual,
    lucroPorSocio: lucroPorSocio
  };
}

function calcGlobal(obraId) {
  var obras = obraId
    ? db.obras.filter(function(o) { return o.id === obraId; })
    : db.obras;
  var ids = obras.map(function(o) { return o.id; });
  var lancs = db.lancamentos.filter(function(l) { return ids.indexOf(l.obraId) !== -1; });

  var totalAportes  = 0;
  var totalDespesas = 0;
  lancs.forEach(function(l) {
    if (l.tipo === 'Aporte')  totalAportes  += l.valor;
    else                      totalDespesas += l.valor;
  });
  var custoTotal = totalAportes + totalDespesas;
  var valorVenda = obras.reduce(function(s, o) { return s + (o.valorVenda || 0); }, 0);
  var lucro = valorVenda > 0 ? valorVenda - custoTotal : 0;

  var porSocio = {};
  db.socios.forEach(function(s) { porSocio[s.id] = 0; });
  lancs.forEach(function(l) {
    if (!porSocio[l.socioId]) porSocio[l.socioId] = 0;
    porSocio[l.socioId] += l.valor;
  });

  return { totalAportes: totalAportes, totalDespesas: totalDespesas, custoTotal: custoTotal, valorVenda: valorVenda, lucro: lucro, porSocio: porSocio };
}

// ─── TOAST ──────────────────────────────────────────────────────
var toastTimer = null;
function toast(msg, type) {
  var el = getEl('toast');
  el.textContent = msg;
  el.className = 'toast show';
  if (type === 'error')   el.style.borderLeft = '4px solid #ef4444';
  else if (type === 'ok') el.style.borderLeft = '4px solid #10b981';
  else                    el.style.borderLeft = 'none';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.className = 'toast'; }, 3000);
}

// ─── MODALS ─────────────────────────────────────────────────────
function openModal(id) { getEl(id).classList.add('open'); }
function closeModal(id) { getEl(id).classList.remove('open'); }

document.addEventListener('click', function(e) {
  var cl = e.target.closest('[data-close]');
  if (cl) closeModal(cl.dataset.close);
  var bg = e.target.classList.contains('modal-bg') ? e.target : null;
  if (bg) bg.classList.remove('open');
});

// ─── CONFIRM ────────────────────────────────────────────────────
function confirmDel(msg, cb) {
  getEl('confirmMsg').textContent = msg;
  confirmCb = cb;
  openModal('modalConfirm');
}
getEl('btnConfirmDel').addEventListener('click', function() {
  if (confirmCb) confirmCb();
  confirmCb = null;
  closeModal('modalConfirm');
});

// ─── NAVIGATION ─────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function(el) { el.classList.remove('active'); });
  getEl('page-' + page).classList.add('active');
  var link = document.querySelector('.nav-link[data-page="' + page + '"]');
  if (link) link.classList.add('active');
  closeSidebar();
  renderPage(page);
}

function renderPage(page) {
  updateNavCounts();
  if (page === 'dashboard')   renderDashboard();
  if (page === 'obras')       renderObras();
  if (page === 'socios')      renderSocios();
  if (page === 'lancamentos') renderLancamentos();
  if (page === 'relatorio')   renderRelatorio();
}

document.querySelectorAll('.nav-link').forEach(function(el) {
  el.addEventListener('click', function(e) {
    e.preventDefault();
    navigate(el.dataset.page);
  });
});

function updateNavCounts() {
  getEl('countObras').textContent  = db.obras.length;
  getEl('countSocios').textContent = db.socios.length;
}

// ─── SIDEBAR MOBILE ─────────────────────────────────────────────
function closeSidebar() {
  getEl('sidebar').classList.remove('open');
  getEl('overlay').classList.remove('show');
}
getEl('burger').addEventListener('click', function() {
  getEl('sidebar').classList.toggle('open');
  getEl('overlay').classList.toggle('show');
});
getEl('overlay').addEventListener('click', closeSidebar);

// ─── POPULATE DROPDOWNS ─────────────────────────────────────────
function populateDropdowns() {
  var obraSelects = ['dashFilter','fObra','mLancObra','relObraSelect'];
  obraSelects.forEach(function(id) {
    var el = getEl(id);
    if (!el) return;
    var prev = el.value;
    var isFilter = id === 'dashFilter' || id === 'fObra' || id === 'relObraSelect';
    el.innerHTML = isFilter ? '<option value="">Todas as obras</option>' : '<option value="">Selecione...</option>';
    if (id === 'relObraSelect') el.innerHTML = '<option value="">Escolha uma obra...</option>';
    db.obras.forEach(function(o) {
      var opt = document.createElement('option');
      opt.value = o.id; opt.textContent = o.nome;
      el.appendChild(opt);
    });
    if (prev) el.value = prev;
  });

  var socioSelects = ['fSocio','mLancSocio'];
  socioSelects.forEach(function(id) {
    var el = getEl(id);
    if (!el) return;
    var prev = el.value;
    el.innerHTML = id === 'fSocio' ? '<option value="">Todos os socios</option>' : '<option value="">Selecione...</option>';
    db.socios.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.nome;
      el.appendChild(opt);
    });
    if (prev) el.value = prev;
  });
}

// ─── DASHBOARD ──────────────────────────────────────────────────
function renderDashboard() {
  var obraId = getEl('dashFilter').value;
  var g = calcGlobal(obraId);

  getEl('kpiInvestido').textContent    = brl(g.totalAportes);
  getEl('kpiDespesas').textContent     = brl(g.totalDespesas);
  getEl('kpiLucro').textContent        = brl(g.lucro);
  getEl('kpiSociosObras').textContent  = db.socios.length + ' / ' + db.obras.length;

  // guia
  var guia = getEl('guiaInicio');
  guia.style.display = (db.socios.length === 0 || db.obras.length === 0) ? 'block' : 'none';

  // gráficos
  var sociosComDados = db.socios.filter(function(s) { return (g.porSocio[s.id] || 0) > 0; });
  var totalGeral = sociosComDados.reduce(function(a, s) { return a + g.porSocio[s.id]; }, 0);

  renderChartPizza(sociosComDados, g.porSocio, totalGeral);
  renderChartBar(sociosComDados, g.porSocio);
  renderObrasResumo(obraId);
}

function renderChartPizza(socios, porSocio, total) {
  var canvas = getEl('chartPizza');
  var empty  = getEl('pizzaEmpty');

  if (socios.length === 0) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
    if (chartPizza) { chartPizza.destroy(); chartPizza = null; }
    return;
  }
  canvas.style.display = 'block';
  empty.style.display  = 'none';
  if (chartPizza) chartPizza.destroy();

  chartPizza = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: socios.map(function(s) { return s.nome; }),
      datasets: [{
        data: socios.map(function(s) { return porSocio[s.id]; }),
        backgroundColor: socios.map(function(s, i) { return colorFor(i); }),
        borderWidth: 3, borderColor: '#1e2130'
      }]
    },
    options: {
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8a90a8', font: { family: 'Outfit', size: 12 }, padding: 16 }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var val = ctx.raw;
              var p = total > 0 ? (val / total * 100).toFixed(1) : 0;
              return ' ' + ctx.label + ': ' + brl(val) + ' (' + p + '%)';
            }
          }
        }
      }
    }
  });
}

function renderChartBar(socios, porSocio) {
  var canvas = getEl('chartBar');
  var empty  = getEl('barEmpty');

  if (socios.length === 0) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
    if (chartBar) { chartBar.destroy(); chartBar = null; }
    return;
  }
  canvas.style.display = 'block';
  empty.style.display  = 'none';
  if (chartBar) chartBar.destroy();

  chartBar = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: socios.map(function(s) { return s.nome; }),
      datasets: [{
        label: 'Investimento',
        data: socios.map(function(s) { return porSocio[s.id]; }),
        backgroundColor: socios.map(function(s, i) { return colorFor(i) + '99'; }),
        borderColor:     socios.map(function(s, i) { return colorFor(i); }),
        borderWidth: 2, borderRadius: 6
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return ' ' + brl(ctx.raw); }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8a90a8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: {
          ticks: { color: '#8a90a8', callback: function(v) { return 'R$ ' + (v/1000).toFixed(0) + 'k'; } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

function renderObrasResumo(obraId) {
  var obras = obraId
    ? db.obras.filter(function(o) { return o.id === obraId; })
    : db.obras;
  var tbody = getEl('tbodyObrasResumo');
  var empty = getEl('obrasResumoEmpty');

  if (obras.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = obras.map(function(o) {
    var c = calcObra(o.id);
    var lucroClass = c.lucro > 0 ? 'txt-green' : c.lucro < 0 ? 'txt-red' : '';
    return '<tr>' +
      '<td><strong>' + o.nome + '</strong></td>' +
      '<td class="tr txt-green">' + brl(c.totalAportes) + '</td>' +
      '<td class="tr txt-red">'   + brl(c.totalDespesas) + '</td>' +
      '<td class="tr">'           + brl(c.custoTotal) + '</td>' +
      '<td class="tr">'           + (c.valorVenda > 0 ? brl(c.valorVenda) : '<span style="color:var(--c-text3)">—</span>') + '</td>' +
      '<td class="tr ' + lucroClass + '">' + (c.valorVenda > 0 ? brl(c.lucro) : '<span style="color:var(--c-text3)">—</span>') + '</td>' +
    '</tr>';
  }).join('');
}

getEl('dashFilter').addEventListener('change', renderDashboard);

// ─── GUIA STEPS ─────────────────────────────────────────────────
document.querySelectorAll('.guia-step').forEach(function(el) {
  el.addEventListener('click', function() {
    navigate(el.dataset.goto);
  });
});

// ─── OBRAS ──────────────────────────────────────────────────────
function renderObras() {
  var grid  = getEl('gridObras');
  var empty = getEl('obrasEmpty');

  if (db.obras.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = db.obras.map(function(o) {
    var c = calcObra(o.id);
    var lucroClass = c.lucro > 0 ? 'badge-pos' : c.lucro < 0 ? 'badge-neg' : 'badge-neu';
    var lucroTxt   = c.valorVenda > 0 ? (c.lucro >= 0 ? 'Lucro' : 'Prejuizo') : 'Sem venda';
    return '<div class="obra-card">' +
      '<div class="obra-card-top">' +
        '<div class="obra-card-id">#' + o.id.slice(-4) + '</div>' +
        '<div class="obra-card-name">' + o.nome + '</div>' +
        '<div class="obra-lucro-badge ' + lucroClass + '">' + lucroTxt + '</div>' +
      '</div>' +
      '<div class="obra-card-stats">' +
        '<div class="obra-stat-row"><span class="obra-stat-label">Total Aportes</span><span class="obra-stat-val txt-green">' + brl(c.totalAportes) + '</span></div>' +
        '<div class="obra-stat-row"><span class="obra-stat-label">Total Despesas</span><span class="obra-stat-val txt-red">' + brl(c.totalDespesas) + '</span></div>' +
        '<div class="obra-stat-row"><span class="obra-stat-label">Custo Total</span><span class="obra-stat-val">' + brl(c.custoTotal) + '</span></div>' +
        '<div class="obra-stat-row"><span class="obra-stat-label">Valor de Venda</span><span class="obra-stat-val txt-blue">' + (c.valorVenda > 0 ? brl(c.valorVenda) : '—') + '</span></div>' +
        '<div class="obra-stat-row"><span class="obra-stat-label">Lucro Estimado</span><span class="obra-stat-val ' + (c.lucro >= 0 ? 'txt-green' : 'txt-red') + '">' + (c.valorVenda > 0 ? brl(c.lucro) : '—') + '</span></div>' +
      '</div>' +
      '<div class="obra-card-foot">' +
        '<button class="btn-icon" onclick="obraEditar(\'' + o.id + '\')">&#9998; Editar</button>' +
        '<button class="btn-icon del" onclick="obraExcluir(\'' + o.id + '\')">&#128465; Excluir</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

getEl('btnNovaObra').addEventListener('click', function() {
  getEl('mObraTitle').textContent = 'Nova Obra';
  getEl('mObraNome').value  = '';
  getEl('mObraVenda').value = '';
  getEl('mObraId').value    = '';
  openModal('modalObra');
});

getEl('btnSalvarObra').addEventListener('click', function() {
  var nome     = getEl('mObraNome').value.trim();
  var venda    = parseFloat(getEl('mObraVenda').value) || 0;
  var corr     = getEl('mObraCorretagem').value;
  var percCorr = parseFloat(getEl('mObraPercCorr').value) || 0;
  var id       = getEl('mObraId').value;
  if (!nome) { toast('Informe o nome da obra.', 'error'); return; }
  if (corr === 'sim' && (percCorr <= 0 || percCorr > 100)) {
    toast('Informe um percentual de corretagem valido (entre 0 e 100).', 'error'); return;
  }
  var dados = { nome: nome, valorVenda: venda, corretagem: corr, percCorretagem: corr === 'sim' ? percCorr : 0 };
  if (id) {
    var obra = db.obras.find(function(o) { return o.id === id; });
    if (obra) { obra.nome = dados.nome; obra.valorVenda = dados.valorVenda; obra.corretagem = dados.corretagem; obra.percCorretagem = dados.percCorretagem; }
    toast('Obra atualizada!', 'ok');
  } else {
    dados.id = uid('obra');
    db.obras.push(dados);
    toast('Obra cadastrada!', 'ok');
  }
  dbSave(); populateDropdowns(); closeModal('modalObra'); renderObras(); updateNavCounts();
});

function obraEditar(id) {
  var o = db.obras.find(function(x) { return x.id === id; });
  if (!o) return;
  getEl('mObraTitle').textContent = 'Editar Obra';
  getEl('mObraNome').value  = o.nome;
  getEl('mObraVenda').value = o.valorVenda || '';
  getEl('mObraId').value    = id;
  openModal('modalObra');
}

function obraExcluir(id) {
  confirmDel('Excluir esta obra e todos os seus lancamentos?', function() {
    db.obras = db.obras.filter(function(o) { return o.id !== id; });
    db.lancamentos = db.lancamentos.filter(function(l) { return l.obraId !== id; });
    dbSave(); populateDropdowns(); renderObras(); updateNavCounts();
    toast('Obra excluida.', 'error');
  });
}

// ─── SOCIOS ─────────────────────────────────────────────────────
function renderSocios() {
  var grid  = getEl('gridSocios');
  var empty = getEl('sociosEmpty');

  if (db.socios.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = db.socios.map(function(s, i) {
    var lancs  = db.lancamentos.filter(function(l) { return l.socioId === s.id; });
    var total  = lancs.reduce(function(a, l) { return a + l.valor; }, 0);
    var nObras = new Set(lancs.map(function(l) { return l.obraId; })).size;
    var cor    = colorFor(i);
    return '<div class="socio-card">' +
      '<div class="socio-avatar" style="background:' + cor + '">' + initials(s.nome) + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="socio-card-id">#' + s.id.slice(-4) + '</div>' +
        '<div class="socio-card-name">' + s.nome + '</div>' +
        '<div class="socio-card-meta">' + brl(total) + ' &middot; ' + nObras + ' obra' + (nObras !== 1 ? 's' : '') + '</div>' +
      '</div>' +
      '<div class="socio-card-actions">' +
        '<button class="btn-icon" onclick="socioEditar(\'' + s.id + '\')">&#9998;</button>' +
        '<button class="btn-icon del" onclick="socioExcluir(\'' + s.id + '\')">&#128465;</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

getEl('btnNovoSocio').addEventListener('click', function() {
  getEl('mSocioTitle').textContent = 'Novo Socio';
  getEl('mSocioNome').value = '';
  getEl('mSocioId').value   = '';
  openModal('modalSocio');
});

getEl('btnSalvarSocio').addEventListener('click', function() {
  var nome = getEl('mSocioNome').value.trim();
  var id   = getEl('mSocioId').value;
  if (!nome) { toast('Informe o nome do socio.', 'error'); return; }
  if (id) {
    var s = db.socios.find(function(x) { return x.id === id; });
    if (s) s.nome = nome;
    toast('Socio atualizado!', 'ok');
  } else {
    db.socios.push({ id: uid('socio'), nome: nome });
    toast('Socio cadastrado!', 'ok');
  }
  dbSave(); populateDropdowns(); closeModal('modalSocio'); renderSocios(); updateNavCounts();
});

function socioEditar(id) {
  var s = db.socios.find(function(x) { return x.id === id; });
  if (!s) return;
  getEl('mSocioTitle').textContent = 'Editar Socio';
  getEl('mSocioNome').value = s.nome;
  getEl('mSocioId').value   = id;
  openModal('modalSocio');
}

function socioExcluir(id) {
  confirmDel('Excluir este socio? Os lancamentos vinculados serao mantidos.', function() {
    db.socios = db.socios.filter(function(s) { return s.id !== id; });
    dbSave(); populateDropdowns(); renderSocios(); updateNavCounts();
    toast('Socio excluido.', 'error');
  });
}

// ─── LANCAMENTOS ────────────────────────────────────────────────
function getLancsFiltrados() {
  var busca  = (getEl('fBusca').value || '').toLowerCase();
  var obraId = getEl('fObra').value;
  var socioId= getEl('fSocio').value;
  var tipo   = getEl('fTipo').value;

  return db.lancamentos.filter(function(l) {
    if (obraId  && l.obraId  !== obraId)  return false;
    if (socioId && l.socioId !== socioId) return false;
    if (tipo    && l.tipo    !== tipo)    return false;
    if (busca) {
      var desc = (l.descricao || '').toLowerCase();
      var cat  = (l.categoria || '').toLowerCase();
      if (desc.indexOf(busca) === -1 && cat.indexOf(busca) === -1) return false;
    }
    return true;
  }).sort(function(a, b) { return b.data > a.data ? 1 : -1; });
}

function renderLancamentos() {
  var lancs = getLancsFiltrados();
  var tbody = getEl('tbodyLanc');
  var empty = getEl('lancEmpty');

  if (lancs.length === 0) {
    tbody.innerHTML = '';
    empty.className = 'tbl-empty show';
    return;
  }
  empty.className = 'tbl-empty';
  tbody.innerHTML = lancs.map(function(l) {
    var obra  = db.obras.find(function(o) { return o.id === l.obraId; });
    var socio = db.socios.find(function(s) { return s.id === l.socioId; });
    var isAporte = l.tipo === 'Aporte';
    return '<tr>' +
      '<td style="white-space:nowrap">' + fmtDate(l.data) + '</td>' +
      '<td>' + (obra  ? obra.nome  : '<em style="color:var(--c-text3)">—</em>') + '</td>' +
      '<td>' + (socio ? socio.nome : '<em style="color:var(--c-text3)">—</em>') + '</td>' +
      '<td><span class="badge badge-' + l.tipo.toLowerCase() + '">' + l.tipo + '</span></td>' +
      '<td>' + (l.categoria || '—') + '</td>' +
      '<td>' + (l.descricao || '<span style="color:var(--c-text3)">—</span>') + '</td>' +
      '<td class="tr" style="color:' + (isAporte ? 'var(--green)' : 'var(--red)') + ';font-weight:600">' + brl(l.valor) + '</td>' +
      '<td class="tc">' +
        '<button class="btn-icon" onclick="lancEditar(\'' + l.id + '\')">&#9998;</button>' +
        '<button class="btn-icon del" onclick="lancExcluir(\'' + l.id + '\')">&#128465;</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

['fBusca','fObra','fSocio','fTipo'].forEach(function(id) {
  var el = getEl(id);
  if (el) el.addEventListener('input', renderLancamentos);
  if (el) el.addEventListener('change', renderLancamentos);
});

// Tipo toggle no modal
document.querySelectorAll('.tipo-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tipo-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    getEl('mLancTipo').value = btn.dataset.tipo;
  });
});

getEl('btnNovoLanc').addEventListener('click', abrirModalLanc);

function abrirModalLanc() {
  if (db.obras.length === 0 || db.socios.length === 0) {
    toast('Cadastre ao menos uma obra e um socio antes de lancar.', 'error');
    return;
  }
  getEl('mLancTitle').textContent = 'Novo Lancamento';
  getEl('mLancTipo').value = 'Aporte';
  getEl('mLancData').value = today();
  getEl('mLancObra').value   = '';
  getEl('mLancSocio').value  = '';
  getEl('mLancValor').value  = '';
  getEl('mLancDesc').value   = '';
  getEl('mLancId').value     = '';
  document.querySelectorAll('.tipo-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tipo === 'Aporte');
  });
  openModal('modalLanc');
}

getEl('btnSalvarLanc').addEventListener('click', function() {
  var tipo    = getEl('mLancTipo').value;
  var obraId  = getEl('mLancObra').value;
  var socioId = getEl('mLancSocio').value;
  var data    = getEl('mLancData').value;
  var valor   = parseFloat(getEl('mLancValor').value);
  var cat     = getEl('mLancCategoria').value;
  var desc    = getEl('mLancDesc').value.trim();
  var editId  = getEl('mLancId').value;

  if (!obraId || !socioId || !data || !valor || valor <= 0) {
    toast('Preencha todos os campos obrigatorios.', 'error'); return;
  }

  if (editId) {
    var l = db.lancamentos.find(function(x) { return x.id === editId; });
    if (l) { l.tipo = tipo; l.obraId = obraId; l.socioId = socioId; l.data = data; l.valor = valor; l.categoria = cat; l.descricao = desc; }
    toast('Lancamento atualizado!', 'ok');
  } else {
    db.lancamentos.push({ id: uid('lanc'), tipo: tipo, obraId: obraId, socioId: socioId, data: data, valor: valor, categoria: cat, descricao: desc });
    toast('Lancamento salvo!', 'ok');
  }
  dbSave(); closeModal('modalLanc'); renderLancamentos();
  if (getEl('page-dashboard').classList.contains('active')) renderDashboard();
});

function lancEditar(id) {
  var l = db.lancamentos.find(function(x) { return x.id === id; });
  if (!l) return;
  getEl('mLancTitle').textContent = 'Editar Lancamento';
  getEl('mLancTipo').value        = l.tipo;
  getEl('mLancObra').value        = l.obraId;
  getEl('mLancSocio').value       = l.socioId;
  getEl('mLancData').value        = l.data;
  getEl('mLancValor').value       = l.valor;
  getEl('mLancCategoria').value   = l.categoria;
  getEl('mLancDesc').value        = l.descricao || '';
  getEl('mLancId').value          = id;
  document.querySelectorAll('.tipo-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tipo === l.tipo);
  });
  openModal('modalLanc');
}

function lancExcluir(id) {
  confirmDel('Excluir este lancamento?', function() {
    db.lancamentos = db.lancamentos.filter(function(l) { return l.id !== id; });
    dbSave(); renderLancamentos();
    if (getEl('page-dashboard').classList.contains('active')) renderDashboard();
    toast('Lancamento excluido.', 'error');
  });
}

// ─── RELATORIO ──────────────────────────────────────────────────
function renderRelatorio() {
  var obraId = getEl('relObraSelect').value;
  var el     = getEl('relatorioContent');

  if (!obraId) {
    el.innerHTML = '<div class="rel-empty">Selecione uma obra para ver o relatorio completo.</div>';
    return;
  }

  var obra = db.obras.find(function(o) { return o.id === obraId; });
  if (!obra) return;
  var c = calcObra(obraId);

  // Categorias
  var lancs = db.lancamentos.filter(function(l) { return l.obraId === obraId; });
  var catMap = {};
  lancs.forEach(function(l) {
    if (!catMap[l.categoria]) catMap[l.categoria] = 0;
    catMap[l.categoria] += l.valor;
  });
  var cats = Object.keys(catMap).map(function(k) { return { nome: k, val: catMap[k] }; }).sort(function(a,b) { return b.val - a.val; });

  // Participacao socios
  var sociosAtivos = db.socios.filter(function(s) { return (c.porSocio[s.id] || 0) > 0; });
  var totalSocios  = sociosAtivos.reduce(function(a, s) { return a + c.porSocio[s.id]; }, 0);

  var socioRows = sociosAtivos.map(function(s, i) {
    var inv  = c.porSocio[s.id] || 0;
    var p    = c.percentual[s.id] || 0;
    var lucr = c.lucroPorSocio[s.id] || 0;
    var cor  = colorFor(i);
    return '<div class="socio-rel-row">' +
      '<div class="socio-rel-av" style="background:' + cor + '">' + initials(s.nome) + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="socio-rel-name">' + s.nome + '</div>' +
        '<div class="socio-rel-sub">' + pct(p) + ' de participacao</div>' +
        '<div class="socio-rel-bar-wrap"><div class="socio-rel-bar" style="width:' + (p*100).toFixed(1) + '%;background:' + cor + '"></div></div>' +
      '</div>' +
      '<div class="socio-rel-vals">' +
        '<div class="socio-rel-pct">' + pct(p) + '</div>' +
        '<div class="socio-rel-amt">Invest: ' + brl(inv) + '</div>' +
        (obra.valorVenda > 0 ? '<div class="socio-rel-amt" style="color:var(--green)">Lucro: ' + brl(lucr) + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  var catRows = cats.map(function(ct) {
    return '<div class="cat-row"><span class="cat-label">' + ct.nome + '</span><span class="cat-val">' + brl(ct.val) + '</span></div>';
  }).join('');

  // Tabela lancamentos
  var lancRows = lancs.slice().sort(function(a,b) { return b.data > a.data ? 1 : -1; }).map(function(l) {
    var socio = db.socios.find(function(s) { return s.id === l.socioId; });
    var isA = l.tipo === 'Aporte';
    return '<tr>' +
      '<td>' + fmtDate(l.data) + '</td>' +
      '<td>' + (socio ? socio.nome : '—') + '</td>' +
      '<td><span class="badge badge-' + l.tipo.toLowerCase() + '">' + l.tipo + '</span></td>' +
      '<td>' + (l.categoria || '—') + '</td>' +
      '<td>' + (l.descricao || '—') + '</td>' +
      '<td class="tr" style="color:' + (isA ? 'var(--green)' : 'var(--red)') + ';font-weight:600">' + brl(l.valor) + '</td>' +
    '</tr>';
  }).join('');

  el.innerHTML =
    '<div class="rel-kpi-row">' +
      '<div class="kpi"><div class="kpi-icon kpi-green-bg"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg></div><div><div class="kpi-label">Total Aportes</div><div class="kpi-val kpi-green">' + brl(c.totalAportes) + '</div></div></div>' +
      '<div class="kpi"><div class="kpi-icon kpi-red-bg"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg></div><div><div class="kpi-label">Total Despesas</div><div class="kpi-val kpi-red">' + brl(c.totalDespesas) + '</div></div></div>' +
      '<div class="kpi"><div class="kpi-icon kpi-blue-bg"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div><div class="kpi-label">Lucro Estimado</div><div class="kpi-val kpi-blue">' + (obra.valorVenda > 0 ? brl(c.lucro) : '—') + '</div><div class="kpi-label" style="margin-top:2px">' + (obra.valorVenda > 0 ? 'Venda: ' + brl(obra.valorVenda) : 'Valor de venda nao definido') + '</div></div></div>' +
    '</div>' +
    '<div class="rel-grid">' +
      '<div class="card"><div class="card-head"><span class="card-title">Participacao dos Socios</span></div>' + (socioRows || '<p style="color:var(--c-text3);font-size:.88rem">Nenhum aporte nesta obra.</p>') + '</div>' +
      '<div class="card"><div class="card-head"><span class="card-title">Gastos por Categoria</span></div>' + (catRows || '<p style="color:var(--c-text3);font-size:.88rem">Sem lancamentos.</p>') + '</div>' +
    '</div>' +
    '<div class="card no-pad">' +
      '<div style="padding:20px 24px 0"><span class="card-title">Historico de Lancamentos</span></div>' +
      '<div class="table-wrap">' +
        '<table class="table"><thead><tr><th>Data</th><th>Socio</th><th>Tipo</th><th>Categoria</th><th>Descricao</th><th class="tr">Valor</th></tr></thead>' +
        '<tbody>' + (lancRows || '<tr><td colspan="6" style="text-align:center;color:var(--c-text3);padding:32px">Sem lancamentos</td></tr>') + '</tbody></table>' +
      '</div>' +
    '</div>';
}

getEl('relObraSelect').addEventListener('change', renderRelatorio);

// ─── EXPORT / IMPORT ────────────────────────────────────────────
getEl('btnExport').addEventListener('click', function() {
  var blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  var a    = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = 'obrasinvest_backup_' + today() + '.json';
  a.click();
  toast('Backup exportado!', 'ok');
});

getEl('btnImportTrigger').addEventListener('click', function() { getEl('importFile').click(); });

getEl('importFile').addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var imp = JSON.parse(ev.target.result);
      if (!imp.obras || !imp.socios || !imp.lancamentos) throw new Error('invalido');
      db = imp;
      dbSave(); populateDropdowns();
      navigate('dashboard');
      toast('Dados importados!', 'ok');
    } catch (err) {
      toast('Arquivo invalido.', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ─── INIT ────────────────────────────────────────────────────────
dbLoad();
populateDropdowns();
updateNavCounts();
renderDashboard();
