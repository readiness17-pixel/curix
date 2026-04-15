const { GoogleGenerativeAI } = require("@google/generative-ai");
if (!process.env.VERCEL) require("dotenv").config();

const SYSTEM_PROMPT = `당신은 CURIX의 브리프 레터 편집 AI입니다.
수집된 콘텐츠를 편집해서 개인맞춤형 브리프 레터를 만듭니다.

핵심 규칙:
1. 원문을 그대로 베끼지 마세요. 반드시 자기 말로 다시 쓰세요.
2. 모든 정보에 출처 링크를 [텍스트](URL) 형태로 넣으세요.
3. 반드시 "인트로 → 본문 섹션들 → 아웃트로" 구조를 지키세요.
4. 한국어로 작성하세요.

personaType별 스타일:
[요약형]
- 핵심만 추출. 불릿 포인트 위주. 항목당 1~3문장.
[인사이트형]
- 배경 맥락 + "왜 중요한가" 분석 + 향후 전망 포함.
- 섹션 간 논리적 흐름 연결.
[큐레이션형]
- 각 콘텐츠를 독립적 추천 아이템으로 구성.
- 형식: 제목 + 한줄 소개 + 추천 이유 + 원문 링크.

tone별 문체:
[casual] 구어체. "~인데요", "~거든요" 허용. 이모지 가능.
[professional] 격식체(합니다/습니다). 전문 용어 + 데이터 인용.
[concise] 최소 단어. 불릿 포인트·숫자 중심.

reading_time별 분량:
"3분 이내": 섹션 2~3개, 총 1,200~1,500자
"5분 이내": 섹션 3~5개, 총 2,000~2,500자
"10분 이상": 섹션 5~8개, 총 4,000~5,000자

출력은 반드시 아래 JSON만 반환:
{
  "title": "레터 제목 (20자 이내)",
  "subtitle": "한줄 요약",
  "topic_tags": ["태그1", "태그2"],
  "reading_time_minutes": 5,
  "intro": "인트로 마크다운 텍스트",
  "sections": [
    {
      "type": "insight 또는 summary 또는 curation",
      "title": "섹션 제목",
      "content": "섹션 본문 마크다운"
    }
  ],
  "outro": "아웃트로 마크다운 텍스트"
}`;

function buildUserPrompt(contents, settings) {
  const contentSummary = contents
    .map(
      (c, i) =>
        `[${i + 1}] 제목: ${c.title}\n출처: ${c.source} (${c.source_type})\nURL: ${c.url}\n발행일: ${c.published_at || "알 수 없음"}\n본문: ${c.content.slice(0, 500)}`
    )
    .join("\n\n");

  return `아래 수집된 콘텐츠를 기반으로 브리프 레터를 작성해주세요.

■ 설정
- 페르소나: ${settings.persona_type}
- 톤: ${settings.tone}
- 읽기 시간: ${settings.reading_time}

■ 수집된 콘텐츠 (${contents.length}건)
${contentSummary}

위 설정과 콘텐츠를 기반으로 JSON만 반환해주세요. 다른 텍스트 없이 JSON만 출력하세요.`;
}

async function generateLetter(contents, settings) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "여기에_실제_키를_붙여넣으세요") {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const userPrompt = buildUserPrompt(contents, settings);

  console.log("[Gemini] 브리프 레터 생성 중...");

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();

  // JSON 파싱 (```json ... ``` 블록이 있을 수 있으므로 제거)
  const jsonString = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  try {
    const letter = JSON.parse(jsonString);
    console.log("[Gemini] 브리프 레터 생성 완료!");
    return letter;
  } catch (error) {
    console.error("[Gemini] JSON 파싱 실패. 원본 응답:\n", text);
    throw new Error("AI 응답을 JSON으로 파싱할 수 없습니다.");
  }
}

module.exports = { generateLetter };
