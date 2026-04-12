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
        <a href="/-emily-lu-website-g/" class="hover:text-[#5D5FEF] transition-colors">首頁</a>
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
  const mdBlocks = await n2m.pageToMarkdown(pageId);
  return n2m.toMarkdownString(mdBlocks).parent;
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
  <script src="https://cdn.tailwindcss.com"></script>
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
  <script src="https://cdn.tailwindcss.com"></script>
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
  console.log(`完成！共產生 ${postData.length} 篇文章`);
}

main().catch(console.error);
