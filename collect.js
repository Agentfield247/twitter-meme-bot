require("dotenv").config();
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

const SUBREDDITS = ["memes", "ProgrammerHumor", "wholesomememes", "funny"];

async function scrapeWithProxy() {
  console.log("🔍 Starting RSS Proxy Scraper...");

  // 1. Pick a Subreddit
  const randomSub = SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];

  // 2. Build the "Proxy" URL
  // We ask rss2json to fetch Reddit's RSS feed for us
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
      // 3. Extract the Image URL
      // The RSS feed hides the image inside HTML code. We need to find it.
      // We look for: src="https://i.redd.it/..."
      const imageMatch = post.content.match(
        /src="(https:\/\/i\.redd\.it\/[^"]+\.(jpg|png|jpeg))"/,
      );

      if (imageMatch) {
        const imageUrl = imageMatch[1]; // The actual link
        const title = post.title;
        const uniqueId = post.guid; // Reddit's unique ID for this post

        // 4. Save to Supabase
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
          console.log(`   ✅ SAVED: ${title}`);
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
