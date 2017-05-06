# Daily Comics

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://david-dm.org/misega/daily-comics.svg)](https://david-dm.org/misega/daily-comics)

## Project Goal
Parse a custom list of comics from various online sources and view them all on one page

## Requirements
Requires: [Node.js and npm 3+](https://docs.npmjs.com/getting-started/installing-node); Optional: [PHP](http://www.php.net/)

## View Comics
### Installation
1. [Fork the repo](https://github.com/misega/daily-comics/fork)
1. `git clone https://github.com/misega/daily-comics.git`
1. `cd daily-comics`
1. `node index.js` starts pulling comics then displays results in a browser.<br>
    Optionally, you could just view `index.php` in the browser.<br>
    `index.php` will only work via a PHP-capable server (e.g. Apache, Nginx)

### Edit List of Comics

Open `comics-list.yml`, currently pulls from `gocomics` and `arcamax`<br>
 -- `file` is the url-formatted name of the comic<br>
 -- `name` is the display name<br>


## Issues and Feedback
Found an issue, have an idea? [github.com/misega/daily-comics/issues](https://github.com/misega/daily-comics/issues)
