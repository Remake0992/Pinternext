<?php require "misc/header.php"; ?>
<title>Pinternext</title>
</head>
<body>
    <main class="mainContainer home-page">
        <section class="hero-section" id="heroSection">
            <section class="hero-panel" aria-labelledby="bodyHeader">
                <p class="eyebrow">Private visual discovery</p>
                <h1 id="bodyHeader"><span class="logo-dot">P</span>internext</h1>
                <p class="hero-copy">Search Pinterest-style image boards without logging in, then save your favorite searches for fast access.</p>

                <form class="searchContainer" action="search.php" method="get" autocomplete="off" role="search" data-feed-form>
                    <div id="inputWrapper">
                        <input type="text" name="q" placeholder="Search recipes, outfits, rooms..." autofocus required maxlength="64" data-feed-input />
                        <button type="submit">Search</button>
                        <button class="secondary-button" type="button" data-save-feed hidden>Save feed</button>
                    </div>
                </form>
            </section>

            <section class="feed-panel saved-feed-panel" id="savedFeedsPanel" aria-labelledby="feed-title">
                <div class="section-title-row">
                    <div>
                        <p class="eyebrow">Quick access</p>
                        <h2 id="feed-title">Saved feeds</h2>
                    </div>
                </div>
                <p>Jump back into searches you’ve saved. No auto-loading feed, no surprise scroll jumps.</p>
                <div class="saved-feed-list" data-feed-list="quick"></div>
            </section>
        </section>
    </main>
<?php require "misc/footer.php"; ?>
