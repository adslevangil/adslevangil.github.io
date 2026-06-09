const CHARACTER_API_URL = "https://ailogo-system-product-name.taile51706.ts.net/character-api";
const GALLERY_DATA_URL = "/gallery/data/gallery.json";

const characterCount = document.querySelector("#characterCount");
const linkedImageCount = document.querySelector("#linkedImageCount");
const updatedAt = document.querySelector("#updatedAt");
const characterList = document.querySelector("#characterList");
const characterSearch = document.querySelector("#characterSearch");
const editorTitle = document.querySelector("#editorTitle");
const imageBindingStatus = document.querySelector("#imageBindingStatus");
const imageEntryId = document.querySelector("#imageEntryId");
const imageFilename = document.querySelector("#imageFilename");
const imageUrl = document.querySelector("#imageUrl");
const imagePreview = document.querySelector("#imagePreview");
const openImageLink = document.querySelector("#openImageLink");
const refreshImageButton = document.querySelector("#refreshImageButton");
const galleryEntryOptions = document.querySelector("#galleryEntryOptions");
const nameInput = document.querySelector("#name");
const genderInput = document.querySelector("#gender");
const professionInput = document.querySelector("#profession");
const raceInput = document.querySelector("#race");
const traitsInput = document.querySelector("#traits");
const skillsInput = document.querySelector("#skills");
const specialtiesInput = document.querySelector("#specialties");
const hobbiesInput = document.querySelector("#hobbies");
const backgroundStoryInput = document.querySelector("#backgroundStory");
const relationList = document.querySelector("#relationList");
const relationTemplate = document.querySelector("#relationTemplate");
const addRelationButton = document.querySelector("#addRelationButton");
const suggestionGrid = document.querySelector("#suggestionGrid");
const suggestionTemplate = document.querySelector("#suggestionTemplate");
const aiStatus = document.querySelector("#aiStatus");
const aiInstructions = document.querySelector("#aiInstructions");
const agentSelect = document.querySelector("#agentSelect");
const runAiButton = document.querySelector("#runAiButton");
const saveCharacterButton = document.querySelector("#saveCharacterButton");
const deleteCharacterButton = document.querySelector("#deleteCharacterButton");
const duplicateCharacterButton = document.querySelector("#duplicateCharacterButton");
const newCharacterButton = document.querySelector("#newCharacterButton");

let store = { updated_at: null, characters: [] };
let galleryEntries = [];
let activeCharacterId = null;
let activeAiPayload = null;
let activePollTimer = null;

const relationTypes = {
  lover: "爱人",
  parents: "父母",
  friend: "朋友",
  archenemy: "死敌",
  blood_feud: "世仇",
  teacher: "老师",
  other: "其他",
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("zh-CN") : "--";
}

function toLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function fromLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createId(prefix = "CHAR") {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function defaultCharacter() {
  const params = new URLSearchParams(window.location.search);
  const imageId = params.get("imageId") || "";
  const linked = galleryEntries.find((entry) => entry.id === imageId);
  return {
    id: createId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    image_entry_id: linked?.id || imageId || "",
    image_filename: linked?.filename || "",
    image_url: linked?.image_url || (linked?.image_path ? `/${linked.image_path}` : ""),
    name: "",
    gender: "",
    profession: "",
    race: "",
    traits: [],
    skills: [],
    specialties: [],
    hobbies: [],
    background_story: "",
    relations: [],
  };
}

function fetchJson(url, options = {}) {
  return fetch(url, options).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  });
}

async function loadGallery() {
  const data = await fetchJson(`${GALLERY_DATA_URL}?v=${Date.now()}`);
  galleryEntries = Array.isArray(data.entries) ? data.entries : [];
  galleryEntryOptions.innerHTML = galleryEntries
    .slice()
    .reverse()
    .slice(0, 400)
    .map((entry) => {
      const label = `${entry.id} | ${entry.style || entry.model || "未命名"} | ${entry.filename || ""}`;
      return `<option value="${escapeHtml(entry.id)}" label="${escapeHtml(label)}"></option>`;
    })
    .join("");
}

