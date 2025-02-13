require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT =process.env.PORT || 5000;
const cors = require("cors");
app.use(cors());


app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;


// Convert YouTube duration format (ISO 8601) to seconds
const convertDurationToSeconds = (duration) => {
    let hours = 0, minutes = 0, seconds = 0;
    duration = duration.replace("PT", "");
    
    if (duration.includes("H")) {
        [hours, duration] = duration.split("H");
        hours = parseInt(hours);
    }
    if (duration.includes("M")) {
        [minutes, duration] = duration.split("M");
        minutes = parseInt(minutes);
    }
    if (duration.includes("S")) {
        [seconds] = duration.split("S");
        seconds = parseInt(seconds);
    }

    return hours * 3600 + minutes * 60 + seconds;
};

// Convert seconds to HH:MM:SS format
const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
};

// Calculate duration at different speeds
const calculatePlaybackTime = (totalSeconds, speed) => {
    return formatTime(Math.ceil(totalSeconds / speed));
};
function extractPlaylistId(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('list');
// Home Route
app.get("/", (req, res) => {
    res.render("index", { result: null });
});

}
// Playlist API Route
app.get("/playlist", async (req, res) => {
    try {
        let { playlistId } = req.query;
        playlistId = extractPlaylistId(playlistId);
        if (!playlistId) {
            return res.status(400).json({ error: "Playlist ID is required" });
        }

        let videoIds = [];
        let nextPageToken = "";
        let videoDetails = [];

        // Fetch all video IDs from the playlist
        do {
            const playlistResponse = await axios.get(
                `https://www.googleapis.com/youtube/v3/playlistItems`, {
                    params: {
                        part: "contentDetails",
                        maxResults: 50,
                        playlistId,
                        key: YOUTUBE_API_KEY,
                        pageToken: nextPageToken
                    }
                }
            );

            playlistResponse.data.items.forEach(item => {
                videoIds.push(item.contentDetails.videoId);
            });

            nextPageToken = playlistResponse.data.nextPageToken;
        } while (nextPageToken);

        if (videoIds.length === 0) {
            return res.json({ message: "No videos found in the playlist" });
        }

        let totalDurationSeconds = 0;

        // Fetch video details
        for (let i = 0; i < videoIds.length; i += 50) {
            const videoResponse = await axios.get(
                `https://www.googleapis.com/youtube/v3/videos`, {
                    params: {
                        part: "contentDetails,snippet",
                        id: videoIds.slice(i, i + 50).join(","),
                        key: YOUTUBE_API_KEY
                    }
                }
            );

            videoResponse.data.items.forEach(video => {
                const duration = convertDurationToSeconds(video.contentDetails.duration);
                totalDurationSeconds += duration;

                videoDetails.push({
                    videoId: video.id, // ✅ Ensure videoId is included
                    title: video.snippet.title,
                    duration: formatTime(duration),
                });
            });
        }

        // Calculate analytics
        const avgSpeed = calculatePlaybackTime(totalDurationSeconds, 1.25);
        const avgSpeed150 = calculatePlaybackTime(totalDurationSeconds, 1.50);
        const avgSpeed175 = calculatePlaybackTime(totalDurationSeconds, 1.75);
        const doubleSpeed = calculatePlaybackTime(totalDurationSeconds, 2.0);

        res.render("index", {
            result: {
                totalVideos: videoDetails.length,
                totalDuration: formatTime(totalDurationSeconds),
                avgSpeed,
                doubleSpeed,
                avgSpeed150,
                avgSpeed175,
                videos: videoDetails // ✅ Pass video details to frontend
            }
        });

    } catch (error) {
        console.error("Error fetching playlist:", error);
        res.status(500).send("Failed to fetch playlist details");
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
