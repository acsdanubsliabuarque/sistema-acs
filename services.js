function nowIso() {
  return new Date().toISOString();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function safeString(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDateBR(value) {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

function diffDays(fromDate, toDate = new Date()) {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  if (!from || !to) return null;

  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function calculateAge(dataNascimento) {
  const nascimento = parseDate(dataNascimento);
  if (!nascimento) return null;

  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();

  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }

  return idade;
}

function calculateDPP(dum) {
  const dumDate = parseDate(dum);
  if (!dumDate) return null;

  const dpp = new Date(dumDate);
  dpp.setDate(dpp.getDate() + 280);
  return dpp.toISOString();
}

function calculateGestationalAge(dum) {
  const dumDate = parseDate(dum);
  if (!dumDate) return { semanas: null, dias: null, totalDias: null };

  const totalDias = diffDays(dumDate, new Date());
  if (totalDias === null || totalDias < 0) {
    return { semanas: 0, dias: 0, totalDias: 0 };
  }

  const semanas = Math.floor(totalDias / 7);
  const dias = totalDias % 7;

  return { semanas, dias, totalDias };
}

function isChildByAge(idade) {
  return typeof idade === "number" && idade >= 0 && idade < 12;
}

function isElderlyByAge(idade) {
  return typeof idade === "number" && idade >= 60;
}

function buildFullAddress(domicilio) {
  if (!domicilio) return "Endereço não encontrado";

  const partes = [
    safeString(domicilio.endereco),
    safeString(domicilio.numero),
    safeString(domicilio.complemento)
  ].filter(Boolean);

  return partes.length ? partes.join(", ") : "Endereço não informado";
}

function likeMatch(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function dataOrEmpty(value) {
  return value || "";
}

function generateVisitDurationMinutes(horaInicio, horaFim) {
  const inicio = parseDate(horaInicio);
  const fim = parseDate(horaFim);

  if (!inicio || !fim) return null;

  const ms = fim.getTime() - inicio.getTime();
  if (ms < 0) return null;

  return Math.floor(ms / (1000 * 60));
}
async function getDomicilioById(id) {
  return await getById("domicilios", id);
}

async function getMoradorById(id) {
  return await getById("moradores", id);
}

async function getPendenciaById(id) {
  return await getById("pendencias", id);
}

async function getReceitaById(id) {
  return await getById("receitas", id);
}

async function getVisitaById(id) {
  return await getById("visitas", id);
}

async function criarDomicilio(dados = {}) {
  const payload = {
    endereco: safeString(dados.endereco),
    numero: safeString(dados.numero),
    complemento: safeString(dados.complemento),
    referencia: safeString(dados.referencia),
    microarea: safeString(dados.microarea),
    telefone: safeString(dados.telefone),
    dataCadastro: nowIso(),
    semResponsavelAlertaManual: false
  };

  return await add("domicilios", payload);
}

async function atualizarDomicilio(id, dados = {}) {
  const atual = await getDomicilioById(id);
  if (!atual) throw new Error("Domicílio não encontrado");

  const payload = {
    ...atual,
    endereco: dados.endereco !== undefined ? safeString(dados.endereco) : atual.endereco,
    numero: dados.numero !== undefined ? safeString(dados.numero) : atual.numero,
    complemento: dados.complemento !== undefined ? safeString(dados.complemento) : atual.complemento,
    referencia: dados.referencia !== undefined ? safeString(dados.referencia) : atual.referencia,
    microarea: dados.microarea !== undefined ? safeString(dados.microarea) : atual.microarea,
    telefone: dados.telefone !== undefined ? safeString(dados.telefone) : atual.telefone
  };

  await update("domicilios", payload);
  return payload;
}

async function listarDomicilios() {
  return await getAll("domicilios");
}

async function buscarDomicilios(termo = "") {
  const todos = await getAll("domicilios");
  const q = safeString(termo);

  if (!q) return todos.sort((a, b) => String(a.endereco).localeCompare(String(b.endereco)));

  return todos.filter(d =>
    likeMatch(d.endereco, q) ||
    likeMatch(d.numero, q) ||
    likeMatch(d.complemento, q) ||
    likeMatch(d.referencia, q) ||
    likeMatch(d.microarea, q) ||
    likeMatch(d.telefone, q)
  );
}

async function podeExcluirDomicilio(id) {
  const moradores = await getAll("moradores");
  const visitas = await getAll("visitas");

  const temMoradores = moradores.some(m => m.domicilioId === id);
  const temVisitas = visitas.some(v => v.domicilioId === id);

  return {
    pode: !temMoradores && !temVisitas,
    motivo: temMoradores
      ? "Domicílio possui moradores vinculados"
      : temVisitas
      ? "Domicílio possui visitas vinculadas"
      : ""
  };
}

async function excluirDomicilio(id) {
  const check = await podeExcluirDomicilio(id);
  if (!check.pode) throw new Error(check.motivo);

  await remove("domicilios", id);
  return true;
}

async function domicilioTemResponsavel(domicilioId) {
  const moradores = await getAll("moradores");
  return moradores.some(m => m.domicilioId === domicilioId && m.ehResponsavel === true);
}

async function existeOutroResponsavelNoDomicilio(domicilioId, moradorIdIgnorar = null) {
  const moradores = await getAll("moradores");

  return moradores.some(m =>
    m.domicilioId === domicilioId &&
    m.ehResponsavel === true &&
    m.id !== moradorIdIgnorar
  );
}

async function criarMorador(dados = {}) {
  const nome = safeString(dados.nome);
  const domicilioId = dados.domicilioId;

  if (!domicilioId) throw new Error("Morador precisa estar vinculado a um domicílio");

  const domicilio = await getDomicilioById(domicilioId);
  if (!domicilio) throw new Error("Domicílio não encontrado");

  if (dados.ehResponsavel) {
    const existe = await existeOutroResponsavelNoDomicilio(domicilioId);
    if (existe) throw new Error("Já existe um responsável familiar nesse domicílio");
  }

  const idade = calculateAge(dados.dataNascimento);

  const payload = {
    domicilioId: domicilioId,
    nome: nome,
    dataNascimento: dataOrEmpty(dados.dataNascimento),
    sexo: safeString(dados.sexo),

    cpf: onlyDigits(dados.cpf),
    cns: onlyDigits(dados.cns),

    ehResponsavel: !!dados.ehResponsavel,

    responsavelNome: safeString(dados.responsavelNome),
    responsavelNascimento: dataOrEmpty(dados.responsavelNascimento),
    parentesco: safeString(dados.parentesco),

    gestante: !!dados.gestante,
    hipertenso: !!dados.hipertenso,
    diabetico: !!dados.diabetico,
    saudeMental: !!dados.saudeMental,
    acamado: !!dados.acamado,

    idoso: isElderlyByAge(idade),
    crianca: isChildByAge(idade),

    dataCadastro: nowIso()
  };

  return await add("moradores", payload);
}

async function atualizarMorador(id, dados = {}) {
  const atual = await getMoradorById(id);
  if (!atual) throw new Error("Morador não encontrado");

  const novoDomicilioId = dados.domicilioId !== undefined ? dados.domicilioId : atual.domicilioId;
  const novoEhResponsavel = dados.ehResponsavel !== undefined ? !!dados.ehResponsavel : atual.ehResponsavel;

  if (!novoDomicilioId) throw new Error("Morador precisa estar vinculado a um domicílio");

  const domicilio = await getDomicilioById(novoDomicilioId);
  if (!domicilio) throw new Error("Domicílio não encontrado");

  if (novoEhResponsavel) {
    const existe = await existeOutroResponsavelNoDomicilio(novoDomicilioId, id);
    if (existe) throw new Error("Já existe um responsável familiar nesse domicílio");
  }

  const dataNascimento = dados.dataNascimento !== undefined ? dados.dataNascimento : atual.dataNascimento;
  const idade = calculateAge(dataNascimento);

  const payload = {
    ...atual,
    domicilioId: novoDomicilioId,
    nome: dados.nome !== undefined ? safeString(dados.nome) : atual.nome,
    dataNascimento: dataOrEmpty(dataNascimento),
    sexo: dados.sexo !== undefined ? safeString(dados.sexo) : atual.sexo,

    cpf: dados.cpf !== undefined ? onlyDigits(dados.cpf) : atual.cpf,
    cns: dados.cns !== undefined ? onlyDigits(dados.cns) : atual.cns,

    ehResponsavel: novoEhResponsavel,

    responsavelNome: dados.responsavelNome !== undefined ? safeString(dados.responsavelNome) : atual.responsavelNome,
    responsavelNascimento: dados.responsavelNascimento !== undefined ? dataOrEmpty(dados.responsavelNascimento) : atual.responsavelNascimento,
    parentesco: dados.parentesco !== undefined ? safeString(dados.parentesco) : atual.parentesco,

    gestante: dados.gestante !== undefined ? !!dados.gestante : atual.gestante,
    hipertenso: dados.hipertenso !== undefined ? !!dados.hipertenso : atual.hipertenso,
    diabetico: dados.diabetico !== undefined ? !!dados.diabetico : atual.diabetico,
    saudeMental: dados.saudeMental !== undefined ? !!dados.saudeMental : atual.saudeMental,
    acamado: dados.acamado !== undefined ? !!dados.acamado : atual.acamado,

    idoso: isElderlyByAge(idade),
    crianca: isChildByAge(idade)
  };

  await update("moradores", payload);
  return payload;
}

async function listarMoradores() {
  return await getAll("moradores");
}

async function listarMoradoresPorDomicilio(domicilioId) {
  const moradores = await getAll("moradores");
  return moradores.filter(m => m.domicilioId === domicilioId);
}

async function buscarMoradores(termo = "") {
  const todos = await getAll("moradores");
  const q = safeString(termo);

  if (!q) return todos.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

  return todos.filter(m =>
    likeMatch(m.nome, q) ||
    likeMatch(m.dataNascimento, q) ||
    onlyDigits(m.cpf).includes(onlyDigits(q)) ||
    onlyDigits(m.cns).includes(onlyDigits(q)) ||
    likeMatch(m.responsavelNome, q)
  );
}

async function buscarMoradoresComEndereco(termo = "") {
  const moradores = await buscarMoradores(termo);
  const domicilios = await getAll("domicilios");

  return moradores.filter(m => {
    const d = domicilios.find(x => x.id === m.domicilioId);
    if (!termo) return true;

    return (
      likeMatch(d?.endereco, termo) ||
      likeMatch(d?.numero, termo) ||
      likeMatch(d?.microarea, termo) ||
      likeMatch(d?.complemento, termo) ||
      true
    );
  }).map(m => {
    const d = domicilios.find(x => x.id === m.domicilioId);
    return {
      ...m,
      enderecoCompleto: buildFullAddress(d),
      microarea: d?.microarea || ""
    };
  });
}

async function excluirMorador(id) {
  return await remove("moradores", id);
}

async function criarReceita(dados = {}) {
  const moradorId = dados.moradorId;
  if (!moradorId) throw new Error("Receita precisa de um morador");

  const morador = await getMoradorById(moradorId);
  if (!morador) throw new Error("Morador não encontrado");

  const tipo = safeString(dados.tipo).toLowerCase();
  if (!["hiperdia", "mental"].includes(tipo)) {
    throw new Error("Tipo de receita inválido");
  }

  return await add("receitas", {
    moradorId,
    tipo,
    dataEmissao: dataOrEmpty(dados.dataEmissao || nowIso()),
    observacoes: safeString(dados.observacoes),
    dataCadastro: nowIso()
  });
}

async function listarReceitasPorMorador(moradorId) {
  const receitas = await getAll("receitas");
  return receitas
    .filter(r => r.moradorId === moradorId)
    .sort((a, b) => new Date(b.dataEmissao) - new Date(a.dataEmissao));
}

async function atualizarReceita(id, dados = {}) {
  const atual = await getReceitaById(id);
  if (!atual) throw new Error("Receita não encontrada");

  const tipo = dados.tipo !== undefined ? safeString(dados.tipo).toLowerCase() : atual.tipo;
  if (!["hiperdia", "mental"].includes(tipo)) {
    throw new Error("Tipo de receita inválido");
  }

  const payload = {
    ...atual,
    tipo,
    dataEmissao: dados.dataEmissao !== undefined ? dataOrEmpty(dados.dataEmissao) : atual.dataEmissao,
    observacoes: dados.observacoes !== undefined ? safeString(dados.observacoes) : atual.observacoes
  };

  await update("receitas", payload);
  return payload;
}

async function excluirReceita(id) {
  await remove("receitas", id);
  return true;
}

function getReceitaValidadeDias(tipo) {
  return String(tipo).toLowerCase() === "mental" ? 60 : 180;
}

function isReceitaVencida(receita) {
  const dias = diffDays(receita.dataEmissao);
  if (dias === null) return false;
  return dias > getReceitaValidadeDias(receita.tipo);
}

const VISITA_DRAFT_KEY = "acs_visita_em_andamento";

function salvarVisitaEmAndamento(payload) {
  localStorage.setItem(VISITA_DRAFT_KEY, JSON.stringify(payload));
}

function obterVisitaEmAndamento() {
  const raw = localStorage.getItem(VISITA_DRAFT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function limparVisitaEmAndamento() {
  localStorage.removeItem(VISITA_DRAFT_KEY);
}

function iniciarVisita(domicilioId) {
  if (!domicilioId) throw new Error("Selecione um domicílio");

  const payload = {
    domicilioId,
    horaInicio: nowIso()
  };

  salvarVisitaEmAndamento(payload);
  return payload;
}

async function finalizarVisita(dados = {}) {
  const draft = obterVisitaEmAndamento();
  if (!draft) throw new Error("Nenhuma visita em andamento");

  const domicilio = await getDomicilioById(draft.domicilioId);
  if (!domicilio) throw new Error("Domicílio não encontrado");

  const horaFim = nowIso();
  const moradoresAtendidos = Array.isArray(dados.moradoresAtendidos) ? dados.moradoresAtendidos : [];

  const visitaPayload = {
    domicilioId: draft.domicilioId,
    data: nowIso(),
    horaInicio: draft.horaInicio,
    horaFim: horaFim,
    duracaoMinutos: generateVisitDurationMinutes(draft.horaInicio, horaFim),
    observacoes: safeString(dados.observacoes)
  };

  const visitaId = await add("visitas", visitaPayload);

  if (moradoresAtendidos.length) {
    await update("visitas", {
      ...(await getVisitaById(visitaId)),
      moradoresAtendidos: moradoresAtendidos
    });
  }

  limparVisitaEmAndamento();
  return visitaId;
}

async function registrarVisitaDireta(dados = {}) {
  if (!dados.domicilioId) throw new Error("Selecione um domicílio");

  const horaInicio = dados.horaInicio || nowIso();
  const horaFim = dados.horaFim || nowIso();
  const moradoresAtendidos = Array.isArray(dados.moradoresAtendidos) ? dados.moradoresAtendidos : [];

  const payload = {
    domicilioId: dados.domicilioId,
    data: nowIso(),
    horaInicio,
    horaFim,
    duracaoMinutos: generateVisitDurationMinutes(horaInicio, horaFim),
    observacoes: safeString(dados.observacoes),
    moradoresAtendidos
  };

  return await add("visitas", payload);
}

async function listarVisitas() {
  const visitas = await getAll("visitas");
  return visitas.sort((a, b) => new Date(b.data) - new Date(a.data));
}

async function listarVisitasPorDomicilio(domicilioId) {
  const visitas = await getAll("visitas");
  return visitas
    .filter(v => v.domicilioId === domicilioId)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
}

async function getUltimaVisitaPorDomicilio(domicilioId) {
  const visitas = await listarVisitasPorDomicilio(domicilioId);
  return visitas.length ? visitas[0] : null;
}

async function criarPendencia(dados = {}) {
  const moradorId = dados.moradorId;
  if (!moradorId) throw new Error("Pendência precisa de um morador");

  const morador = await getMoradorById(moradorId);
  if (!morador) throw new Error("Morador não encontrado");

  const prioridade = safeString(dados.prioridade).toLowerCase() || "media";

  return await add("pendencias", {
    moradorId,
    descricao: safeString(dados.descricao),
    prioridade,
    resolvida: false,
    dataCriacao: nowIso(),
    dataResolucao: null
  });
}

async function listarPendencias() {
  const lista = await getAll("pendencias");
  return lista.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
}

async function listarPendenciasPorMorador(moradorId) {
  const lista = await getAll("pendencias");
  return lista
    .filter(p => p.moradorId === moradorId)
    .sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
}

async function atualizarPendencia(id, dados = {}) {
  const atual = await getPendenciaById(id);
  if (!atual) throw new Error("Pendência não encontrada");

  const payload = {
    ...atual,
    descricao: dados.descricao !== undefined ? safeString(dados.descricao) : atual.descricao,
    prioridade: dados.prioridade !== undefined ? safeString(dados.prioridade).toLowerCase() : atual.prioridade
  };

  await update("pendencias", payload);
  return payload;
}

async function resolverPendencia(id) {
  const atual = await getPendenciaById(id);
  if (!atual) throw new Error("Pendência não encontrada");

  const payload = {
    ...atual,
    resolvida: true,
    dataResolucao: nowIso()
  };

  await update("pendencias", payload);
  return payload;
}

async function reabrirPendencia(id) {
  const atual = await getPendenciaById(id);
  if (!atual) throw new Error("Pendência não encontrada");

  const payload = {
    ...atual,
    resolvida: false,
    dataResolucao: null
  };

  await update("pendencias", payload);
  return payload;
}

async function excluirPendencia(id) {
  await remove("pendencias", id);
  return true;
}

function getPendenciaDiasAbertos(pendencia) {
  if (!pendencia) return null;
  const dataBase = pendencia.resolvida && pendencia.dataResolucao
    ? pendencia.dataResolucao
    : nowIso();

  const inicio = parseDate(pendencia.dataCriacao);
  const fim = parseDate(dataBase);
  if (!inicio || !fim) return null;

  return Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
}

async function enriquecerPendencias() {
  const pendencias = await listarPendencias();
  const moradores = await getAll("moradores");
  const domicilios = await getAll("domicilios");

  return pendencias.map(p => {
    const morador = moradores.find(m => m.id === p.moradorId);
    const domicilio = morador ? domicilios.find(d => d.id === morador.domicilioId) : null;

    return {
      ...p,
      moradorNome: morador?.nome || "Morador não encontrado",
      enderecoCompleto: buildFullAddress(domicilio),
      diasAberto: getPendenciaDiasAbertos(p)
    };
  });
}

async function enriquecerMoradores() {
  const moradores = await getAll("moradores");
  const domicilios = await getAll("domicilios");

  return moradores.map(m => {
    const domicilio = domicilios.find(d => d.id === m.domicilioId);
    return {
      ...m,
      enderecoCompleto: buildFullAddress(domicilio),
      microarea: domicilio?.microarea || ""
    };
  });
}

async function gerarAlertas() {
  const alertas = [];

  const domicilios = await getAll("domicilios");
  const moradores = await getAll("moradores");
  const visitas = await getAll("visitas");
  const receitas = await getAll("receitas");
  const pendencias = await getAll("pendencias");

  const hoje = new Date();

  function getDomicilioLocal(id) {
    return domicilios.find(d => d.id === id);
  }

  function getMoradorInfo(morador) {
    const d = getDomicilioLocal(morador?.domicilioId);
    return {
      nome: morador?.nome || "Sem nome",
      endereco: buildFullAddress(d)
    };
  }


  for (const d of domicilios) {
    const temResponsavel = moradores.some(m => m.domicilioId === d.id && m.ehResponsavel);
    if (!temResponsavel) {
      alertas.push({
        tipo: "domicilio",
        severidade: "alta",
        mensagem: `${buildFullAddress(d)} sem responsável familiar definido`
      });
    }
  }


  for (const r of receitas) {
    const morador = moradores.find(m => m.id === r.moradorId);
    if (!morador) continue;

    if (isReceitaVencida(r)) {
      const info = getMoradorInfo(morador);
      alertas.push({
        tipo: "receita",
        severidade: "alta",
        mensagem: `${info.nome} — ${info.endereco} — receita ${r.tipo} vencida`
      });
    }
  }

  for (const p of pendencias) {
    if (p.resolvida) continue;

    const morador = moradores.find(m => m.id === p.moradorId);
    if (!morador) continue;

    const info = getMoradorInfo(morador);
    const dias = getPendenciaDiasAbertos(p);

    alertas.push({
      tipo: "pendencia",
      severidade: p.prioridade === "alta" ? "alta" : "media",
      mensagem: `${info.nome} — ${info.endereco} — ${p.descricao} (${dias} dias em aberto)`
    });
  }


  for (const m of moradores) {
    const grupoPrioritario = m.crianca || m.idoso || m.acamado || m.gestante;
    if (!grupoPrioritario) continue;

    const visitasDomicilio = visitas
      .filter(v => v.domicilioId === m.domicilioId)
      .sort((a, b) => new Date(b.data) - new Date(a.data));

    const ultima = visitasDomicilio[0];
    const info = getMoradorInfo(m);

    if (!ultima) {
      alertas.push({
        tipo: "visita",
        severidade: "alta",
        mensagem: `${info.nome} — ${info.endereco} — sem visita registrada`
      });
      continue;
    }

    const dias = diffDays(ultima.data, hoje);
    if (dias !== null && dias > 30) {
      alertas.push({
        tipo: "visita",
        severidade: "media",
        mensagem: `${info.nome} — ${info.endereco} — sem visita há ${dias} dias`
      });
    }
  }

  return alertas;
}

async function obterResumoDashboard() {
  const domicilios = await getAll("domicilios");
  const moradores = await getAll("moradores");
  const pendencias = await getAll("pendencias");
  const receitas = await getAll("receitas");
  const alertas = await gerarAlertas();

  const receitasVencidas = receitas.filter(r => isReceitaVencida(r)).length;

  return {
    totalDomicilios: domicilios.length,
    totalMoradores: moradores.length,
    totalGestantes: moradores.filter(m => m.gestante).length,
    totalIdosos: moradores.filter(m => m.idoso).length,
    totalCriancas: moradores.filter(m => m.crianca).length,
    totalAcamados: moradores.filter(m => m.acamado).length,
    totalHipertensos: moradores.filter(m => m.hipertenso).length,
    totalDiabeticos: moradores.filter(m => m.diabetico).length,
    totalSaudeMental: moradores.filter(m => m.saudeMental).length,
    pendenciasAbertas: pendencias.filter(p => !p.resolvida).length,
    receitasVencidas,
    totalAlertas: alertas.length
  };
}