async function loadCharacters() {
  const data = await fetchJson(`${CHARACTER_API_URL}/characters?v=${Date.now()}`);
  store = {
    updated_at: data.updated_at || null,
    characters: Array.isArray(data.characters) ? data.characters : [],
  };
  if (!activeCharacterId && store.characters.length) {
    activeCharacterId = store.characters[0].id;
  }
  if (activeCharacterId && !store.characters.find((item) => item.id === activeCharacterId)) {
    activeCharacterId = store.characters[0]?.id || null;
  }
}

function getActiveCharacter() {
  return store.characters.find((item) => item.id === activeCharacterId) || null;
}

function findCharacterByImageEntryId(entryId) {
  const normalized = String(entryId || "").trim();
  if (!normalized) return null;
  return store.characters.find((item) => String(item.image_entry_id || "").trim() === normalized) || null;
}

function setStatus(text, kind = "") {
  aiStatus.textContent = text;
  aiStatus.className = "statusBox";
  if (kind) aiStatus.classList.add(kind);
}

function resolveGalleryEntry(entryId) {
  const normalized = String(entryId || "").trim();
  if (!normalized) return null;
  return (
    galleryEntries.find((entry) => entry.id === normalized) ||
    resolveGalleryEntryByFilename(normalized) ||
    null
  );
}

function resolveGalleryEntryByFilename(filename) {
  const normalized = String(filename || "").trim().toLowerCase();
  if (!normalized) return null;
  return (
    galleryEntries.find((entry) => String(entry.filename || "").trim().toLowerCase() === normalized) || null
  );
}

function renderStats() {
  characterCount.textContent = String(store.characters.length);
  linkedImageCount.textContent = String(store.characters.filter((item) => item.image_entry_id || item.image_url).length);
  updatedAt.textContent = formatDate(store.updated_at);
}

