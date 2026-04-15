// 정적 require — Vercel NFT가 추적할 수 있도록
const collectorMod = "./_collector";
const generatorMod = "./_generator";
const indexMod = "./_index";

module.exports = async function handler(req, res) {
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
    ok: results.collector === "ok" && results.generator === "ok" && results.index === "ok",
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
