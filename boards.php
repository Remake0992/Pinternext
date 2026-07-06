<?php require "misc/header.php"; ?>
<title>Boards - Pinternext</title>
</head>
<body>
    <main class="boards-page" data-boards-page>
        <section class="boards-hero" aria-labelledby="boards-title">
            <a class="no-decoration accent logo-wordmark" href="./"><span class="logo-dot">P</span>internext</a>
            <h1 id="boards-title">Your boards</h1>
            <p>Create Pinterest-style boards, rename and reorder them, choose covers, and drag pins into your preferred order. Boards are stored privately in this browser.</p>

            <form class="board-create-form" data-board-create-form autocomplete="off">
                <input type="text" name="boardName" placeholder="New board name" required maxlength="48" data-board-name-input>
                <button type="submit">Create board</button>
            </form>
        </section>

        <section class="boards-grid" data-boards-list aria-live="polite"></section>
    </main>
<?php require "misc/footer.php"; ?>
