<?php

const PINTERNEXT_AI_LABEL_CACHE_TTL = 86400;
const PINTERNEXT_AI_LABEL_MAX_CONCURRENCY = 4;

function pinternext_ai_label_cache_file(string $pin_id): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR . "pinternext-ai-label-cache"
        . DIRECTORY_SEPARATOR . hash("sha256", $pin_id);
}

function pinternext_read_ai_label_cache(string $pin_id): ?bool
{
    $cache_file = pinternext_ai_label_cache_file($pin_id);
    if (!is_file($cache_file) || filemtime($cache_file) < time() - PINTERNEXT_AI_LABEL_CACHE_TTL) {
        return null;
    }

    $value = file_get_contents($cache_file);
    if ($value === "ai") {
        return true;
    }
    if ($value === "not-ai") {
        return false;
    }

    return null;
}

function pinternext_cache_ai_label(string $pin_id, bool $is_ai_modified): void
{
    $cache_directory = dirname(pinternext_ai_label_cache_file($pin_id));
    if (!is_dir($cache_directory) && !@mkdir($cache_directory, 0700, true) && !is_dir($cache_directory)) {
        return;
    }

    @file_put_contents(
        pinternext_ai_label_cache_file($pin_id),
        $is_ai_modified ? "ai" : "not-ai",
        LOCK_EX
    );
}

function pinternext_ai_label_request(string $pin_id)
{
    $curl = curl_init("https://www.pinterest.com/pin/" . rawurlencode($pin_id) . "/");
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ["User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"],
    ]);

    return $curl;
}

/**
 * Returns only successfully determined labels. Pins whose pages cannot be
 * fetched are deliberately omitted so ordinary results remain visible.
 */
function pinternext_get_ai_labels(array $pin_ids): array
{
    $labels = [];
    $pending = [];

    foreach (array_unique($pin_ids) as $pin_id) {
        $pin_id = (string) $pin_id;
        if (!preg_match("/^\\d+$/", $pin_id)) {
            continue;
        }

        $cached_label = pinternext_read_ai_label_cache($pin_id);
        if ($cached_label !== null) {
            $labels[$pin_id] = $cached_label;
        } else {
            $pending[] = $pin_id;
        }
    }

    if (!$pending) {
        return $labels;
    }

    $multi = curl_multi_init();
    $handles = [];

    while ($pending || $handles) {
        while ($pending && count($handles) < PINTERNEXT_AI_LABEL_MAX_CONCURRENCY) {
            $pin_id = array_shift($pending);
            $curl = pinternext_ai_label_request($pin_id);
            $handles[spl_object_id($curl)] = ["curl" => $curl, "pin_id" => $pin_id];
            curl_multi_add_handle($multi, $curl);
        }

        do {
            $status = curl_multi_exec($multi, $running);
        } while ($status === CURLM_CALL_MULTI_PERFORM);

        while ($info = curl_multi_info_read($multi)) {
            $key = spl_object_id($info["handle"]);
            $handle = $handles[$key];
            $response = curl_multi_getcontent($info["handle"]);
            $http_status = curl_getinfo($info["handle"], CURLINFO_RESPONSE_CODE);

            if ($info["result"] === CURLE_OK && $http_status === 200 && is_string($response)) {
                $is_ai_modified = str_contains($response, 'data-test-id="ai-generated-label"')
                    || str_contains($response, 'title="AI modified"');
                $labels[$handle["pin_id"]] = $is_ai_modified;
                pinternext_cache_ai_label($handle["pin_id"], $is_ai_modified);
            }

            curl_multi_remove_handle($multi, $info["handle"]);
            curl_close($info["handle"]);
            unset($handles[$key]);
        }

        if ($running) {
            $selected = curl_multi_select($multi, 1.0);
            if ($selected === -1) {
                usleep(10000);
            }
        }
    }

    curl_multi_close($multi);
    return $labels;
}
