require("dotenv").config();
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { decode } = require("html-entities"); // You might need this, but for now we'll do basic decoding

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

const SUBREDDITS = [
  "memes",
  "ProgrammerHumor",
  "wholesomememes",
  "funny",
  "me_irl",
];

async function scrapeWithProxy() {
  console.log("🔍 Starting RSS Proxy Scraper...");

  const randomSub = SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];
  const redditRSS = `https://www.reddit.com/r/${randomSub}/top/.rss?t=day`;
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(redditRSS)}`;

  console.log(`🌍 Fetching via Proxy: r/${randomSub}`);

  try {
    const response = await axios.get(proxyUrl);
    const posts = response.data.items;
    let count = 0;

    for (const post of posts) {
      const content = post.content || post.description || "";

      // FIX: Capture everything inside src="..." quotes, even if it has ?s=... codes
      const imageMatch = content.match(/src="([^"]+)"/);

      if (imageMatch) {
        // RSS feeds encoded symbols like &amp; to &, we must fix that
        let imageUrl = imageMatch[1].replace(/&amp;/g, "&");

        const title = post.title;
        const uniqueId = post.guid;

        const { error } = await supabase.from("meme_queue").insert([
          {
            title: title,
            image_url: imageUrl,
            source_id: uniqueId,
            status: "pending",
          },
        ]);

        if (!error) {
          console.log(`   ✅ SAVED: ${title.substring(0, 30)}...`);
          count++;
        }
      }
    }
    console.log(`\n🎉 Scrape finished. Added ${count} new memes.`);
  } catch (err) {
    console.error(`❌ Proxy Error: ${err.message}`);
  }
}

scrapeWithProxy();
