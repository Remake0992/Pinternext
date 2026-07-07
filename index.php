<?php require "misc/header.php"; ?>
<title>Pinternext</title>
</head>
<body>
    <main class="mainContainer home-page">
        <section class="hero-panel" aria-labelledby="bodyHeader">
            <h1 id="bodyHeader"><span class="logo-dot">P</span>internext</h1>
            <p class="hero-copy">A private, no-login way to discover visual inspiration from Pinterest-style image boards.</p>

            <form class="searchContainer" action="search.php" method="get" autocomplete="off" role="search" data-feed-form>
                <div id="inputWrapper">
                    <input type="text" name="q" placeholder="Search for recipes, outfits, rooms..." autofocus required maxlength="64" data-feed-input />
                    <button type="submit">Search</button>
                    <button class="secondary-button home-save-feed-button" type="button" data-save-feed>Save feed</button>
                </div>
            </form>

            <section class="home-feed-keywords" aria-labelledby="saved-feeds-title">
                <div class="section-title-row compact-title-row">
                    <div>
                        <h2 id="saved-feeds-title">Saved feeds</h2>
                        <p>Keep keyword feeds for searches you revisit often.</p>
                    </div>
                    <span class="saved-feed-count" data-feed-count>0 saved</span>
                </div>
                <div data-feed-keywords></div>
            </section>

        </section>

        <section class="home-saved-feed-panel" aria-labelledby="home-feed-title" data-home-feed-panel hidden>
            <div class="home-feed-panel-header">
                <div>
                    <p class="eyebrow-label">Made from your saved feeds</p>
                    <h2 id="home-feed-title">Ideas picked for you</h2>
                </div>
                <a class="secondary-button compact-button" href="search.php?q=inspiration">Explore more</a>
            </div>
            <div data-feed-list="home"></div>
        </section>
    </main>
<?php require "misc/footer.php"; ?>