function renderCharacterList() {
  const keyword = String(characterSearch.value || "").trim().toLowerCase();
  const items = store.characters.filter((character) => {
    if (!keyword) return true;
    const haystack = [
      character.name,
      character.gender,
      character.profession,
      character.race,
      ...(character.traits || []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });

  if (!items.length) {
    characterList.innerHTML = '<div class="emptyState">还没有角色，或者当前搜索没有结果。</div>';
    return;
  }

  characterList.innerHTML = items
    .map((character) => {
      const active = character.id === activeCharacterId;
      return `
        <button class="characterCard${active ? " active" : ""}" type="button" data-character-id="${escapeHtml(character.id)}">
          <h3>${escapeHtml(character.name || "未命名角色")}</h3>
          <p>${escapeHtml([character.gender, character.profession, character.race].filter(Boolean).join(" / ") || "未填写基础信息")}</p>
          <p>${escapeHtml(character.image_entry_id || character.image_filename || "未绑定图片")}</p>
        </button>
      `;
    })
    .join("");
}

function bindImageFields(character) {
  const linked =
    resolveGalleryEntry(character.image_entry_id) ||
    resolveGalleryEntryByFilename(character.image_filename);
  if (linked) {
    character.image_entry_id = linked.id || character.image_entry_id || "";
    character.image_filename = linked.filename || character.image_filename || "";
    character.image_url = linked.image_url || (linked.image_path ? `/${linked.image_path}` : "") || character.image_url || "";
  }
  imageBindingStatus.textContent = character.image_entry_id
    ? `已绑定图片编号 ${character.image_entry_id}`
    : character.image_filename
      ? `已按文件名匹配图片 ${character.image_filename}`
      : "未绑定图片";
  imageEntryId.value = character.image_entry_id || "";
  imageFilename.value = character.image_filename || "";
  imageUrl.value = character.image_url || "";
  imagePreview.src = character.image_url || "";
  openImageLink.href = character.image_url || "#";
  openImageLink.style.pointerEvents = character.image_url ? "" : "none";
  openImageLink.style.opacity = character.image_url ? "1" : "0.45";
}

function renderRelations(relations = []) {
  relationList.innerHTML = "";
  if (!relations.length) {
    relationList.innerHTML = '<div class="emptyState">还没有关系设定，可以先新增一条。</div>';
    return;
  }
  relations.forEach((relation, index) => {
    const node = relationTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.index = String(index);
    node.querySelector(".relationType").value = relation.type || "other";
    node.querySelector(".relationName").value = relation.name || "";
    node.querySelector(".relationCharacterId").value = relation.target_character_id || "";
    node.querySelector(".relationImageEntryId").value = relation.target_image_entry_id || "";
    node.querySelector(".relationNote").value = relation.note || "";
    const link = node.querySelector(".relationCharacterLink");
    if (relation.target_character_id) {
      link.href = `/character-editor/?id=${encodeURIComponent(relation.target_character_id)}`;
      link.style.pointerEvents = "";
      link.style.opacity = "1";
    } else if (relation.target_image_entry_id) {
      link.href = `/character-editor/?imageId=${encodeURIComponent(relation.target_image_entry_id)}`;
      link.style.pointerEvents = "";
      link.style.opacity = "1";
    } else {
      link.href = "#";
      link.style.pointerEvents = "none";
      link.style.opacity = "0.45";
    }
    node.querySelector(".removeRelationButton").addEventListener("click", () => {
      const character = getActiveCharacter();
      if (!character) return;
      character.relations.splice(index, 1);
      renderRelations(character.relations);
    });
    relationList.appendChild(node);
  });
}

function renderEditor() {
  const character = getActiveCharacter();
  if (!character) {
    editorTitle.textContent = "角色详情";
    bindImageFields(defaultCharacter());
    nameInput.value = "";
    genderInput.value = "";
    professionInput.value = "";
    raceInput.value = "";
    traitsInput.value = "";
    skillsInput.value = "";
    specialtiesInput.value = "";
    hobbiesInput.value = "";
    backgroundStoryInput.value = "";
    renderRelations([]);
    suggestionGrid.innerHTML = "";
    return;
  }

  editorTitle.textContent = character.name ? `${character.name} · 角色详情` : "未命名角色";
  bindImageFields(character);
  nameInput.value = character.name || "";
  genderInput.value = character.gender || "";
  professionInput.value = character.profession || "";
  raceInput.value = character.race || "";
  traitsInput.value = toLines(character.traits);
  skillsInput.value = toLines(character.skills);
  specialtiesInput.value = toLines(character.specialties);
  hobbiesInput.value = toLines(character.hobbies);
  backgroundStoryInput.value = character.background_story || "";
  renderRelations(character.relations || []);
}

function collectRelations() {
  return [...relationList.querySelectorAll(".relationItem")].map((node) => ({
    type: node.querySelector(".relationType").value,
    name: node.querySelector(".relationName").value.trim(),
    target_character_id: node.querySelector(".relationCharacterId").value.trim(),
    target_image_entry_id: node.querySelector(".relationImageEntryId").value.trim(),
    note: node.querySelector(".relationNote").value.trim(),
  })).filter((item) => item.name || item.target_character_id || item.target_image_entry_id || item.note);
}

function applyFormToCharacter(character) {
  character.image_entry_id = imageEntryId.value.trim();
  character.image_filename = imageFilename.value.trim();
  character.image_url = imageUrl.value.trim();
  character.name = nameInput.value.trim();
  character.gender = genderInput.value.trim();
  character.profession = professionInput.value.trim();
  character.race = raceInput.value.trim();
  character.traits = fromLines(traitsInput.value);
  character.skills = fromLines(skillsInput.value);
  character.specialties = fromLines(specialtiesInput.value);
  character.hobbies = fromLines(hobbiesInput.value);
  character.background_story = backgroundStoryInput.value.trim();
  character.relations = collectRelations();
  character.updated_at = new Date().toISOString();
}

async function saveCharacter() {
  let character = getActiveCharacter();
  if (!character) {
    character = defaultCharacter();
    store.characters.unshift(character);
    activeCharacterId = character.id;
  }
  applyFormToCharacter(character);
  const payload = await fetchJson(`${CHARACTER_API_URL}/characters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(character),
  });
  store.updated_at = payload.updated_at;
  store.characters = payload.characters || store.characters;
  activeCharacterId = payload.character?.id || activeCharacterId;
  renderStats();
  renderCharacterList();
  renderEditor();
}

async function deleteCharacter() {
  const character = getActiveCharacter();
  if (!character) return;
  if (!window.confirm(`确定删除角色「${character.name || character.id}」吗？`)) return;
  const payload = await fetchJson(`${CHARACTER_API_URL}/characters/${encodeURIComponent(character.id)}`, { method: "DELETE" });
  store.updated_at = payload.updated_at;
  store.characters = payload.characters || [];
  activeCharacterId = store.characters[0]?.id || null;
  renderStats();
  renderCharacterList();
  renderEditor();
}

function addNewCharacter() {
  const character = defaultCharacter();
  store.characters.unshift(character);
  activeCharacterId = character.id;
  renderStats();
  renderCharacterList();
  renderEditor();
}

function duplicateCharacter() {
  const character = getActiveCharacter();
  if (!character) return;
  const copy = JSON.parse(JSON.stringify(character));
  copy.id = createId();
  copy.name = copy.name ? `${copy.name}（副本）` : "未命名角色（副本）";
  copy.created_at = new Date().toISOString();
  copy.updated_at = new Date().toISOString();
  store.characters.unshift(copy);
  activeCharacterId = copy.id;
  renderStats();
  renderCharacterList();
  renderEditor();
}

function refreshImageFromGallery() {
  const character = getActiveCharacter();
  if (!character) return;
  character.image_entry_id = imageEntryId.value.trim();
  character.image_filename = imageFilename.value.trim();
  character.image_url = imageUrl.value.trim();
  const linked =
    resolveGalleryEntry(character.image_entry_id) ||
    resolveGalleryEntryByFilename(character.image_filename);
  if (linked) {
    character.image_entry_id = linked.id || character.image_entry_id;
    character.image_filename = linked.filename || character.image_filename;
    character.image_url = linked.image_url || (linked.image_path ? `/${linked.image_path}` : "") || character.image_url;
  }
  bindImageFields(character);
}

function renderSuggestionCard(title, meta, payload, raw, applyHandler) {
  const node = suggestionTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".suggestionTitle").textContent = title;
  node.querySelector(".suggestionMeta").textContent = meta;
  node.querySelector(".suggestionJson").textContent = JSON.stringify(payload, null, 2);
  node.querySelector(".suggestionRaw").textContent = raw || "";
  node.querySelector(".applySuggestionButton").addEventListener("click", applyHandler);
  suggestionGrid.appendChild(node);
}

function clearAiPollTimer() {
  if (activePollTimer) {
    window.clearTimeout(activePollTimer);
    activePollTimer = null;
  }
}

function applySuggestionToForm(profile) {
  const character = getActiveCharacter();
  if (!character) return;
  if (profile.name) nameInput.value = profile.name;
  if (profile.gender) genderInput.value = profile.gender;
  if (profile.profession) professionInput.value = profile.profession;
  if (profile.race) raceInput.value = profile.race;
  if (Array.isArray(profile.traits)) traitsInput.value = profile.traits.join("\n");
  if (Array.isArray(profile.skills)) skillsInput.value = profile.skills.join("\n");
  if (Array.isArray(profile.specialties)) specialtiesInput.value = profile.specialties.join("\n");
  if (Array.isArray(profile.hobbies)) hobbiesInput.value = profile.hobbies.join("\n");
  if (profile.background_story) backgroundStoryInput.value = profile.background_story;
  if (Array.isArray(profile.relations) && profile.relations.length) {
    character.relations = profile.relations;
    renderRelations(character.relations);
  }
}

async function runAiAnalysis() {
  const character = getActiveCharacter();
  if (!character) {
    window.alert("请先新建或选择一个角色。");
    return;
  }
  applyFormToCharacter(character);
  if (!character.image_entry_id && !character.image_url) {
    window.alert("请先绑定角色图片，再进行 AI 分析。");
    return;
  }
  runAiButton.disabled = true;
  clearAiPollTimer();
  setStatus("AI 正在向所选代理提交分析任务，请稍候。", "running");
  suggestionGrid.innerHTML = "";
  activeAiPayload = null;
  try {
    const payload = await fetchJson(`${CHARACTER_API_URL}/ai-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_entry_id: character.image_entry_id,
        image_url: character.image_url,
        image_filename: character.image_filename,
        current_character: character,
        agent: agentSelect.value,
        extra_instructions: aiInstructions.value.trim(),
      }),
    });
    const taskId = payload.task_id;
    setStatus(`AI 任务已提交给 ${agentSelect.options[agentSelect.selectedIndex]?.text || agentSelect.value}，正在等待分析完成。任务号：${taskId}`, "running");
    await pollAiTask(taskId);
  } catch (error) {
    setStatus(error.message || "AI 分析失败。", "error");
    runAiButton.disabled = false;
    clearAiPollTimer();
  }
}

