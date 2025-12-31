require("dotenv").config();
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

const SUBREDDITS = ["memes", "ProgrammerHumor", "wholesomememes", "funny"];

async function scrapeReddit() {
  console.log("🔍 Starting Scraper...");

  // Pick a random subreddit
  const randomSub = SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];
  const url = `https://www.reddit.com/r/${randomSub}/top.json?t=day&limit=25`; // Increased limit to 25

  console.log(`🌍 Fetching from: r/${randomSub}`);

  try {
    const response = await axios.get(url);
    const posts = response.data.data.children;
    let count = 0;

    for (const post of posts) {
      const { title, url, id, post_hint, is_video } = post.data;

      // DEBUG LOG: Uncomment this if you want to see every raw post details
      // console.log(`Checking: ${title.substring(0, 20)}... | Hint: ${post_hint} | URL: ${url}`);

      // 1. Skip Videos
      if (is_video || url.includes("v.redd.it")) {
        console.log(`   ⏭️ Skipped (Video): ${title.substring(0, 30)}...`);
        continue;
      }

      // 2. Check for Valid Image URL (Added .jpeg and .webp)
      const isImage = url.match(/\.(jpg|jpeg|png|webp)$/i);

      // 3. Strict Filter: Must be an image
      if (post_hint === "image" && isImage) {
        // Save to Supabase
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
          .select(); // Returns data so we know if it worked

        if (!error) {
          console.log(`   ✅ SAVED: ${title}`);
          count++;
        } else if (error.code === "23505") {
          console.log(
            `   ⚠️ Duplicate (Already in DB): ${title.substring(0, 30)}...`,
          );
        } else {
          console.log(`   ❌ DB Error: ${error.message}`);
        }
      } else {
        console.log(
          `   ⏭️ Skipped (Not direct image): ${title.substring(0, 30)}...`,
        );
      }
    }
    console.log(`\n🎉 Scrape finished. Added ${count} new memes.`);
  } catch (err) {
    console.error("❌ Scraping failed:", err.message);
  }
}

scrapeReddit();
