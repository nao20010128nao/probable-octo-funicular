const chromium = require("chrome-aws-lambda");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (req, res) => {
  const { id } = req.query;
  const { puppeteer } = chromium;
  const browser = await puppeteer.launch({
    args: [...chromium.args, "--autoplay-policy=no-user-gesture-required"],
    executablePath: await chromium.executablePath,
    env: process.env,
  });
  const page = await browser.newPage();
  try {
    await new Promise((resolve, reject) => {
      (async () => {
        await page.exposeFunction("reportResponseText", (response) => {
          res.writeHead(200, { "Content-Type": "application/x-mpegurl" });
          res.end(response);
          resolve();
        });
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (request.url() == "https://avgle.com/templates/frontend/videojs-contrib-hls.js") {
            console.log("replacing url");
            request.continue({
              // replace with patched code
              url: "https://avgle-m3u8-extractor.vercel.app/videojs-contrib-hls.js",
            });
          } else if (request.url().endsWith("?adblock_detected")) {
            // easy adblocking
            request.abort();
          } else if (request.url().includes("jads.co")) {
            // easy adblocking
            request.abort();
          } else {
            request.continue();
          }
        });
        await page.goto(`https://avgle.com/video/${id}/`);
        console.log("loaded");
        const [button] = await page.$x("//span[@id='player_3x2_close']");
        if (button) {
          await button.click();
        }
        console.log("clicked");
        await page.evaluate((_) => {
          /* eslint no-undef: 0 */
          closeAd({ screenX: 1, originalEvent: { isTrusted: true } });
        });
        console.log("ad closed");
        await wait(100);
        await page.evaluate((_) => {
          /* eslint no-undef: 0 */
          for (const p of Object.values(videojs.getPlayers())) {
            p.play();
          }
        });
        console.log("video played");
      })().catch(reject);
    });
  } finally {
    await page.close();
    await browser.close();
  }
};