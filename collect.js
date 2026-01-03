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
  "BlackPeopleTwitter", // Viral roasts
  "WhitePeopleTwitter", // Viral politics/drama
  "PublicFreakout", // (The image versions often allow context without the violence ban)
  "Facepalm", // People being stupid (Very popular)
  "CleverComebacks", // High engagement reading
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

      // FIX: Find the image source inside quotes
      const imageMatch = content.match(/src="([^"]+)"/);

      if (imageMatch) {
        // Fix the link (RSS turns '&' into '&amp;', we switch it back)
        let imageUrl = imageMatch[1].replace(/&amp;/g, "&");

        const title = post.title;
        const uniqueId = post.guid;

        // Save to Database
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
        } else if (error.code !== "23505") {
          // Ignore duplicates (23505), but show other errors
          console.error(`   ⚠️ DB Error: ${error.message}`);
        }
      }
    }
    console.log(`\n🎉 Scrape finished. Added ${count} new memes.`);
  } catch (err) {
    console.error(`❌ Proxy Error: ${err.message}`);
  }
}

scrapeWithProxy();
