<?php require "misc/header.php"; ?>
<title>Pinternext</title>
</head>
<body>
    <main class="mainContainer centered">
        <section class="hero-panel" aria-labelledby="bodyHeader">
            <h1 id="bodyHeader"><span class="logo-dot">P</span>internext</h1>
            <p class="hero-copy">A private, no-login way to discover visual inspiration from Pinterest-style image boards.</p>

            <form class="searchContainer" action="search.php" method="get" autocomplete="off" role="search">
                <div id="inputWrapper">
                    <input type="text" name="q" placeholder="Search for recipes, outfits, rooms..." autofocus required maxlength="64" />
                    <button type="submit">Search</button>
                </div>
            </form>

            <nav class="quick-searches" aria-label="Quick searches">
                <a href="search.php?q=interior%20design">Interior design</a>
                <a href="search.php?q=streetwear">Streetwear</a>
                <a href="search.php?q=recipes">Recipes</a>
                <a href="search.php?q=wallpaper">Wallpaper</a>
            </nav>
        </section>
    </main>
<?php require "misc/footer.php"; ?>
