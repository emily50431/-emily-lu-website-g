const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const BASE_URL = "https://emily50431.github.io/-emily-lu-website-g";

// ─── 共用 NAV CSS（注入到 <style> 內）─────────────────────────────────────────
const NAV_CSS = `
  .sticky-nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(25px);
    border-bottom: 1px solid rgba(0,0,0,0.03);
  }
  .nav-container {
    max-width: 1100px; margin: 0 auto;
    padding: 1.25rem 2rem;
    display: flex; justify-content: space-between; align-items: center;
  }
  .nav-logo {
    font-size: 1.2rem; font-weight: 900; letter-spacing: -0.04em;
    text-decoration: none; color: #1F2937; flex-shrink: 0;
  }
  .nav-logo span { color: #5D5FEF; }
  /* 桌面選單 */
  .nav-links {
    display: flex; align-items: center; gap: 2.5rem;
    font-size: 13px; font-weight: 700;
    letter-spacing: 0.15em; text-transform: uppercase; color: #94A3B8;
  }
  .nav-links a { text-decoration: none; color: inherit; transition: color 0.2s; }
  .nav-links a:hover { color: #5D5FEF; }
  .nav-cta {
    background: #5D5FEF; color: white !important;
    padding: 0.5rem 1.5rem; border-radius: 9999px;
    font-weight: 700; text-decoration: none;
    white-space: nowrap;
  }
  .nav-cta:hover { opacity: 0.88; }
  /* 漢堡按鈕 */
  .nav-burger {
    display: none;
    flex-direction: column; justify-content: center; align-items: center;
    gap: 5px; width: 36px; height: 36px;
    background: none; border: none; cursor: pointer; padding: 4px;
    flex-shrink: 0;
  }
  .nav-burger span {
    display: block; width: 22px; height: 2px;
    background: #1F2937; border-radius: 2px;
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    transform-origin: center;
  }
  /* 漢堡開啟狀態 */
  .nav-burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .nav-burger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
  .nav-burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
  /* 手機下拉選單 */
  .nav-mobile {
    display: none;
    flex-direction: column;
    background: rgba(255,255,255,0.97);
    backdrop-filter: blur(25px);
    padding: 1rem 2rem 1.5rem;
    border-top: 1px solid rgba(93,95,239,0.08);
    gap: 0.25rem;
  }
  .nav-mobile.open { display: flex; }
  .nav-mobile a {
    font-size: 14px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: #64748B; text-decoration: none;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid rgba(0,0,0,0.04);
    transition: color 0.2s;
  }
  .nav-mobile a:last-child { border-bottom: none; }
  .nav-mobile a:hover { color: #5D5FEF; }
  .nav-mobile .nav-cta {
    margin-top: 0.75rem;
    text-align: center;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    border-bottom: none !important;
  }
  /* RWD 斷點 */
  @media (max-width: 640px) {
    .nav-links { display: none; }
    .nav-burger { display: flex; }
    .nav-container { padding: 1rem 1.25rem; }
  }
  .mesh-gradient {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    z-index: -1;
    background:
      radial-gradient(circle at 15% 50%, rgba(93, 95, 239, 0.1) 0%, transparent 40%),
      radial-gradient(circle at 80% 80%, rgba(93, 95, 239, 0.05) 0%, transparent 50%);
    background-color: #FDFDFF;
  }
`;

// ─── 共用 NAV HTML（文章頁、文章列表頁使用）────────────────────────────────────
const NAV_HTML = `
  <style>${NAV_CSS}</style>
  <div class="mesh-gradient"></div>
  <nav class="sticky-nav">
    <div class="nav-container">
      <a href="/-emily-lu-website-g/" class="nav-logo">Emily's LAB<span>.</span></a>
      <div class="nav-links">
        <a href="/-emily-lu-website-g/about/">關於我</a>
        <a href="/-emily-lu-website-g/blog/">文章分享</a>
        <a href="mailto:emily50431@gmail.com" target="_blank" class="nav-cta">聯絡交流</a>
      </div>
      <button class="nav-burger" id="navBurger" aria-label="開啟選單">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="nav-mobile" id="navMobile">
      <a href="/-emily-lu-website-g/about/">關於我</a>
      <a href="/-emily-lu-website-g/blog/">文章分享</a>
      <a href="mailto:emily50431@gmail.com" target="_blank" class="nav-cta">聯絡交流</a>
    </div>
  </nav>
  <script>
    (function(){
      var btn = document.getElementById('navBurger');
      var menu = document.getElementById('navMobile');
      if(btn && menu){
        btn.addEventListener('click', function(){
          btn.classList.toggle('open');
          menu.classList.toggle('open');
        });
      }
    })();
  <\/script>`;

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(filepath);
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function processImages(md, slug) {
  const imgDir = path.join("assets", "images", slug);
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let result = md;
  const matches = [...md.matchAll(imgRegex)];

  for (let i = 0; i < matches.length; i++) {
    const [full, alt, url] = matches[i];
    if (!url || url.startsWith("/-emily-lu-website-g")) continue;

    try {
      const ext = url.split("?")[0].split(".").pop().split("/").pop() || "png";
      const filename = `img-${i + 1}.${ext.length > 5 ? "png" : ext}`;
      const filepath = path.join(imgDir, filename);
      await downloadImage(url, filepath);
      const localUrl = `${BASE_URL}/assets/images/${slug}/${filename}`;
      result = result.replace(full, `![${alt}](${localUrl})`);
      console.log(`圖片下載成功：${filename}`);
    } catch (e) {
      console.log(`圖片下載失敗：${url}`);
    }
  }
  return result;
}

async function fetchPosts() {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Status",
      select: { equals: "Published" },
    },
    sorts: [{ property: "PublishedDate", direction: "descending" }],
  });
  return response.results;
}

