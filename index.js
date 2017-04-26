/* global Promise */
var url = require('url');
var path = require('path');
var fs = require('fs-jetpack');
var request = require('request');
var cheerio = require('cheerio');
var readYaml = require('read-yaml');
var dateFormat = require('dateformat');

var now = new Date();
var folder = path.join('./archive', dateFormat(now, 'yyyy/mm/dd'));

var comicsRequestList = []; // single list of formatted comic urls
var comicPromiseList = []; // promise list of image requests

var divider = function() {
    var cols = process.stdout.columns;
    return Array.apply(null, { length: cols }).join('-').slice(0, cols);
};

/* Format Comic URL with name of comic
--------------------------------------------------------------------------- */
var formatComicsUrl = function(type, comic) {
    var results = {
        url: null,
        selector: {}
    };

    // Kludge: Would prefer the HTML5 Template Literal to be stored in the yaml file along with each list
    // but it's a pain to `eval` the template then parse. It's easier to store it in this `switch` statement.
    switch (type) {
        case 'gocomics':
            results.url = `http://www.gocomics.com/${comic.file}`;
            results.selector.img = '.item-comic-image > img';
            break;
        case 'arcamax':
            results.url = `https://www.arcamax.com/thefunnies/${comic.file}/`;
            results.selector.img = 'img.the-comic';
            break;
    }
    results.name = comic.file;
    return results;
};

var showDownloadingProgress = function(msg, received, total) {
    var percentage = ((received * 100) / total).toFixed(2);
    process.stdout.write(msg + percentage + '%\r');
    if (percentage >= 100) { process.stdout.write('\n'); }
};

var formatLocalFileName = function(file, name, type) {
    var extension = path.extname(file).slice(1);
    if (!extension) { extension = type.split('/')[1]; }
    return name + '.' + extension;
};

/* Download image to local folder
--------------------------------------------------------------------------- */
var saveImage = function(remote_file, name, callback) {
    return new Promise(function(resolve, reject) {
        var received_bytes = 0;
        var total_bytes = 0;
        var msg = ' - ' + name + ': ';

        var r = request.get(remote_file)
            .on('error', function(err) {
                if (err) { reject(err); }
            })
            .on('response', function(response) {
                total_bytes = parseInt(response.headers['content-length']);
                var localFile = formatLocalFileName(remote_file, name, response.headers['content-type']);
                // Save file to local folder
                r.pipe(fs.createWriteStream(path.join(folder, localFile)));
            })
            .on('data', function(chunk) {
                received_bytes += chunk.length;
                showDownloadingProgress(msg, received_bytes, total_bytes);
            })
            .on('end', resolve);
    });
};

/* Find image and title within the web page
--------------------------------------------------------------------------- */
function getComicStrip(comic) {
    return new Promise(function(resolve, reject) {
        request(comic.url, function(err, response, body) {
            if (err) { reject(err); }
            if (response.statusCode !== 200) {
                reject('Invalid status code: ' + response.statusCode);
            }

            var  $ = cheerio.load(body);
            var img = $(comic.selector.img)[0].attribs.src;

            // @url.resolve - concat relative urls with their hostname to create an absolute url
            var comicstrip = {
                image: url.resolve(comic.url, img)
            };

            saveImage(comicstrip.image, comic.name).then(function() {
                resolve(comicstrip);
            });
        });
    });
}

/* Read list of comics and pull images from site
--------------------------------------------------------------------------- */
readYaml('comics-list.yml', function(err, data) {
    if (err) { throw err; }

    // 1) Format comic urls
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    data.comics.forEach(function(comics) {
        comics.items.forEach(function(comic) {
            var file = fs.dir(folder).find('.', { matching: '*' + comic.file + '*' });
            if (!file.length) {
                var results = formatComicsUrl(comics.url, comic);
                if (results.url) { comicsRequestList.push(results); }
            }
        });
    });

    // 2) Scrape title & images from website
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    if (comicsRequestList.length) {
        console.log('Saving Comics:\n' + divider());
    }
    for (var item in comicsRequestList) {
        if (comicsRequestList.hasOwnProperty(item)) {
            comicPromiseList.push(getComicStrip(comicsRequestList[item]));
        }
    }
    if (comicsRequestList.length) {
        console.log(divider());
    }

    // 3) Build/update index pages
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Promise.all(comicPromiseList).then(function() {
        console.log(fs.list(folder));
        // TODO: 1) add all images + title to `index.html` inside today's folder
        // TODO: 2) open `index.html` in browser
    });
});