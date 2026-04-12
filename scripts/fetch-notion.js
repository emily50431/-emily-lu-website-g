const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

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
      <div class="flex items-center space-x-10 text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">
        <a href="#" class="hover:text-[#5D5FEF] transition-colors">關於我</a>
        <a href="/-emily-lu-website-g/blog/" class="hover:text-[#5D5FEF] transition-colors">文章分享</a>
        <a href="#" style="background:#5D5FEF;color:white;padding:0.5rem 1.5rem;border-radius:9999px;font-weight:700;text-decoration:none;">聯絡交流</a>
      </div>
    </div>
  </nav>`;

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
    return mdString?.parent || mdString || "";
  } catch (e) {
    return "";
  }
}

function markdownToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
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
</head>
<body class="antialiased">
  ${NAV_HTML}
  <main class="blog-wrap">
    <h1 class="section-title">所有文章</h1>
    <div class="post-list">${items}</div>
  </main>
</body>
</html>`;
}

function generateHomeCards(posts) {
  const top3 = posts.slice(0, 3);
  return top3.map((p, i) => {
    const category = p.categories[0] || "文章";
    return `
      <div class="spec-item p-10 reveal" style="transition-delay: ${i * 0.15}s;">
        <div class="mb-8 flex items-center justify-between">
          <span class="text-[9px] font-black tracking-widest text-[#5D5FEF] bg-indigo-50/50 px-3 py-1 rounded-full uppercase">${category}</span>
          <div class="text-[10px] font-black text-slate-200 uppercase">0${i + 1} /</div>
        </div>
        <h3 class="text-2xl font-black tracking-tight mb-4 leading-tight">${p.title}</h3>
        <p class="text-slate-400 text-[13px] leading-relaxed mb-10">${p.excerpt}</p>
        <a href="${BASE_URL}/blog/${p.slug}/" class="text-[10px] font-black text-[#5D5FEF] uppercase tracking-widest" style="text-decoration:none;">Read More →</a>
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
        .hero-tag { display:inline-flex; align-items:center; gap:6px; font-size:9px; font-weight:900; letter-spacing:.15em; text-transform:uppercase; color:#5D5FEF; background:rgba(93,95,239,0.08); border:1px solid rgba(93,95,239,0.15); padding:5px 12px; border-radius:20px; margin-bottom:1.5rem; animation:tagSlide .5s .3s both; }
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
</head>
<body class="antialiased">
    <div class="mesh-gradient"></div>
    <nav class="sticky-nav">
        <div class="nav-container px-8 py-5 flex justify-between items-center">
            <div class="text-xl font-black tracking-tighter">Emily's LAB<span class="text-[#5D5FEF]">.</span></div>
            <div class="flex items-center space-x-10 text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">
                <a href="#" class="hover:text-[#5D5FEF] transition-colors">關於我</a>
                <a href="/-emily-lu-website-g/blog/" class="hover:text-[#5D5FEF] transition-colors">文章分享</a>
                <a href="#" class="btn-brand px-6 py-2 rounded-full text-white font-bold">聯絡交流</a>
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
                    Hello 我是 Emily，擁有5年B2B資訊軟體解決方案規劃經歷，喜歡有溫度的交流與思考，希望創造一個生活練習與分享的園區。
                </p>
                <div class="flex gap-4">
                    <a href="/-emily-lu-website-g/blog/" class="btn-brand px-10 py-3.5 rounded-xl font-bold text-sm">查看分享</a>
                    <a href="#" class="px-10 py-3.5 border border-slate-200 rounded-xl font-bold text-sm bg-white/40 hover:bg-white transition text-slate-500 shadow-sm">關於我</a>
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
        <p class="text-[9px] font-black tracking-[0.4em] text-slate-300 uppercase">
            © 2026 EMILY LU — 保持快樂、保持思考
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

async function main() {
  const posts = await fetchPosts();
  const postData = [];

  if (!fs.existsSync("blog")) fs.mkdirSync("blog");

  for (const post of posts) {
    const props = post.properties;
    const title = props.Title?.title[0]?.plain_text || "無標題";
    const slug = props.Slug?.rich_text[0]?.plain_text || post.id;
    const date = props.PublishedDate?.date?.start || "";
    const categories = props.Category?.multi_select?.map((c) => c.name) || [];
    const excerpt = props.Excerpt?.rich_text[0]?.plain_text || "";
    const content = await getPostContent(post.id);
    const htmlContent = markdownToHtml(content);

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
  console.log(`完成！共產生 ${postData.length} 篇文章`);
}

main().catch(console.error);
