<h2 align="center">Pinternext</h2>

> A privacy-respecting Pinterest-style image search with no login prompts. Forked from Binternet with quality of life features added (image previews, theme switcher, infinite scroll). 

<div align="center">

[GitHub](https://github.com/Remake0992/Pinternext)

 </div>

<h2 align="center">Features</h2>

* API-less Pinterest image searching.
* Pinterest does not see the IP of the end user, only the instance IP.
* Image proxy support.
* Pinterest-inspired masonry frontend.

<h2 align="center">Screenshots</h2>

<img width="1470" height="848" alt="image" src="https://github.com/user-attachments/assets/84e44941-ee7f-42e7-8d8b-c1dc45193924" />

<img width="1465" height="856" alt="image" src="https://github.com/user-attachments/assets/17510def-2e49-4a7f-85f7-3784f4d6d0ea" />

<img width="1466" height="848" alt="image" src="https://github.com/user-attachments/assets/332c84de-11f7-4035-a71e-593008d23fb6" />

<img width="1458" height="845" alt="image" src="https://github.com/user-attachments/assets/8d803d1b-cc3d-4593-b6f3-2710bff3600f" />

<h2 align="center">Legal notice</h2>

Pinternext doesn't host any content. All content shown by Pinternext is from Pinterest™. Pinterest is a registered trademark of Pinterest Inc. Pinternext is not affiliated with Pinterest Inc. Any issues with content shown on a Pinternext instance need to be reported to Pinterest, not the instance host's internet provider or domain provider.

Cloudflare is a registered trademark of Cloudflare, Inc. Pinternext is not affiliated with Cloudflare, Inc.

<h2 align="center">Install</h2>

Use Docker Compose:

```sh
services:
  pinternext:
    image: node:20-alpine
    container_name: pinternext
    working_dir: /app
    command: sh -c "npm install && npm run dev"
    ports:
      - "3032:3000"
    volumes:
      - /appdata/pinternext:/app
      - /appdata/pinternext-node-modules:/app/node_modules
    environment:
      - HOST=0.0.0.0
      - PORT=3000
    restart: unless-stopped
```

<h3 align="center">Credits</h3>

* [LibreX](https://github.com/hnhx/librex) - a bit of misc code.
* [LibreY](https://github.com/Ahwxorg/LibreY) - image proxy
