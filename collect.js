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
    // FIX: Add a custom User-Agent to bypass the 403 Block
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const posts = response.data.data.children;
    let count = 0;

    for (const post of posts) {
      const { title, url, id, post_hint, is_video } = post.data;

      // Skip Videos
      if (is_video || url.includes("v.redd.it")) continue;

      // Check for Image
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
          .ignore(); // Safely ignore duplicates

        if (!error) {
          console.log(`   ✅ SAVED: ${title}`);
          count++;
        }
      }
    }
    console.log(`\n🎉 Scrape finished. Added ${count} new memes.`);
  } catch (err) {
    console.error(`❌ Scraping failed: ${err.message}`);
    // If Reddit blocks us, try a fallback URL (optional future improvement)
  }
}

scrapeReddit();
