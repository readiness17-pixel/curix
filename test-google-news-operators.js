// Google News RSS 시간 연산자 및 정렬 파라미터 검증
// 에버그린 토픽에서 강제로 최신만 뽑을 수 있는지 확인
require("dotenv").config();
const RSSParser = require("rss-parser");

const rssParser = new RSSParser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; CURIX/1.0)" },
});

// 앞선 테스트에서 최신성이 나빴던 토픽들
const TEST_TOPICS = [
  "개발자 커리어",    // 기존 7일내 3%, 평균 481일
  "디자인 시스템",    // 기존 7일내 7%, 평균 99일
  "한국 부동산 정책", // 기존 7일내 7%, 평균 67일
];

// 각 토픽에 대해 여러 전략을 비교
function buildVariants(query) {
  const encoded = encodeURIComponent(query);
  const baseUrl = "https://news.google.com/rss/search";
  const baseParams = "hl=ko&gl=KR&ceid=KR:ko";

  // 최근 날짜 리터럴 (after: 연산자용)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  return [
    {
      name: "baseline",
      url: `${baseUrl}?q=${encoded}&${baseParams}`,
    },
    {
      name: "when:1d",
      url: `${baseUrl}?q=${encodeURIComponent(query + " when:1d")}&${baseParams}`,
    },
    {
      name: "when:7d",
      url: `${baseUrl}?q=${encodeURIComponent(query + " when:7d")}&${baseParams}`,
    },
    {
      name: "when:30d",
      url: `${baseUrl}?q=${encodeURIComponent(query + " when:30d")}&${baseParams}`,
    },
    {
      name: `after:${sevenDaysAgo}`,
      url: `${baseUrl}?q=${encodeURIComponent(query + " after:" + sevenDaysAgo)}&${baseParams}`,
    },
    {
      name: "tbs=qdr:w",
      url: `${baseUrl}?q=${encoded}&${baseParams}&tbs=qdr:w`,
    },
    {
      name: "tbs=qdr:d",
      url: `${baseUrl}?q=${encoded}&${baseParams}&tbs=qdr:d`,
    },
  ];
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

async function runVariant(variant) {
  try {
    const parsed = await rssParser.parseURL(variant.url);
    const items = parsed.items || [];
    if (items.length === 0) {
      return { name: variant.name, count: 0, fresh7d: 0, avgDays: null, samples: [] };
    }

    const daysList = items
      .map((item) => daysSince(item.isoDate || item.pubDate))
      .filter((d) => d !== null);

    const fresh7d = daysList.filter((d) => d <= 7).length;
    const avgDays = daysList.length
      ? (daysList.reduce((a, b) => a + b, 0) / daysList.length).toFixed(1)
      : null;
    const medianDays = daysList.length
      ? daysList.sort((a, b) => a - b)[Math.floor(daysList.length / 2)]
      : null;

    const samples = items.slice(0, 3).map((item) => ({
      days: daysSince(item.isoDate || item.pubDate),
      title: (item.title || "").slice(0, 50),
    }));

    return {
      name: variant.name,
      count: items.length,
      fresh7d,
      fresh7dPct: Math.round((fresh7d / items.length) * 100),
      avgDays,
      medianDays,
      samples,
    };
  } catch (e) {
    return { name: variant.name, error: e.message };
  }
}

async function main() {
  console.log("=".repeat(78));
  console.log("Google News RSS — 시간 연산자/정렬 파라미터 검증");
  console.log("=".repeat(78));
  console.log("(이전 검증에서 최신성이 낮았던 에버그린 토픽 대상)\n");

  for (const topic of TEST_TOPICS) {
    console.log("\n" + "━".repeat(78));
    console.log(`📌 "${topic}"`);
    console.log("━".repeat(78));

    const variants = buildVariants(topic);
    const results = [];
    for (const v of variants) {
      const r = await runVariant(v);
      results.push(r);
      await new Promise((r) => setTimeout(r, 300));
    }

    // 테이블 출력
    console.log("전략              | 건수 | 7일내 | 7일내% | 평균일 | 중위일");
    console.log("-".repeat(78));
    results.forEach((r) => {
      if (r.error) {
        console.log(`${r.name.padEnd(18)}| ERROR: ${r.error.slice(0, 50)}`);
        return;
      }
      console.log(
        `${r.name.padEnd(18)}| ${String(r.count).padStart(4)} | ${String(r.fresh7d).padStart(5)} | ${String(r.fresh7dPct || 0).padStart(5)}% | ${String(r.avgDays || "-").padStart(6)} | ${String(r.medianDays || "-").padStart(6)}`
      );
    });

    // when:7d 전략 샘플만 자세히
    const when7d = results.find((r) => r.name === "when:7d");
    if (when7d && when7d.samples && when7d.samples.length > 0) {
      console.log(`\n  when:7d 상위 샘플:`);
      when7d.samples.forEach((s, i) => {
        console.log(`    [${i + 1}] (${s.days !== null ? s.days + "일 전" : "?"}) ${s.title}`);
      });
    }
  }

  console.log("\n" + "=".repeat(78));
  console.log("검증 완료");
  console.log("=".repeat(78));
}

main().catch(console.error);
