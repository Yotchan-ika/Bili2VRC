# Bili2VRC

A web extension that parses the bilibili video and copies the parsed video URL to the clipboard.

## Features

- Parses bilibili video
- Default parsing service or local parsing without a third-party parser
- Validate CDN links before copying them, including cached links
- Optional diagnostic export and automatic/light/dark appearance
- Video parsing history (to reduce API usage)
- Tutorial
- Supports Chrome, Edge, QQ Browser and Firefox
- Available in English, Simplified Chinese, Traditional Chinese, and Japanese

## Installation

1. Open the store page
   - [Chrome Web Store](https://chromewebstore.google.com/detail/fojgodnomgghdjkfohljapkfbgicddpb)
   - [Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/nlamopbkkcadijajjipdepfmicngablg)
   - [Firefox Browser Add-ons](https://addons.mozilla.org/firefox/addon/bili2vrc/)
2. Click the install button

## Usage

1. Go to bilibili and open the video page you want to play in VRChat.
2. Left-click the "Parse" button or the extension icon.
3. In the URL field of the VRChat video player, press Ctrl+V to paste the URL and start playback

Choose Default parsing or Local parsing in the extension options. The default
service remains selected until you change it. Both channels resolve and validate
an MP4 CDN link before copying it. Cached links are reused only for the same
channel and are checked again before copying.

Link validation checks current reachability, not playback on every VRChat client.
CDN links can expire or be restricted by region, IP address, or the provider.

Local parsing requests Bilibili metadata and the HTML5 MP4 playback API directly
from the extension. It uses no third-party parsing server and sends no login
cookies. It preserves the selected video page and rejects previews, split
audio/video streams and multi-segment results. Availability and quality depend
on Bilibili's public playback response.

Diagnostic logs stay in local extension storage and default to errors only. In
the Support tab you can select the log level and choose which data to export.
Exports may contain video URLs and browsing history; review them before sharing.

## Tests

Run the regression tests with Node.js:

```sh
node --test tests/*.test.cjs
```

## Dependencies

- Manifest V3

## External Web API

This project integrates the following third-party web APIs:

- Bilibili Video Info API (https://api.bilibili.com/x/web-interface/view), developed by Bilibili Inc.
- bilibili-parse (https://github.com/injahow/bilibili-parse), provided by injahow
- Default parsing service: https://api.squidtail.com/bili2vrc/parse/
- Bilibili playback API (Local parsing): https://api.bilibili.com/x/player/playurl

Please note:
- These APIs are not part of this project's codebase — they are externally maintained by their respective developers.
- All usage is subject to and must comply with the original developers' terms of use, privacy policies, and other applicable license agreements.
- I do not claim ownership of nor are we responsible for the APIs' availability, usage limits, billing, or data handling—these are managed solely by the API providers.

By using this project, you agree to abide by the external API providers' legal terms and policies.

## Author

Yotchan-ika (Squidtail)

Contact: [contact@squidtail.com](mailto:contact@squidtail.com)

## License

This project is licensed under a custom restrictive license.
See [LICENSE.txt](./LICENSE.txt) for details.
