require("dotenv").config();

const http = require("http");
const { Client, GatewayIntentBits } = require("discord.js");
const { chromium } = require("playwright");

const PORT = process.env.PORT || 3000;

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot actif");
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur web actif sur le port ${PORT}`);
  });

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const URL = "https://my.weezevent.com/flechettes-cup-1";
const SOLD_OUT_TEXT = "Trop tard";

async function checkPage() {
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    const page = await browser.newPage();

    await page.goto(URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(10000);

    console.log("----- IFRAMES TROUVÉES -----");
    page.frames().forEach((frame, index) => {
      console.log(index, frame.url());
    });
    console.log("----------------------------");

    const iframeElement = await page.waitForSelector(
      'iframe[src*="widget_billeterie.php"], iframe[src*="widget.weezevent.com"]',
      { timeout: 15000 }
    );

    const frame = await iframeElement.contentFrame();

    if (!frame) {
      throw new Error("Iframe trouvée mais impossible à lire");
    }

    await frame.waitForLoadState("domcontentloaded");
    await frame.waitForTimeout(5000);

    const text = await frame.locator("body").innerText();
    const isSoldOut = text.includes(SOLD_OUT_TEXT);

    console.log("----- TEXTE IFRAME -----");
    console.log(text.slice(0, 1500));
    console.log("isSoldOut =", isSoldOut);
    console.log("------------------------");

    const channel = await client.channels.fetch(process.env.CHANNEL_ID);

    if (isSoldOut) {
      await channel.send({
        content: "@everyone 🚨 ALERTE ROUGE : DES PLACES SONT PEUT-ÊTRE DISPO !\nhttps://my.weezevent.com/flechettes-cup-1",
        allowedMentions: { parse: ["everyone"] },
      });
    }
  } catch (err) {
    console.error("Erreur :", err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

client.once("clientReady", () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  checkPage();
  setInterval(checkPage, 60000);
});

client.login(process.env.DISCORD_TOKEN);