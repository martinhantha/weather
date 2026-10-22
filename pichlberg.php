<?php
/**
 * Upload this file to the PHP app on 45.144.187.11 (document root /html/).
 * It forwards one URL only: the Pichlberg station, which accepts that server's IP.
 *
 * Call: https://<domain-of-that-project>/pichlberg.php
 */

$url = 'http://89.190.166.17:8081/v1/current_conditions';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
]);

$body = curl_exec($ch);
$error = curl_error($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($body === false || $code === 0) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => $error ?: 'upstream unreachable']);
    return;
}

http_response_code($code);
header('Content-Type: application/json');
echo $body;
