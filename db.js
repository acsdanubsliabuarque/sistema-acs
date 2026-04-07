const DB_NAME = "acs_db";
const DB_VERSION = 1;

let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (event) {
      db = event.target.result;

      if (!db.objectStoreNames.contains("domicilios")) {
        const domicilios = db.createObjectStore("domicilios", {
          keyPath: "id",
          autoIncrement: true
        });
        domicilios.createIndex("endereco", "endereco", { unique: false });
      }

      if (!db.objectStoreNames.contains("moradores")) {
        const moradores = db.createObjectStore("moradores", {
          keyPath: "id",
          autoIncrement: true
        });
        moradores.createIndex("nome", "nome", { unique: false });
        moradores.createIndex("cpf", "cpf", { unique: false });
        moradores.createIndex("cns", "cns", { unique: false });
        moradores.createIndex("domicilioId", "domicilioId", { unique: false });
      }

      if (!db.objectStoreNames.contains("visitas")) {
        const visitas = db.createObjectStore("visitas", {
          keyPath: "id",
          autoIncrement: true
        });
        visitas.createIndex("domicilioId", "domicilioId", { unique: false });
        visitas.createIndex("data", "data", { unique: false });
      }

      if (!db.objectStoreNames.contains("receitas")) {
        const receitas = db.createObjectStore("receitas", {
          keyPath: "id",
          autoIncrement: true
        });
        receitas.createIndex("moradorId", "moradorId", { unique: false });
      }

      if (!db.objectStoreNames.contains("pendencias")) {
        const pendencias = db.createObjectStore("pendencias", {
          keyPath: "id",
          autoIncrement: true
        });
        pendencias.createIndex("moradorId", "moradorId", { unique: false });
        pendencias.createIndex("resolvida", "resolvida", { unique: false });
      }
    };

    request.onsuccess = function () {
      db = request.result;
      resolve();
    };

    request.onerror = function () {
      reject("Erro ao abrir banco");
    };
  });
}

function validarDados(store, dados) {
  if (store === "domicilios") {
    if (!dados.endereco || !dados.numero) {
      throw new Error("Endereço e número são obrigatórios");
    }
  }

  if (store === "moradores") {
    if (!dados.nome || dados.nome.trim().length < 3) {
      throw new Error("Nome inválido");
    }

    if (dados.cpf && dados.cpf.length < 11) {
      throw new Error("CPF inválido");
    }
  }

  if (store === "pendencias") {
    if (!dados.descricao || dados.descricao.trim().length < 3) {
      throw new Error("Descrição inválida");
    }
  }
}

function add(storeName, data) {
  return new Promise((resolve, reject) => {
    try {
      validarDados(storeName, data);

      data.createdAt = new Date().toISOString();
      data.updatedAt = new Date().toISOString();

      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      const request = store.add(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject("Erro ao salvar");
    } catch (e) {
      reject(e.message);
    }
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Erro ao buscar");
  });
}

function getById(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Erro ao buscar");
  });
}

function update(storeName, data) {
  return new Promise((resolve, reject) => {
    try {
      validarDados(storeName, data);

      data.updatedAt = new Date().toISOString();

      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject("Erro ao atualizar");
    } catch (e) {
      reject(e.message);
    }
  });
}

async function remove(storeName, id) {
  if (storeName === "moradores") {
    const pendencias = await getAll("pendencias");
    const receitas = await getAll("receitas");

    if (pendencias.some(p => p.moradorId === id && !p.resolvida)) {
      throw new Error("Morador possui pendências abertas");
    }

    if (receitas.some(r => r.moradorId === id)) {
      throw new Error("Morador possui receitas vinculadas");
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);

    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject("Erro ao excluir");
  });
}
