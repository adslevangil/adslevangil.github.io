const PAGE_SIZE = 40;
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentPage() {
  const value = Number(new URLSearchParams(window.location.search).get("page") || "1");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function pageHref(page) {
  const params = new URLSearchParams(window.location.search);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const query = params.toString();
  return `/gallery/${query ? `?${query}` : ""}`;
}

async function loadGallery() {
  const response = await fetch(`/gallery/data/gallery.json?v=${Date.now()}`);
  if (!response.ok) throw new Error("加载图库数据失败");
  return response.json();
}

function renderPagination(page, pageCount) {
  prevPage.href = pageHref(Math.max(1, page - 1));
  nextPage.href = pageHref(Math.min(pageCount, page + 1));
  prevPage.style.pointerEvents = page <= 1 ? "none" : "";
  prevPage.style.opacity = page <= 1 ? "0.45" : "1";
  nextPage.style.pointerEvents = page >= pageCount ? "none" : "";
  nextPage.style.opacity = page >= pageCount ? "0.45" : "1";

  const pages = [];
  for (let value = 1; value <= pageCount; value += 1) pages.push(value);
  pagerNumbers.innerHTML = pages
    .map((value) => `<a class="pagerNumber${value === page ? " active" : ""}" href="${pageHref(value)}">${value}</a>`)
    .join("");
}

function openLightbox(entry) {
  lightboxImage.src = entry.image_url;
  lightboxImage.alt = entry.prompt;
  lightboxStyle.textContent = entry.style || "未命名风格";
  lightboxTarget.textContent = entry.target_name || entry.target_id || "未知服务器";
  lightboxTitle.textContent = entry.prompt || "生成详情";
  lightboxList.innerHTML = [
    ["提示词", entry.prompt],
    ["负面词", entry.negative_prompt || "无"],
    ["风格", entry.style],
    ["模型", entry.model],
    ["LoRA / 插件", entry.plugin || entry.lora || "无"],
    ["工作流", entry.workflow],
    ["采样", `${entry.sampler} / ${entry.scheduler} / ${entry.steps} steps / cfg ${entry.cfg}`],
    ["尺寸", `${entry.width} x ${entry.height}`],
    ["时间", new Date(entry.created_at).toLocaleString("zh-CN")],
    ["服务器", `${entry.target_name} (${entry.server?.base_url || "-"})`],
    ["文件名前缀", entry.filename_prefix || "-"],
    ["Prompt ID", entry.prompt_id || "-"],
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
  lightbox.showModal();
}

function renderCards(entries) {
  grid.innerHTML = "";
  if (!entries.length) {
    grid.innerHTML = `<article class="card"><div class="cardButton"><div class="cardBody"><strong>还没有图片</strong><p class="cardPrompt">等你从本地生成器成功出图后，这里会自动出现。</p></div></div></article>`;
    return;
  }

  entries.forEach((entry) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const button = node.querySelector(".cardButton");
    const image = node.querySelector(".cardImage");
    image.src = entry.image_url;
    image.alt = entry.prompt || entry.filename || "generated image";
    node.querySelector(".cardStyle").textContent = entry.style || "未命名风格";
    node.querySelector(".cardTime").textContent = new Date(entry.created_at).toLocaleString("zh-CN");
    node.querySelector(".cardTitle").textContent = entry.prompt || entry.filename || "未命名图片";
    node.querySelector(".cardPrompt").textContent = entry.negative_prompt ? `负面词: ${entry.negative_prompt}` : "点击查看完整提示词与工作流信息";
    node.querySelector(".cardModel").textContent = entry.model || "-";
    node.querySelector(".cardPlugin").textContent = entry.plugin || entry.lora || "无";
    node.querySelector(".cardServer").textContent = entry.target_name || entry.target_id || "-";
    button.addEventListener("click", () => openLightbox(entry));
    grid.appendChild(node);
  });
}

async function init() {
  try {
    const data = await loadGallery();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const page = currentPage();
    const pageSize = Number(data.per_page || PAGE_SIZE) || PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * pageSize;
    const pageEntries = entries.slice(start, start + pageSize);

    totalCount.textContent = String(entries.length);
    perPageCount.textContent = String(pageSize);
    updatedAt.textContent = data.updated_at ? new Date(data.updated_at).toLocaleString("zh-CN") : "--";
    pageTitle.textContent = `第 ${safePage} 页`;
    pageSummary.textContent = entries.length
      ? `显示第 ${start + 1} - ${Math.min(start + pageEntries.length, entries.length)} 张，共 ${entries.length} 张`
      : "暂无图片";

    renderPagination(safePage, pageCount);
    renderCards(pageEntries);
  } catch (error) {
    grid.innerHTML = `<article class="card"><div class="cardButton"><div class="cardBody"><strong>加载失败</strong><p class="cardPrompt">${escapeHtml(error.message)}</p></div></div></article>`;
  }
}

lightbox?.addEventListener("click", (event) => {
  const rect = lightbox.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!inside) lightbox.close();
});

init();