async function pollAiTask(taskId, attempt = 0) {
  try {
    const payload = await fetchJson(`${CHARACTER_API_URL}/ai-tasks/${encodeURIComponent(taskId)}?v=${Date.now()}`);
    activeAiPayload = payload;
    const completedCount = Array.isArray(payload.completed_agents) ? payload.completed_agents.length : 0;
    if (payload.status === "completed") {
      suggestionGrid.innerHTML = "";
      (payload.suggestions || []).forEach((item) => {
        renderSuggestionCard(
          item.agent_name || item.agent || "代理建议",
          item.agent || "",
          item.profile || {},
          item.raw_body || "",
          () => applySuggestionToForm(item.profile || {}),
        );
      });
      setStatus(`AI 分析完成，已收到 ${payload.replies?.length || 0} 个代理回复。`, "success");
      runAiButton.disabled = false;
      clearAiPollTimer();
      return;
    }
    const totalAgents = Array.isArray(payload.assigned_agents) && payload.assigned_agents.length ? payload.assigned_agents.length : 1;
    setStatus(`AI 正在分析中，当前已完成 ${completedCount}/${totalAgents} 个代理。`, "running");
    activePollTimer = window.setTimeout(() => {
      pollAiTask(taskId, attempt + 1);
    }, attempt < 10 ? 2500 : 4000);
  } catch (error) {
    setStatus(error.message || "AI 分析失败。", "error");
    runAiButton.disabled = false;
    clearAiPollTimer();
  }
}

