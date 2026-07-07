<?php require "misc/header.php"; ?>
<title>Pinternext</title>
</head>
<body>
    <main class="mainContainer centered">
        <section class="hero-panel" aria-labelledby="bodyHeader">
            <h1 id="bodyHeader"><span class="logo-dot">P</span>internext</h1>
            <p class="hero-copy">A private, no-login way to discover visual inspiration from Pinterest-style image boards.</p>

            <form class="searchContainer" action="search.php" method="get" autocomplete="off" role="search" data-feed-form>
                <div id="inputWrapper">
                    <input type="text" name="q" placeholder="Search for recipes, outfits, rooms..." autofocus required maxlength="64" data-feed-input />
                    <button type="submit">Search</button>
                </div>
            </form>

            <section class="home-feed-keywords" aria-labelledby="saved-feeds-title">
                <div class="section-title-row compact-title-row">
                    <h2 id="saved-feeds-title">Saved feeds</h2>
                    <p>Your saved keywords</p>
                </div>
                <div data-feed-keywords></div>
            </section>

        </section>
    </main>
<?php require "misc/footer.php"; ?>
