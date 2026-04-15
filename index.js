const { collectContents } = require("./collector");
const { generateLetter } = require("./generator");

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

  return {
    topic,
    settings,
    source_count: contents.length,
    letter,
  };
}

module.exports = { createBriefLetter };
