require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

// Initialize Clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function postNextMeme() {
  console.log("🤖 Worker waking up...");

  // 1. Get the next pending meme
  const { data: meme, error } = await supabase
    .from("meme_queue")
    .select("*")
    .eq("status", "pending")
    .limit(1)
    .single();

  if (error || !meme) {
    return console.log("💤 No pending memes found in queue.");
  }

  console.log(`🎯 Found meme: ${meme.title}`);

  // --- TEST MODE CHECK ---
  if (process.env.TEST_MODE === "true") {
    console.log("--------------------------------");
    console.log("✅ [TEST MODE] Simulated Post Successful");
    console.log(`📝 Text: ${meme.title} #memes`);
    console.log(`🖼 Image: ${meme.image_url}`);
    console.log("--------------------------------");
    return;
  }

  try {
    // 2. Download Image (WITH THE FIX: "User-Agent" Mask)
    // We pretend to be a regular browser so Reddit lets us download the file
    const imageResponse = await axios.get(meme.image_url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const imageBuffer = Buffer.from(imageResponse.data);

    // 3. Upload to Twitter
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
      mimeType: "image/jpeg",
    });

    // 4. Create Tweet (Adding invisible char to prevent duplicates + Hashtags)
    const uniqueText = `${meme.title} \u200B\n\n#memes #fun`;

    await twitterClient.v2.tweet({
      text: uniqueText,
      media: { media_ids: [mediaId] },
    });

    // 5. Mark as Published
    await supabase
      .from("meme_queue")
      .update({ status: "published" })
      .eq("id", meme.id);

    console.log(`🚀 Successfully posted tweet ID: ${meme.id}`);
  } catch (err) {
    console.error("❌ Failed to post:", err);
  }
}

postNextMeme();
