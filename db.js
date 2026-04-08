const DB_NAME = "acs_db";
const DB_VERSION = 1;

let db = null;

// ===============================
// UTILITÁRIOS INTERNOS
// ===============================
function getErrorMessage(error) {
  if (!error) return "Erro desconhecido";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  if (error.name) return error.name;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function ensureDBReady() {
  if (!db) {
    throw new Error("Banco de dados ainda não foi inicializado. Execute initDB() primeiro.");
  }
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeStoreName(storeName) {
  return String(storeName || "").trim();
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

// ===============================
// INICIALIZAR BANCO
// ===============================
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (event) {
      const database = event.target.result;

      if (!database.objectStoreNames.contains("domicilios")) {
        const domicilios = database.createObjectStore("domicilios", {
          keyPath: "id",
          autoIncrement: true
        });

        domicilios.createIndex("endereco", "endereco", { unique: false });
        domicilios.createIndex("microarea", "microarea", { unique: false });
      }

      if (!database.objectStoreNames.contains("moradores")) {
        const moradores = database.createObjectStore("moradores", {
          keyPath: "id",
          autoIncrement: true
        });

        moradores.createIndex("nome", "nome", { unique: false });
        moradores.createIndex("cpf", "cpf", { unique: false });
        moradores.createIndex("cns", "cns", { unique: false });
        moradores.createIndex("domicilioId", "domicilioId", { unique: false });
        moradores.createIndex("dataNascimento", "dataNascimento", { unique: false });
      }

      if (!database.objectStoreNames.contains("visitas")) {
        const visitas = database.createObjectStore("visitas", {
          keyPath: "id",
          autoIncrement: true
        });

        visitas.createIndex("domicilioId", "domicilioId", { unique: false });
        visitas.createIndex("data", "data", { unique: false });
      }

      if (!database.objectStoreNames.contains("receitas")) {
        const receitas = database.createObjectStore("receitas", {
          keyPath: "id",
          autoIncrement: true
        });

        receitas.createIndex("moradorId", "moradorId", { unique: false });
        receitas.createIndex("tipo", "tipo", { unique: false });
      }

      if (!database.objectStoreNames.contains("pendencias")) {
        const pendencias = database.createObjectStore("pendencias", {
          keyPath: "id",
          autoIncrement: true
        });

        pendencias.createIndex("moradorId", "moradorId", { unique: false });
        pendencias.createIndex("resolvida", "resolvida", { unique: false });
        pendencias.createIndex("prioridade", "prioridade", { unique: false });
        pendencias.createIndex("dataCriacao", "dataCriacao", { unique: false });
      }
    };

    request.onsuccess = function (event) {
      db = event.target.result;

      db.onversionchange = function () {
        db.close();
        console.warn("Banco fechado por mudança de versão.");
      };

      resolve(db);
    };

    request.onerror = function (event) {
      const error = event.target.error;
      console.error("Erro ao abrir banco IndexedDB:", error);
      reject(new Error("Erro ao abrir banco: " + getErrorMessage(error)));
    };

    request.onblocked = function () {
      reject(new Error("Abertura do banco bloqueada. Feche outras abas do sistema e tente novamente."));
    };
  });
}

// ===============================
// VALIDAÇÕES
// ===============================
function validarDados(store, dados) {
  const storeName = normalizeStoreName(store);

  if (!dados || typeof dados !== "object") {
    throw new Error("Dados inválidos");
  }

  if (storeName === "domicilios") {
    const endereco = String(dados.endereco || "").trim();
    const numero = String(dados.numero || "").trim();

    if (!endereco || !numero) {
      throw new Error("Endereço e número são obrigatórios");
    }
  }

  if (storeName === "moradores") {
    const nome = String(dados.nome || "").trim();
    if (!nome || nome.length < 3) {
      throw new Error("Nome inválido");
    }

    const cpf = onlyDigits(dados.cpf);
    if (cpf && cpf.length !== 11) {
      throw new Error("CPF inválido");
    }

    const cns = onlyDigits(dados.cns);
    if (cns && cns.length < 15) {
      throw new Error("CNS inválido");
    }

    if (!dados.domicilioId && dados.domicilioId !== 0) {
      throw new Error("Morador precisa estar vinculado a um domicílio");
    }
  }

  if (storeName === "pendencias") {
    const descricao = String(dados.descricao || "").trim();
    if (!descricao || descricao.length < 3) {
      throw new Error("Descrição inválida");
    }

    if (!dados.moradorId && dados.moradorId !== 0) {
      throw new Error("Pendência precisa estar vinculada a um morador");
    }
  }

  if (storeName === "receitas") {
    if (!dados.moradorId && dados.moradorId !== 0) {
      throw new Error("Receita precisa estar vinculada a um morador");
    }
  }

  if (storeName === "visitas") {
    if (!dados.domicilioId && dados.domicilioId !== 0) {
      throw new Error("Visita precisa estar vinculada a um domicílio");
    }
  }
}

// ===============================
// TRANSAÇÃO AUXILIAR
// ===============================
function getStore(storeName, mode = "readonly") {
  ensureDBReady();

  const normalized = normalizeStoreName(storeName);

  if (!db.objectStoreNames.contains(normalized)) {
    throw new Error(`Store "${normalized}" não existe no banco`);
  }

  const tx = db.transaction(normalized, mode);
  const store = tx.objectStore(normalized);

  return { tx, store };
}

