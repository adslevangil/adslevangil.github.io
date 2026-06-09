const PAGE_SIZE = 40;
const FAVORITES_KEY = "eason_game_gallery_favorites_v1";
const FAVORITES_API_URL = "https://lalalabuy.com/eason-gallery-favorites/favorites";

const grid = document.querySelector("#galleryGrid");
const totalCount = document.querySelector("#totalCount");
const perPageCount = document.querySelector("#perPageCount");
const updatedAt = document.querySelector("#updatedAt");
const pageTitle = document.querySelector("#pageTitle");
const pageSummary = document.querySelector("#pageSummary");
const pagerNumbers = document.querySelector("#pagerNumbers");
const prevPage = document.querySelector("#prevPage");
const nextPage = document.querySelector("#nextPage");
const template = document.querySelector("#cardTemplate");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxStyle = document.querySelector("#lightboxStyle");
const lightboxTarget = document.querySelector("#lightboxTarget");
const lightboxTitle = document.querySelector("#lightboxTitle");
const lightboxList = document.querySelector("#lightboxList");
const lightboxFavorite = document.querySelector("#lightboxFavorite");
const lightboxDelete = document.querySelector("#lightboxDelete");
const lightboxPrev = document.querySelector("#lightboxPrev");
const lightboxNext = document.querySelector("#lightboxNext");
const allTab = document.querySelector("#allTab");
const favoritesTab = document.querySelector("#favoritesTab");
const toggleSelectModeButton = document.querySelector("#toggleSelectMode");
const selectPageButton = document.querySelector("#selectPageButton");
const clearSelectionButton = document.querySelector("#clearSelectionButton");
const deleteSelectedButton = document.querySelector("#deleteSelectedButton");
const bulkSummary = document.querySelector("#bulkSummary");

let favoriteIds = new Set();
let deletedIds = new Set();
let selectedIds = new Set();
let activeEntry = null;
let currentRenderedEntries = [];
let favoritesMode = "shared";
let selectionMode = false;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentView() {
  return new URLSearchParams(window.location.search).get("view") === "favorites" ? "favorites" : "all";
}

function currentPage() {
  const value = Number(new URLSearchParams(window.location.search).get("page") || "1");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function pageHref(page, view = currentView()) {
  const params = new URLSearchParams(window.location.search);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  if (view === "favorites") params.set("view", "favorites");
  else params.delete("view");
  const query = params.toString();
  return `/gallery/${query ? `?${query}` : ""}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("zh-CN") : "--";
}

function resolveImageUrl(entry) {
  return entry.image_path ? `/${entry.image_path}` : entry.image_url;
}

function loadLocalFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoriteIds]));
}

async function loadSharedFavorites() {
  const response = await fetch(`${FAVORITES_API_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("共享收藏接口不可用");
  const payload = await response.json();
  return {
    favoriteIds: Array.isArray(payload.favorite_ids) ? new Set(payload.favorite_ids) : new Set(),
    deletedIds: Array.isArray(payload.deleted_ids) ? new Set(payload.deleted_ids) : new Set(),
  };
}

async function persistSharedState(entryId, action, value) {
  const response = await fetch(FAVORITES_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: entryId, action, value }),
  });
  if (!response.ok) throw new Error("保存共享状态失败");
  const payload = await response.json();
  return {
    favoriteIds: Array.isArray(payload.favorite_ids) ? new Set(payload.favorite_ids) : new Set(),
    deletedIds: Array.isArray(payload.deleted_ids) ? new Set(payload.deleted_ids) : new Set(),
  };
}

function isFavorite(entry) {
  return favoriteIds.has(entry.id);
}

function isSelected(entry) {
  return selectedIds.has(entry.id);
}

function syncFavoriteButton(button, entry, activeText, inactiveText) {
  const favored = isFavorite(entry);
  button.classList.toggle("active", favored);
  button.textContent = favored ? activeText : inactiveText;
  button.setAttribute("aria-label", favored ? "取消收藏" : "加入收藏");
}

function syncSelectButton(button, entry) {
  const selected = isSelected(entry);
  button.classList.toggle("active", selected);
  button.textContent = selected ? "✓" : "○";
  button.setAttribute("aria-label", selected ? "取消选择" : "选择");
}

function setSelectionMode(value) {
  selectionMode = Boolean(value);
  if (!selectionMode) {
    selectedIds.clear();
  }
  document.body.classList.toggle("selectionMode", selectionMode);
  updateBulkBar();
  renderFromState(window.__galleryData || { entries: [] });
}

