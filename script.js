// ============================
// Sistema de Reserva - FINAL
// ============================

function uuid() {
  return (crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now();
}

function esc(t) {
  return (t || '').toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}

let dados = JSON.parse(localStorage.getItem("faculdadeDados")) || {
  pessoas: [],
  equipamentos: [],
  emprestimos: [],
  remocoes: []
};

function salvar() {
  localStorage.setItem("faculdadeDados", JSON.stringify(dados));
}

// Elementos
const nome = document.getElementById("nome");
const telefone = document.getElementById("telefone");
const curso = document.getElementById("curso");
const funcao = document.getElementById("funcao");
const btnRegistrarPessoa = document.getElementById("btnRegistrarPessoa");

const nomeEquipamento = document.getElementById("nomeEquipamento");
const patrimonio = document.getElementById("patrimonio");
const quantidade = document.getElementById("quantidade");
const btnRegistrarEquip = document.getElementById("btnRegistrarEquip");

const alunoEmprestimo = document.getElementById("alunoEmprestimo");
const equipEmprestimo = document.getElementById("equipEmprestimo");
const devolucaoSelect = document.getElementById("devolucaoSelect");
const statusDevolucao = document.getElementById("statusDevolucao");
const notaDevolucao = document.getElementById("notaDevolucao");

const tabelaPessoas = document.querySelector("#tabelaPessoas tbody");
const tabelaEquipamentos = document.querySelector("#tabelaEquipamentos tbody");
const tabelaEmprestimos = document.querySelector("#tabelaEmprestimos tbody");
const tabelaRemocoes = document.querySelector("#tabelaRemocoes tbody");

const btnGerarRel = document.getElementById("btnGerarRel");
const btnImprimirRel = document.getElementById("btnImprimirRel");
const resumoRelatorio = document.getElementById("resumoRelatorio");
const listaRelatorio = document.getElementById("listaRelatorio");

// Abas principais
document.querySelectorAll('.tab').forEach(t => {
  if (t.dataset.aba) {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      t.classList.add('active');
      document.getElementById(t.dataset.aba).classList.add('active');
    });
  }
});

// ============================
// Filtros
let filtroPessoa = "Aluno";
let filtroEmprestimo = "Aluno";

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

// ============================
// Atualizações

function atualizarPessoas(){
  tabelaPessoas.innerHTML = '';
  dados.pessoas.filter(p => p.funcao === filtroPessoa).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(p.nome)}</td>
      <td>${esc(p.telefone)}</td>
      <td>${esc(p.curso)}</td>
      <td>${esc(p.funcao)}</td>
      <td><button onclick="removerPessoa('${p.id}')">Remover</button></td>`;
    tabelaPessoas.appendChild(tr);
  });
}

function atualizarEmprestimos(){
  tabelaEmprestimos.innerHTML = '';
  dados.emprestimos.filter(e => e.funcao === filtroEmprestimo).forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${emp.equipamentoNome}</td>
      <td>${emp.alunoNome}</td>
      <td>${emp.curso}</td>
      <td>${emp.funcao}</td>
      <td>${emp.status}</td>
      <td>${emp.nota || '-'}</td>
      <td>${new Date(emp.dataEmprestimo).toLocaleString()}</td>
      <td>${emp.dataDevolucao ? new Date(emp.dataDevolucao).toLocaleString() : '-'}</td>`;
    tabelaEmprestimos.appendChild(tr);
  });
}

function atualizarEquipamentos(){
  tabelaEquipamentos.innerHTML = '';
  dados.equipamentos.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(e.nome)}</td>
      <td>${esc(e.patrimonio || '-')}</td>
      <td>${e.quantidade}</td>
      <td>${e.quantidade > 0 ? 'Disponível' : 'Indisponível'}</td>
      <td><button onclick="removerEquipamento('${e.id}')">Remover</button></td>`;
    tabelaEquipamentos.appendChild(tr);
  });

  alunoEmprestimo.innerHTML = '<option value="">Selecione</option>';
  dados.pessoas.forEach(p => {
    alunoEmprestimo.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
  });

  equipEmprestimo.innerHTML = '<option value="">Selecione</option>';
  dados.equipamentos.filter(e => e.quantidade > 0).forEach(e => {
    equipEmprestimo.innerHTML += `<option value="${e.id}">${e.nome}</option>`;
  });

  devolucaoSelect.innerHTML = '<option value="">Selecione</option>';
  dados.emprestimos.filter(e => e.status === 'Emprestado').forEach(e => {
    devolucaoSelect.innerHTML += `<option value="${e.id}">${e.equipamentoNome} - ${e.alunoNome}</option>`;
  });
}

function atualizarRemocoes(){
  tabelaRemocoes.innerHTML = '';
  dados.remocoes.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.nome}</td>
      <td>${r.tipo}</td>
      <td>${r.patrimonio}</td>
      <td>${r.justificativa}</td>
      <td>${new Date(r.data).toLocaleString()}</td>`;
    tabelaRemocoes.appendChild(tr);
  });
}