// ===============================
// ADD (CRIAR)
// ===============================
function add(storeName, data) {
  return new Promise((resolve, reject) => {
    try {
      const normalized = normalizeStoreName(storeName);
      const payload = cloneData(data);

      validarDados(normalized, payload);

      const now = new Date().toISOString();
      if (!payload.createdAt) payload.createdAt = now;
      payload.updatedAt = now;

      const { tx, store } = getStore(normalized, "readwrite");
      const request = store.add(payload);

      tx.onabort = function () {
        reject(new Error("Transação abortada ao salvar"));
      };

      tx.onerror = function (event) {
        reject(new Error("Erro na transação ao salvar: " + getErrorMessage(event.target.error)));
      };

      request.onsuccess = () => resolve(request.result);

      request.onerror = (event) => {
        reject(new Error("Erro ao salvar: " + getErrorMessage(event.target.error)));
      };
    } catch (e) {
      reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
    }
  });
}

// ===============================
// GET ALL
// ===============================
function getAll(storeName) {
  return new Promise((resolve, reject) => {
    try {
      const normalized = normalizeStoreName(storeName);
      const { tx, store } = getStore(normalized, "readonly");
      const request = store.getAll();

      tx.onabort = function () {
        reject(new Error("Transação abortada ao buscar"));
      };

      tx.onerror = function (event) {
        reject(new Error("Erro na transação ao buscar: " + getErrorMessage(event.target.error)));
      };

      request.onsuccess = () => resolve(request.result || []);

      request.onerror = (event) => {
        reject(new Error("Erro ao buscar: " + getErrorMessage(event.target.error)));
      };
    } catch (e) {
      reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
    }
  });
}

// ===============================
// GET BY ID
// ===============================
function getById(storeName, id) {
  return new Promise((resolve, reject) => {
    try {
      const normalized = normalizeStoreName(storeName);
      const { tx, store } = getStore(normalized, "readonly");
      const request = store.get(id);

      tx.onabort = function () {
        reject(new Error("Transação abortada ao buscar registro"));
      };

      tx.onerror = function (event) {
        reject(new Error("Erro na transação ao buscar registro: " + getErrorMessage(event.target.error)));
      };

      request.onsuccess = () => resolve(request.result || null);

      request.onerror = (event) => {
        reject(new Error("Erro ao buscar registro: " + getErrorMessage(event.target.error)));
      };
    } catch (e) {
      reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
    }
  });
}

// ===============================
// UPDATE
// ===============================
function update(storeName, data) {
  return new Promise((resolve, reject) => {
    try {
      const normalized = normalizeStoreName(storeName);
      const payload = cloneData(data);

      if (payload.id === undefined || payload.id === null) {
        throw new Error("Registro sem ID para atualização");
      }

      validarDados(normalized, payload);

      payload.updatedAt = new Date().toISOString();

      const { tx, store } = getStore(normalized, "readwrite");
      const request = store.put(payload);

      tx.onabort = function () {
        reject(new Error("Transação abortada ao atualizar"));
      };

      tx.onerror = function (event) {
        reject(new Error("Erro na transação ao atualizar: " + getErrorMessage(event.target.error)));
      };

      request.onsuccess = () => resolve(payload);

      request.onerror = (event) => {
        reject(new Error("Erro ao atualizar: " + getErrorMessage(event.target.error)));
      };
    } catch (e) {
      reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
    }
  });
}

// ===============================
// DELETE (COM SEGURANÇA)
// ===============================
async function remove(storeName, id) {
  const normalized = normalizeStoreName(storeName);

  if (normalized === "moradores") {
    const pendencias = await getAll("pendencias");
    const receitas = await getAll("receitas");

    if (pendencias.some(p => p.moradorId === id && !p.resolvida)) {
      throw new Error("Morador possui pendências abertas");
    }

    if (receitas.some(r => r.moradorId === id)) {
      throw new Error("Morador possui receitas vinculadas");
    }
  }

  if (normalized === "domicilios") {
    const moradores = await getAll("moradores");
    const visitas = await getAll("visitas");

    if (moradores.some(m => m.domicilioId === id)) {
      throw new Error("Domicílio possui moradores vinculados");
    }

    if (visitas.some(v => v.domicilioId === id)) {
      throw new Error("Domicílio possui visitas vinculadas");
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const { tx, store } = getStore(normalized, "readwrite");
      const request = store.delete(id);

      tx.onabort = function () {
        reject(new Error("Transação abortada ao excluir"));
      };

      tx.onerror = function (event) {
        reject(new Error("Erro na transação ao excluir: " + getErrorMessage(event.target.error)));
      };

      request.onsuccess = () => resolve(true);

      request.onerror = (event) => {
        reject(new Error("Erro ao excluir: " + getErrorMessage(event.target.error)));
      };
    } catch (e) {
      reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
    }
  });
}

// ===============================
// LIMPAR BANCO (USO CONTROLADO)
// ===============================
function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    try {
      const normalized = normalizeStoreName(storeName);
      const { tx, store } = getStore(normalized, "readwrite");
      const request = store.clear();

      tx.onabort = function () {
        reject(new Error("Transação abortada ao limpar store"));
      };

      tx.onerror = function (event) {
        reject(new Error("Erro na transação ao limpar store: " + getErrorMessage(event.target.error)));
      };

      request.onsuccess = () => resolve(true);

      request.onerror = (event) => {
        reject(new Error("Erro ao limpar store: " + getErrorMessage(event.target.error)));
      };
    } catch (e) {
      reject(e instanceof Error ? e : new Error(getErrorMessage(e)));
    }
  });
}
