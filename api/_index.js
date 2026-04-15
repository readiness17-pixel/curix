const { collectContents } = require("./_collector");
const { generateLetter } = require("./_generator");

async function createBriefLetter(topic, settings) {
  const contents = await collectContents(topic);

  if (contents.length < 3) {
    throw new Error(
      `수집된 콘텐츠가 ${contents.length}건으로 부족합니다. (최소 3건 필요)`
    );
  }

  const letter = await generateLetter(contents, settings);

  return {
    topic,
    settings,
    source_count: contents.length,
    letter,
  };
}

module.exports = { createBriefLetter };
