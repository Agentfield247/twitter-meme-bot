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

async function scrapeReddit() {
  console.log("🔍 Starting Scraper...");

  const randomSub = SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];
  const url = `https://www.reddit.com/r/${randomSub}/top.json?t=day&limit=25`;

  console.log(`🌍 Fetching from: r/${randomSub}`);

  try {
    // FIX: Use a "Bot" User-Agent instead of a "Browser" one.
    // Reddit allows bots if they identify themselves honestly.
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "script:meme-bot:v1.0 (by /u/tweet_bot_dev)",
      },
    });

    const posts = response.data.data.children;
    let count = 0;

    for (const post of posts) {
      const { title, url, id, post_hint, is_video } = post.data;

      if (is_video || url.includes("v.redd.it")) continue;

      const isImage = url.match(/\.(jpg|jpeg|png|webp)$/i);

      if (post_hint === "image" && isImage) {
        const { error } = await supabase
          .from("meme_queue")
          .insert([
            {
              title: title,
              image_url: url,
              source_id: id,
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
    console.error(`❌ Scraping failed: ${err.message}`);
  }
}

scrapeReddit();
