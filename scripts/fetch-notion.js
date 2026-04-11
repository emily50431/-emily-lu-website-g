const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const BASE_URL = "https://emily50431.github.io/-emily-lu-website-g";

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
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, (line) =>
      line.startsWith("<") ? line : `<p>${line}</p>`
    );
}

function generatePostHtml(title, date, category, content) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Emily's LAB</title>
  <link rel="stylesheet" href="/-emily-lu-website-g/assets/style.css" />
</head>
<body>
  <nav class="nav">
    <a class="nav-logo" href="/-emily-lu-website-g/">Emily's <span>LAB</span></a>
    <div class="nav-links">
      <a href="/-emily-lu-website-g/">首頁</a>
      <a href="/-emily-lu-website-g/blog/">文章</a>
    </div>
  </nav>
  <main class="post-wrap">
    <div class="post-meta">
      <span class="post-tag">${category}</span>
      <span class="post-date">${date}</span>
    </div>
    <h1 class="post-title">${title}</h1>
    <div class="post-content">${content}</div>
  </main>
</body>
</html>`;
}

function generateBlogIndexHtml(posts) {
  const cards = posts
    .map(
      (p) => `
    <a class="post-card" href="${BASE_URL}/blog/${p.slug}/">
      <div class="post-card-meta">
        <span class="post-card-tag">${p.category}</span>
        <span class="post-card-date">${p.date}</span>
      </div>
      <div class="post-card-title">${p.title}</div>
      <div class="post-card-excerpt">${p.excerpt}</div>
    </a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>文章 | Emily's LAB</title>
  <link rel="stylesheet" href="/-emily-lu-website-g/assets/style.css" />
</head>
<body>
  <nav class="nav">
    <a class="nav-logo" href="/-emily-lu-website-g/">Emily's <span>LAB</span></a>
    <div class="nav-links">
      <a href="/-emily-lu-website-g/">首頁</a>
      <a href="/-emily-lu-website-g/blog/">文章</a>
    </div>
  </nav>
  <main class="blog-wrap">
    <h1 class="section-title">所有文章</h1>
    <div class="posts-grid">${cards}</div>
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
    const category = props.Category?.select?.name || "";
    const excerpt = props.Excerpt?.rich_text[0]?.plain_text || "";
    const content = await getPostContent(post.id);
    const htmlContent = markdownToHtml(content);

    const postDir = path.join("blog", slug);
    if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(
      path.join(postDir, "index.html"),
      generatePostHtml(title, date, category, htmlContent)
    );

    postData.push({ title, slug, date, category, excerpt });
  }

  fs.writeFileSync("blog/index.html", generateBlogIndexHtml(postData));
  console.log(`完成！共產生 ${postData.length} 篇文章`);
}

main().catch(console.error);
