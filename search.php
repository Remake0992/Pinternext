<?php
$query = trim($_REQUEST["q"] ?? '');

if (strlen($query) < 1 || strlen($query) > 64) {
    header("Location: ./");
    exit();
}

$query_escaped = htmlspecialchars($query, ENT_QUOTES, 'UTF-8');
require "misc/header.php";
?>
<title><?php echo $query_escaped; ?> - Pinternext</title>
</head>
<body class="search-page">
    <header class="search-container">
        <a class="brand" href="./" aria-label="Pinternext home"><span class="logo-dot">P</span><span>Pinternext</span></a>
        <form class="search-input-row" action="search.php" method="get" autocomplete="off" role="search">
            <label class="sr-only" for="results-search">Search Pinterest images</label>
            <span class="search-icon" aria-hidden="true"></span>
            <input id="results-search" type="text" name="q" placeholder="Search images" value="<?php echo $query_escaped; ?>" required maxlength="64">
            <button type="submit">Search</button>
    </form>
        <a class="header-support" href="./donate.php">Support Pinternext</a>
    </header>

    <main>
        <section class="results-heading" aria-labelledby="results-title">
            <p class="eyebrow">Search results</p>
            <h2 id="results-title">Ideas for “<?php echo $query_escaped; ?>”</h2>
            <p>Browse the collection and open any image for a closer look.</p>
        </section>

<?php
// Fetching query and optional parameters
$bookmark = $_GET["bookmark"] ?? null;
$csrftoken = $_GET["csrftoken"] ?? null;

// Pinterest API endpoint
$url = "https://www.pinterest.com/resource/BaseSearchResource/get/";

class SearchResult
{
    public $images;
    public $bookmark;
}

// Header function to capture CSRF token from response
$header_function = function ($ch, $rawheader) use (&$csrftoken) {
    if (preg_match('/^set-cookie:\s*csrftoken=([^;]*)/', $rawheader, $matches)) {
        $csrftoken = $matches[1];
    }
    return strlen($rawheader);
};

// Prepare CURL object for search request
$prepare_search_curl_obj = function ($query, $bookmark) use ($url, $header_function, $csrftoken) {
    $data_param_obj = [
        "options" => [
            "query" => $query,
        ],
    ];
    
    if ($bookmark !== null) {
        $data_param_obj["options"]["bookmarks"] = [$bookmark];
    }

    $data_param = urlencode(json_encode($data_param_obj));
    $headers = [
        "x-pinterest-pws-handler: www/search/[scope].js"
    ];
    
    if ($csrftoken !== null) {
        $headers[] = "x-csrftoken: $csrftoken";
        $headers[] = "cookie: csrftoken=$csrftoken";
    }

    $finalurl = $bookmark === null ? "$url?data=$data_param" : $url;
    
    $ch = curl_init($finalurl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADERFUNCTION, $header_function);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    if ($bookmark !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, "data=$data_param");
    }
    
    return $ch;
};

// Function to perform the search and display results
$search = function ($query, $bookmark) use ($prepare_search_curl_obj) {
    $ch = $prepare_search_curl_obj($query, $bookmark);
    $response = curl_exec($ch);
    curl_close($ch);
    $data = json_decode($response);
    
    $images = [];
    echo "<div class='img-container' role='feed' aria-label='Masonry image feed'>";
    
    if ($data && isset($data->resource_response->data->results)) {
        foreach ($data->resource_response->data->results as $result) {
            if (!isset($result->images->orig->url)) {
                continue;
            }

            $url = $result->images->orig->url;
            $width = isset($result->images->orig->width) ? (int) $result->images->orig->width : 0;
            $height = isset($result->images->orig->height) ? (int) $result->images->orig->height : 0;
            if ($width < 1 || $height < 1) {
                $width = 2;
                $height = 3;
            }

            $images[] = $url;
            $proxy_url = "/image_proxy.php?url=" . urlencode($url);
            $safe_proxy_url = htmlspecialchars($proxy_url, ENT_QUOTES, 'UTF-8');
            $safe_title = htmlspecialchars($query, ENT_QUOTES, 'UTF-8');
            echo "<article class='img-result' data-pin-width='$width' data-pin-height='$height' style='--pin-w:$width;--pin-h:$height'>";
            echo "<a class='pin-open-link' href='$safe_proxy_url' rel='noopener noreferrer'>";
            echo "<img loading='lazy' decoding='async' width='$width' height='$height' src='$safe_proxy_url' alt='Pinterest result for $safe_title'></a>";
            echo "</article>";
        }
    }
    
    if (count($images) === 0) {
        echo "<div class='empty-state'><h2>No results found</h2><p>Try another search term or check back later.</p></div>";
    }

    echo "</div>";
    
    $result = new SearchResult();
    $result->images = $images;
    
    if (isset($data->resource_response->bookmark)) {
        $result->bookmark = $data->resource_response->bookmark;
    }
    
    return $result;
};

$result = $search($query, $bookmark);
$images = $result->images;

// Pagination link for the next page
if ($result->bookmark !== null) {
    $query_encoded = urlencode($query);
    $bookmark_encoded = urlencode($result->bookmark);
    $csrftoken_encoded = $csrftoken ? urlencode($csrftoken) : "";

    echo "<section class='next-page' aria-live='polite'><a class='button-link' href='/search.php?q=$query_encoded&bookmark=$bookmark_encoded&csrftoken=$csrftoken_encoded'>Load more ideas</a></section>";
}
?>
    </main>
    <script src="/static/masonry.js?v=1"></script>
    <script src="/static/infinite-scroll.js?v=2" defer></script>
<?php include "misc/footer.php"; ?>
