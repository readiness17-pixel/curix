const { createBriefLetter } = require("./index");

const TEST_CASES = [
  {
    topic: "AI 규제 동향",
    settings: {
      persona_type: "인사이트형",
      tone: "professional",
      reading_time: "5분 이내",
    },
  },
  {
    topic: "스타트업 투자 트렌드",
    settings: {
      persona_type: "요약형",
      tone: "concise",
      reading_time: "3분 이내",
    },
  },
  {
    topic: "프론트엔드 개발 트렌드",
    settings: {
      persona_type: "큐레이션형",
      tone: "casual",
      reading_time: "5분 이내",
    },
  },
];

function countChars(letter) {
  let total = 0;
  total += (letter.intro || "").length;
  for (const section of letter.sections || []) {
    total += (section.title || "").length;
    total += (section.content || "").length;
  }
  total += (letter.outro || "").length;
  return total;
}

async function runTests() {
  const results = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🧪 테스트 ${i + 1}: "${tc.topic}" (${tc.settings.persona_type}, ${tc.settings.tone}, ${tc.settings.reading_time})`);
    console.log("=".repeat(60));

    try {
      const result = await createBriefLetter(tc.topic, tc.settings);
      const letter = result.letter;
      const charCount = countChars(letter);

      results.push({
        topic: tc.topic,
        persona: tc.settings.persona_type,
        tone: tc.settings.tone,
        reading_time: tc.settings.reading_time,
        title: letter.title,
        subtitle: letter.subtitle,
        sections: letter.sections?.length || 0,
        chars: charCount,
        source_count: result.source_count,
      });

      console.log(`\n📄 제목: ${letter.title}`);
      console.log(`📝 부제: ${letter.subtitle}`);
      console.log(`🏷️  태그: ${letter.topic_tags?.join(", ")}`);
      console.log(`📖 읽기 시간: ${letter.reading_time_minutes}분`);
      console.log(`📑 섹션 수: ${letter.sections?.length || 0}개`);
      console.log(`📊 총 글자수: ${charCount}자`);
      console.log(`🔗 수집 소스: ${result.source_count}건`);

      console.log(`\n--- 인트로 ---`);
      console.log(letter.intro);

      for (const section of letter.sections || []) {
        console.log(`\n--- [${section.type}] ${section.title} ---`);
        console.log(section.content.slice(0, 200) + "...");
      }

      console.log(`\n--- 아웃트로 ---`);
      console.log(letter.outro);
    } catch (error) {
      console.error(`❌ 테스트 ${i + 1} 실패:`, error.message);
      results.push({
        topic: tc.topic,
        persona: tc.settings.persona_type,
        error: error.message,
      });
    }
  }

  // 비교 테이블
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("📊 3개 테스트 비교 요약");
  console.log("=".repeat(60));
  console.log(
    "토픽".padEnd(20) +
      "페르소나".padEnd(12) +
      "톤".padEnd(15) +
      "섹션수".padEnd(8) +
      "글자수".padEnd(8) +
      "제목"
  );
  console.log("-".repeat(80));
  for (const r of results) {
    if (r.error) {
      console.log(`${r.topic.padEnd(20)}${r.persona.padEnd(12)}❌ ${r.error}`);
    } else {
      console.log(
        `${r.topic.padEnd(20)}${r.persona.padEnd(12)}${r.tone.padEnd(15)}${String(r.sections).padEnd(8)}${String(r.chars).padEnd(8)}${r.title}`
      );
    }
  }
}

runTests().catch(console.error);