function updateBulkBar() {
  const count = selectedIds.size;
  toggleSelectModeButton.textContent = selectionMode ? "退出多选" : "多选模式";
  toggleSelectModeButton.classList.toggle("active", selectionMode);
  selectPageButton.disabled = !selectionMode || currentRenderedEntries.length === 0;
  clearSelectionButton.disabled = !selectionMode || count === 0;
  deleteSelectedButton.disabled = !selectionMode || count === 0;
  bulkSummary.textContent = selectionMode ? `已选择 ${count} 张图片` : "未选择图片";
}

function toggleSelected(entry) {
  if (!entry?.id) return;
  if (selectedIds.has(entry.id)) selectedIds.delete(entry.id);
  else selectedIds.add(entry.id);
  updateBulkBar();
}

function selectCurrentPage() {
  currentRenderedEntries.forEach((entry) => selectedIds.add(entry.id));
  updateBulkBar();
  renderFromState(window.__galleryData || { entries: [] });
}

function clearSelected() {
  selectedIds.clear();
  updateBulkBar();
  renderFromState(window.__galleryData || { entries: [] });
}

async function toggleFavorite(entry) {
  if (!entry?.id) return;
  const shouldFavorite = !favoriteIds.has(entry.id);
  if (favoritesMode === "shared") {
    const state = await persistSharedState(entry.id, "favorite", shouldFavorite);
    favoriteIds = state.favoriteIds;
    deletedIds = state.deletedIds;
    return;
  }
  if (shouldFavorite) favoriteIds.add(entry.id);
  else favoriteIds.delete(entry.id);
  saveLocalFavorites();
}

async function deleteEntry(entry) {
  if (!entry?.id) return;
  if (favoritesMode !== "shared") {
    throw new Error("当前客户端没有连上共享图库删除接口");
  }
  const state = await persistSharedState(entry.id, "delete", true);
  favoriteIds = state.favoriteIds;
  deletedIds = state.deletedIds;
  selectedIds.delete(entry.id);
}

async function deleteSelectedEntries() {
  if (favoritesMode !== "shared") {
    throw new Error("当前客户端没有连上共享图库删除接口");
  }
  const queue = [...selectedIds];
  for (const id of queue) {
    const entry = (window.__galleryData?.entries || []).find((item) => item.id === id);
    if (!entry) {
      selectedIds.delete(id);
      continue;
    }
    const state = await persistSharedState(entry.id, "delete", true);
    favoriteIds = state.favoriteIds;
    deletedIds = state.deletedIds;
    selectedIds.delete(entry.id);
  }
}

async function loadGallery() {
  const response = await fetch(`/gallery/data/gallery.json?v=${Date.now()}`);
  if (!response.ok) throw new Error("加载图库数据失败");
  return response.json();
}

function renderPagination(page, pageCount, view) {
  prevPage.href = pageHref(Math.max(1, page - 1), view);
  nextPage.href = pageHref(Math.min(pageCount, page + 1), view);
  prevPage.style.pointerEvents = page <= 1 ? "none" : "";
  prevPage.style.opacity = page <= 1 ? "0.45" : "1";
  nextPage.style.pointerEvents = page >= pageCount ? "none" : "";
  nextPage.style.opacity = page >= pageCount ? "0.45" : "1";

  const pages = [];
  for (let value = 1; value <= pageCount; value += 1) pages.push(value);
  pagerNumbers.innerHTML = pages
    .map((value) => `<a class="pagerNumber${value === page ? " active" : ""}" href="${pageHref(value, view)}">${value}</a>`)
    .join("");
}

function updateTabs(view, favoriteCount) {
  allTab.classList.toggle("active", view === "all");
  favoritesTab.classList.toggle("active", view === "favorites");
  favoritesTab.textContent = `收藏${favoriteCount ? ` (${favoriteCount})` : ""}`;
}

function getActiveIndex() {
  return currentRenderedEntries.findIndex((entry) => entry.id === activeEntry?.id);
}

function syncLightboxNav() {
  const index = getActiveIndex();
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < currentRenderedEntries.length - 1;
  lightboxPrev.disabled = !hasPrev;
  lightboxNext.disabled = !hasNext;
}

