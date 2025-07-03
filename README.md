# Bili2VRC

A web extension that parseS the bilibili video and copies the parsed video URL to the clipboard.

## Features

- Parses bilibili video
- Video parsing history (to reduce API usage)
- Tutorial
- Supports Chrome, Edge, QQ Browser and Firefox
- Available in English, Simplified Chinese, Traditional Chinese, and Japanese

## Installation

1. Open the store page
   - [Chrome Web Store](https://chromewebstore.google.com/detail/fojgodnomgghdjkfohljapkfbgicddpb)
   - [Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/nlamopbkkcadijajjipdepfmicngablg)
   - Firefox Browser Add-ons (preparing)
2. Click the install button

## Usage

1. Go to bilibili and open the video page you want to play in VRChat.
2. Left-click the "Parse" button or the extension icon.
3. In the URL field of the VRChat video player, press Ctrl+V to paste the URL and start playback

## Dependencies

- Manifest V3

## External Web API

This project integrates the following third-party web APIs:

- Bilibili Video Info API (https://api.bilibili.com/x/web-interface/view), developed by Bilibili Inc.
- [bilibili-parse](https://github.com/injahow/bilibili-parse) (https://api.injahow.cn/bparse/), provided by injahow

Please note:
- These APIs are not part of this project's codebase — they are externally maintained by their respective developers.
- All usage is subject to and must comply with the original developers' terms of use, privacy policies, and other applicable license agreements.
- I do not claim ownership of nor are we responsible for the APIs' availability, usage limits, billing, or data handling—these are managed solely by the API providers.

By using this project, you agree to abide by the external API providers' legal terms and policies.

## Author

Yotchan-ika (Squidtail)

Contact: [squidtail.contact@gmail.com](mailto:squidtail.contact@gmail.com)

## License

This project is licensed under a custom restrictive license.
See [LICENSE.txt](./LICENSE.txt) for details.