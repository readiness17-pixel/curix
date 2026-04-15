module.exports = async function handler(req, res) {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasTavily = !!process.env.TAVILY_API_KEY;

  res.status(200).json({
    status: "ok",
    env: {
      GEMINI_API_KEY: hasGemini ? "설정됨" : "미설정",
      TAVILY_API_KEY: hasTavily ? "설정됨" : "미설정",
    },
    node: process.version,
  });
};