function atualizarTudo(){
  atualizarPessoas();
  atualizarEmprestimos();
  atualizarEquipamentos();
  atualizarRemocoes();
}

// ============================
// Remover

window.removerPessoa = function(id) {
  const p = dados.pessoas.find(p => p.id === id);
  if (!p) return;

  if (dados.emprestimos.some(e => e.alunoId === id && e.status === 'Emprestado')) {
    return alert("Essa pessoa possui empréstimos ativos.");
  }

  const motivo = prompt("Motivo da remoção:");
  if (!motivo) return;

  dados.remocoes.push({
    nome: p.nome, tipo: 'Pessoa', patrimonio: '-', justificativa: motivo,
    data: new Date().toISOString()
  });

  dados.pessoas = dados.pessoas.filter(x => x.id !== id);
  salvar();
  atualizarTudo();
};

window.removerEquipamento = function(id) {
  const e = dados.equipamentos.find(e => e.id === id);
  if (!e) return;

  if (dados.emprestimos.some(x => x.equipamentoId === id && x.status === 'Emprestado')) {
    return alert("Esse equipamento está emprestado.");
  }

  const motivo = prompt("Motivo:");
  if (!motivo) return;

  dados.remocoes.push({
    nome: e.nome, tipo: 'Equipamento', patrimonio: e.patrimonio || '-',
    justificativa: motivo, data: new Date().toISOString()
  });

  dados.equipamentos = dados.equipamentos.filter(x => x.id !== id);
  salvar();
  atualizarTudo();
};

// ============================
// Registrar

btnRegistrarPessoa.onclick = () => {
  if (!nome.value || !telefone.value || !curso.value || !funcao.value) return alert("Preencha tudo");

  dados.pessoas.push({
    id: uuid(),
    nome: nome.value,
    telefone: telefone.value,
    curso: curso.value,
    funcao: funcao.value
  });

  nome.value = telefone.value = curso.value = funcao.value = "";
  salvar();
  atualizarTudo();
};

btnRegistrarEquip.onclick = () => {
  if (!nomeEquipamento.value || quantidade.value < 1) return alert("Preencha corretamente");

  dados.equipamentos.push({
    id: uuid(),
    nome: nomeEquipamento.value,
    patrimonio: patrimonio.value,
    quantidade: Number(quantidade.value)
  });

  nomeEquipamento.value = patrimonio.value = quantidade.value = "";
  salvar();
  atualizarTudo();
};

// ============================
// Empréstimo

document.getElementById('btnEmprestar').onclick = () => {
  const p = dados.pessoas.find(p => p.id === alunoEmprestimo.value);
  const e = dados.equipamentos.find(e => e.id === equipEmprestimo.value);
  if (!p || !e || e.quantidade < 1) return;

  dados.emprestimos.push({
    id: uuid(),
    alunoId: p.id,
    alunoNome: p.nome,
    curso: p.curso,
    funcao: p.funcao,
    equipamentoId: e.id,
    equipamentoNome: e.nome,
    status: 'Emprestado',
    nota: '',
    dataEmprestimo: new Date().toISOString(),
    dataDevolucao: null
  });

  e.quantidade--;
  salvar();
  atualizarTudo();
};

// ============================
// Devolução

document.getElementById('btnDevolver').onclick = () => {
  const emp = dados.emprestimos.find(e => e.id === devolucaoSelect.value);
  if (!emp) return;

  emp.status = statusDevolucao.value;
  emp.nota = notaDevolucao.value;
  emp.dataDevolucao = new Date().toISOString();

  const equip = dados.equipamentos.find(e => e.id === emp.equipamentoId);
  if (equip) equip.quantidade++;

  salvar();
  atualizarTudo();
};

// ============================
// Relatório

btnGerarRel.onclick = () => {
  let html = `
    <h2>Relatório Completo de Empréstimos</h2>
    <table>
      <tr>
        <th>Equipamento</th>
        <th>Nome</th>
        <th>Função</th>
        <th>Status</th>
        <th>Observação</th>
        <th>Data Empréstimo</th>
        <th>Data Devolução</th>
      </tr>
  `;

  dados.emprestimos.forEach(emp => {
    html += `
      <tr>
        <td>${emp.equipamentoNome}</td>
        <td>${emp.alunoNome}</td>
        <td>${emp.funcao}</td>
        <td>${emp.status}</td>
        <td>${emp.nota || '-'}</td>
        <td>${new Date(emp.dataEmprestimo).toLocaleString()}</td>
        <td>${emp.dataDevolucao ? new Date(emp.dataDevolucao).toLocaleString() : '-'}</td>
      </tr>`;
  });

  html += '</table>';
  listaRelatorio.innerHTML = html;
};

btnImprimirRel.onclick = () => window.print();

// ============================
// Reset

function resetarSistema() {
  if (confirm("Deseja apagar todos os dados?")) {
    localStorage.removeItem("faculdadeDados");
    location.reload();
  }
}

// Inicial
atualizarTudo();
