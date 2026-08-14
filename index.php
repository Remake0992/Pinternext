<?php require "misc/header.php"; ?>
<title>Pinternext</title>
</head>
<body class="home-page">
    <header class="marketing-header">
        <a class="brand" href="./" aria-label="Pinternext home"><span class="logo-dot">P</span><span>Pinternext</span></a>
        <nav class="header-links" aria-label="Primary navigation">
            <a href="#discover">Discover</a>
            <a href="./donate.php">Support the project</a>
        </nav>
    </header>

    <main class="mainContainer">
        <section class="hero-panel" aria-labelledby="bodyHeader">
            <div class="hero-content">
                <p class="eyebrow">Visual search, without an account</p>
                <h1 id="bodyHeader">Search visual<br>inspiration privately.</h1>
                <p class="hero-copy">Pinternext lets you browse public visual search results without creating an account or sharing a profile.</p>
                <form class="searchContainer" action="search.php" method="get" autocomplete="off" role="search">
                    <label class="sr-only" for="home-search">Search Pinterest images</label>
                    <div id="inputWrapper">
                        <span class="search-icon" aria-hidden="true"></span>
                        <input id="home-search" type="text" name="q" placeholder="Search for recipes, outfits, rooms..." autofocus required maxlength="64" />
                        <button type="submit">Search</button>
                    </div>
                </form>
            </div>
        </section>

        <section class="discovery" id="discover" aria-labelledby="discover-heading">
            <div>
                <p class="eyebrow">Start exploring</p>
                <h2 id="discover-heading">What are you looking for?</h2>
            </div>
            <div class="quick-searches" aria-label="Popular searches">
                <a href="search.php?q=easy+dinners">Easy dinners</a>
                <a href="search.php?q=small+space+ideas">Small spaces</a>
                <a href="search.php?q=outfit+ideas">Outfit ideas</a>
                <a href="search.php?q=garden+design">Garden design</a>
                <a href="search.php?q=art+inspiration">Art inspiration</a>
            </div>
        </section>
    </main>
<?php require "misc/footer.php"; ?>
