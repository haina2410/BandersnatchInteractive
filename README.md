# Bandersnatch Interactive Player

Watch Bandersnatch in your browser and make choices that determine what happens next.

## Run with Docker

Build the static site and serve it with unprivileged NGINX.

```sh
docker compose up -d --build
```

Open [http://localhost:1984](http://localhost:1984) and select **Play film**. Stop the player with `docker compose down`.

To use Docker without Compose:

```sh
docker build -t bandersnatch-player .
docker run --rm -p 1984:8080 bandersnatch-player
```

The browser streams the film from its host. The image contains the player and subtitles.

## Playback

The configured source is a Matroska file with HEVC video. Use Chrome or Edge on a device with HEVC playback support. Select subtitles and volume in the playback toolbar and choose the language of interactive choices on the start screen.

The start screen shows **Continue watching** when there is a bookmarked scene or a saved position. **Start from the beginning** plays the film again and keeps the saved choices. **Erase saved choices** clears the choices and the saved position. The player keeps the choice language, subtitle language and volume.

The player has no timeline, because the film has no fixed length: the choices set the path, and some paths go back to an earlier scene. The start screen shows how many of the 250 scenes you have seen.

Open **Story tree** from the start screen or playback controls to see how choices connect. The dot marks your current stage. Select any stage to jump straight to its choice prompt or the start of its scene.

During a choice, the answer that you pick stays marked in blue. If you do not answer, the player uses the answer that the line below the choices names.

| Key | Action |
| --- | --- |
| 1 / 2 | Pick a choice (0–9 type digits on the phone keypad) |
| Space or K | Play or pause |
| ← / → | Go back or forward 10 seconds in the current scene |
| J / L | Jump to the previous or next segment or interaction |
| M | Mute |
| C | Subtitles on or off |
| F | Toggle fullscreen |
| R | Restart the video |

## Change the video source

Edit `VIDEO_URL` in `assets/scripts.js` and rebuild the image. Use an HTTPS URL that streams the full 5:12:14 cut with the same scene timings and supports HTTP range requests. A browser-compatible encoding of that cut works with the existing choices and subtitles.

## Credits

This edition is by [haina2410](https://github.com/haina2410). It is based on the [original player by joric](https://github.com/joric/bandersnatch/), with contributions from [mohetios](https://github.com/mohetios) and [CyberShadow](https://github.com/CyberShadow).
