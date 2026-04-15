// 디버그 엔드포인트: ENABLE_DEBUG=true 또는 x-debug-token 헤더 일치 시에만 응답
module.exports = async function handler(req, res) {
  const enabled = process.env.ENABLE_DEBUG === "true";
  const debugToken = process.env.DEBUG_TOKEN;
  const headerToken = req.headers["x-debug-token"];
  const tokenOk = debugToken && headerToken === debugToken;

  if (!enabled && !tokenOk) {
    return res.status(404).json({ error: "Not found" });
  }

  const results = {};

  try {
    require("./_collector");
    results.collector = "ok";
  } catch (e) {
    results.collector = e.message;
  }

  try {
    require("./_generator");
    results.generator = "ok";
  } catch (e) {
    results.generator = e.message;
  }

  try {
    require("./_index");
    results.index = "ok";
  } catch (e) {
    results.index = e.message;
  }

  const fs = require("fs");
  let files = [];
  try {
    files = fs.readdirSync(__dirname);
  } catch (e) {
    files = ["error: " + e.message];
  }

  res.status(200).json({
    ok:
      results.collector === "ok" &&
      results.generator === "ok" &&
      results.index === "ok",
    dirname: __dirname,
    files,
    results,
    node: process.version,
    env: {
      TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    },
  });
};
