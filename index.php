<?php

if (isset($_GET['station_code'])) {
   $url = "http://daten.buergernetz.bz.it/services/meteo/v1/sensors?station_code=" . $_GET['station_code'];
   $ch = curl_init();
      // Will return the response, if false it print the response
   curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
   // Set the url
   curl_setopt($ch, CURLOPT_URL, $url);
   // Execute
   $result = curl_exec($ch) . ',';
   $status_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
   // Closing
   curl_close($ch);
   print_r(rtrim($result, ","));
   return;
} else if ($_GET['foehn']) {
   $url = "http://daten.buergernetz.bz.it/services/weather/foehn?lang=" . $_GET['foehn'] . "&format=json";
   $ch = curl_init();
      // Will return the response, if false it print the response
   curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
   // Set the url
   curl_setopt($ch, CURLOPT_URL, $url);
   // Execute
   $result = curl_exec($ch) . ',';
   $status_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
   // Closing
   curl_close($ch);
   print_r(rtrim($result, ","));
   return;
}


$date = new DateTime();
$apiRequestTimestamp = $date->getTimestamp();
$apiKey = "zcmyfzk32xr5itw5oplnxgmuwjby7sym";
$apiSecret = "p0neabg9fxq6qngxhrf2h3fcfhnz2kbz";

$stationIds = ["92575", "33570"];  // 33570 => Pichlberg     92575 => Satteke

$result = '[';

foreach ($stationIds as $stationId) {

   $parametersToHash = [
      "api-key" => $apiKey,
      "t" => $apiRequestTimestamp,
      "station-id" => $stationId
   ];


   $apiSignature = calculateSignature($apiSecret, $parametersToHash);

   //Get Station IDs

   //$url = "https://api.weatherlink.com/v2/stations?api-key=" . $apiKey . "&api-signature=" . $apiSignature . "&t=" . $apiRequestTimestamp;

   //Get Weather 
   $url = "https://api.weatherlink.com/v2/current/" . $stationId . "?api-key=" . $apiKey . "&api-signature=" . $apiSignature . "&t=" . $apiRequestTimestamp;

/*echo $url;
   echo "<br/>";*/
   //  Initiate curl
   $ch = curl_init();
   // Will return the response, if false it print the response
   curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
   // Set the url
   curl_setopt($ch, CURLOPT_URL, $url);
   // Execute
   $result .= curl_exec($ch) . ',';
   $status_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
   // Closing
   curl_close($ch);
}

$result = rtrim($result, ",") . ']';

// Will dump a beauty json :3
print_r($result);


function calculateSignature($apiSecret, $parametersToHash) {
   ksort($parametersToHash);
   $stringToHash = "";
   foreach ($parametersToHash as $parameterName => $parameterValue) {
       $stringToHash = $stringToHash . $parameterName . $parameterValue;
   }
   $apiSignature = hash_hmac("sha256", $stringToHash, $apiSecret);
   return $apiSignature;
}