// Google News RSS 검증 스크립트
// 확인 항목:
//  1. 한국어 쿼리로 한국 매체 결과가 돌아오는가
//  2. pubDate 반환율
//  3. 결과 개수
//  4. 최신성 분포 (몇 일 이내?)
//  5. 출처 다양성 (몇 개 매체?)
//  6. 영어 쿼리 비교
require("dotenv").config();
const RSSParser = require("rss-parser");

const rssParser = new RSSParser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; CURIX/1.0)" },
});

const TEST_CASES = [
  { query: "AI 규제", hl: "ko", gl: "KR", ceid: "KR:ko", label: "AI 규제 (한국어)" },
  { query: "한국 부동산 정책", hl: "ko", gl: "KR", ceid: "KR:ko", label: "한국 부동산 (한국어)" },
  { query: "삼성전자 반도체", hl: "ko", gl: "KR", ceid: "KR:ko", label: "삼성 반도체 (한국어)" },
  { query: "스타트업 투자", hl: "ko", gl: "KR", ceid: "KR:ko", label: "스타트업 (한국어)" },
  { query: "디자인 시스템", hl: "ko", gl: "KR", ceid: "KR:ko", label: "디자인 시스템 (한국어)" },
  { query: "개발자 커리어", hl: "ko", gl: "KR", ceid: "KR:ko", label: "개발자 커리어 (한국어)" },
  { query: "AI regulation", hl: "en", gl: "US", ceid: "US:en", label: "AI regulation (영어)" },
  { query: "startup funding", hl: "en", gl: "US", ceid: "US:en", label: "startup funding (영어)" },
];

function buildUrl({ query, hl, gl, ceid }) {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

function bucketize(days) {
  if (days === null) return "none";
  if (days <= 1) return "1d";
  if (days <= 7) return "7d";
  if (days <= 30) return "30d";
  return "old";
}

async function testOne(testCase) {
  const url = buildUrl(testCase);
  console.log("\n" + "─".repeat(78));
  console.log(`📌 ${testCase.label}`);
  console.log(`   URL: ${url.slice(0, 100)}`);

  try {
    const parsed = await rssParser.parseURL(url);
    const items = parsed.items || [];

    if (items.length === 0) {
      console.log("   ⚠️  결과 0건");
      return null;
    }

    // 날짜 분석
    const buckets = { "1d": 0, "7d": 0, "30d": 0, old: 0, none: 0 };
    const sources = new Set();
    const daysList = [];
    let withDate = 0;

    items.forEach((item) => {
      const days = daysSince(item.isoDate || item.pubDate);
      buckets[bucketize(days)]++;
      if (days !== null) {
        withDate++;
        daysList.push(days);
      }
      // Google News는 source가 item.source 또는 title 끝에 "- 매체명" 형태로 붙음
      const src = item.source?.["#"] || item.creator || extractSourceFromTitle(item.title);
      if (src) sources.add(src);
    });

    const avgDays = daysList.length
      ? (daysList.reduce((a, b) => a + b, 0) / daysList.length).toFixed(1)
      : "-";
    const medianDays = daysList.length
      ? daysList.sort((a, b) => a - b)[Math.floor(daysList.length / 2)]
      : "-";

    console.log(`   총 ${items.length}건 | 날짜있음 ${withDate}건 (${Math.round((withDate / items.length) * 100)}%)`);
    console.log(`   분포: 1일내 ${buckets["1d"]} | 7일내 ${buckets["7d"]} | 30일내 ${buckets["30d"]} | 오래됨 ${buckets.old} | 없음 ${buckets.none}`);
    console.log(`   평균 ${avgDays}일 전, 중위값 ${medianDays}일 전`);
    console.log(`   출처 다양성: ${sources.size}개 매체`);

    // 샘플 3건
    console.log(`   샘플:`);
    items.slice(0, 3).forEach((item, i) => {
      const days = daysSince(item.isoDate || item.pubDate);
      const src = extractSourceFromTitle(item.title) || "?";
      console.log(`     [${i + 1}] (${days !== null ? days + "일 전" : "?"}) ${(item.title || "").slice(0, 55)}`);
      console.log(`         매체: ${src}`);
    });

    // 출처 상위 5개
    const sourceList = Array.from(sources).slice(0, 8);
    console.log(`   주요 매체: ${sourceList.join(", ")}`);

    return { items, withDate, sources: sources.size, buckets };
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
    return null;
  }
}

// Google News는 제목 끝에 "- 매체명" 형식으로 매체가 붙음
function extractSourceFromTitle(title) {
  if (!title) return null;
  const match = title.match(/\s-\s([^-]+)$/);
  return match ? match[1].trim() : null;
}

async function main() {
  console.log("=".repeat(78));
  console.log("Google News RSS 검증");
  console.log("=".repeat(78));

  const summary = [];
  for (const tc of TEST_CASES) {
    const result = await testOne(tc);
    if (result) {
      summary.push({
        label: tc.label,
        count: result.items.length,
        freshPct: Math.round(((result.buckets["1d"] + result.buckets["7d"]) / result.items.length) * 100),
        sources: result.sources,
      });
    }
    await new Promise((r) => setTimeout(r, 500)); // rate limit 예의
  }

  console.log("\n\n" + "=".repeat(78));
  console.log("전체 요약");
  console.log("=".repeat(78));
  console.log("토픽                          | 건수 | 7일내% | 매체수");
  console.log("-".repeat(78));
  summary.forEach((s) => {
    console.log(
      `${s.label.padEnd(30)} | ${String(s.count).padStart(4)} | ${String(s.freshPct).padStart(5)}% | ${String(s.sources).padStart(5)}`
    );
  });
}

main().catch(console.error);
