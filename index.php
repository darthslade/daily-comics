<?php
header('Content-Type: text/html');
exec('mode=php /usr/local/bin/node index.js', $output);

$doc = new DOMDocument();
$doc->loadHTML(implode("\n", $output));

// get current folder
$body = $doc->getElementsByTagName('body')->item(0);
$folder = $body->getAttribute('data-folder');

// update all image paths to include current folder
$images = $doc->getElementsByTagName('img');
foreach($images as $image) {
    $src = $image->getAttribute('src');
    $image->setAttribute('src', "$folder/$src");
}
// display results
echo $doc->saveHTML();
