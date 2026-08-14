<?php

const PINTERNEXT_IMAGE_CACHE_TTL = 604800;
const PINTERNEXT_IMAGE_CACHE_MAX_BYTES = 536870912;
const PINTERNEXT_IMAGE_MAX_BYTES = 26214400;

function pinternext_image_cache_directory(): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "pinternext-image-cache";
}

function pinternext_image_cache_paths(string $url): array
{
    $key = hash("sha256", $url);
    $directory = pinternext_image_cache_directory();
    return [
        "image" => $directory . DIRECTORY_SEPARATOR . $key . ".image",
        "metadata" => $directory . DIRECTORY_SEPARATOR . $key . ".json",
    ];
}

function pinternext_send_cached_image(string $image_file, array $metadata): void
{
    $etag = '"' . hash("sha256", $image_file . filemtime($image_file) . filesize($image_file)) . '"';
    header("Content-Type: " . $metadata["content_type"]);
    header("Cache-Control: public, max-age=86400, stale-while-revalidate=604800");
    header("ETag: " . $etag);

    if (($_SERVER["HTTP_IF_NONE_MATCH"] ?? "") === $etag) {
        http_response_code(304);
        return;
    }

    header("Content-Length: " . filesize($image_file));
    readfile($image_file);
}

function pinternext_read_image_cache(string $url): bool
{
    $paths = pinternext_image_cache_paths($url);
    if (!is_file($paths["image"]) || !is_file($paths["metadata"]) || filemtime($paths["image"]) < time() - PINTERNEXT_IMAGE_CACHE_TTL) {
        return false;
    }

    $metadata = json_decode(file_get_contents($paths["metadata"]), true);
    if (!is_array($metadata) || !isset($metadata["content_type"]) || !str_starts_with($metadata["content_type"], "image/")) {
        return false;
    }

    pinternext_send_cached_image($paths["image"], $metadata);
    return true;
}

function pinternext_cleanup_image_cache(string $directory): void
{
    if (random_int(1, 100) !== 1) {
        return;
    }

    $images = glob($directory . DIRECTORY_SEPARATOR . "*.image") ?: [];
    usort($images, fn ($first, $second) => filemtime($first) <=> filemtime($second));
    $total_size = 0;

    foreach ($images as $image) {
        $size = filesize($image);
        if (filemtime($image) < time() - PINTERNEXT_IMAGE_CACHE_TTL || $total_size + $size > PINTERNEXT_IMAGE_CACHE_MAX_BYTES) {
            @unlink($image);
            @unlink(substr($image, 0, -6) . ".json");
            continue;
        }
        $total_size += $size;
    }
}

function pinternext_write_image_cache(string $url, string $body, string $content_type): void
{
    $directory = pinternext_image_cache_directory();
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        return;
    }

    pinternext_cleanup_image_cache($directory);
    $paths = pinternext_image_cache_paths($url);
    $temporary_image = tempnam($directory, "image-");
    $temporary_metadata = tempnam($directory, "metadata-");
    if ($temporary_image === false || $temporary_metadata === false) {
        return;
    }

    file_put_contents($temporary_image, $body, LOCK_EX);
    file_put_contents($temporary_metadata, json_encode(["content_type" => $content_type]), LOCK_EX);
    rename($temporary_image, $paths["image"]);
    rename($temporary_metadata, $paths["metadata"]);
}

function pinternext_fetch_image(string $url): ?array
{
    $response = "";
    $content_type = "";
    $too_large = false;
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_ENCODING => "",
        CURLOPT_USERAGENT => "Mozilla/5.0 (compatible; Pinternext/1.0)",
        CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$content_type) {
            if (stripos($header, "Content-Type:") === 0) {
                $content_type = trim(explode(";", trim(substr($header, 13)), 2)[0]);
            }
            return strlen($header);
        },
        CURLOPT_WRITEFUNCTION => function ($curl, $chunk) use (&$response, &$too_large) {
            if (strlen($response) + strlen($chunk) > PINTERNEXT_IMAGE_MAX_BYTES) {
                $too_large = true;
                return 0;
            }
            $response .= $chunk;
            return strlen($chunk);
        },
    ]);

    $success = curl_exec($curl) && curl_getinfo($curl, CURLINFO_RESPONSE_CODE) === 200;

    if (!$success || $too_large || !str_starts_with($content_type, "image/") || $response === "") {
        return null;
    }

    return ["body" => $response, "content_type" => $content_type];
}

$url = $_GET["url"] ?? "";
$parsed_url = parse_url($url);
$host = strtolower($parsed_url["host"] ?? "");
$is_allowed_host = $host === "pinimg.com" || str_ends_with($host, ".pinimg.com");

if (($parsed_url["scheme"] ?? "") !== "https" || !$is_allowed_host) {
    http_response_code(400);
    exit();
}

if (pinternext_read_image_cache($url)) {
    exit();
}

$image = pinternext_fetch_image($url);
if ($image === null) {
    http_response_code(502);
    exit();
}

pinternext_write_image_cache($url, $image["body"], $image["content_type"]);
header("Content-Type: " . $image["content_type"]);
header("Cache-Control: public, max-age=86400, stale-while-revalidate=604800");
header("Content-Length: " . strlen($image["body"]));
echo $image["body"];