async function getPostContent(pageId) {
  try {
    const mdBlocks = await n2m.pageToMarkdown(pageId);
    const mdString = n2m.toMarkdownString(mdBlocks);
    const content = mdString?.parent || mdString || "";
    console.log("=== 文章內容 ===");
    console.log(content.substring(0, 500));
    return content;
  } catch (e) {
    console.log("錯誤:", e.message);
    return "";
  }
}

function makeDownloadBtn(downloadUrl, downloadLabel) {
  const label = downloadLabel || "免費下載完整學習資源";
  const safeUrl = downloadUrl.replace(/'/g, "\\'");
  const trackScript = `gtag('event','download',{'file_name':'google-drive-folder','page_slug':'${safeUrl}'})`;
  return `<div class="download-section"><a href="${downloadUrl}" target="_blank" class="download-block" onclick="${trackScript.replace(/"/g, '&quot;')}"><div class="dl-pulse"></div><div class="dl-arrow">前往查看 →</div><div class="dl-icon-wrap"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5D5FEF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div><div class="dl-title">${label}</div></a></div>`;
}

const INFO_CARD_TYPE_MAP = {
  '重點整理': { color: 'purple', icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>' },
  '實用技巧': { color: 'teal',   icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
  '注意事項': { color: 'amber',  icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
  '小提醒':   { color: 'amber',  icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
  '延伸閱讀': { color: 'blue',   icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
  '基本資料': { color: 'blue',   icon: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
};

function makeInfoCard(label, title, desc) {
  const trimLabel = label.trim();
  const type = INFO_CARD_TYPE_MAP[trimLabel] || { color: 'purple', icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>' };
  const descHtml = desc.trim() ? `<p class="info-card__desc">${desc.trim().replace(/\\n/g, '<br>')}</p>` : '';
  return `<div class="info-card info-card--${type.color}"><div class="info-card__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${type.icon}</svg></div><div class="info-card__body"><p class="info-card__label">${trimLabel}</p><div class="info-card__row"><p class="info-card__title">${title.trim()}</p>${descHtml}</div></div></div>`;
}

function groupInfoCards(html) {
  const cardPattern = /(<div class="info-card info-card--[^"]+">(?:(?!<div class="info-card ).)*?<\/div><\/div>)/gs;
  const parts = [];
  let last = 0;
  const matches = [...html.matchAll(/<div class="info-card info-card--([^"]+)">([\s\S]*?)<\/div><\/div>/g)];
  if (matches.length === 0) return html;
  let i = 0;
  while (i < matches.length) {
    const m = matches[i];
    parts.push(html.slice(last, m.index));
    const labelMatch = m[2].match(/<p class="info-card__label">(.*?)<\/p>/);
    const currentLabel = labelMatch ? labelMatch[1] : '';
    const color = m[1];
    let rows = m[2].replace(/<p class="info-card__label">.*?<\/p>/, '').replace(/<div class="info-card__icon">[\s\S]*?<\/div>/, '');
    let j = i + 1;
    while (j < matches.length) {
      const next = matches[j];
      if (next.index !== (matches[j-1].index + matches[j-1][0].length + (html.slice(matches[j-1].index + matches[j-1][0].length, next.index).trim() === '' ? html.slice(matches[j-1].index + matches[j-1][0].length, next.index).length : -1))) break;
      const nextLabel = (next[2].match(/<p class="info-card__label">(.*?)<\/p>/) || [])[1] || '';
      if (nextLabel !== currentLabel) break;
      rows += next[2].replace(/<p class="info-card__label">.*?<\/p>/, '').replace(/<div class="info-card__icon">[\s\S]*?<\/div>/, '');
      j++;
    }
    const type = INFO_CARD_TYPE_MAP[currentLabel] || { icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>' };
    parts.push(`<div class="info-card info-card--${color}"><div class="info-card__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${type.icon}</svg></div><div class="info-card__body"><p class="info-card__label">${currentLabel}</p>${rows}</div></div>`);
    last = matches[j-1].index + matches[j-1][0].length;
    i = j;
  }
  parts.push(html.slice(last));
  return parts.join('');
}

function markdownToHtml(md, downloadUrl = "", downloadLabel = "") {
  let html = md
    .replace(/\{\{card:(.*?)\|(.*?)\|(.*?)\}\}/g, (_, label, title, desc) => makeInfoCard(label, title, desc))
    .replace(/\{\{card:(.*?)\|(.*?)\}\}/g, (_, label, title) => makeInfoCard(label, title, ''))
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/(?:\*\*)?==\*{0,2}([\s\S]+?)\*{0,2}==(?:\*\*)?/g, '<mark class="hl-yellow"><strong>$1</strong></mark>')
    .replace(/^> (.+)$/gm, '<div class="hl-block">$1</div>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:1rem 0;">')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\{\{download\}\}/g, downloadUrl ? makeDownloadBtn(downloadUrl, downloadLabel) : '')
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, (line) =>
      line.startsWith("<") ? line : `<p>${line}</p>`
    );
  return groupInfoCards(html);
}

function generatePostHtml(title, date, categories, content, slug = '', excerpt = '') {
  const categoryTags = categories
    .map((c) => `<span class="post-tag">${c}</span>`)
    .join("");

  const descriptionText = excerpt || content.replace(/<[^>]+>/g, '').substring(0, 160).trim();

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Emily's LAB</title>
  <!-- SEO -->
  <meta name="description" content="${descriptionText}" />
  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title} | Emily's LAB" />
  <meta property="og:description" content="${descriptionText}" />
  <meta property="og:image" content="${BASE_URL}/og-image.png" />
  <meta property="og:url" content="${BASE_URL}/blog/${slug}/" />
  <meta property="og:site_name" content="Emily's LAB" />
  <meta property="og:locale" content="zh_TW" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} | Emily's LAB" />
  <meta name="twitter:description" content="${descriptionText}" />
  <meta name="twitter:image" content="${BASE_URL}/og-image.png" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/-emily-lu-website-g/assets/style.css" />
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-67N1NCPZGK"><\/script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-67N1NCPZGK');
  <\/script>
</head>
<body class="antialiased">
  ${NAV_HTML}
  <main class="post-wrap">
    <div class="post-meta">
      ${categoryTags}
      <span class="post-date">${date}</span>
    </div>
    <h1 class="post-title">${title}</h1>

    <!-- 標題下方分享列 -->
    <div class="share-bar share-bar--top">
      <button class="share-btn" onclick="shareTo('line','${BASE_URL}/blog/${slug}/')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#00B900"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.07 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
      </button>
      <button class="share-btn" onclick="shareTo('threads','${BASE_URL}/blog/${slug}/')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M13.468 7.458L19.11 1h-1.328l-4.896 5.695L8.787 1H4l5.928 8.622L4 17h1.328l5.183-6.025L15.213 17H20l-6.532-9.542zM11.19 10.12l-.601-.859L5.8 1.875h2.059l3.86 5.52.601.859 5.016 7.17h-2.058l-4.087-5.304z"/></svg>
      </button>
      <button class="share-btn" onclick="copyLink('${BASE_URL}/blog/${slug}/')" id="copyBtnTop">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5D5FEF" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
    </div>

    <div class="post-content">${content}</div>

    <!-- 文章結尾：按讚 + 分享 -->
    <div class="post-footer-bar">
      <div class="like-area">
        <button class="like-btn" id="likeBtn" onclick="handleLike('${slug}')">
          <span class="like-heart">❤️</span>
          <span class="like-count" id="likeCount">0</span>
        </button>
        <span class="like-msg">謝謝您的閱讀，<br>您的愛心是莫大的鼓勵</span>
      </div>
      <div class="share-bar">
        <button class="share-btn" onclick="shareTo('line','${BASE_URL}/blog/${slug}/')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#00B900"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.07 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        </button>
        <button class="share-btn" onclick="shareTo('threads','${BASE_URL}/blog/${slug}/')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M13.468 7.458L19.11 1h-1.328l-4.896 5.695L8.787 1H4l5.928 8.622L4 17h1.328l5.183-6.025L15.213 17H20l-6.532-9.542zM11.19 10.12l-.601-.859L5.8 1.875h2.059l3.86 5.52.601.859 5.016 7.17h-2.058l-4.087-5.304z"/></svg>
        </button>
        <button class="share-btn" onclick="copyLink('${BASE_URL}/blog/${slug}/')" id="copyBtnBottom">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5D5FEF" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>
      </div>
    </div>
  </main>
  <footer style="padding:5rem 0;text-align:center;border-top:1px solid rgba(93,95,239,0.08);">
    <p style="font-size:12px;font-weight:900;letter-spacing:0.3em;color:#D1D5DB;text-transform:uppercase;">© 2026 EMILY LU — 保持學習、保持快樂</p>
  </footer>

  <!-- 複製連結 Toast -->
  <div id="copyToast" style="position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(20px);background:#1F2937;color:white;font-size:14px;font-weight:700;padding:0.75rem 1.5rem;border-radius:9999px;opacity:0;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);pointer-events:none;z-index:999;white-space:nowrap;">✓ 已複製連結</div>
  <style>#copyToast.show{opacity:1!important;transform:translateX(-50%) translateY(0)!important;}</style>

  <script>
    // 分享功能
    function shareTo(platform, url) {
      var encoded = encodeURIComponent(url);
      var urls = {
        line: 'https://line.me/R/msg/text/?' + encoded,
        threads: 'https://www.threads.net/intent/post?text=' + encoded
      };
      if (urls[platform]) {
        window.open(urls[platform], '_blank');
        gtag('event', 'share', { method: platform, content_type: 'article', item_id: '${slug}' });
      }
    }

    // 複製連結
    function copyLink(url) {
      navigator.clipboard.writeText(url).then(function() {
        var toast = document.getElementById('copyToast');
        if (toast) {
          toast.classList.add('show');
          setTimeout(function() { toast.classList.remove('show'); }, 1500);
        }
        gtag('event', 'share', { method: 'copy_link', content_type: 'article', item_id: '${slug}' });
      });
    }

    // 按讚功能（Supabase，無限按）
    var SUPABASE_URL = 'https://bicpmisqilziyjuxytbl.supabase.co';
    var ANON_KEY = '` + (process.env.SUPABASE_ANON_KEY || '') + `';
    var slug = '${slug}';
    var count = 0;

    var likeBtn = document.getElementById('likeBtn');
    var likeCountEl = document.getElementById('likeCount');

    function renderLike() {
      likeCountEl.textContent = count;
    }

    async function loadLikeCount() {
      try {
        var res = await fetch(
          SUPABASE_URL + '/rest/v1/likes?slug=eq.' + encodeURIComponent(slug) + '&select=id',
          { headers: { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY } }
        );
        var data = await res.json();
        count = Array.isArray(data) ? data.length : 0;
        renderLike();
      } catch(e) { renderLike(); }
    }

    async function handleLike(s) {
      count++;
      renderLike();
      likeBtn.style.transform = 'scale(1.2)';
      setTimeout(function() { likeBtn.style.transform = ''; }, 200);
      gtag('event', 'like', { content_type: 'article', item_id: s });
      try {
        await fetch(SUPABASE_URL + '/rest/v1/likes', {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': 'Bearer ' + ANON_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ slug: s, ip_hash: 'anon' })
        });
      } catch(e) {}
    }

    loadLikeCount();
  <\/script>
</body>
</html>`;
}

function generateBlogIndexHtml(posts) {
  const items = posts
    .map((p) => {
      const categoryTags = p.categories
        .map((c) => `<span class="list-tag">${c}</span>`)
        .join("");
      return `
    <a class="post-list-item" href="${BASE_URL}/blog/${p.slug}/">
      <div class="post-list-meta">
        <span class="post-list-date">${p.date}</span>
        <div class="post-list-tags">${categoryTags}</div>
      </div>
      <div class="post-list-title">${p.title}</div>
      <div class="post-list-excerpt">${p.excerpt}</div>
    </a>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>文章 | Emily's LAB</title>
  <!-- SEO -->
  <meta name="description" content="Emily 的文章分享，涵蓋 AI 應用、職場成長、生活實作等主題。" />
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="文章 | Emily's LAB" />
  <meta property="og:description" content="Emily 的文章分享，涵蓋 AI 應用、職場成長、生活實作等主題。" />
  <meta property="og:image" content="${BASE_URL}/og-image.png" />
  <meta property="og:url" content="${BASE_URL}/blog/" />
  <meta property="og:site_name" content="Emily's LAB" />
  <meta property="og:locale" content="zh_TW" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="文章 | Emily's LAB" />
  <meta name="twitter:description" content="Emily 的文章分享，涵蓋 AI 應用、職場成長、生活實作等主題。" />
  <meta name="twitter:image" content="${BASE_URL}/og-image.png" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/-emily-lu-website-g/assets/style.css" />
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-67N1NCPZGK"><\/script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-67N1NCPZGK');
  <\/script>
</head>
<body class="antialiased">
  ${NAV_HTML}
  <main class="blog-wrap">
    <h1 class="section-title">所有文章</h1>
    <div class="post-list">${items}</div>
  </main>
  <footer style="padding:5rem 0;text-align:center;border-top:1px solid rgba(93,95,239,0.08);">
    <p style="font-size:12px;font-weight:900;letter-spacing:0.3em;color:#D1D5DB;text-transform:uppercase;">© 2026 EMILY LU — 保持學習、保持快樂</p>
  </footer>
</body>
</html>`;
}

function generateHomeCards(posts) {
  const top3 = posts.slice(0, 3);
  return top3.map((p, i) => {
    const category = p.categories[0] || "文章";
    return `
      <div class="spec-item p-10 reveal" style="transition-delay: ${i * 0.15}s; display:flex; flex-direction:column;">
        <div class="mb-8 flex items-center justify-between">
          <span class="text-[12px] font-black tracking-widest text-[#5D5FEF] bg-indigo-50/50 px-3 py-1 rounded-full uppercase">${category}</span>
          <div class="text-[12px] font-black text-slate-200 uppercase">0${i + 1} /</div>
        </div>
        <h3 class="text-2xl font-black tracking-tight mb-4 leading-tight">${p.title}</h3>
        <p class="text-slate-400 text-[13px] leading-relaxed" style="flex:1;">${p.excerpt}</p>
        <div style="margin-top:2.5rem;">
          <a href="${BASE_URL}/blog/${p.slug}/" class="text-[12px] font-black text-[#5D5FEF] uppercase tracking-widest" style="text-decoration:none;">Read More →</a>
        </div>
      </div>`;
  }).join("");
}

function generateHomeHtml(posts) {
  const cards = generateHomeCards(posts);
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Emily's LAB｜Planner·Writer·Creator</title>
    <!-- SEO -->
    <meta name="description" content="Emily's LAB — 用人生實作，創造影響力。Solution Planner、Writer、Creator，分享 AI 應用、職場成長與生活實作。" />
    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Emily's LAB｜Planner·Writer·Creator" />
    <meta property="og:description" content="用人生實作，創造影響力。分享 AI 應用、職場成長與生活實作。" />
    <meta property="og:image" content="${BASE_URL}/og-image.png" />
    <meta property="og:url" content="${BASE_URL}/" />
    <meta property="og:site_name" content="Emily's LAB" />
    <meta property="og:locale" content="zh_TW" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Emily's LAB｜Planner·Writer·Creator" />
    <meta name="twitter:description" content="用人生實作，創造影響力。分享 AI 應用、職場成長與生活實作。" />
    <meta name="twitter:image" content="${BASE_URL}/og-image.png" />
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans TC', sans-serif; background-color: #ffffff; overflow-x: hidden; color: #1F2937; }
        .mesh-gradient {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            z-index: -1;
            background:
                radial-gradient(circle at 15% 50%, rgba(93, 95, 239, 0.1) 0%, transparent 40%),
                radial-gradient(circle at 80% 80%, rgba(93, 95, 239, 0.05) 0%, transparent 50%);
            background-color: #FDFDFF;
        }
        @keyframes glowPulse {
            0%, 100% { box-shadow: 0 0 15px 2px rgba(93, 95, 239, 0.2); }
            50% { box-shadow: 0 0 25px 5px rgba(93, 95, 239, 0.4); }
        }
        @keyframes dotPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:.6} }
        @keyframes tagSlide { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        .hero-tag { display:inline-flex; align-items:center; gap:6px; font-size:10px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; color:#5D5FEF; background:rgba(93,95,239,0.08); border:1px solid rgba(93,95,239,0.15); padding:5px 12px; border-radius:20px; margin-bottom:1.5rem; animation:tagSlide .5s .3s both; }
        .hero-dot { width:6px; height:6px; border-radius:50%; background:#5D5FEF; animation:dotPulse 2s infinite; flex-shrink:0; }
        /* ── 首頁 Nav ── */
        .sticky-nav {
            position: sticky; top: 0; z-index: 100;
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(25px);
            border-bottom: 1px solid rgba(0,0,0,0.03);
        }
        .nav-container { max-width: 1100px; margin: 0 auto; padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .nav-logo { font-size: 1.2rem; font-weight: 900; letter-spacing: -0.04em; text-decoration: none; color: #1F2937; flex-shrink: 0; }
        .nav-logo span { color: #5D5FEF; }
        .nav-links { display: flex; align-items: center; gap: 2.5rem; font-size: 13px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #94A3B8; }
        .nav-links a { text-decoration: none; color: inherit; transition: color 0.2s; }
        .nav-links a:hover { color: #5D5FEF; }
        .nav-cta { background: #5D5FEF; color: white !important; padding: 0.5rem 1.5rem; border-radius: 9999px; font-weight: 700; white-space: nowrap; }
        .nav-cta:hover { opacity: 0.88; }
        .nav-burger { display: none; flex-direction: column; justify-content: center; align-items: center; gap: 5px; width: 36px; height: 36px; background: none; border: none; cursor: pointer; padding: 4px; flex-shrink: 0; }
        .nav-burger span { display: block; width: 22px; height: 2px; background: #1F2937; border-radius: 2px; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); transform-origin: center; }
        .nav-burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .nav-burger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .nav-burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
        .nav-mobile { display: none; flex-direction: column; background: rgba(255,255,255,0.97); backdrop-filter: blur(25px); padding: 1rem 2rem 1.5rem; border-top: 1px solid rgba(93,95,239,0.08); gap: 0.25rem; }
        .nav-mobile.open { display: flex; }
        .nav-mobile a { font-size: 14px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #64748B; text-decoration: none; padding: 0.75rem 0.5rem; border-bottom: 1px solid rgba(0,0,0,0.04); transition: color 0.2s; }
        .nav-mobile a:last-child { border-bottom: none; }
        .nav-mobile a:hover { color: #5D5FEF; }
        .nav-mobile .nav-cta { margin-top: 0.75rem; text-align: center; padding: 0.75rem 1.5rem; border-radius: 12px; border-bottom: none !important; }
        @media (max-width: 640px) {
          .nav-links { display: none; }
          .nav-burger { display: flex; }
          .nav-container { padding: 1rem 1.25rem; }
        }
        /* ── 其他樣式 ── */
        .photo-base {
            background: rgba(243, 244, 246, 0.6);
            border-radius: 3.5rem; padding: 2.5rem;
            width: 100%; max-width: 320px; margin-left: auto;
        }
        .photo-card {
            background: #ffffff; border-radius: 2.5rem;
            width: 100%; aspect-ratio: 4/5;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; border: 1.5px solid rgba(93, 95, 239, 0.3);
            animation: glowPulse 4s ease-in-out infinite;
            transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
            position: relative; z-index: 1;
        }
        .photo-card:hover {
            transform: translateY(-10px) scale(1.01);
            border-color: rgba(93, 95, 239, 0.6);
            box-shadow: 0 0 15px 4px rgba(93,95,239,0.4), 0 0 30px 10px rgba(93,95,239,0.15), 0 15px 30px rgba(0,0,0,0.08);
            animation: none;
        }
        .photo-card img { width: 100%; height: 100%; object-fit: cover; object-position: center 10%; transform: scale(1.3); pointer-events: none; }
        .spec-item { background: #ffffff; border-radius: 2rem; transition: all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1); border: 1px solid rgba(0,0,0,0.03); }
        .spec-item:hover { transform: translateY(-15px); box-shadow: 0 40px 80px -15px rgba(93,95,239,0.15); border-color: #5D5FEF; }
        .btn-brand { background: #5D5FEF; color: white; transition: all 0.3s; }
        .btn-brand:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(93,95,239,0.3); }
        .reveal { opacity: 0; transform: translateY(15px); transition: all 0.8s ease-out; }
        .reveal.active { opacity: 1; transform: translateY(0); }
    </style>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-67N1NCPZGK"><\/script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-67N1NCPZGK');
  <\/script>
</head>
<body class="antialiased">
    <div class="mesh-gradient"></div>
    <nav class="sticky-nav">
        <div class="nav-container">
            <a href="/-emily-lu-website-g/" class="nav-logo">Emily's LAB<span>.</span></a>
            <div class="nav-links">
                <a href="/-emily-lu-website-g/about/">關於我</a>
                <a href="/-emily-lu-website-g/blog/">文章分享</a>
                <a href="mailto:emily50431@gmail.com" target="_blank" class="nav-cta">聯絡交流</a>
            </div>
            <button class="nav-burger" id="navBurger" aria-label="開啟選單">
                <span></span><span></span><span></span>
            </button>
        </div>
        <div class="nav-mobile" id="navMobile">
            <a href="/-emily-lu-website-g/about/">關於我</a>
            <a href="/-emily-lu-website-g/blog/">文章分享</a>
            <a href="mailto:emily50431@gmail.com" target="_blank" class="nav-cta">聯絡交流</a>
        </div>
    </nav>
    <main class="max-w-5xl mx-auto px-8 pt-20 pb-32">
        <div class="flex flex-col lg:flex-row items-center gap-16 mb-40">
            <div class="lg:w-3/5 reveal active">
                <div class="hero-tag">
                  <span class="hero-dot"></span>
                  Solution Planner · Writer · Creator
                </div>
                <h1 class="text-5xl lg:text-7xl font-black mb-6 leading-[1.15] tracking-tight text-slate-800">
                    用人生實作<br><span class="text-[#5D5FEF]">創造影響力.</span>
                </h1>
                <p class="text-base text-slate-400 max-w-md mb-10 leading-relaxed">
                    Hello 我是 Emily，擁有5年B2B資訊軟體解決方案規劃經歷，喜歡跟人互動聊聊天，希望創造一個生活練習與分享的園區。
                </p>
                <div class="flex gap-4">
                    <a href="/-emily-lu-website-g/blog/" class="btn-brand px-10 py-3.5 rounded-xl font-bold text-sm">查看分享</a>
                    <a href="/-emily-lu-website-g/about/" class="px-10 py-3.5 border border-slate-200 rounded-xl font-bold text-sm bg-white/40 hover:bg-white transition text-slate-500 shadow-sm">關於我</a>
                </div>
            </div>
            <div class="lg:w-2/5 reveal active" style="transition-delay: 0.3s;">
                <div class="photo-base">
                   <div class="photo-card">
                        <img src="/-emily-lu-website-g/profile.jpg" alt="Emily Lu">
                    </div>
                </div>
            </div>
        </div>
        <section id="work" class="grid grid-cols-1 md:grid-cols-3 gap-8 reveal">
            ${cards}
        </section>
    </main>
    <footer class="py-20 text-center border-t border-slate-100 bg-white/20">
        <p class="text-[12px] font-black tracking-[0.3em] text-slate-300 uppercase">
            © 2026 EMILY LU — 保持學習、保持快樂
        </p>
    </footer>
    <script>
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
        }, { threshold: 0.1 });
        document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

        // 漢堡選單
        (function(){
          var btn = document.getElementById('navBurger');
          var menu = document.getElementById('navMobile');
          if(btn && menu){
            btn.addEventListener('click', function(){
              btn.classList.toggle('open');
              menu.classList.toggle('open');
            });
          }
        })();
    <\/script>
</body>
</html>`;
}

function generateAboutHtml() {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>關於我 | Emily's LAB</title>
  <!-- SEO -->
  <meta name="description" content="Hi，我是 Emily！Solution Planner、Writer、Creator，喜歡跟人互動，希望創造一個生活練習與分享的園區。" />
  <!-- Open Graph -->
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="關於我 | Emily's LAB" />
  <meta property="og:description" content="Hi，我是 Emily！Solution Planner、Writer、Creator，喜歡跟人互動，希望創造一個生活練習與分享的園區。" />
  <meta property="og:image" content="${BASE_URL}/og-image.png" />
  <meta property="og:url" content="${BASE_URL}/about/" />
  <meta property="og:site_name" content="Emily's LAB" />
  <meta property="og:locale" content="zh_TW" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="關於我 | Emily's LAB" />
  <meta name="twitter:description" content="Hi，我是 Emily！Solution Planner、Writer、Creator。" />
  <meta name="twitter:image" content="${BASE_URL}/og-image.png" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/-emily-lu-website-g/assets/style.css" />
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-67N1NCPZGK"><\/script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-67N1NCPZGK');
  <\/script>
  <style>
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes glowPulse { 0%,100%{box-shadow:0 0 10px rgba(93,95,239,0.25),0 0 0 1px rgba(93,95,239,0.15)}50%{box-shadow:0 0 24px rgba(93,95,239,0.5),0 0 0 1px rgba(93,95,239,0.4)} }
    @keyframes photoGlow { 0%,100%{box-shadow:0 0 15px 2px rgba(93,95,239,0.2);}50%{box-shadow:0 0 25px 5px rgba(93,95,239,0.4);} }
    @keyframes gradientFlow1 { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    @keyframes gradientFlow2 { 0%{background-position:100% 50%} 50%{background-position:0% 50%} 100%{background-position:100% 50%} }
    @keyframes gradientFlow3 { 0%{background-position:0% 0%} 50%{background-position:100% 100%} 100%{background-position:0% 0%} }
    body { font-family: 'Noto Sans TC', sans-serif; background: #FDFDFF; color: #1d1d1f; overflow-x: hidden; }
    .mesh-gradient { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background: radial-gradient(circle at 15% 50%, rgba(93,95,239,0.1) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(93,95,239,0.05) 0%, transparent 50%); background-color: #FDFDFF; }
    /* ── About Nav ── */
    .sticky-nav { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.7); backdrop-filter: blur(25px); border-bottom: 1px solid rgba(0,0,0,0.03); }
    .nav-container { max-width: 1100px; margin: 0 auto; padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .nav-logo { font-size: 1.2rem; font-weight: 900; letter-spacing: -0.04em; text-decoration: none; color: #1F2937; flex-shrink: 0; }
    .nav-logo span { color: #5D5FEF; }
    .nav-links { display: flex; align-items: center; gap: 2.5rem; font-size: 13px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #94A3B8; }
    .nav-links a { text-decoration: none; color: inherit; transition: color 0.2s; }
    .nav-links a:hover { color: #5D5FEF; }
    .nav-cta { background: #5D5FEF; color: white !important; padding: 0.5rem 1.5rem; border-radius: 9999px; font-weight: 700; white-space: nowrap; }
    .nav-cta:hover { opacity: 0.88; }
    .nav-burger { display: none; flex-direction: column; justify-content: center; align-items: center; gap: 5px; width: 36px; height: 36px; background: none; border: none; cursor: pointer; padding: 4px; flex-shrink: 0; }
    .nav-burger span { display: block; width: 22px; height: 2px; background: #1F2937; border-radius: 2px; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); transform-origin: center; }
    .nav-burger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .nav-burger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .nav-burger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
    .nav-mobile { display: none; flex-direction: column; background: rgba(255,255,255,0.97); backdrop-filter: blur(25px); padding: 1rem 2rem 1.5rem; border-top: 1px solid rgba(93,95,239,0.08); gap: 0.25rem; }
    .nav-mobile.open { display: flex; }
    .nav-mobile a { font-size: 14px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #64748B; text-decoration: none; padding: 0.75rem 0.5rem; border-bottom: 1px solid rgba(0,0,0,0.04); transition: color 0.2s; }
    .nav-mobile a:last-child { border-bottom: none; }
    .nav-mobile a:hover { color: #5D5FEF; }
    .nav-mobile .nav-cta { margin-top: 0.75rem; text-align: center; padding: 0.75rem 1.5rem; border-radius: 12px; border-bottom: none !important; }
    @media (max-width: 640px) {
      .nav-links { display: none; }
      .nav-burger { display: flex; }
      .nav-container { padding: 1rem 1.25rem; }
    }
    /* ── About 內容 ── */
    .about-main { max-width: 760px; margin: 0 auto; padding: 3rem 2rem 6rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .win { background: white; border-radius: 16px; overflow: hidden; opacity: 0; }
    .w1 { animation: fadeUp 0.6s 0.1s forwards, glowPulse 4s 0.7s ease-in-out infinite; }
    .w2 { animation: fadeUp 0.6s 0.25s forwards, glowPulse 4s 0.85s ease-in-out infinite; }
    .w3 { animation: fadeUp 0.6s 0.4s forwards, glowPulse 4s 1s ease-in-out infinite; }
    .win-bar { padding: 0.65rem 1rem; display: flex; align-items: center; gap: 0.5rem; background-size: 300% 300%; }
    .win-bar.v1 { background-image: linear-gradient(120deg, #5D5FEF, #6366f1, #5D5FEF, #4f46e5); animation: gradientFlow1 15s ease infinite; }
    .win-bar.v2 { background-image: linear-gradient(120deg, #4C1D95, #5b21b6, #4C1D95, #3b0764); animation: gradientFlow2 15s ease infinite; }
    .win-bar.v3 { background-image: linear-gradient(120deg, #7C3AED, #8b5cf6, #7C3AED, #6D28D9); animation: gradientFlow3 15s ease infinite; }
    .win-dots { display: flex; gap: 5px; }
    .win-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.35); }
    .win-dot.g { background: rgba(255,255,255,0.85); }
    .win-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.9); letter-spacing: 0.12em; text-transform: uppercase; margin-left: 0.5rem; }
    .photo-body { display: flex; align-items: center; gap: 2rem; padding: 1.75rem 2rem; }
    .photo-frame { width: 120px; height: 120px; border-radius: 50%; overflow: hidden; border: 2.5px solid rgba(93,95,239,0.4); flex-shrink: 0; animation: photoGlow 4s ease-in-out infinite; }
    .photo-frame img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; }
    .photo-info h2 { font-size: 24px; font-weight: 900; color: #1d1d1f; letter-spacing: -0.02em; margin-bottom: 4px; }
    .photo-info .role { font-size: 12px; font-weight: 700; color: #5D5FEF; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; }
    .photo-info p { font-size: 15px; color: #374151; line-height: 1.6; font-weight: 400; }
    .facts-body { padding: 0.75rem 1rem; }
    .fact { display: flex; align-items: center; gap: 1.25rem; padding: 0.875rem 1rem; border-radius: 10px; margin-bottom: 0.4rem; cursor: default; transition: all 0.3s; border: 1px solid transparent; }
    .fact:last-child { margin-bottom: 0; }
    .fact:hover { background: #EEEDFE; border-color: rgba(93,95,239,0.3); box-shadow: 0 0 12px rgba(93,95,239,0.2), inset 0 0 12px rgba(93,95,239,0.05); transform: translateY(-2px); }
    .fact-num { font-size: 12px; font-weight: 900; color: #5D5FEF; width: 30px; height: 30px; border-radius: 50%; background: rgba(93,95,239,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.3s; }
    .fact:hover .fact-num { background: #5D5FEF; color: white; box-shadow: 0 0 10px rgba(93,95,239,0.5); }
    .fact-text { font-size: 15px; color: #1d1d1f; line-height: 1.5; transition: color 0.3s; }
    .fact:hover .fact-text { color: #5D5FEF; }
    .tags-body { padding: 1.25rem 2rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .about-tag { font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; background: #EEEDFE; color: #3C3489; letter-spacing: 0.04em; transition: all 0.2s; cursor: default; }
    .about-tag:hover { background: #5D5FEF; color: white; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(93,95,239,0.3); }
    @media (max-width: 600px) {
      .photo-body { flex-direction: column; text-align: center; }
      .about-main { padding: 2rem 1rem 4rem; }
    }
  </style>
</head>
<body class="antialiased">
  <div class="mesh-gradient"></div>
  <nav class="sticky-nav">
    <div class="nav-container">
      <a href="/-emily-lu-website-g/" class="nav-logo">Emily's LAB<span>.</span></a>
      <div class="nav-links">
        <a href="/-emily-lu-website-g/about/">關於我</a>
        <a href="/-emily-lu-website-g/blog/">文章分享</a>
        <a href="mailto:emily50431@gmail.com" target="_blank" class="nav-cta">聯絡交流</a>
      </div>
      <button class="nav-burger" id="navBurger" aria-label="開啟選單">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="nav-mobile" id="navMobile">
      <a href="/-emily-lu-website-g/about/">關於我</a>
      <a href="/-emily-lu-website-g/blog/">文章分享</a>
      <a href="mailto:emily50431@gmail.com" target="_blank" class="nav-cta">聯絡交流</a>
    </div>
  </nav>
  <script>
    (function(){
      var btn = document.getElementById('navBurger');
      var menu = document.getElementById('navMobile');
      if(btn && menu){
        btn.addEventListener('click', function(){
          btn.classList.toggle('open');
          menu.classList.toggle('open');
        });
      }
    })();
  <\/script>
  <main class="about-main">
    <div class="win w1">
      <div class="win-bar v1">
        <div class="win-dots"><div class="win-dot"></div><div class="win-dot"></div><div class="win-dot g"></div></div>
        <div class="win-title">Emily — About me</div>
      </div>
      <div class="photo-body">
        <div class="photo-frame">
          <img src="/-emily-lu-website-g/about-photo.jpg" alt="Emily" />
        </div>
        <div class="photo-info">
          <h2>Emily</h2>
          <div class="role">Hi there, nice to meet you</div>
          <p>生活目標是當一個快樂又充滿活力<br>努力讓日常充滿儀式感的女子</p>
        </div>
      </div>
    </div>
    <div class="win w2">
      <div class="win-bar v2">
        <div class="win-dots"><div class="win-dot"></div><div class="win-dot"></div><div class="win-dot g"></div></div>
        <div class="win-title">關於我的 9 件事</div>
      </div>
      <div class="facts-body">
        <div class="fact"><div class="fact-num">01</div><div class="fact-text">是一介即將邁入30歲的巨蟹座女子，坐標臺灣北部人</div></div>
        <div class="fact"><div class="fact-num">02</div><div class="fact-text">MBTI 是 ESFP 表演者，對環境越自在，越可以好好表現自己</div></div>
        <div class="fact"><div class="fact-num">03</div><div class="fact-text">大學、研究所都唸測量相關，但本人不耐曬，默默選辦公室工作</div></div>
        <div class="fact"><div class="fact-num">04</div><div class="fact-text">以前是B2B Sales，現在是Presales，資訊軟體業打滾約 5 年</div></div>
        <div class="fact"><div class="fact-num">05</div><div class="fact-text">積極嘗試各種生活，近期著迷上皮克敏、壁球、看電子書</div></div>
        <div class="fact"><div class="fact-num">06</div><div class="fact-text">人生終極夢想是開一間有個性的豆花店，搭配一隻可愛的店狗</div></div>
        <div class="fact"><div class="fact-num">07</div><div class="fact-text">非常喜歡開車到處晃，覺得在車上冥想放空是一大樂事</div></div>
        <div class="fact"><div class="fact-num">08</div><div class="fact-text">對於飲食忠貞度異常高，去同間店只會點同樣的食物</div></div>
        <div class="fact"><div class="fact-num">09</div><div class="fact-text">太愛寫東西但不知道放哪，乾脆創一個園地留些數位資產</div></div>
      </div>
    </div>
    <div class="win w3">
      <div class="win-bar v3">
        <div class="win-dots"><div class="win-dot"></div><div class="win-dot"></div><div class="win-dot g"></div></div>
        <div class="win-title">關鍵字</div>
      </div>
      <div class="tags-body">
        <div class="about-tag">你好</div>
        <div class="about-tag">巨蟹座</div>
        <div class="about-tag">ESFP</div>
        <div class="about-tag">Presales</div>
        <div class="about-tag">測量系</div>
        <div class="about-tag">B2B 資訊軟體</div>
        <div class="about-tag">豆花店夢想</div>
        <div class="about-tag">喜歡跟人交流</div>
        <div class="about-tag">愛狗</div>
        <div class="about-tag">愛開車</div>
        <div class="about-tag">皮克敏</div>
        <div class="about-tag">壁球</div>
        <div class="about-tag">儀式感</div>
        <div class="about-tag">喜歡寫東寫西</div>
      </div>
    </div>
  </main>
  <footer style="padding:3rem 0;text-align:center;border-top:1px solid rgba(93,95,239,0.08);">
    <p style="font-size:12px;font-weight:900;letter-spacing:0.3em;color:#D1D5DB;text-transform:uppercase;">© 2026 EMILY LU — 保持學習、保持快樂</p>
  </footer>
</body>
</html>`;
}

async function main() {
  const posts = await fetchPosts();
  const postData = [];

  if (fs.existsSync("blog")) {
    fs.rmSync("blog", { recursive: true, force: true });
  }
  fs.mkdirSync("blog");

  if (!fs.existsSync(path.join("assets", "images"))) {
    fs.mkdirSync(path.join("assets", "images"), { recursive: true });
  }

  for (const post of posts) {
    const props = post.properties;
    const title = props.Title?.title[0]?.plain_text || "無標題";
    const slug = props.Slug?.rich_text[0]?.plain_text || post.id;
    const date = props.PublishedDate?.date?.start || "";
    const categories = props.Category?.multi_select?.map((c) => c.name) || [];
    const excerpt = props.Excerpt?.rich_text[0]?.plain_text || "";
    const downloadUrl = props.DownloadURL?.url || "";
    const downloadLabel = props.DownloadLabel?.rich_text[0]?.plain_text || "";
    let content = await getPostContent(post.id);
    content = await processImages(content, slug);
    const htmlContent = markdownToHtml(content, downloadUrl, downloadLabel);

    const postDir = path.join("blog", slug);
    if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(
      path.join(postDir, "index.html"),
      generatePostHtml(title, date, categories, htmlContent, slug, excerpt)
    );

    postData.push({ title, slug, date, categories, excerpt });
  }

  fs.writeFileSync("blog/index.html", generateBlogIndexHtml(postData));
  fs.writeFileSync("index.html", generateHomeHtml(postData));

  // 產生關於我頁面
  if (!fs.existsSync("about")) fs.mkdirSync("about");
  fs.writeFileSync("about/index.html", generateAboutHtml());

  // 產生 Sitemap
  const today = new Date().toISOString().split('T')[0];
  const sitemapUrls = [
    `  <url><loc>${BASE_URL}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>`,
    `  <url><loc>${BASE_URL}/blog/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`,
    `  <url><loc>${BASE_URL}/about/</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>`,
    ...postData.map(p => `  <url><loc>${BASE_URL}/blog/${p.slug}/</loc><lastmod>${p.date || today}</lastmod><priority>0.9</priority></url>`)
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join('\n')}
</urlset>`;
  fs.writeFileSync("sitemap.xml", sitemap);
  console.log(`完成！共產生 ${postData.length} 篇文章，sitemap.xml 已產生`);
}

main().catch(console.error);
