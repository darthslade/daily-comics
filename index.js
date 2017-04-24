/* global Promise */
var request = require('request');
var cheerio = require('cheerio');
var readYaml = require('read-yaml');

var comicsList = [];
var comicRequests = [];

/* Format Comic URL with name of comic
--------------------------------------------------------------------------- */
var formatComicsUrl = function(type, comic) {
    var results = {
        url: null,
        selector: {}
    };

    switch (type) {
        case 'gocomics':
            results.url = `http://www.gocomics.com/${comic}`;
            results.selector.title = '.gc-feature-header-link@title';
            results.selector.img = '.item-comic-image > img';
            break;
        case 'arcamax':
            results.url = `https://www.arcamax.com/thefunnies/${comic}/`;
            results.selector.title = 'meta[property="og:title"]@content';
            results.selector.img = 'img.the-comic';
            break;
    }
    return results;
};

function getComicStrip(comic) {
    return new Promise(function(resolve, reject) {
        request(comic.url, function(err, response, body) {
            if (err) { reject(err); }
            if (response.statusCode !== 200) {
                reject('Invalid status code: ' + response.statusCode);
            }

            var  $ = cheerio.load(body);
            var selector = comic.selector.title.split('@');

            var comicstrip = {
                title: $(selector[0]).attr(selector[1]),
                image: $(comic.selector.img)[0].attribs.src
            };

            // TODO: 1) Save image into today's folder 2017/04/24/{comic}.jpg

            resolve(comicstrip);
        });
    });
}

/* Read list of comics and pull images from site
--------------------------------------------------------------------------- */
readYaml('comics-list.yml', function(err, data) {
    if (err) { throw err; }

    // 1) Format comic urls
    data.comics.forEach(function(comics) {
        comics.items.forEach(function(comic) {
            // TODO: 1) if there is a image with same name as `comic` in today's folder, skip it.
            // TODO: 2) if all images have been skipped, open today's `index.html` page
            var results = formatComicsUrl(comics.url, comic);
            if (results.url) { comicsList.push(results); }
        });
    });

    // 2) Scrape title & images from website
    for (var item in comicsList) {
        if (comicsList.hasOwnProperty(item)) {
            comicRequests.push(getComicStrip(comicsList[item]));
        }
    }

    // 3) Build/update index pages
    Promise.all(comicRequests).then(function() {
        console.log('complete');
        // TODO: 1) add all images + title to `index.html` inside today's folder
        // TODO: 2) open `index.html` in browser
    });

});

// var request = require('request'),
//     fs      = require('fs'),
//     url     = 'http://upload.wikimedia.org/wikipedia/commons/8/8c/JPEG_example_JPG_RIP_025.jpg';

// request(url, {encoding: 'binary'}, function(error, response, body) {
//   fs.writeFile('./downloaded.jpg', body, 'binary', function (err) {});
// });
