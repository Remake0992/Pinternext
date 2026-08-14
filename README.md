<h2 align="center">Pinternext</h2>

> A privacy-respecting Pinterest-style image search with no login prompts. Forked from Binternet with quality of life features added (image previews, theme switcher, caching, infinite scroll). 

<div align="center">

[GitHub](https://github.com/Remake0992/Pinternext)

 </div>

<h2 align="center">Features</h2>

* API-less Pinterest image searching.
* Pinterest does not see the IP of the end user, only the instance IP.
* Image proxy support.
* Pinterest-inspired masonry frontend.
* AI filter

<h2 align="center">Screenshots</h2>

<img width="1486" height="858" alt="image" src="https://github.com/user-attachments/assets/24531f68-1170-4c2a-b2c0-b85eae949784" />

<img width="1486" height="858" alt="image" src="https://github.com/user-attachments/assets/1d9f1262-a6a8-4951-85a9-97e5b99601e2" />

<img width="1480" height="852" alt="image" src="https://github.com/user-attachments/assets/45ca08ca-8aae-4d32-82c1-44cafcbb474d" />

<img width="1481" height="854" alt="image" src="https://github.com/user-attachments/assets/3a728ab3-56cc-4e4c-948b-11ba4f72def8" />

<h2 align="center">Legal notice</h2>

Pinternext doesn't host any content. All content shown by Pinternext is from Pinterest™. Pinterest is a registered trademark of Pinterest Inc. Pinternext is not affiliated with Pinterest Inc. Any issues with content shown on a Pinternext instance need to be reported to Pinterest, not the instance host's internet provider or domain provider.

Cloudflare is a registered trademark of Cloudflare, Inc. Pinternext is not affiliated with Cloudflare, Inc.

<h2 align="center">Install</h2>

Use Docker Compose:

```sh
services:
  pinternext:
    container_name: pinternext
    image: ghcr.io/remake0992/pinternext:latest
    ports:
      - "8080:8080"
    restart: unless-stopped
```

<h3 align="center">Credits</h3>

* [Binternet](https://github.com/Ahwxorg/Binternet) - Original Frontend.
* [LibreX](https://github.com/hnhx/librex) - Misc code.
* [LibreY](https://github.com/Ahwxorg/LibreY) - Image proxy.
