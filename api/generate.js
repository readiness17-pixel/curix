const { createBriefLetter } = require("./_index");

// 톤 매핑 (한글 → 영문)
const TONE_MAP = {
  "친근한": "casual",
  "전문적인": "professional",
  "간결한": "concise",
};

module.exports = async function handler(req, res) {
  // CORS 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { topic, settings } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "토픽을 입력해주세요." });
    }

    // 환경 변수 확인
    if (!process.env.TAVILY_API_KEY) {
      return res.status(500).json({ error: "TAVILY_API_KEY가 설정되지 않았습니다." });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." });
    }

    const mappedSettings = {
      persona_type: settings.persona_type,
      tone: TONE_MAP[settings.tone] || settings.tone,
      reading_time: settings.reading_time,
    };

    const result = await createBriefLetter(topic.trim(), mappedSettings);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[API 에러]", error.message, error.stack);

    if (error.message.includes("부족")) {
      return res.status(400).json({
        error: "해당 토픽의 콘텐츠를 충분히 찾지 못했습니다.",
      });
    }

    return res.status(500).json({
      error: "생성에 실패했습니다: " + error.message,
    });
  }
};
