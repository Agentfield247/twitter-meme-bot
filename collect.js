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

      // IMPROVED REGEX: Finds ANY url ending in jpg/png/jpeg/webp inside the HTML
      // It doesn't care if it's i.redd.it or preview.redd.it anymore.
      const imageMatch = content.match(
        /(https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp))/i,
      );

      if (imageMatch) {
        const imageUrl = imageMatch[1];
        const title = post.title;
        const uniqueId = post.guid;

        // Save to Supabase
        const { error } = await supabase
          .from("meme_queue")
          .insert([
            {
              title: title,
              image_url: imageUrl,
              source_id: uniqueId,
              status: "pending",
            },
          ])
          .ignore();

        if (!error) {
          console.log(`   ✅ SAVED: ${title.substring(0, 30)}...`);
          count++;
        }
      } else {
        // Optional: See what we skipped
        // console.log(`   ⏭️ Skipped (No image found): ${post.title.substring(0, 20)}...`);
      }
    }
    console.log(`\n🎉 Scrape finished. Added ${count} new memes.`);
  } catch (err) {
    console.error(`❌ Proxy Error: ${err.message}`);
  }
}

scrapeWithProxy();
