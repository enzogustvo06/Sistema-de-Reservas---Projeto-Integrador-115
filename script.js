// =====================================================
// Sistema de Reserva (ADM / Funcionário)
// - Cadastro: Pessoas, Equipamentos
// - Empréstimo / Devolução
// - Edição: Pessoa, Equipamento, Empréstimo
// =====================================================

// ---------- Utils ----------
function uuid(){
  return (crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function esc(t){
  return (t || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function nowISO(){ return new Date().toISOString(); }

function fmtData(iso){
  if (!iso) return '-';
  try{ return new Date(iso).toLocaleString(); }catch{ return iso; }
}

// ---------- Storage ----------
let dados = JSON.parse(localStorage.getItem('faculdadeDados')) || {
  pessoas: [],
  equipamentos: [],
  emprestimos: [],
  danificados: [],
  remocoes: []
};


// ---------- Unidade (SEDE / ANEXO II) ----------
const UNIDADES = [
  { id: 'SEDE', label: 'Sede' },
  { id: 'ANEXO2', label: 'Anexo II' }
];

let unidadeAtiva = localStorage.getItem('unidadeAtiva') || 'SEDE';

function setUnidadeAtiva(id){
  unidadeAtiva = id;
  localStorage.setItem('unidadeAtiva', id);
  atualizarTudo();
  atualizarUnidadeUI();
}

function atualizarUnidadeUI(){
  const btnSede = document.getElementById('tabUnidadeSEDE');
  const btnAnexo = document.getElementById('tabUnidadeANEXO2');
  if (btnSede) btnSede.classList.toggle('active', unidadeAtiva === 'SEDE');
  if (btnAnexo) btnAnexo.classList.toggle('active', unidadeAtiva === 'ANEXO2');
}

function bindUnidadeUI(){
  const btnSede = document.getElementById('tabUnidadeSEDE');
  const btnAnexo = document.getElementById('tabUnidadeANEXO2');
  if (btnSede) btnSede.addEventListener('click', () => setUnidadeAtiva('SEDE'));
  if (btnAnexo) btnAnexo.addEventListener('click', () => setUnidadeAtiva('ANEXO2'));
}


function salvar(){
  localStorage.setItem('faculdadeDados', JSON.stringify(dados));
}

// ---------- Usuários / Login ----------
let usuariosSistema = JSON.parse(localStorage.getItem('usuariosSistema')) || [
  { id: 'admin', usuario: 'admin', senha: '1234', role: 'admin' }
];

// migração: usuários antigos sem role -> funcionario
usuariosSistema = usuariosSistema.map(u => ({ ...u, role: u.role || 'funcionario' }));

// garantia: admin padrão sempre existe e sempre é admin (evita "perder" permissão ao trocar de origem/servidor)
if (!usuariosSistema.some(u => u.usuario === 'admin' || u.id === 'admin')){
  usuariosSistema.push({ id: 'admin', usuario: 'admin', senha: '1234', role: 'admin' });
}
usuariosSistema = usuariosSistema.map(u => (u.usuario === 'admin' || u.id === 'admin') ? { ...u, role: 'admin' } : u);
function salvarUsuarios(){ localStorage.setItem('usuariosSistema', JSON.stringify(usuariosSistema)); }

// salva normalizações/migrações de usuários (evita diferenças entre GitHub Pages e Live Server)
salvarUsuarios();

function getSessao(){
  const usuario = localStorage.getItem('usuarioLogado');
  const role = localStorage.getItem('usuarioRole');
  return { usuario, role };
}
function isAdmin(){ return getSessao().role === 'admin'; }

function login(usuario, senha){
  const u = usuariosSistema.find(x => x.usuario === usuario && x.senha === senha);
  if (!u){ alert('Usuário ou senha incorretos!'); return false; }
  localStorage.setItem('usuarioLogado', u.usuario);
  localStorage.setItem('usuarioRole', u.role);
  return true;
}

function logout(){
  localStorage.removeItem('usuarioLogado');
  localStorage.removeItem('usuarioRole');
  location.reload();
}

function mostrarUsuarioNoHeader(){
  const { usuario, role } = getSessao();
  const label = document.getElementById('usuarioLogadoLabel');
  const roleLabel = document.getElementById('usuarioRoleLabel');

  if (label && usuario) label.textContent = 'Logado como: ' + usuario;

  if (roleLabel && role){
    roleLabel.style.display = 'inline-block';
    roleLabel.textContent = (role === 'admin') ? 'ADMIN' : 'FUNCIONÁRIO';
  }
}

function verificarLogin(){
  const { usuario } = getSessao();
  if (!usuario){
    const header = document.querySelector('header');
    const nav = document.querySelector('nav');
    const main = document.querySelector('main');

    if (header) header.style.display = 'none';
    if (nav) nav.style.display = 'none';
    if (main) main.style.display = 'none';

    const loginTela = document.getElementById('telaLogin');
    if (loginTela) loginTela.style.display = 'flex';

    const btn = document.getElementById('btnLogin');
    if (btn){
      btn.onclick = () => {
        const u = document.getElementById('loginUser').value.trim();
        const s = document.getElementById('loginSenha').value;
        if (login(u, s)) location.reload();
      };
    }
    return false;
  }
  return true;
}

// ---------- MIGRAÇÕES DE DADOS ----------
function migrarDados(){
  // Equipamentos: antes era {quantidade} como disponível. Agora: total + disponivel + danificados.
  dados.equipamentos = (dados.equipamentos || []).map(e => {
    const q = (typeof e.quantidade === 'number') ? e.quantidade : Number(e.quantidade || 0);
    const total = (typeof e.total === 'number') ? e.total : (Number(e.total || 0) || q);
    const disponivel = (typeof e.disponivel === 'number') ? e.disponivel : (Number(e.disponivel || 0) || q);
    const danificados = (typeof e.danificados === 'number') ? e.danificados : Number(e.danificados || 0);

    const { quantidade, ...rest } = e;

    // normaliza limites
    const totalN = Math.max(0, Number(total) || 0);
    const danN = Math.min(Math.max(0, Number(danificados) || 0), totalN);
    const disponN = Math.min(Math.max(0, Number(disponivel) || 0), Math.max(0, totalN - danN));

    return { ...rest, total: totalN, disponivel: disponN, danificados: danN };
  });

  // Empréstimos: garantir campos
  dados.emprestimos = (dados.emprestimos || []).map(emp => ({
    nota: emp.nota ?? '',
    fezDevolucao: emp.fezDevolucao ?? '',
    dataDevolucao: emp.dataDevolucao ?? null,
    fotoDevolucao: emp.fotoDevolucao ?? null,
    ...emp
  }));

  // Danificados: garantir array
  dados.danificados = Array.isArray(dados.danificados) ? dados.danificados : [];

  // Unidade: garantir campo em todos os registros (dados antigos viram SEDE)
  const garantirUnidade = (obj) => ({ ...obj, unidade: obj.unidade || 'SEDE' });
  dados.pessoas = (dados.pessoas || []).map(garantirUnidade);
  dados.equipamentos = (dados.equipamentos || []).map(garantirUnidade);
  dados.emprestimos = (dados.emprestimos || []).map(garantirUnidade);
  dados.danificados = (dados.danificados || []).filter(d => (d.unidade || 'SEDE') === unidadeAtiva).map(garantirUnidade);
  dados.remocoes = (dados.remocoes || []).filter(r => (r.unidade || 'SEDE') === unidadeAtiva).map(garantirUnidade);

  salvar();
}

// ---------- Elementos ----------
const nome = document.getElementById('nome');
const telefone = document.getElementById('telefone');
const curso = document.getElementById('curso');
const funcao = document.getElementById('funcao');
const btnRegistrarPessoa = document.getElementById('btnRegistrarPessoa');

const nomeEquipamento = document.getElementById('nomeEquipamento');
const patrimonio = document.getElementById('patrimonio');
const quantidade = document.getElementById('quantidade');
const btnRegistrarEquip = document.getElementById('btnRegistrarEquip');

const alunoEmprestimo = document.getElementById('alunoEmprestimo');
const equipEmprestimo = document.getElementById('equipEmprestimo');
const devolucaoSelect = document.getElementById('devolucaoSelect');
const statusDevolucao = document.getElementById('statusDevolucao');
const notaDevolucao = document.getElementById('notaDevolucao');

// Foto (opcional) na devolução — aparece no layout mobile, mas funciona em qualquer dispositivo
const fotoDevolucaoInput = document.getElementById('fotoDevolucaoInput');
const fotoDevolucaoBox = document.getElementById('fotoDevolucaoBox');
const fotoDevolucaoPreview = document.getElementById('fotoDevolucaoPreview');
const btnRemoverFotoDevolucao = document.getElementById('btnRemoverFotoDevolucao');

const tabelaPessoas = document.querySelector('#tabelaPessoas tbody');
const tabelaEquipamentos = document.querySelector('#tabelaEquipamentos tbody');
const tabelaEmprestimos = document.querySelector('#tabelaEmprestimos tbody');
const tabelaDanificados = document.querySelector('#tabelaDanificados tbody');
const tabelaRemocoes = document.querySelector('#tabelaRemocoes tbody');
const searchPessoas = document.getElementById('searchPessoas');
const searchEquipamentos = document.getElementById('searchEquipamentos');
const searchEmprestimos = document.getElementById('searchEmprestimos');
const searchDanificados = document.getElementById('searchDanificados');
const searchRemocoes = document.getElementById('searchRemocoes');
const searchUsuarios = document.getElementById('searchUsuarios');

const btnGerarRel = document.getElementById('btnGerarRel');
const btnImprimirRel = document.getElementById('btnImprimirRel');
const listaRelatorio = document.getElementById('listaRelatorio');

const tabUsuarios = document.getElementById('tabUsuarios');
const tabRemocoes = document.getElementById('tabRemocoes');
const tabDanificados = document.getElementById('tabDanificados');
const btnResetSistemaHeader = document.getElementById('btnResetSistema');

const novoUsuario = document.getElementById('novoUsuario');
const novaSenha = document.getElementById('novaSenha');
const novoCargo = document.getElementById('novoCargo');
const btnCriarUsuario = document.getElementById('btnCriarUsuario');
const tabelaUsuarios = document.querySelector('#tabelaUsuarios tbody');
const btnResetSistemaAdmin = document.getElementById('btnResetSistemaAdmin');

// ---------- Abas ----------
document.querySelectorAll('.tab').forEach(t => {
  if (t.dataset.aba){
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      t.classList.add('active');
      document.getElementById(t.dataset.aba).classList.add('active');
    });
  }
});

// ---------- Permissões ----------
function aplicarPermissoes(){
  if (!isAdmin()){
    if (tabUsuarios) tabUsuarios.style.display = 'none';
    if (btnResetSistemaHeader) btnResetSistemaHeader.style.display = 'none';
  }
}

// ---------- Filtros ----------
let filtroPessoa = 'Aluno';
let filtroEmprestimo = 'Aluno';

// Pesquisa (em todas as colunas/campos)
const pesquisa = {
  pessoas: '',
  equipamentos: '',
  emprestimos: '',
  danificados: '',
  remocoes: '',
  usuarios: ''
};

function norm(v){
  return (v ?? '').toString().toLowerCase().trim();
}

function matchAllFields(obj, termo){
  const t = norm(termo);
  if (!t) return true;
  // inclui também chaves calculadas se existirem
  const vals = [];
  try{ vals.push(...Object.values(obj)); }catch{}
  return vals.some(v => norm(v).includes(t));
}

function limparPesquisa(aba){
  if (!pesquisa.hasOwnProperty(aba)) return;
  pesquisa[aba] = '';
  const map = {
    pessoas: searchPessoas,
    equipamentos: searchEquipamentos,
    emprestimos: searchEmprestimos,
    danificados: searchDanificados,
    remocoes: searchRemocoes,
    usuarios: searchUsuarios
  };
  if (map[aba]) map[aba].value = '';
  atualizarTudo();
}

window.limparPesquisa = limparPesquisa;

// Foto (opcional) capturada na devolução
let fotoDevolucaoDataUrl = null;

function limparFotoDevolucao(){
  fotoDevolucaoDataUrl = null;
  if (fotoDevolucaoInput) fotoDevolucaoInput.value = '';
  if (fotoDevolucaoBox) fotoDevolucaoBox.style.display = 'none';
  if (fotoDevolucaoPreview) fotoDevolucaoPreview.removeAttribute('src');
}

if (fotoDevolucaoInput){
  fotoDevolucaoInput.addEventListener('change', () => {
    const file = fotoDevolucaoInput.files && fotoDevolucaoInput.files[0];
    if (!file){
      limparFotoDevolucao();
      return;
    }

    if (!file.type || !file.type.startsWith('image/')){
      alert('Selecione um arquivo de imagem.');
      limparFotoDevolucao();
      return;
    }

    // limite simples para evitar explodir o localStorage
    const maxBytes = 1200 * 1024; // ~1.2 MB (mantém seguro para localStorage)
    if (file.size > maxBytes){
      alert('Imagem muito grande. Tente uma foto menor (até ~1.2MB).');
      limparFotoDevolucao();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      fotoDevolucaoDataUrl = String(reader.result || '');
      if (fotoDevolucaoPreview) fotoDevolucaoPreview.src = fotoDevolucaoDataUrl;
      if (fotoDevolucaoBox) fotoDevolucaoBox.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });
}

if (btnRemoverFotoDevolucao){
  btnRemoverFotoDevolucao.addEventListener('click', () => limparFotoDevolucao());
}

function mostrarPessoasPorTipo(tipo, el){
  filtroPessoa = tipo;
  document.querySelectorAll('#pessoas .tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  atualizarPessoas();
}

function mostrarEmprestimos(tipo, el){
  filtroEmprestimo = tipo;
  document.querySelectorAll('#emprestimos .tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  atualizarEmprestimos();
}

// ---------- Modal (Edição) ----------
let modalState = { type: null, id: null };

function abrirModal(titulo, bodyHTML, onSave){
  const modal = document.getElementById('modal');
  const tituloEl = document.getElementById('modalTitulo');
  const bodyEl = document.getElementById('modalBody');
  const btnSalvar = document.getElementById('modalSalvar');

  // padrão
  btnSalvar.textContent = 'Salvar';

  tituloEl.textContent = titulo;
  bodyEl.innerHTML = bodyHTML;

  btnSalvar.onclick = () => {
    try{
      onSave();
      fecharModal();
    }catch(e){
      console.error(e);
      alert(e?.message || 'Erro ao salvar.');
    }
  };

  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');
}

function abrirModalVisualizacao(titulo, bodyHTML){
  const modal = document.getElementById('modal');
  const tituloEl = document.getElementById('modalTitulo');
  const bodyEl = document.getElementById('modalBody');
  const btnSalvar = document.getElementById('modalSalvar');

  tituloEl.textContent = titulo;
  bodyEl.innerHTML = bodyHTML;

  btnSalvar.textContent = 'OK';
  btnSalvar.onclick = () => fecharModal();

  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');
}

/* (duplicada removida) */

function fecharModal(){
  const modal = document.getElementById('modal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  document.getElementById('modalBody').innerHTML = '';
  modalState = { type: null, id: null };
}

window.fecharModal = fecharModal;

// ---------- Atualizações UI ----------
function atualizarPessoas(){
  tabelaPessoas.innerHTML = '';
  dados.pessoas
    .filter(p => (p.unidade || 'SEDE') === unidadeAtiva)
    .filter(p => p.funcao === filtroPessoa)
    .filter(p => matchAllFields(p, pesquisa.pessoas))
    .forEach(p => {
      const tr = document.createElement('tr');

      const btnEditar = `<button class="btn btn-ghost" onclick="editarPessoa('${p.id}')">Editar</button>`;
      const btnRemover = isAdmin()
        ? `<button class="btn btn-danger" onclick="removerPessoa('${p.id}')">Remover</button>`
        : `<span class="muted">—</span>`;

      tr.innerHTML = `
        <td data-label="Nome">${esc(p.nome)}</td>
        <td data-label="Telefone">${esc(p.telefone)}</td>
        <td data-label="Curso">${esc(p.curso)}</td>
        <td data-label="Função">${esc(p.funcao)}</td>
        <td data-label="Ações"><div class="td-actions">${btnEditar}${btnRemover}</div></td>
      `;
      tabelaPessoas.appendChild(tr);
    });
}

function atualizarEquipamentos(){
  tabelaEquipamentos.innerHTML = '';
  dados.equipamentos
    .filter(e => (e.unidade || 'SEDE') === unidadeAtiva)
    .filter(e => matchAllFields(e, pesquisa.equipamentos))
    .forEach(e => {
    const tr = document.createElement('tr');

    const total = Number(e.total ?? 0);
    const dan = Number(e.danificados ?? 0);
    const disp = Number(e.disponivel ?? 0);
    const totalUtil = Math.max(0, total - dan);
    const emprestados = Math.max(0, totalUtil - disp);

    let status = 'Indisponível';
    if (disp > 0) status = 'Disponível';
    if (dan > 0) status += ` • ${dan} danificado(s)`;
    if (emprestados > 0) status += ` • ${emprestados} emprestado(s)`;

    const btnEditar = `<button class="btn btn-ghost" onclick="editarEquipamento('${e.id}')">Editar</button>`;
    const btnRemover = isAdmin()
      ? `<button class="btn btn-danger" onclick="removerEquipamento('${e.id}')">Remover</button>`
      : `<span class="muted">—</span>`;

    tr.innerHTML = `
      <td data-label="Nome">${esc(e.nome)}</td>
      <td data-label="Patrimônio">${esc(e.patrimonio)}</td>
      <td data-label="Disponível">${disp}</td>
      <td data-label="Total">${total}</td>
      <td data-label="Danificados">${dan}</td>
      <td data-label="Status">${status}</td>
      <td data-label="Ações"><div class="td-actions">${btnEditar}${btnRemover}</div></td>
    `;
    tabelaEquipamentos.appendChild(tr);
  });
}

function atualizarEmprestimos(){
  tabelaEmprestimos.innerHTML = '';
  dados.emprestimos
    .filter(e => (e.unidade || 'SEDE') === unidadeAtiva)
    .filter(e => e.funcao === filtroEmprestimo)
    .filter(e => matchAllFields(e, pesquisa.emprestimos))
    .sort((a,b) => (b.dataEmprestimo || '').localeCompare(a.dataEmprestimo || ''))
    .forEach(emp => {
      const tr = document.createElement('tr');

      const btnEditar = `<button class="btn btn-ghost" onclick="editarEmprestimo('${emp.id}')">Editar</button>`;
      const btnFoto = emp.fotoDevolucao
        ? `<button class="btn btn-ghost" onclick="verFotoDevolucao('${emp.id}')">Foto</button>`
        : `<span class="muted">Sem foto</span>`;

      tr.innerHTML = `
        <td data-label="Equipamento">${esc(emp.equipamentoNome)}</td>
        <td data-label="Nome">${esc(emp.alunoNome)}</td>
        <td data-label="Curso">${esc(emp.curso)}</td>
        <td data-label="Função">${esc(emp.funcao)}</td>
        <td data-label="Status">${esc(emp.status)}</td>
        <td data-label="Observação">${esc(emp.nota || '-')}</td>
        <td data-label="Data Empréstimo">${fmtData(emp.dataEmprestimo)}</td>
        <td data-label="Data Devolução">${emp.dataDevolucao ? fmtData(emp.dataDevolucao) : '-'}</td>
        <td data-label="Registrado por">${esc(emp.fezEmprestimo || '-')}</td>
        <td data-label="Devolvido por">${esc(emp.fezDevolucao || '-')}</td>
        <td data-label="Ações"><div class="td-actions">${btnEditar}${btnFoto}</div></td>
      `;

      tabelaEmprestimos.appendChild(tr);
    });
}

// ---------- Danificados ----------
function atualizarDanificados(){
  if (!tabelaDanificados) return;
  tabelaDanificados.innerHTML = '';

  (dados.danificados || [])
    .slice()
    .sort((a,b) => (b.data || '').localeCompare(a.data || ''))
    .filter(d => matchAllFields(d, pesquisa.danificados))
    .forEach(d => {
      const tr = document.createElement('tr');

      const temFoto = !!d.foto;
      const statusTxt = d.status || 'Danificado';

      const btnFoto = temFoto
        ? `<button class="btn btn-ghost btn-sm" onclick="verFotoDanificado('${d.id}')">Ver</button>`
        : `<span class="muted">Sem</span>`;

      // Ações de estoque: apenas ADM
      const acoesAdmin = isAdmin()
        ? `<button class="btn btn-ghost btn-sm" onclick="marcarConsertado('${d.id}')">Consertado</button>
           <button class="btn btn-danger btn-sm" onclick="darBaixaDanificado('${d.id}')">Dar baixa</button>`
        : `<span class="muted">—</span>`;

      tr.innerHTML = `
        <td data-label="Equipamento">${esc(d.equipamentoNome || '-')}</td>
        <td data-label="Patrimônio">${esc(d.patrimonio || '-')}</td>
        <td data-label="Pessoa">${esc(d.pessoaNome || '-')}</td>
        <td data-label="Data">${fmtData(d.data)}</td>
        <td data-label="Observação">${esc(d.observacao || '-')}</td>
        <td data-label="Foto">${btnFoto}</td>
        <td data-label="Status">${esc(statusTxt)}</td>
        <td data-label="Ações"><div class="td-actions">${acoesAdmin}</div></td>
      `;

      tabelaDanificados.appendChild(tr);
    });
}

function atualizarRemocoes(){
  if (!tabelaRemocoes) return;
  tabelaRemocoes.innerHTML = '';
  (dados.remocoes || [])
    .slice()
    .reverse()
    .filter(r => matchAllFields(r, pesquisa.remocoes))
    .forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Nome">${esc(r.nome || '-')}</td>
      <td data-label="Tipo">${esc(r.tipo || '-')}</td>
      <td data-label="Patrimônio">${esc(r.patrimonio || '-')}</td>
      <td data-label="Justificativa">${esc(r.justificativa || '-')}</td>
      <td data-label="Data">${fmtData(r.data)}</td>
      <td data-label="Removido por">${esc(r.removidoPor || '-')}</td>
    `;
    tabelaRemocoes.appendChild(tr);
  });
}

function atualizarSelects(){
  // pessoas
  alunoEmprestimo.innerHTML = '<option value="">Selecione a Pessoa</option>';
  dados.pessoas
    .filter(p => (p.unidade || 'SEDE') === unidadeAtiva)
    .forEach(p => {
    alunoEmprestimo.innerHTML += `<option value="${p.id}">${esc(p.nome)} (${esc(p.funcao)})</option>`;
  });

  // equipamentos (apenas com disponivel)
  equipEmprestimo.innerHTML = '<option value="">Selecione o Equipamento</option>';
  dados.equipamentos
    .filter(e => (e.unidade || 'SEDE') === unidadeAtiva)
    .filter(e => Number(e.disponivel ?? 0) > 0)
    .forEach(e => {
      const total = Number(e.total ?? 0);
      const dan = Number(e.danificados ?? 0);
      const totalUtil = Math.max(0, total - dan);
      equipEmprestimo.innerHTML += `<option value="${e.id}">${esc(e.nome)} - ${esc(e.patrimonio)} (${Number(e.disponivel ?? 0)}/${totalUtil})</option>`;
    });

  // devoluções: apenas empréstimos em aberto
  devolucaoSelect.innerHTML = '<option value="">Selecione o Empréstimo</option>';
  dados.emprestimos
    .filter(e => (e.unidade || 'SEDE') === unidadeAtiva)
    .filter(e => e.status === 'Emprestado')
    .forEach(e => {
      devolucaoSelect.innerHTML += `<option value="${e.id}">${esc(e.alunoNome)} → ${esc(e.equipamentoNome)}</option>`;
    });
}

function atualizarUsuarios(){
  if (!tabelaUsuarios) return;
  tabelaUsuarios.innerHTML = '';

  usuariosSistema
    .filter(u => matchAllFields(u, pesquisa.usuarios))
    .forEach(u => {
    const tr = document.createElement('tr');
    const cargo = (u.role === 'admin') ? 'Admin' : 'Funcionário';

    const btnSenha = isAdmin()
      ? `<button class="btn btn-ghost" onclick="editarSenhaUsuario('${u.id}')">Editar senha</button>`
      : `<span class="muted">—</span>`;

    const btnRemover = (isAdmin() && u.usuario !== 'admin')
      ? `<button class="btn btn-danger" onclick="removerUsuario('${u.id}')">Remover</button>`
      : `<span class="muted">—</span>`;

    tr.innerHTML = `
      <td data-label="Usuário">${esc(u.usuario)}</td>
      <td data-label="Cargo">${cargo}</td>
      <td data-label="Ações"><div class="td-actions">${btnSenha}${btnRemover}</div></td>
    `;
    tabelaUsuarios.appendChild(tr);
  });
}

function atualizarTudo(){
  atualizarPessoas();
  atualizarEquipamentos();
  atualizarEmprestimos();
  atualizarDanificados();
  atualizarRemocoes();
  atualizarSelects();
  atualizarUsuarios();
}

// ---------- Cadastro ----------
btnRegistrarPessoa.onclick = () => {
  const n = nome.value.trim();
  const t = telefone.value.trim();
  const c = curso.value.trim();
  const f = funcao.value;

  if (!n || !t || !c || !f) return alert('Preencha todos os campos.');

  dados.pessoas.push({
    id: uuid(),
    nome: n,
    telefone: t,
    curso: c,
    funcao: f,
    criadoEm: nowISO(),
    criadoPor: getSessao().usuario || 'Desconhecido',
    unidade: unidadeAtiva
  });

  nome.value = telefone.value = curso.value = '';
  funcao.value = '';

  salvar();
  atualizarTudo();
};

btnRegistrarEquip.onclick = () => {
  const n = nomeEquipamento.value.trim();
  const p = patrimonio.value.trim();
  const q = Number(quantidade.value);

  if (!n || !p || !q || q < 1) return alert('Preencha todos os campos corretamente.');

  if (dados.equipamentos.some(e => (e.patrimonio || '').trim() === p)){
    return alert('Já existe um equipamento com este patrimônio.');
  }

  dados.equipamentos.push({
    id: uuid(),
    nome: n,
    patrimonio: p,
    total: q,
    disponivel: q,
    danificados: 0,
    criadoEm: nowISO(),
    criadoPor: getSessao().usuario || 'Desconhecido',
    unidade: unidadeAtiva
  });

  nomeEquipamento.value = patrimonio.value = quantidade.value = '';

  salvar();
  atualizarTudo();
};

// ---------- Empréstimo / Devolução ----------
document.getElementById('btnEmprestar').onclick = () => {
  const pessoa = dados.pessoas.find(p => p.id === alunoEmprestimo.value);
  const equip = dados.equipamentos.find(e => e.id === equipEmprestimo.value);

  if (!pessoa || !equip) return alert('Selecione pessoa e equipamento.');
  if (equip.disponivel < 1) return alert('Equipamento indisponível.');

  dados.emprestimos.push({
    id: uuid(),
    alunoId: pessoa.id,
    alunoNome: pessoa.nome,
    curso: pessoa.curso,
    funcao: pessoa.funcao,

    equipamentoId: equip.id,
    equipamentoNome: equip.nome,
    patrimonio: equip.patrimonio,

    status: 'Emprestado',
    nota: '',
    dataEmprestimo: nowISO(),
    dataDevolucao: null,
    fezEmprestimo: getSessao().usuario || 'Desconhecido',
    fezDevolucao: '',
    unidade: unidadeAtiva
  });

  equip.disponivel -= 1;

  salvar();
  atualizarTudo();
};

document.getElementById('btnDevolver').onclick = () => {
  const emp = dados.emprestimos.find(e => e.id === devolucaoSelect.value);
  if (!emp) return alert('Selecione um empréstimo.');

  if (emp.status !== 'Emprestado') return alert('Este empréstimo já foi encerrado.');

  const equip = dados.equipamentos.find(e => e.id === emp.equipamentoId);
  const statusNovo = statusDevolucao.value; // Funcionando / Danificado
  const obs = notaDevolucao.value.trim();
  const foto = fotoDevolucaoDataUrl || null;

  if (equip){
    const total = Number(equip.total ?? 0);
    equip.danificados = Number(equip.danificados ?? 0);
    equip.disponivel = Number(equip.disponivel ?? 0);

    if (statusNovo === 'Danificado'){
      equip.danificados = Math.min(total, equip.danificados + 1);
      // não volta para disponível
    } else {
      // Funcionando
      const totalUtil = Math.max(0, total - equip.danificados);
      equip.disponivel = Math.min(totalUtil, equip.disponivel + 1);
    }
  }

  emp.status = statusNovo; // Funcionando / Danificado
  emp.nota = obs;
  emp.dataDevolucao = nowISO();
  emp.fezDevolucao = getSessao().usuario || 'Desconhecido';

  // Foto opcional do estado do equipamento na devolução
  emp.fotoDevolucao = foto;

  // Se voltou danificado, cria um registro na aba "Danificados"
  if (statusNovo === 'Danificado'){
    dados.danificados = Array.isArray(dados.danificados) ? dados.danificados : [];
    dados.danificados.push({
      id: uuid(),
      emprestimoId: emp.id,
      equipamentoId: emp.equipamentoId,
      equipamentoNome: emp.equipamentoNome,
      patrimonio: emp.patrimonio,
      pessoaNome: emp.alunoNome,
      curso: emp.curso,
      funcao: emp.funcao,
      observacao: obs,
      foto: foto,
      data: nowISO(),
      status: 'Danificado',
      registradoPor: getSessao().usuario || 'Desconhecido',
      resolvidoEm: null,
      resolvidoPor: '',
      unidade: unidadeAtiva
    });
  }

  notaDevolucao.value = '';
  limparFotoDevolucao();

  salvar();
  atualizarTudo();
};

// ---------- Remoções (ADM) ----------
function registrarRemocao(payload){
  dados.remocoes.push({
    id: uuid(),
    data: nowISO(),
    removidoPor: getSessao().usuario || 'Desconhecido',
    unidade: unidadeAtiva,
    ...payload
  });
}

function removerPessoa(id){
  if (!isAdmin()) return alert('Apenas ADM pode remover.');

  const pessoa = dados.pessoas.find(p => p.id === id);
  if (!pessoa) return;

  const temEmprestimoAberto = dados.emprestimos.some(e => e.alunoId === id && e.status === 'Emprestado');
  if (temEmprestimoAberto) return alert('Não é possível remover: pessoa com empréstimo em aberto.');

  const justificativa = prompt('Justificativa para remoção:') || '';

  dados.pessoas = dados.pessoas.filter(p => p.id !== id);
  registrarRemocao({ nome: pessoa.nome, tipo: 'Pessoa', patrimonio: '', justificativa });

  salvar();
  atualizarTudo();
}

function removerEquipamento(id){
  if (!isAdmin()) return alert('Apenas ADM pode remover.');

  const equip = dados.equipamentos.find(e => e.id === id);
  if (!equip) return;

  const temEmprestimoAberto = dados.emprestimos.some(e => e.equipamentoId === id && e.status === 'Emprestado');
  if (temEmprestimoAberto) return alert('Não é possível remover: equipamento com empréstimo em aberto.');

  const justificativa = prompt('Justificativa para remoção:') || '';

  dados.equipamentos = dados.equipamentos.filter(e => e.id !== id);
  registrarRemocao({ nome: equip.nome, tipo: 'Equipamento', patrimonio: equip.patrimonio, justificativa });

  salvar();
  atualizarTudo();
}

// ---------- EDIÇÃO: Pessoa ----------
function editarPessoa(id){
  const p = dados.pessoas.find(x => x.id === id);
  if (!p) return;

  abrirModal(
    'Editar Pessoa',
    `
      <div class="grid grid-4">
        <div class="field">
          <label>Nome</label>
          <input id="editNome" value="${esc(p.nome)}" />
        </div>
        <div class="field">
          <label>Telefone</label>
          <input id="editTelefone" value="${esc(p.telefone)}" />
        </div>
        <div class="field">
          <label>Curso</label>
          <input id="editCurso" value="${esc(p.curso)}" />
        </div>
        <div class="field">
          <label>Função</label>
          <select id="editFuncao">
            <option value="Aluno">Aluno</option>
            <option value="Professor">Professor</option>
            <option value="Colaborador">Colaborador</option>
          </select>
        </div>
      </div>
      <p class="muted" style="margin-top:8px;">Dica: ao salvar, os empréstimos desse cadastro também são atualizados.</p>
    `,
    () => {
      const n = document.getElementById('editNome').value.trim();
      const t = document.getElementById('editTelefone').value.trim();
      const c = document.getElementById('editCurso').value.trim();
      const f = document.getElementById('editFuncao').value;

      if (!n || !t || !c || !f) throw new Error('Preencha todos os campos.');

      p.nome = n;
      p.telefone = t;
      p.curso = c;
      p.funcao = f;
      p.atualizadoEm = nowISO();
      p.atualizadoPor = getSessao().usuario || 'Desconhecido';

      // atualizar histórico de empréstimos dessa pessoa
      dados.emprestimos.forEach(emp => {
        if (emp.alunoId === id){
          emp.alunoNome = n;
          emp.curso = c;
          emp.funcao = f;
        }
      });

      salvar();
      atualizarTudo();
    }
  );

  // set select
  const sel = document.getElementById('editFuncao');
  sel.value = p.funcao || 'Aluno';
}

// ---------- EDIÇÃO: Equipamento ----------
function editarEquipamento(id){
  const e = dados.equipamentos.find(x => x.id === id);
  if (!e) return;

  const total = Number(e.total ?? 0);
  const dan = Number(e.danificados ?? 0);
  const disp = Number(e.disponivel ?? 0);
  const totalUtil = Math.max(0, total - dan);
  const emprestados = Math.max(0, totalUtil - disp);

  abrirModal(
    'Editar Equipamento',
    `
      <div class="grid grid-4">
        <div class="field">
          <label>Nome</label>
          <input id="editEquipNome" value="${esc(e.nome)}" />
        </div>
        <div class="field">
          <label>Patrimônio</label>
          <input id="editEquipPat" value="${esc(e.patrimonio)}" />
        </div>
        <div class="field">
          <label>Total</label>
          <input id="editEquipTotal" type="number" min="${dan + emprestados}" value="${total}" />
          <div class="help">Mínimo: Danificados (${dan}) + Emprestados (${emprestados})</div>
        </div>
        <div class="field">
          <label>Danificados</label>
          <input id="editEquipDan" type="number" min="0" max="${total}" value="${dan}" />
          <div class="help">0 até Total</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:10px;">
        <div class="field">
          <label>Disponível (funcionando)</label>
          <input id="editEquipDisp" type="number" min="0" value="${disp}" />
          <div class="help">0 até (Total - Danificados)</div>
        </div>
        <div class="field">
          <label>Resumo</label>
          <input disabled value="Emprestados: ${emprestados} | Utilizáveis: ${totalUtil}" />
          <div class="help">Utilizáveis = Total - Danificados</div>
        </div>
      </div>

      <p class="muted" style="margin-top:8px;">
        Regra: Disponível só conta os que estão <b>funcionando</b>. Quando volta <b>Danificado</b>, ele vai para Danificados e não aparece como disponível.
      </p>
    `,
    () => {
      const nomeNovo = document.getElementById('editEquipNome').value.trim();
      const patNovo = document.getElementById('editEquipPat').value.trim();
      const totalNovo = Number(document.getElementById('editEquipTotal').value);
      const danNovo = Number(document.getElementById('editEquipDan').value);
      const dispNovo = Number(document.getElementById('editEquipDisp').value);

      if (!nomeNovo || !patNovo) throw new Error('Preencha Nome e Patrimônio.');
      if (!Number.isFinite(totalNovo) || totalNovo < 0) throw new Error('Total inválido.');
      if (!Number.isFinite(danNovo) || danNovo < 0) throw new Error('Danificados inválido.');
      if (danNovo > totalNovo) throw new Error('Danificados não pode ser maior que o Total.');

      // emprestados atuais (calculados a partir dos valores atuais antes de salvar)
      const totalAtual = Number(e.total ?? 0);
      const danAtual = Number(e.danificados ?? 0);
      const dispAtual = Number(e.disponivel ?? 0);
      const emprestadosAtual = Math.max(0, Math.max(0, totalAtual - danAtual) - dispAtual);

      // Com os novos valores, o total deve comportar danificados + emprestados
      if (totalNovo < danNovo + emprestadosAtual){
        throw new Error(`Total precisa ser >= Danificados (${danNovo}) + Emprestados (${emprestadosAtual}).`);
      }

      const totalUtilNovo = Math.max(0, totalNovo - danNovo);
      if (!Number.isFinite(dispNovo) || dispNovo < 0 || dispNovo > totalUtilNovo){
        throw new Error('Disponível precisa estar entre 0 e (Total - Danificados).');
      }

      // não permitir patrimônio duplicado
      const dup = dados.equipamentos.find(x => x.id !== id && (x.patrimonio || '').trim() === patNovo);
      if (dup) throw new Error('Já existe outro equipamento com esse patrimônio.');

      e.nome = nomeNovo;
      e.patrimonio = patNovo;
      e.total = totalNovo;
      e.danificados = danNovo;
      e.disponivel = dispNovo;
      e.atualizadoEm = nowISO();
      e.atualizadoPor = getSessao().usuario || 'Desconhecido';

      // atualizar histórico de empréstimos do equipamento
      dados.emprestimos.forEach(emp => {
        if (emp.equipamentoId === id){
          emp.equipamentoNome = nomeNovo;
          emp.patrimonio = patNovo;
        }
      });

      salvar();
      atualizarTudo();
    }
  );
}

// ---------- EDIÇÃO: Empréstimo ----------
function editarEmprestimo(id){
  const emp = dados.emprestimos.find(x => x.id === id);
  if (!emp) return;

  const fotoSection = emp.fotoDevolucao
    ? `
      <div class="card" style="margin:10px 0 0; box-shadow:none;">
        <h3 style="margin:0 0 10px;">Foto na devolução</h3>
        <div class="photo-preview" style="border-style:solid;">
          <img src="${esc(emp.fotoDevolucao)}" alt="Foto do equipamento na devolução" />
          <div style="display:flex; flex-direction:column; gap:8px;">
            <span class="muted">Esta foto foi salva no momento da devolução.</span>
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" id="editEmpRemoverFoto" />
              Remover esta foto
            </label>
          </div>
        </div>
      </div>
    `
    : `<p class="muted" style="margin-top:10px;">Sem foto registrada na devolução.</p>`;

  const pessoasOptions = dados.pessoas.map(p =>
    `<option value="${p.id}">${esc(p.nome)} (${esc(p.funcao)})</option>`
  ).join('');

  const equipsOptions = dados.equipamentos.map(e => {
    const total = Number(e.total ?? 0);
    const dan = Number(e.danificados ?? 0);
    const totalUtil = Math.max(0, total - dan);
    const disp = Number(e.disponivel ?? 0);
    return `<option value="${e.id}">${esc(e.nome)} - ${esc(e.patrimonio)} (${disp}/${totalUtil})</option>`;
  }).join('');

  const statusOptions = ['Emprestado','Funcionando','Danificado']
    .map(s => `<option value="${s}">${s}</option>`)
    .join('');

  abrirModal(
    'Editar Empréstimo',
    `
      <div class="grid grid-3">
        <div class="field">
          <label>Pessoa</label>
          <select id="editEmpPessoa">${pessoasOptions}</select>
        </div>
        <div class="field">
          <label>Equipamento</label>
          <select id="editEmpEquip">${equipsOptions}</select>
        </div>
        <div class="field">
          <label>Status</label>
          <select id="editEmpStatus">${statusOptions}</select>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="field">
          <label>Observação</label>
          <input id="editEmpNota" value="${esc(emp.nota || '')}" />
        </div>
        <div class="field">
          <label>Data Devolução (opcional)</label>
          <input id="editEmpDataDev" placeholder="ISO ou vazio" value="${esc(emp.dataDevolucao || '')}" />
          <div class="help">Se deixar vazio e status != Emprestado, o sistema preenche com agora.</div>
        </div>
      </div>

      <p class="muted" style="margin-top:8px;">
        Se o empréstimo estiver <b>Emprestado</b>, trocar equipamento ajusta o estoque automaticamente.
        Se mudar para <b>Funcionando/Danificado</b>, ele encerra e devolve ao estoque.
      </p>

      ${fotoSection}
    `,
    () => {
      const novaPessoaId = document.getElementById('editEmpPessoa').value;
      const novoEquipId = document.getElementById('editEmpEquip').value;
      const novoStatus = document.getElementById('editEmpStatus').value;
      const novaNota = document.getElementById('editEmpNota').value.trim();
      const dataDevRaw = document.getElementById('editEmpDataDev').value.trim();
      const removerFoto = !!document.getElementById('editEmpRemoverFoto')?.checked;

      const p = dados.pessoas.find(x => x.id === novaPessoaId);
      const equipNovo = dados.equipamentos.find(x => x.id === novoEquipId);
      if (!p) throw new Error('Pessoa inválida.');
      if (!equipNovo) throw new Error('Equipamento inválido.');

      const equipAnt = dados.equipamentos.find(x => x.id === emp.equipamentoId);

      // 1) Troca de pessoa (sempre pode)
      emp.alunoId = p.id;
      emp.alunoNome = p.nome;
      emp.curso = p.curso;
      emp.funcao = p.funcao;

      // 2) Troca de equipamento
      const mudouEquip = emp.equipamentoId !== equipNovo.id;
      if (mudouEquip){
        // se empréstimo está em aberto, precisa ajustar estoque
        if (emp.status === 'Emprestado'){
          if (equipNovo.disponivel < 1) throw new Error('Novo equipamento sem disponibilidade.');
          // devolve 1 ao antigo
          if (equipAnt) equipAnt.disponivel += 1;
          // retira 1 do novo
          equipNovo.disponivel -= 1;
        }

        emp.equipamentoId = equipNovo.id;
        emp.equipamentoNome = equipNovo.nome;
        emp.patrimonio = equipNovo.patrimonio;
      }

      // 3) Status (controla devolução/reabertura)
      const statusAnt = emp.status;

      const equipAtual = dados.equipamentos.find(x => x.id === emp.equipamentoId);
      if (!equipAtual) throw new Error('Equipamento atual não encontrado.');

      // normaliza estoque
      equipAtual.total = Number(equipAtual.total ?? 0);
      equipAtual.danificados = Number(equipAtual.danificados ?? 0);
      equipAtual.disponivel = Number(equipAtual.disponivel ?? 0);

      // --- Reabrir para Emprestado (se estava devolvido) ---
      if (statusAnt !== 'Emprestado' && novoStatus === 'Emprestado'){
        if (statusAnt === 'Funcionando'){
          if (equipAtual.disponivel < 1) throw new Error('Sem disponibilidade para reabrir como Emprestado.');
          equipAtual.disponivel -= 1;
        } else if (statusAnt === 'Danificado'){
          if (equipAtual.danificados < 1) throw new Error('Não há item danificado para reabrir (corrigir).');
          equipAtual.danificados -= 1;
          // o item saiu de Danificados e virou Emprestado (não precisa mexer em disponível)
        }

        emp.status = 'Emprestado';
        emp.dataDevolucao = null;
        emp.fezDevolucao = '';
        emp.fotoDevolucao = null;
      }

      // --- Encerrar (se estava Emprestado) ---
      if (statusAnt === 'Emprestado' && novoStatus !== 'Emprestado'){
        if (novoStatus === 'Danificado'){
          equipAtual.danificados = Math.min(equipAtual.total, equipAtual.danificados + 1);
        } else {
          const totalUtil = Math.max(0, equipAtual.total - equipAtual.danificados);
          equipAtual.disponivel = Math.min(totalUtil, equipAtual.disponivel + 1);
        }

        emp.status = novoStatus;
        emp.dataDevolucao = dataDevRaw || nowISO();
        emp.fezDevolucao = getSessao().usuario || emp.fezDevolucao || 'Desconhecido';
      }

      // --- Corrigir dentro de devolvido (Funcionando <-> Danificado) ---
      if (statusAnt !== 'Emprestado' && novoStatus !== 'Emprestado'){
        if (statusAnt != novoStatus){
          if (statusAnt === 'Funcionando' && novoStatus === 'Danificado'){
            if (equipAtual.disponivel < 1) throw new Error('Sem disponível suficiente para marcar como Danificado.');
            equipAtual.disponivel -= 1;
            equipAtual.danificados = Math.min(equipAtual.total, equipAtual.danificados + 1);
          }
          if (statusAnt === 'Danificado' && novoStatus === 'Funcionando'){
            if (equipAtual.danificados < 1) throw new Error('Sem danificados suficientes para marcar como Funcionando.');
            equipAtual.danificados -= 1;
            const totalUtil = Math.max(0, equipAtual.total - equipAtual.danificados);
            equipAtual.disponivel = Math.min(totalUtil, equipAtual.disponivel + 1);
          }
        }

        emp.status = novoStatus;
        emp.dataDevolucao = dataDevRaw || emp.dataDevolucao || nowISO();
      }

      // --- Permaneceu Emprestado ---
      if (statusAnt === 'Emprestado' && novoStatus === 'Emprestado'){
        emp.status = 'Emprestado';
        emp.dataDevolucao = null;
        emp.fotoDevolucao = null;
      }

      emp.nota = novaNota;

      if (removerFoto) emp.fotoDevolucao = null;

      salvar();
      atualizarTudo();
    }
  );

  // set values
  document.getElementById('editEmpPessoa').value = emp.alunoId;
  document.getElementById('editEmpEquip').value = emp.equipamentoId;
  document.getElementById('editEmpStatus').value = emp.status;
}

function verFotoDevolucao(id){
  const emp = dados.emprestimos.find(x => x.id === id);
  if (!emp) return;
  if (!emp.fotoDevolucao) return alert('Este empréstimo não tem foto de devolução.');

  abrirModalVisualizacao(
    `Foto — ${esc(emp.equipamentoNome)}`,
    `<div class="photo-preview" style="border:none; padding:0;">
       <img src="${esc(emp.fotoDevolucao)}" alt="Foto do equipamento na devolução" />
     </div>`
  );
}

function verFotoDanificado(id){
  const d = (dados.danificados || []).find(x => x.id === id);
  if (!d) return;
  if (!d.foto) return alert('Este registro não possui foto.');

  abrirModalVisualizacao(
    `Foto — Danificado — ${esc(d.equipamentoNome || '')}`,
    `<div class="photo-preview" style="border:none; padding:0;">
       <img src="${esc(d.foto)}" alt="Foto do equipamento danificado" />
     </div>`
  );
}

function marcarConsertado(id){
  if (!isAdmin()) return alert('Apenas ADM pode marcar como consertado.');
  const d = (dados.danificados || []).find(x => x.id === id);
  if (!d) return;
  if ((d.status || 'Danificado') !== 'Danificado') return alert('Este registro já foi resolvido.');

  const equip = dados.equipamentos.find(e => e.id === d.equipamentoId);
  if (!equip) return alert('Equipamento não encontrado (talvez tenha sido removido).');

  equip.total = Number(equip.total ?? 0);
  equip.danificados = Number(equip.danificados ?? 0);
  equip.disponivel = Number(equip.disponivel ?? 0);

  if (equip.danificados < 1) return alert('Não há itens danificados para este equipamento.');

  // 1) Sai de danificados
  equip.danificados = Math.max(0, equip.danificados - 1);

  // 2) Volta para disponível (respeitando o limite de utilizáveis)
  const totalUtil = Math.max(0, equip.total - equip.danificados);
  equip.disponivel = Math.min(totalUtil, equip.disponivel + 1);

  d.status = 'Consertado';
  d.resolvidoEm = nowISO();
  d.resolvidoPor = getSessao().usuario || 'Desconhecido';

  salvar();
  atualizarTudo();
}

function darBaixaDanificado(id){
  if (!isAdmin()) return alert('Apenas ADM pode dar baixa.');
  const d = (dados.danificados || []).find(x => x.id === id);
  if (!d) return;
  if ((d.status || 'Danificado') !== 'Danificado') return alert('Este registro já foi resolvido.');

  const equip = dados.equipamentos.find(e => e.id === d.equipamentoId);
  if (!equip) return alert('Equipamento não encontrado (talvez já tenha sido removido).');

  if (!confirm('Dar baixa neste item danificado? Isso reduz o total do equipamento em 1.')) return;

  equip.total = Number(equip.total ?? 0);
  equip.danificados = Number(equip.danificados ?? 0);
  equip.disponivel = Number(equip.disponivel ?? 0);

  if (equip.danificados < 1) return alert('Não há itens danificados para dar baixa.');
  if (equip.total < 1) return alert('Total inválido.');

  // calcula emprestados atuais com os valores ANTES de mexer
  const totalUtilAtual = Math.max(0, equip.total - equip.danificados);
  const emprestados = Math.max(0, totalUtilAtual - equip.disponivel);

  // após dar baixa: total -1 e danificados -1
  const novoTotal = equip.total - 1;
  const novoDan = equip.danificados - 1;
  if (novoTotal < 0) return alert('Operação inválida.');
  if (novoTotal < novoDan + emprestados){
    return alert('Não é possível dar baixa agora: o total ficaria menor que (danificados + emprestados).');
  }

  equip.total = novoTotal;
  equip.danificados = Math.max(0, novoDan);

  // ajusta disponível para não passar do limite de utilizáveis
  const novoTotalUtil = Math.max(0, equip.total - equip.danificados);
  equip.disponivel = Math.min(Math.max(0, equip.disponivel), novoTotalUtil);

  // se total zerou, remove o equipamento do sistema
  if (equip.total === 0){
    dados.equipamentos = dados.equipamentos.filter(e => e.id !== equip.id);
  }

  registrarRemocao({
    nome: d.equipamentoNome || equip.nome,
    tipo: 'Equipamento',
    patrimonio: d.patrimonio || equip.patrimonio,
    justificativa: `Baixa por dano (sem conserto). Obs: ${d.observacao || '-'}`
  });

  d.status = 'Baixado';
  d.resolvidoEm = nowISO();
  d.resolvidoPor = getSessao().usuario || 'Desconhecido';

  salvar();
  atualizarTudo();
}

window.editarPessoa = editarPessoa;
window.editarEquipamento = editarEquipamento;
window.editarEmprestimo = editarEmprestimo;
window.verFotoDevolucao = verFotoDevolucao;
window.verFotoDanificado = verFotoDanificado;
window.marcarConsertado = marcarConsertado;
window.darBaixaDanificado = darBaixaDanificado;
window.removerPessoa = removerPessoa;
window.removerEquipamento = removerEquipamento;

// ---------- Relatórios ----------
btnGerarRel.onclick = () => {
  const ini = document.getElementById('relDataInicio').value;
  const fim = document.getElementById('relDataFim').value;

  const tipo = (document.getElementById('relTipo')?.value || 'emprestimos');
  const funcFil = (document.getElementById('relFuncao')?.value || 'todos');

  const iniDt = ini ? new Date(ini + 'T00:00:00') : null;
  const fimDt = fim ? new Date(fim + 'T23:59:59') : null;

  const filtraData = (iso) => {
    if (!iniDt && !fimDt) return true;
    const d = new Date(iso);
    if (iniDt && d < iniDt) return false;
    if (fimDt && d > fimDt) return false;
    return true;
  };

  let lista = [];
  if (tipo === 'danificados'){
    lista = (dados.danificados || [])
      .filter(d => (d.unidade || 'SEDE') === unidadeAtiva)
      .filter(d => funcFil === 'todos' ? true : (d.funcao === funcFil))
      .filter(d => filtraData(d.data || d.dataRegistro || d.dataEmprestimo || nowISO()));
  } else {
    lista = (dados.emprestimos || [])
      .filter(emp => (emp.unidade || 'SEDE') === unidadeAtiva)
      .filter(emp => funcFil === 'todos' ? true : (emp.funcao === funcFil))
      .filter(emp => filtraData(emp.dataEmprestimo));
  }

  const titulo = (tipo === 'danificados') ? 'Relatório de Danificados' : 'Relatório de Reservas';
  const unidadeTxt = (unidadeAtiva === 'ANEXO2') ? 'Anexo II' : 'Sede';

  let html = `
    <div id="relatorioCard">
      <h2>${titulo}</h2>
      <p class="muted">
        Unidade: <b>${unidadeTxt}</b>
        ${ini ? (' • De: ' + ini) : ''}
        ${fim ? (' • Até: ' + fim) : ''}
        ${(funcFil !== 'todos') ? (' • Função: ' + funcFil) : ''}
      </p>
      <div class="table-wrap no-mobile-cards">
        <table>
          <thead>
  `;

  if (tipo === 'danificados'){
    html += `
      <tr>
        <th>Equipamento</th>
        <th>Patrimônio</th>
        <th>Pessoa</th>
        <th>Função</th>
        <th>Data</th>
        <th>Observação</th>
        <th>Status</th>
      </tr>
    </thead><tbody>
    `;

    lista
      .slice()
      .sort((a,b) => (b.data || '').localeCompare(a.data || ''))
      .forEach(d => {
        html += `
          <tr>
            <td>${esc(d.equipamentoNome || d.equipamento || '-')}</td>
            <td>${esc(d.patrimonio || '-')}</td>
            <td>${esc(d.pessoaNome || d.pessoa || '-')}</td>
            <td>${esc(d.funcao || '-')}</td>
            <td>${fmtData(d.data || '')}</td>
            <td>${esc(d.observacao || d.obs || '-')}</td>
            <td>${esc(d.status || 'Danificado')}</td>
          </tr>
        `;
      });

  } else {
    html += `
      <tr>
        <th>Equipamento</th>
        <th>Nome</th>
        <th>Função</th>
        <th>Status</th>
        <th>Observação</th>
        <th>Data Empréstimo</th>
        <th>Data Devolução</th>
        <th>Registrado por</th>
        <th>Devolvido por</th>
      </tr>
    </thead><tbody>
    `;

    lista
      .slice()
      .sort((a,b) => (b.dataEmprestimo || '').localeCompare(a.dataEmprestimo || ''))
      .forEach(emp => {
        html += `
          <tr>
            <td>${esc(emp.equipamentoNome || '-')}</td>
            <td>${esc(emp.alunoNome || '-')}</td>
            <td>${esc(emp.funcao || '-')}</td>
            <td>${esc(emp.status || '-')}</td>
            <td>${esc(emp.nota || '-')}</td>
            <td>${fmtData(emp.dataEmprestimo)}</td>
            <td>${emp.dataDevolucao ? fmtData(emp.dataDevolucao) : '-'}</td>
            <td>${esc(emp.fezEmprestimo || '-')}</td>
            <td>${esc(emp.fezDevolucao || '-')}</td>
          </tr>
        `;
      });
  }

  html += `</tbody></table></div></div>`;
  listaRelatorio.innerHTML = html;
};

// Imprime apenas o relatório (não muda layout da tela, só modo de impressão)
btnImprimirRel.onclick = () => {
  document.body.classList.add('print-mode');
  window.print();
  // remove depois para voltar ao normal
  setTimeout(() => document.body.classList.remove('print-mode'), 250);
};

// ---------- Usuários (ADM) ----------
function criarUsuario(usuario, senha, role){
  if (!isAdmin()) return alert('Apenas ADM pode criar usuários.');

  usuario = (usuario || '').trim();
  senha = (senha || '').trim();
  role = role || 'funcionario';

  if (!usuario || !senha) return alert('Preencha usuário e senha.');
  if (usuariosSistema.some(u => u.usuario === usuario)) return alert('Usuário já existe.');

  usuariosSistema.push({ id: uuid(), usuario, senha, role });
  salvarUsuarios();
  atualizarUsuarios();

  novoUsuario.value = '';
  novaSenha.value = '';
  novoCargo.value = 'funcionario';
}

function editarSenhaUsuario(id){
  if (!isAdmin()) return alert('Apenas ADM pode editar senhas.');
  const u = usuariosSistema.find(x => x.id === id);
  if (!u) return;

  abrirModal(
    `Editar senha — ${esc(u.usuario)}`,
    `
      <div class="grid grid-2">
        <div class="field">
          <label>Nova senha</label>
          <input id="editSenha1" type="password" placeholder="Digite a nova senha" />
        </div>
        <div class="field">
          <label>Confirmar senha</label>
          <input id="editSenha2" type="password" placeholder="Repita a nova senha" />
        </div>
      </div>
      <p class="muted" style="margin-top:8px;">Dica: use uma senha diferente da antiga e evite senhas muito curtas.</p>
    `,
    () => {
      const s1 = (document.getElementById('editSenha1').value || '').trim();
      const s2 = (document.getElementById('editSenha2').value || '').trim();

      if (!s1 || !s2) throw new Error('Preencha a nova senha e a confirmação.');
      if (s1.length < 4) throw new Error('Senha muito curta (mínimo 4 caracteres).');
      if (s1 !== s2) throw new Error('As senhas não coincidem.');

      u.senha = s1;
      salvarUsuarios();
      atualizarUsuarios();
    }
  );
}

window.editarSenhaUsuario = editarSenhaUsuario;

function removerUsuario(id){
  if (!isAdmin()) return alert('Apenas ADM pode remover usuários.');
  const u = usuariosSistema.find(x => x.id === id);
  if (!u) return;
  if (u.usuario === 'admin') return alert('Não é possível remover o admin padrão.');

  if (!confirm('Remover usuário "' + u.usuario + '"?')) return;
  usuariosSistema = usuariosSistema.filter(x => x.id !== id);
  salvarUsuarios();
  atualizarUsuarios();
}

window.removerUsuario = removerUsuario;

if (btnCriarUsuario){
  btnCriarUsuario.onclick = () => criarUsuario(novoUsuario.value, novaSenha.value, novoCargo.value);
}

// ---------- Reset do Sistema (ADM) ----------
function resetarSistema(){
  if (!isAdmin()) return alert('Apenas ADM pode resetar.');
  if (!confirm('Tem certeza? Isso apaga Pessoas, Equipamentos, Empréstimos e Remoções.')) return;

  dados = { pessoas: [], equipamentos: [], emprestimos: [], danificados: [], remocoes: [] };
  salvar();
  atualizarTudo();
}

window.resetarSistema = resetarSistema;

if (btnResetSistemaAdmin){
  btnResetSistemaAdmin.onclick = resetarSistema;
}

// ---------- Inicialização ----------
(function init(){
  migrarDados();
  if (!verificarLogin()) return;

  mostrarUsuarioNoHeader();
  aplicarPermissoes();

  // Unidade (Sede / Anexo II) - evita misturar dados
  bindUnidadeUI();
  atualizarUnidadeUI();

  atualizarTudo();

  // Pesquisa por aba (em todos os campos)
  const bindSearch = (el, key) => {
    if (!el) return;
    el.addEventListener('input', () => {
      pesquisa[key] = el.value || '';
      // atualiza apenas a tabela necessária
      if (key === 'pessoas') return atualizarPessoas();
      if (key === 'equipamentos') return atualizarEquipamentos();
      if (key === 'emprestimos') return atualizarEmprestimos();
      if (key === 'danificados') return atualizarDanificados();
      if (key === 'remocoes') return atualizarRemocoes();
      if (key === 'usuarios') return atualizarUsuarios();
    });
  };

  bindSearch(searchPessoas, 'pessoas');
  bindSearch(searchEquipamentos, 'equipamentos');
  bindSearch(searchEmprestimos, 'emprestimos');
  bindSearch(searchDanificados, 'danificados');
  bindSearch(searchRemocoes, 'remocoes');
  bindSearch(searchUsuarios, 'usuarios');

  // cada devolução começa "limpa" (sem reaproveitar foto anterior)
  if (devolucaoSelect){
    devolucaoSelect.addEventListener('change', () => {
      limparFotoDevolucao();
    });
  }
})();