function openLightbox(entry) {
  activeEntry = entry;
  lightboxImage.src = resolveImageUrl(entry);
  lightboxImage.alt = entry.prompt || entry.filename || "generated image";
  lightboxStyle.textContent = entry.style || "未命名风格";
  lightboxTarget.textContent = entry.target_name || entry.target_id || "未知服务器";
  lightboxTitle.textContent = entry.id ? `图片编号 ${entry.id}` : (entry.filename || "生成详情");
  syncFavoriteButton(lightboxFavorite, entry, "★ 已收藏", "☆ 收藏");
  lightboxList.innerHTML = [
    ["图片编号", entry.id || "-"],
    ["文件名", entry.filename || "-"],
    ["提示词", entry.prompt || "无"],
    ["负面词", entry.negative_prompt || "无"],
    ["风格", entry.style || "无"],
    ["模型", entry.model || "无"],
    ["LoRA / 插件", entry.plugin || entry.lora || "无"],
    ["工作流", entry.workflow || "无"],
    ["采样", `${entry.sampler || "-"} / ${entry.scheduler || "-"} / ${entry.steps || "-"} steps / cfg ${entry.cfg || "-"}`],
    ["尺寸", `${entry.width || "-"} x ${entry.height || "-"}`],
    ["时间", formatDate(entry.created_at)],
    ["服务器", entry.target_name || entry.target_id || "未知服务器"],
    ["文件名前缀", entry.filename_prefix || "-"],
    ["Prompt ID", entry.prompt_id || "-"],
    ["收藏同步", favoritesMode === "shared" ? "共享收藏" : "本地收藏"],
    ["图库状态", deletedIds.has(entry.id) ? "已删除" : "显示中"],
  ]
    .map(
      ([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `,
    )
    .join("");
  syncLightboxNav();
  lightbox.showModal();
}

function openRelativeEntry(offset) {
  const index = getActiveIndex();
  if (index < 0) return;
  const nextEntry = currentRenderedEntries[index + offset];
  if (nextEntry) openLightbox(nextEntry);
}

function renderCards(entries) {
  currentRenderedEntries = entries;
  grid.innerHTML = "";
  if (!entries.length) {
    const emptyTitle = currentView() === "favorites" ? "还没有收藏图片" : "还没有图片";
    const emptyText =
      currentView() === "favorites"
        ? "点亮右上角五角星后，图片会自动进入收藏标签。"
        : "等你从生成器成功出图后，这里会自动出现。";
    grid.innerHTML = `
      <article class="card cardEmpty">
        <div class="cardBody">
          <strong>${emptyTitle}</strong>
          <span class="cardSubline">${emptyText}</span>
        </div>
      </article>
    `;
    updateBulkBar();
    return;
  }

  entries.forEach((entry) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const button = node.querySelector(".cardButton");
    const favoriteButton = node.querySelector(".favoriteButton");
    const selectButton = node.querySelector(".selectButton");
    const image = node.querySelector(".cardImage");

    node.classList.toggle("selected", isSelected(entry));
    image.src = resolveImageUrl(entry);
    image.alt = entry.filename || "generated image";
    node.querySelector(".cardStyle").textContent = entry.style || "未命名风格";
    node.querySelector(".cardTime").textContent = formatDate(entry.created_at);
    node.querySelector(".cardTitle").textContent = entry.model || entry.filename || "未命名图片";
    node.querySelector(".cardSubline").textContent = `${entry.id || "无编号"} | ${entry.target_name || entry.target_id || "未知服务器"} | ${selectionMode ? "点击可选择" : "点击查看详情"}`;
    syncFavoriteButton(favoriteButton, entry, "★", "☆");
    syncSelectButton(selectButton, entry);

    selectButton.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (!selectionMode) setSelectionMode(true);
      toggleSelected(entry);
      renderFromState(window.__galleryData || { entries: [] });
    });

    favoriteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      event.preventDefault();
      favoriteButton.disabled = true;
      try {
        await toggleFavorite(entry);
        renderFromState(window.__galleryData || { entries: [] });
        if (lightbox.open && activeEntry?.id === entry.id) {
          openLightbox(entry);
        }
      } catch (error) {
        window.alert(error.message || "收藏保存失败");
      } finally {
        favoriteButton.disabled = false;
      }
    });

    button.addEventListener("click", () => {
      if (selectionMode) {
        toggleSelected(entry);
        renderFromState(window.__galleryData || { entries: [] });
        return;
      }
      openLightbox(entry);
    });

    grid.appendChild(node);
  });

  updateBulkBar();
}

function sortEntriesForView(entries, view) {
  const list = [...entries];
  if (view === "favorites") {
    list.sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
  }
  return list;
}

function renderFromState(data) {
  const view = currentView();
  const allEntries = (Array.isArray(data.entries) ? data.entries : []).filter((entry) => !deletedIds.has(entry.id));
  const baseEntries = view === "favorites" ? allEntries.filter((entry) => isFavorite(entry)) : allEntries;
  const filteredEntries = sortEntriesForView(baseEntries, view);
  const page = currentPage();
  const pageSize = Number(data.per_page || PAGE_SIZE) || PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageEntries = filteredEntries.slice(start, start + pageSize);

  totalCount.textContent = String(allEntries.length);
  perPageCount.textContent = String(pageSize);
  updatedAt.textContent = formatDate(data.updated_at);
  pageTitle.textContent = view === "favorites" ? `收藏 · 第 ${safePage} 页` : `第 ${safePage} 页`;
  pageSummary.textContent = filteredEntries.length
    ? `显示第 ${start + 1} - ${Math.min(start + pageEntries.length, filteredEntries.length)} 张，共 ${filteredEntries.length} 张`
    : view === "favorites"
      ? "收藏夹里还没有图片"
      : "暂无图片";

  updateTabs(view, favoriteIds.size);
  renderPagination(safePage, pageCount, view);
  renderCards(pageEntries);
}

async function initFavorites() {
  try {
    const state = await loadSharedFavorites();
    favoriteIds = state.favoriteIds;
    deletedIds = state.deletedIds;
    favoritesMode = "shared";
  } catch {
    favoriteIds = loadLocalFavorites();
    deletedIds = new Set();
    favoritesMode = "local";
  }
}

async function init() {
  try {
    await initFavorites();
    const data = await loadGallery();
    window.__galleryData = data;
    renderFromState(data);
  } catch (error) {
    grid.innerHTML = `
      <article class="card cardEmpty">
        <div class="cardBody">
          <strong>加载失败</strong>
          <span class="cardSubline">${escapeHtml(error.message)}</span>
        </div>
      </article>
    `;
  }
}

toggleSelectModeButton?.addEventListener("click", () => {
  setSelectionMode(!selectionMode);
});

selectPageButton?.addEventListener("click", () => {
  selectCurrentPage();
});

clearSelectionButton?.addEventListener("click", () => {
  clearSelected();
});

deleteSelectedButton?.addEventListener("click", async () => {
  if (!selectedIds.size) return;
  const confirmed = window.confirm(`删除后，这 ${selectedIds.size} 张图会从所有客户端的图库列表里隐藏。确定继续吗？`);
  if (!confirmed) return;
  deleteSelectedButton.disabled = true;
  try {
    await deleteSelectedEntries();
    renderFromState(window.__galleryData || { entries: [] });
  } catch (error) {
    window.alert(error.message || "批量删除失败");
  } finally {
    deleteSelectedButton.disabled = false;
  }
});

lightboxFavorite?.addEventListener("click", async () => {
  if (!activeEntry) return;
  lightboxFavorite.disabled = true;
  try {
    await toggleFavorite(activeEntry);
    openLightbox(activeEntry);
    renderFromState(window.__galleryData || { entries: [] });
  } catch (error) {
    window.alert(error.message || "收藏保存失败");
  } finally {
    lightboxFavorite.disabled = false;
  }
});

lightboxDelete?.addEventListener("click", async () => {
  if (!activeEntry) return;
  const confirmed = window.confirm("删除后，这张图会从所有客户端的图库列表里隐藏。确定继续吗？");
  if (!confirmed) return;
  lightboxDelete.disabled = true;
  try {
    await deleteEntry(activeEntry);
    lightbox.close();
    renderFromState(window.__galleryData || { entries: [] });
  } catch (error) {
    window.alert(error.message || "删除失败");
  } finally {
    lightboxDelete.disabled = false;
  }
});

lightboxPrev?.addEventListener("click", () => openRelativeEntry(-1));
lightboxNext?.addEventListener("click", () => openRelativeEntry(1));

window.addEventListener("keydown", (event) => {
  if (!lightbox.open) return;
  if (event.key === "ArrowLeft") openRelativeEntry(-1);
  if (event.key === "ArrowRight") openRelativeEntry(1);
});

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    lightbox.close();
  }
});

init();
