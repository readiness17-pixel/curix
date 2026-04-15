const axios = require("axios");
const RSSParser = require("rss-parser");
const crypto = require("crypto");
if (!process.env.VERCEL) require("dotenv").config();

const rssParser = new RSSParser();

const RSS_FEEDS = [
  { url: "https://techcrunch.com/feed/", name: "TechCrunch" },
  { url: "https://openai.com/blog/rss.xml", name: "OpenAI Blog" },
  { url: "https://www.bloter.net/feed", name: "Bloter" },
  { url: "https://byline.network/feed", name: "Byline Network" },
];

const MAX_CONTENT_LENGTH = 2000;

function truncate(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
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

// RSS 피드 수집 (토픽 관련 기사만 필터링)
async function collectFromRSS(topic) {
  const results = [];
  // 2글자 이상의 의미 있는 키워드만 사용 (조사/일반어 제외)
  const topicKeywords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((kw) => kw.length >= 2);

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await rssParser.parseURL(feed.url);

      const matched = parsed.items.filter((item) => {
        const text = [
          item.title || "",
          item.contentSnippet || "",
          item.content || "",
          item.summary || "",
        ]
          .join(" ")
          .toLowerCase();

        // 키워드의 절반 이상이 매칭되어야 관련 기사로 판단
        const matchCount = topicKeywords.filter((kw) => text.includes(kw)).length;
        const threshold = Math.max(2, Math.ceil(topicKeywords.length / 2));
        return matchCount >= threshold;
      });

      const items = matched.slice(0, 3);

      for (const item of items) {
        results.push({
          id: crypto.randomUUID(),
          title: item.title || "제목 없음",
          content: truncate(
            item.contentSnippet || item.content || item.summary || "",
            MAX_CONTENT_LENGTH
          ),
          source: feed.name,
          source_type: "rss",
          url: item.link || "",
          published_at: item.isoDate || item.pubDate || null,
        });
      }

      console.log(`[RSS] ${feed.name}: ${items.length}건 수집 (전체 ${parsed.items.length}건 중 매칭)`);
    } catch (error) {
      console.warn(`[RSS] ${feed.name} 수집 실패: ${error.message}`);
    }
  }

  return results;
}

// 메인 수집 함수
async function collectContents(topic) {
  console.log(`\n🔍 "${topic}" 관련 콘텐츠 수집 시작...\n`);

  // 병렬로 수집
  const [webResults, rssResults] = await Promise.all([
    searchWithTavily(topic),
    collectFromRSS(topic),
  ]);

  console.log(`\n[결과] Tavily: ${webResults.length}건, RSS: ${rssResults.length}건`);

  // 합치기
  const allResults = [...webResults, ...rssResults];

  // URL 기준 중복 제거
  const seen = new Set();
  const deduplicated = allResults.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // 날짜순 정렬 (최신순)
  deduplicated.sort((a, b) => {
    const dateA = a.published_at ? new Date(a.published_at) : new Date(0);
    const dateB = b.published_at ? new Date(b.published_at) : new Date(0);
    return dateB - dateA;
  });

  console.log(`[결과] 중복 제거 후: ${deduplicated.length}건\n`);

  return deduplicated;
}

module.exports = { collectContents };
