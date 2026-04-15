const axios = require("axios");
const RSSParser = require("rss-parser");
const crypto = require("crypto");
if (!process.env.VERCEL) require("dotenv").config();

const rssParser = new RSSParser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; CURIX/1.0)" },
});

const MAX_CONTENT_LENGTH = 2000;

function truncate(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

// Google News는 제목 끝에 " - 매체명" 형식으로 매체가 붙음
function extractSourceFromTitle(title) {
  if (!title) return { title: "제목 없음", source: "Google News" };
  const match = title.match(/^(.*)\s-\s([^-]+)$/);
  if (match) {
    return { title: match[1].trim(), source: match[2].trim() };
  }
  return { title, source: "Google News" };
}

// 토픽에 한국어 포함 여부에 따라 로케일 선택
function detectLocale(topic) {
  return /[가-힣]/.test(topic)
    ? { hl: "ko", gl: "KR", ceid: "KR:ko" }
    : { hl: "en", gl: "US", ceid: "US:en" };
}

// Tavily 웹 검색
async function searchWithTavily(topic) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey === "여기에_실제_키를_붙여넣으세요") {
    console.warn("[Tavily] API 키가 설정되지 않았습니다. 웹 검색을 건너뜁니다.");
    return [];
  }

  try {
    const response = await axios.post("https://api.tavily.com/search", {
      api_key: apiKey,
      query: topic,
      search_depth: "advanced",
      include_raw_content: true,
      max_results: 10,
    });

    return response.data.results.map((item) => ({
      id: crypto.randomUUID(),
      title: item.title || "제목 없음",
      content: truncate(item.raw_content || item.content, MAX_CONTENT_LENGTH),
      source: new URL(item.url).hostname.replace("www.", ""),
      source_type: "web",
      url: item.url,
      published_at: item.published_date || null,
    }));
  } catch (error) {
    console.error("[Tavily] 검색 실패:", error.message);
    return [];
  }
}

// Google News RSS로 토픽 검색 (최근 30일 이내 기사로 제한)
async function collectFromRSS(topic) {
  const locale = detectLocale(topic);
  // when:30d 연산자로 에버그린 토픽에서도 최신 기사만 수집
  const query = `${topic} when:30d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query
  )}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`;

  try {
    const parsed = await rssParser.parseURL(url);
    const items = (parsed.items || []).slice(0, 15);

    const results = items.map((item) => {
      const { title, source } = extractSourceFromTitle(item.title);
      return {
        id: crypto.randomUUID(),
        title,
        content: truncate(
          item.contentSnippet || item.content || item.summary || "",
          MAX_CONTENT_LENGTH
        ),
        source,
        source_type: "rss",
        url: item.link || "",
        published_at: item.isoDate || item.pubDate || null,
      };
    });

    console.log(
      `[Google News RSS] ${results.length}건 수집 (locale: ${locale.ceid})`
    );
    return results;
  } catch (error) {
    console.warn(`[Google News RSS] 수집 실패: ${error.message}`);
    return [];
  }
}

// 메인 수집 함수
async function collectContents(topic) {
  console.log(`\n🔍 "${topic}" 관련 콘텐츠 수집 시작...\n`);

  // 병렬로 수집
  const [webResults, rssResults] = await Promise.all([
    searchWithTavily(topic),
    collectFromRSS(topic),
  ]);

  console.log(
    `\n[결과] Tavily: ${webResults.length}건, Google News: ${rssResults.length}건`
  );

  // 합치기
  const allResults = [...webResults, ...rssResults];

  // URL 기준 중복 제거
  const seen = new Set();
  const deduplicated = allResults.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // 날짜순 정렬 (최신순) — 날짜 없는 항목은 가장 뒤로
  deduplicated.sort((a, b) => {
    const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
    const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
    return dateB - dateA;
  });

  console.log(`[결과] 중복 제거 후: ${deduplicated.length}건\n`);

  return deduplicated;
}

module.exports = { collectContents };
