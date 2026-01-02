require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");

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

  const { data: meme, error } = await supabase
    .from("meme_queue")
    .select("*")
    .eq("status", "pending")
    .limit(1)
    .single();

  if (error || !meme) {
    return console.log("💤 No pending memes found.");
  }

  console.log(`🎯 Processing: ${meme.title}`);

  try {
    // Attempt download via Proxy
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(meme.image_url)}&output=jpg`;

    const imageResponse = await axios.get(proxyUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Upload & Tweet
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
      mimeType: "image/jpeg",
    });
    await twitterClient.v2.tweet({
      text: `${meme.title} #memes #fun`,
      media: { media_ids: [mediaId] },
    });

    // Success: Mark as Published
    await supabase
      .from("meme_queue")
      .update({ status: "published" })
      .eq("id", meme.id);
    console.log(`🚀 SUCCESS! Posted tweet ID: ${meme.id}`);
  } catch (err) {
    console.error("❌ Error posting meme:", err.message);

    // CRITICAL FIX: If it fails, mark as 'error' so we don't get stuck!
    console.log("🗑️ Trashing bad meme to unblock queue...");
    await supabase
      .from("meme_queue")
      .update({ status: "error" })
      .eq("id", meme.id);
  }
}

postNextMeme();
