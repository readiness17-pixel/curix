const { collectContents } = require("./collector");

async function main() {
  const topic = "AI 규제 동향";
  const results = await collectContents(topic);

  console.log("=".repeat(60));
  console.log(`📋 "${topic}" 수집 결과: 총 ${results.length}건`);
  console.log("=".repeat(60));

  results.forEach((item, index) => {
    console.log(`\n--- [${index + 1}] ${item.source_type.toUpperCase()} ---`);
    console.log(`제목: ${item.title}`);
    console.log(`출처: ${item.source}`);
    console.log(`URL: ${item.url}`);
    console.log(`발행일: ${item.published_at || "알 수 없음"}`);
    console.log(`본문 미리보기: ${item.content.slice(0, 100)}...`);
  });
}

main().catch(console.error);
