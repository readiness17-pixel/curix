const express = require("express");
const path = require("path");
const { createBriefLetter } = require("./index");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_TOPIC_LENGTH = 100;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// 톤 매핑 (한글 → 영문)
const TONE_MAP = {
  "친근한": "casual",
  "전문적인": "professional",
  "간결한": "concise",
};

// 토픽 정규화: 제어 문자 제거, 공백 정리
function sanitizeTopic(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

app.post("/api/generate", async (req, res) => {
  try {
    const { topic, settings } = req.body || {};

    const cleanTopic = sanitizeTopic(topic);
    if (!cleanTopic) {
      return res.status(400).json({ error: "토픽을 입력해주세요." });
    }
    if (cleanTopic.length > MAX_TOPIC_LENGTH) {
      return res.status(400).json({
        error: `토픽은 ${MAX_TOPIC_LENGTH}자 이내로 입력해주세요.`,
      });
    }

    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ error: "설정값이 없습니다." });
    }

    const mappedSettings = {
      persona_type: settings.persona_type,
      tone: TONE_MAP[settings.tone] || settings.tone,
      reading_time: settings.reading_time,
    };

    const result = await createBriefLetter(cleanTopic, mappedSettings);
    res.json(result);
  } catch (error) {
    console.error("[API 에러]", error.message);

    if (error.message.includes("부족")) {
      return res.status(400).json({
        error: "해당 토픽의 콘텐츠를 충분히 찾지 못했습니다.",
      });
    }

    res.status(500).json({
      error: "생성에 실패했습니다. 다시 시도해주세요.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 CURIX 서버가 시작되었습니다: http://localhost:${PORT}\n`);
});
