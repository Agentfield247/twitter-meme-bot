require("dotenv").config();
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

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

  // Use a public RSS-to-JSON bridge
  const redditRSS = `https://www.reddit.com/r/${randomSub}/top/.rss?t=day`;
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(redditRSS)}`;

  console.log(`🌍 Fetching via Proxy: r/${randomSub}`);

  try {
    const response = await axios.get(proxyUrl);

    if (response.data.status !== "ok") {
      throw new Error("Proxy returned error");
    }

    const posts = response.data.items;
    let count = 0;

    for (const post of posts) {
      const content = post.content || post.description || "";

      // Regex to find ANY image url inside the HTML
      const imageMatch = content.match(
        /(https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp))/i,
      );

      if (imageMatch) {
        const imageUrl = imageMatch[1];
        const title = post.title;
        const uniqueId = post.guid;

        // FIX: Removed .ignore() and used standard error handling
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
        } else if (error.code === "23505") {
          // 23505 is the code for "Unique Violation" (Duplicate)
          // We silently skip it
        } else {
          console.error(`   ❌ DB Error: ${error.message}`);
        }
      }
    }
    console.log(`\n🎉 Scrape finished. Added ${count} new memes.`);
  } catch (err) {
    console.error(`❌ Proxy Error: ${err.message}`);
  }
}

scrapeWithProxy();
