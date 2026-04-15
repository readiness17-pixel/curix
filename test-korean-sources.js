// 한국 소스 날짜 추출 가능성 검증
// 1) Tavily general의 raw_content에서 한국어 날짜 파싱 가능한가
// 2) 한국 매체 RSS 피드의 실제 날짜 반환율은 얼마인가
require("dotenv").config();
const axios = require("axios");
const RSSParser = require("rss-parser");

const rssParser = new RSSParser({ timeout: 10000 });

// 한국어 날짜 파서
function extractKoreanDate(text) {
  if (!text) return null;
  const head = text.slice(0, 1500);
  const patterns = [
    /(20\d{2})[.\-년]\s*(\d{1,2})[.\-월]\s*(\d{1,2})[일]?/,
    /입력\s*:?\s*(20\d{2})[.\-](\d{1,2})[.\-](\d{1,2})/,
    /등록\s*:?\s*(20\d{2})[.\-](\d{1,2})[.\-](\d{1,2})/,
    /(20\d{2})\/(\d{1,2})\/(\d{1,2})/,
  ];
  for (const p of patterns) {
    const m = head.match(p);
    if (m) {
      const y = m[1], mo = m[2].padStart(2, "0"), d = m[3].padStart(2, "0");
      const iso = `${y}-${mo}-${d}`;
      const date = new Date(iso);
      if (!isNaN(date.getTime())) return iso;
    }
  }
  return null;
}

