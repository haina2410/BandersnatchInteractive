# Bandersnatch Interactive Player

Watch Bandersnatch in your browser and make choices that determine what happens next.

## Run with Docker

Build the static site and serve it with unprivileged NGINX.

```sh
docker build -t bandersnatch-player .
docker run --rm -p 8080:8080 bandersnatch-player
```

Open [http://localhost:8080](http://localhost:8080) and select **Play film**. The browser streams the film from its host. The image contains the player and subtitles.

## Playback

The configured source is a Matroska file with HEVC video. Use Chrome or Edge on a device with HEVC playback support. Select subtitles in the playback toolbar and choose the language of interactive choices on the start screen.

The player resumes from a bookmarked scene or your saved position. **Reset progress** clears saved choices and watch history.

| Key | Action |
| --- | --- |
| Space or K | Play or pause |
| J / L | Seek back or forward 10 seconds |
| ← / → | Jump to the previous or next segment or interaction |
| ↓ / ↑ | Slow down or speed up |
| F | Toggle fullscreen |
| R | Restart the video |

## Change the video source

Edit `VIDEO_URL` in `assets/scripts.js` and rebuild the image. Use an HTTPS URL that streams the full 5:12:14 cut with the same scene timings and supports HTTP range requests. A browser-compatible encoding of that cut works with the existing choices and subtitles.

## Credits

Based on the [original player by joric](https://github.com/joric/bandersnatch/), with contributions from [mohetios](https://github.com/mohetios) and [CyberShadow](https://github.com/CyberShadow).
