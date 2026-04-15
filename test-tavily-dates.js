// Tavily 한국어 소스 날짜 반환율 검증 스크립트
require("dotenv").config();
const axios = require("axios");

const TEST_TOPICS = [
  { topic: "AI 규제 동향", lang: "ko" },
  { topic: "한국 부동산 정책", lang: "ko" },
  { topic: "삼성전자 반도체", lang: "ko" },
  { topic: "스타트업 투자", lang: "ko" },
  { topic: "AI regulation trends", lang: "en" },
  { topic: "startup funding", lang: "en" },
];

const MODES = [
  { name: "general", params: {} },
  { name: "news+7d", params: { topic: "news", days: 7 } },
  { name: "news+30d", params: { topic: "news", days: 30 } },
];

function isKoreanDomain(url) {
  try {
    const host = new URL(url).hostname;
    return /\.(kr|co\.kr)$/.test(host) ||
           /naver\.com|daum\.net|chosun|joongang|hankyung|mk\.co|etnews|zdnet\.co\.kr|bloter|byline/.test(host);
  } catch {
    return false;
  }
}

async function tavilyCall(query, extraParams) {
  const response = await axios.post(
    "https://api.tavily.com/search",
    {
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: 10,
      ...extraParams,
    },
    { timeout: 20000 }
  );
  return response.data.results || [];
}

async function analyze(topic, mode) {
  try {
    const results = await tavilyCall(topic, mode.params);
    const total = results.length;
    const withDate = results.filter((r) => r.published_date).length;
    const koreanResults = results.filter((r) => isKoreanDomain(r.url));
    const koreanTotal = koreanResults.length;
    const koreanWithDate = koreanResults.filter((r) => r.published_date).length;

    return {
      total,
      withDate,
      datePct: total ? Math.round((withDate / total) * 100) : 0,
      koreanTotal,
      koreanWithDate,
      koreanDatePct: koreanTotal ? Math.round((koreanWithDate / koreanTotal) * 100) : 0,
      samples: results.slice(0, 3).map((r) => ({
        title: (r.title || "").slice(0, 40),
        url: r.url,
        published_date: r.published_date || null,
        isKorean: isKoreanDomain(r.url),
      })),
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  if (!process.env.TAVILY_API_KEY) {
    console.error("TAVILY_API_KEY가 .env에 없습니다.");
    process.exit(1);
  }

  console.log("=".repeat(78));
  console.log("Tavily 한국어 소스 날짜 반환율 검증");
  console.log("=".repeat(78));

  for (const { topic, lang } of TEST_TOPICS) {
    console.log(`\n\n📌 토픽: "${topic}" (${lang})`);
    console.log("-".repeat(78));
    for (const mode of MODES) {
      const r = await analyze(topic, mode);
      if (r.error) {
        console.log(`  [${mode.name.padEnd(10)}] ❌ ${r.error}`);
        continue;
      }
      console.log(
        `  [${mode.name.padEnd(10)}] 전체 ${r.total}건 중 날짜있음 ${r.withDate}건 (${r.datePct}%) | 한국소스 ${r.koreanTotal}건 중 날짜있음 ${r.koreanWithDate}건 (${r.koreanDatePct}%)`
      );
      r.samples.forEach((s, i) => {
        const flag = s.isKorean ? "🇰🇷" : "🌐";
        const date = s.published_date || "null";
        console.log(`      ${flag} [${i + 1}] ${date.padEnd(25)} | ${s.title}`);
      });
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log("검증 완료");
  console.log("=".repeat(78));
}

main().catch(console.error);