// URL 경로에서 날짜 추출
function extractDateFromUrl(url) {
  if (!url) return null;
  const patterns = [
    /\/(20\d{2})\/(\d{1,2})\/(\d{1,2})\//,
    /\/(20\d{2})(\d{2})(\d{2})/,
    /[?&]date=(20\d{2})(\d{2})(\d{2})/,
    /[?&]aid=(20\d{2})(\d{2})(\d{2})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}

function isKoreanDomain(url) {
  try {
    const host = new URL(url).hostname;
    return /\.(kr|co\.kr)$/.test(host) ||
           /naver\.com|daum\.net|chosun|joongang|hankyung|mk\.co|etnews|zdnet\.co\.kr|bloter|byline/.test(host);
  } catch {
    return false;
  }
}

// ====================================================================
// Test 1: Tavily general의 raw_content에서 날짜 추출 가능한가
// ====================================================================
async function testTavilyRawContent() {
  console.log("\n" + "=".repeat(78));
  console.log("Test 1: Tavily general의 raw_content에서 한국어 날짜 추출");
  console.log("=".repeat(78));

  const topics = ["한국 부동산 정책", "삼성전자 반도체", "스타트업 투자"];
  const totals = { koreanResults: 0, urlDate: 0, bodyDate: 0, eitherDate: 0 };

  for (const topic of topics) {
    console.log(`\n📌 "${topic}"`);
    try {
      const response = await axios.post(
        "https://api.tavily.com/search",
        {
          api_key: process.env.TAVILY_API_KEY,
          query: topic,
          search_depth: "advanced",
          include_raw_content: true,
          max_results: 10,
        },
        { timeout: 30000 }
      );

      const koreanItems = (response.data.results || []).filter((r) => isKoreanDomain(r.url));

      koreanItems.forEach((item, i) => {
        totals.koreanResults++;
        const urlDate = extractDateFromUrl(item.url);
        const bodyDate = extractKoreanDate(item.raw_content || item.content || "");
        if (urlDate) totals.urlDate++;
        if (bodyDate) totals.bodyDate++;
        if (urlDate || bodyDate) totals.eitherDate++;
        console.log(
          `  [${i + 1}] URL날짜:${(urlDate || "-").padEnd(12)} 본문날짜:${(bodyDate || "-").padEnd(12)} | ${(item.title || "").slice(0, 40)}`
        );
        console.log(`      ${item.url.slice(0, 90)}`);
      });
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  }

  console.log("\n--- Test 1 요약 ---");
  console.log(`한국 소스 총 ${totals.koreanResults}건`);
  console.log(`  URL 패턴 날짜 추출: ${totals.urlDate}건 (${pct(totals.urlDate, totals.koreanResults)}%)`);
  console.log(`  본문 한국어 날짜 추출: ${totals.bodyDate}건 (${pct(totals.bodyDate, totals.koreanResults)}%)`);
  console.log(`  최종 날짜 확보: ${totals.eitherDate}건 (${pct(totals.eitherDate, totals.koreanResults)}%)`);
}

// ====================================================================
// Test 2: 한국 매체 RSS 피드 날짜 반환율
// ====================================================================
const KOREAN_RSS = [
  { name: "ZDNet Korea", url: "https://feeds.feedburner.com/zdkorea" },
  { name: "Bloter", url: "https://www.bloter.net/rss" },
  { name: "Byline Network", url: "https://byline.network/feed" },
  { name: "디지털데일리", url: "https://www.ddaily.co.kr/rss/rss_all.xml" },
  { name: "아이티월드", url: "https://www.itworld.co.kr/rss/feed" },
  { name: "전자신문", url: "https://rss.etnews.com/Section901.xml" },
  { name: "IT조선", url: "https://it.chosun.com/rss.xml" },
  { name: "한경IT", url: "https://www.hankyung.com/feed/it" },
  { name: "플래텀", url: "https://platum.kr/feed" },
  { name: "벤처스퀘어", url: "https://www.venturesquare.net/feed" },
];

async function testKoreanRSS() {
  console.log("\n\n" + "=".repeat(78));
  console.log("Test 2: 한국 매체 RSS 피드 날짜 반환율");
  console.log("=".repeat(78));

  const totals = { feeds: 0, ok: 0, items: 0, withDate: 0, recent7d: 0 };
  const cutoff7d = Date.now() - 7 * 86400000;

  for (const feed of KOREAN_RSS) {
    totals.feeds++;
    try {
      const parsed = await rssParser.parseURL(feed.url);
      totals.ok++;
      const items = parsed.items.slice(0, 10);
      let feedWithDate = 0, feedRecent = 0;
      items.forEach((item) => {
        totals.items++;
        const rawDate = item.isoDate || item.pubDate;
        if (rawDate) {
          totals.withDate++;
          feedWithDate++;
          const ts = new Date(rawDate).getTime();
          if (!isNaN(ts) && ts >= cutoff7d) {
            totals.recent7d++;
            feedRecent++;
          }
        }
      });
      console.log(
        `✅ ${feed.name.padEnd(20)} | ${items.length}건 중 날짜 ${feedWithDate}건 (${pct(feedWithDate, items.length)}%) | 최근7일 ${feedRecent}건`
      );
      // 샘플 1건
      const sample = items[0];
      if (sample) {
        console.log(`   예시: ${(sample.title || "").slice(0, 50)} | ${sample.isoDate || sample.pubDate || "날짜없음"}`);
      }
    } catch (e) {
      console.log(`❌ ${feed.name.padEnd(20)} | ${e.message.slice(0, 60)}`);
    }
  }

  console.log("\n--- Test 2 요약 ---");
  console.log(`피드 접근 성공: ${totals.ok}/${totals.feeds}`);
  console.log(`전체 아이템: ${totals.items}건`);
  console.log(`  날짜 있음: ${totals.withDate}건 (${pct(totals.withDate, totals.items)}%)`);
  console.log(`  최근 7일: ${totals.recent7d}건 (${pct(totals.recent7d, totals.items)}%)`);
}

function pct(a, b) {
  return b ? Math.round((a / b) * 100) : 0;
}

(async () => {
  if (!process.env.TAVILY_API_KEY) {
    console.error("TAVILY_API_KEY 필요");
    process.exit(1);
  }
  await testTavilyRawContent();
  await testKoreanRSS();
  console.log("\n" + "=".repeat(78));
  console.log("검증 완료");
  console.log("=".repeat(78));
})().catch(console.error);
