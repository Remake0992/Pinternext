<?php require "misc/header.php"; ?>
<title>Pinternext</title>
</head>
<body>
    <main class="mainContainer">
        <!-- Hero Section -->
        <section class="hero-section" id="heroSection">
            <section class="hero-panel" aria-labelledby="bodyHeader">
                <h1 id="bodyHeader"><span class="logo-dot">P</span>internext</h1>
                <p class="hero-copy">A private, no-login way to discover visual inspiration from Pinterest-style image boards.</p>

                <form class="searchContainer" action="search.php" method="get" autocomplete="off" role="search" data-feed-form>
                    <div id="inputWrapper">
                        <input type="text" name="q" placeholder="Search for recipes, outfits, rooms..." autofocus required maxlength="64" data-feed-input />
                        <button type="submit">Search</button>
                        <button class="secondary-button" type="button" data-save-feed hidden>Save feed</button>
                    </div>
                </form>
            </section>
        </section>

        <!-- Feed Section -->
        <section class="feed-section" id="feedSection" hidden>
            <div class="feed-header">
                <h2>Your Combined Feed</h2>
                <button class="secondary-button" id="toggleHeroButton">Back to search</button>
            </div>

            <div class="feed-manager" id="feedManager">
                <p>Saved feeds</p>
                <div class="feed-manager-chips" id="feedManagerChips"></div>
            </div>

            <div class="feed-container">
                <div class="feed-image-grid" id="feedImageGrid"></div>
                <div class="feed-load-status" id="feedLoadStatus">Loading your feed...</div>
                <div class="feed-sentinel" id="feedSentinel"></div>
            </div>
        </section>

        <!-- Saved Feeds Panel (shown only on hero) -->
        <section class="feed-panel" id="savedFeedsPanel" aria-labelledby="feed-title">
            <div class="section-title-row">
                <h2 id="feed-title">Your feed</h2>
            </div>
            <p>Save searches and their images will show up here.</p>
            <div class="saved-feed-list" data-feed-list></div>
        </section>
    </main>
<?php require "misc/footer.php"; ?>
<script src="/static/combined-feed-scroll.js" defer></script>
