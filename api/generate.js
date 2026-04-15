const { createBriefLetter } = require("./_index");

// 톤 매핑 (한글 → 영문)
const TONE_MAP = {
  "친근한": "casual",
  "전문적인": "professional",
  "간결한": "concise",
};

const MAX_TOPIC_LENGTH = 100;

// 허용된 origin 목록 (필요 시 환경 변수로 확장)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function setCors(req, res) {
  const origin = req.headers.origin;
  // 허용 목록이 비어있으면(개발 환경) 같은 origin 또는 * 허용
  // 명시된 경우 화이트리스트 기반
  if (ALLOWED_ORIGINS.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// 토픽 정규화: 제어 문자 제거, 공백 정리
function sanitizeTopic(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    // 환경 변수 확인
    if (!process.env.TAVILY_API_KEY || !process.env.GEMINI_API_KEY) {
      console.error("[API 에러] 필수 환경 변수 누락");
      return res.status(500).json({
        error: "서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.",
      });
    }

    const mappedSettings = {
      persona_type: settings.persona_type,
      tone: TONE_MAP[settings.tone] || settings.tone,
      reading_time: settings.reading_time,
    };

    const result = await createBriefLetter(cleanTopic, mappedSettings);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[API 에러]", error.message, error.stack);

    if (error.message && error.message.includes("부족")) {
      return res.status(400).json({
        error: "해당 토픽의 콘텐츠를 충분히 찾지 못했습니다.",
      });
    }

    return res.status(500).json({
      error: "생성에 실패했습니다. 다시 시도해주세요.",
    });
  }
};
