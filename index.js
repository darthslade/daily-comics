/* global Promise */
var url = require('url');
var opn = require('opn');
var path = require('path');
var fs = require('fs-jetpack');
var request = require('request');
var cheerio = require('cheerio');
var readYaml = require('read-yaml');
var dateFormat = require('dateformat');

var now = new Date();
var folder = path.join('./archive', dateFormat(now, 'yyyy/mm/dd'));

/* Utils
--------------------------------------------------------------------------- */
var divider = function() {
    var cols = process.stdout.columns;
    return Array.apply(null, { length: cols }).join('-').slice(0, cols);
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

// Daily Comics
// ====================================================================================================
var dailyComics = (function() {
    var errorList = [];

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
        results.file = comic.file;
        results.name = comic.name;
        return results;
    };

    /*
    --------------------------------------------------------------------------- */
    var downloadImages = function(urls) {
        if (!urls.length) {
            createIndexPage();
            return;
        }

        console.log('Saving Images\n' + divider());
        var list = urls.filter(function(n) { return n !== undefined; });

        var saveImage = (function saveImage() {
            if (list.length) {
                var image = list.shift();
                var received_bytes = 0;
                var total_bytes = 0;
                var msg = ' - ' + image.name + ': ';

                var r = request.get(image.url)
                    .on('error', function(err) {
                        // if (err) { return reject(err); }
                    })
                    .on('response', function(response) {
                        total_bytes = parseInt(response.headers['content-length']);
                        var localFile = formatLocalFileName(image.url, image.file, response.headers['content-type']);
                        // Save file to local folder
                        r.pipe(fs.createWriteStream(path.join(folder, localFile)));
                    })
                    .on('data', function(chunk) {
                        received_bytes += chunk.length;
                        showDownloadingProgress(msg, received_bytes, total_bytes);
                    })
                    .on('end', saveImage);
            }
            else {
                console.log(divider());
                createIndexPage();
            }
        })();
    };

    /*
    --------------------------------------------------------------------------- */
    var getComicImageUrls = function(list) {
        function findImgInPage(comic, index) {
            return new Promise(function(resolve, reject) {
                request(comic.url, function(err, response, body) {
                    if (err) { return reject(err); }
                    if (response.statusCode !== 200) {
                        return reject('Invalid status code: ' + response.statusCode);
                    }

                    var  $ = cheerio.load(body);
                    var selector = $(comic.selector.img);

                    if (!selector.length) {
                        return reject('unable to find: ' + comic.file);
                    }

                    process.stdout.write('Gathering image urls: ' + (index + 1) + ' of ' + list.length + '\r');
                    if (index === list.length - 1) { process.stdout.write('\n\n'); }

                    // @url.resolve - concat relative urls with their hostname to create an absolute url
                    var img = $(comic.selector.img)[0].attribs.src;
                    resolve({
                        url: url.resolve(comic.url, img),
                        file: comic.file,
                        name: comic.name
                    });
                });
            }).catch(function(err) {
                errorList.push(comic.file);
            });
        }

        return Promise.all(list.map(findImgInPage));
    };

    /* Pull local yaml file and parse list of comics
    --------------------------------------------------------------------------- */
    var getListOfComics = function() {
        var comicsRequestList = []; // list of formatted comic urls

        return new Promise(function(resolve, reject) {
            readYaml('comics-list.yml', function(err, data) {
                if (err) { reject(new Error(err)); }

                data.comics.forEach(function(comics) {
                    comics.items.forEach(function(comic) {
                        var file = fs.find(folder, { matching: '*' + comic.file + '*' });
                        if (!file.length) {
                            var results = formatComicsUrl(comics.url, comic);
                            if (results.url) { comicsRequestList.push(results); }
                        }
                    });
                });

                resolve(comicsRequestList);
            });
        });
    };

    /* Create and Open `index` page
    --------------------------------------------------------------------------- */
    var indexPage = function(date, comics) {
        var template = `
            <!DOCTYPE html>
            <html><head><meta charset="utf-8">
            <title>Daily Comics | ${date}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style type="text/css">
            .comics-list { margin: 0; padding: 0; list-style: none; }
            .comics-list li { margin-bottom: 15px; padding: 0 15px 15px; border-bottom: 1px solid #ccc; }
            .comics-list h3 { margin: 0 0 5px; font: 200 18px/1 'Helvetica Neue', Helvetica, sans-serif; color: #666; }
            .comics-list img { max-width: 100%; height: auto; }
            </style></head>
            <body><ul class="comics-list">${comics}</ul></body></html>
        `;
        return template;
    };

    var createIndexPage = function(data) {
        var index = path.join(folder, 'index.html');
        if (fs.exists(index) === 'file') {
            openIndexPage(index);
            return;
        }

        var comics = fs.find(folder, { matching: '*.{jpg,jpeg,gif,png}' });
        var list = comics.map(function(comic) {
            return '<li><img src="' + path.basename(comic) + '"></li>';
        });
        var date = dateFormat(now, 'mediumDate');
        fs.file(index, { content: indexPage(date, list.join('')) });
        openIndexPage(index);
    };

    var openIndexPage = function(file) {
        opn(file);
        process.exit();
    };

    /* Init Comic Promise Chain
    --------------------------------------------------------------------------- */
    var getComics = function() {
        getListOfComics().then(getComicImageUrls).then(downloadImages);
    };

    return {
        get: getComics
    };
})();

dailyComics.get();
