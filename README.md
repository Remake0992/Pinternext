<h2 align="center">Pinternext</h2>

> A privacy-respecting Pinterest-style image search with no login prompts. Heavily vibe-coded.

<div align="center">

[GitHub](https://github.com/Remake0992/Pinternext)

 </div>

<h2 align="center">Features</h2>

* API-less Pinterest image searching.
* Pinterest does not see the IP of the end user, only the instance IP.
* Image proxy support.
* Pinterest-inspired masonry frontend.

<h2 align="center">Legal notice</h2>

Pinternext doesn't host any content. All content shown by Pinternext is from Pinterest™. Pinterest is a registered trademark of Pinterest Inc. Pinternext is not affiliated with Pinterest Inc. Any issues with content shown on a Pinternext instance need to be reported to Pinterest, not the instance host's internet provider or domain provider.

Cloudflare is a registered trademark of Cloudflare, Inc. Pinternext is not affiliated with Cloudflare, Inc.

<h2 align="center">Install</h2>

Use Docker Compose:

```sh
services:
  pinternext:
    image: ghcr.io/remake0992/pinternext:latest
    ports:
      - "8080:8080"
```

<h3 align="center">Credits</h3>

* [LibreX](https://github.com/hnhx/librex) - a bit of misc code.
* [LibreY](https://github.com/Ahwxorg/LibreY) - image proxy