window.addEventListener("beforeunload", () => {
  clearAiPollTimer();
});

function wireEvents() {
  characterList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-character-id]");
    if (!button) return;
    activeCharacterId = button.dataset.characterId;
    renderCharacterList();
    renderEditor();
  });

  characterSearch.addEventListener("input", renderCharacterList);
  refreshImageButton.addEventListener("click", refreshImageFromGallery);
  addRelationButton.addEventListener("click", () => {
    const character = getActiveCharacter();
    if (!character) return;
    character.relations = character.relations || [];
    character.relations.push({ type: "friend", name: "", target_character_id: "", target_image_entry_id: "", note: "" });
    renderRelations(character.relations);
  });
  saveCharacterButton.addEventListener("click", saveCharacter);
  deleteCharacterButton.addEventListener("click", deleteCharacter);
  newCharacterButton.addEventListener("click", addNewCharacter);
  duplicateCharacterButton.addEventListener("click", duplicateCharacter);
  runAiButton.addEventListener("click", runAiAnalysis);
}

async function init() {
  await loadGallery();
  await loadCharacters();
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  const requestedImageId = params.get("imageId");
  if (!store.characters.length) {
    const fresh = defaultCharacter();
    if (requestedId) fresh.id = requestedId;
    store.characters = [fresh];
    activeCharacterId = fresh.id;
  } else {
    if (requestedId && store.characters.find((item) => item.id === requestedId)) {
      activeCharacterId = requestedId;
    } else if (requestedImageId) {
      const matched = findCharacterByImageEntryId(requestedImageId);
      if (matched) {
        activeCharacterId = matched.id;
      } else {
        const fresh = defaultCharacter();
        store.characters.unshift(fresh);
        activeCharacterId = fresh.id;
      }
    }
  }
  renderStats();
  renderCharacterList();
  renderEditor();
  wireEvents();
  setStatus("可以开始手动编辑，或绑定图片后让 AI 自动生成角色资料。");
}

init().catch((error) => {
  setStatus(`初始化失败：${error.message}`, "error");
});
