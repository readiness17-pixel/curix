const { collectContents } = require("./_collector");
const { generateLetter } = require("./_generator");

async function createBriefLetter(topic, settings) {
  // 1. 콘텐츠 수집
  const contents = await collectContents(topic);

  // 2. 수집 결과 검증
  if (contents.length < 3) {
    throw new Error(
      `수집된 콘텐츠가 ${contents.length}건으로 부족합니다. (최소 3건 필요)`
    );
  }

  // 3. 브리프 레터 생성
  const letter = await generateLetter(contents, settings);

  // 4. 출처 메타데이터 (Gemini를 거치지 않고 collector 데이터를 그대로 노출)
  const sources = contents.map((c) => ({
    title: c.title,
    url: c.url,
    source: c.source,
    source_type: c.source_type,
    published_at: c.published_at,
  }));

  return {
    topic,
    settings,
    source_count: contents.length,
    letter,
    sources,
  };
}

module.exports = { createBriefLetter };
