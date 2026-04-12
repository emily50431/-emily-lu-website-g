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

const NAV_HTML = `
  <style>
    .sticky-nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(25px);
      border-bottom: 1px solid rgba(0,0,0,0.03);
    }
    .nav-container { max-width: 1100px; margin: 0 auto; }
    .mesh-gradient {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: -1;
      background:
        radial-gradient(circle at 15% 50%, rgba(93, 95, 239, 0.1) 0%, transparent 40%),
        radial-gradient(circle at 80% 80%, rgba(93, 95, 239, 0.05) 0%, transparent 50%);
      background-color: #FDFDFF;
    }
  </style>
  <div class="mesh-gradient"></div>
  <nav class="sticky-nav">
    <div class="nav-container px-8 py-5 flex justify-between items-center">
      <div class="text-xl font-black tracking-tighter">
        <a href="/-emily-lu-website-g/" style="text-decoration:none;color:#1F2937;">
          Emily's LAB<span style="color:#5D5FEF;">.</span>
        </a>
      </div>
      <div class="flex items-center space-x-10 text-[13px] font-bold tracking-[0.15em] text-slate-400 uppercase">
        <a href="/-emily-lu-website-g/about/" class="hover:text-[#5D5FEF] transition-colors">關於我</a>
        <a href="/-emily-lu-website-g/blog/" class="hover:text-[#5D5FEF] transition-colors">文章分享</a>
        <a href="mailto:emily50431@gmail.com" target="_blank" style="background:#5D5FEF;color:white;padding:0.5rem 1.5rem;border-radius:9999px;font-weight:700;text-decoration:none;">聯絡交流</a>
      </div>
    </div>
  </nav>`;

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
  return `<div class="download-section"><a href="${downloadUrl}" target="_blank" class="download-block" onclick="${trackScript.replace(/"/g, '&quot;')}"><div class="dl-pulse"></div><div class="dl-arrow">前往下載 →</div><div class="dl-icon-wrap"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5D5FEF" stroke-width="2" stroke-linecap="round"><path d="M12 3v13M6 11l6 6 6-6"/><path d="M3 21h18"/></svg></div><div class="dl-title">${label}</div></a></div>`;
}

function markdownToHtml(md, downloadUrl = "", downloadLabel = "") {
  return md
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
}

function generatePostHtml(title, date, categories, content) {
  const categoryTags = categories
    .map((c) => `<span class="post-tag">${c}</span>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Emily's LAB</title>
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
    <div class="post-content">${content}</div>
  </main>
  <footer style="padding:5rem 0;text-align:center;border-top:1px solid rgba(93,95,239,0.08);">
    <p style="font-size:12px;font-weight:900;letter-spacing:0.3em;color:#D1D5DB;text-transform:uppercase;">© 2026 EMILY LU — 保持學習、保持快樂</p>
  </footer>
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
        .sticky-nav {
            position: sticky; top: 0; z-index: 100;
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(25px);
            border-bottom: 1px solid rgba(0,0,0,0.03);
        }
        .nav-container { max-width: 1100px; margin: 0 auto; }
        .photo-base {
            background: rgba(243, 244, 246, 0.6);
            border-radius: 3.5rem;
            padding: 2.5rem;
            width: 100%;
            max-width: 320px;
            margin-left: auto;
        }
        .photo-card {
            background: #ffffff;
            border-radius: 2.5rem;
            width: 100%;
            aspect-ratio: 4/5;
            display: flex;
            align-items: center; justify-content: center;
            overflow: hidden;
            border: 1.5px solid rgba(93, 95, 239, 0.3);
            animation: glowPulse 4s ease-in-out infinite;
            transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
            position: relative;
            z-index: 1;
        }
        .photo-card:hover {
            transform: translateY(-10px) scale(1.01);
            border-color: rgba(93, 95, 239, 0.6);
            box-shadow:
                0 0 15px 4px rgba(93, 95, 239, 0.4),
                0 0 30px 10px rgba(93, 95, 239, 0.15),
                0 15px 30px rgba(0, 0, 0, 0.08);
            animation: none;
        }
        .photo-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center 10%;
            transform: scale(1.3);
            pointer-events: none;
        }
        .spec-item {
            background: #ffffff;
            border-radius: 2rem;
            transition: all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
            border: 1px solid rgba(0,0,0,0.03);
        }
        .spec-item:hover {
            transform: translateY(-15px);
            box-shadow: 0 40px 80px -15px rgba(93, 95, 239, 0.15);
            border-color: #5D5FEF;
        }
        .btn-brand {
            background: #5D5FEF;
            color: white; transition: all 0.3s;
        }
        .btn-brand:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(93, 95, 239, 0.3); }
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
        <div class="nav-container px-8 py-5 flex justify-between items-center">
            <div class="text-xl font-black tracking-tighter">Emily's LAB<span class="text-[#5D5FEF]">.</span></div>
            <div class="flex items-center space-x-10 text-[13px] font-bold tracking-[0.15em] text-slate-400 uppercase">
                <a href="/-emily-lu-website-g/about/" class="hover:text-[#5D5FEF] transition-colors">關於我</a>
                <a href="/-emily-lu-website-g/blog/" class="hover:text-[#5D5FEF] transition-colors">文章分享</a>
                <a href="mailto:emily50431@gmail.com" class="btn-brand px-6 py-2 rounded-full text-white font-bold">聯絡交流</a>
            </div>
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
  <style>
    .sticky-nav { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.7); backdrop-filter: blur(25px); border-bottom: 1px solid rgba(0,0,0,0.03); }
    .nav-container { max-width: 1100px; margin: 0 auto; }
  </style>
  <nav class="sticky-nav">
    <div class="nav-container px-8 py-5 flex justify-between items-center">
      <div class="text-xl font-black tracking-tighter">
        <a href="/-emily-lu-website-g/" style="text-decoration:none;color:#1F2937;">
          Emily's LAB<span style="color:#5D5FEF;">.</span>
        </a>
      </div>
      <div class="flex items-center space-x-10 text-[13px] font-bold tracking-[0.15em] text-slate-400 uppercase">
        <a href="/-emily-lu-website-g/about/" class="hover:text-[#5D5FEF] transition-colors">關於我</a>
        <a href="/-emily-lu-website-g/blog/" class="hover:text-[#5D5FEF] transition-colors">文章分享</a>
        <a href="mailto:emily50431@gmail.com" target="_blank" style="background:#5D5FEF;color:white;padding:0.5rem 1.5rem;border-radius:9999px;font-weight:700;text-decoration:none;">聯絡交流</a>
      </div>
    </div>
  </nav>
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
        <div class="fact"><div class="fact-num">02</div><div class="fact-text">MBTI 是 ESFP 表演者，對環境自在可以越表現自己</div></div>
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
        <div class="about-tag">紐西蘭</div>
        <div class="about-tag">愛狗</div>
        <div class="about-tag">愛開車</div>
        <div class="about-tag">皮克敏</div>
        <div class="about-tag">壁球</div>
        <div class="about-tag">電子書</div>
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
      generatePostHtml(title, date, categories, htmlContent)
    );

    postData.push({ title, slug, date, categories, excerpt });
  }

  fs.writeFileSync("blog/index.html", generateBlogIndexHtml(postData));
  fs.writeFileSync("index.html", generateHomeHtml(postData));

  // 產生關於我頁面
  if (!fs.existsSync("about")) fs.mkdirSync("about");
  fs.writeFileSync("about/index.html", generateAboutHtml());

  console.log(`完成！共產生 ${postData.length} 篇文章`);
}

main().catch(console.error);
