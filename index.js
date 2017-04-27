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
    var comicsList = []; // flat array of all names of comics

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
                        var localFile = formatLocalFileName(image.url, image.name, response.headers['content-type']);
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
                        comicsList.push(comic); // save list to build index file
                        var file = fs.dir(folder).find('.', { matching: '*' + comic.file + '*' });
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

    /*
    --------------------------------------------------------------------------- */
    var createIndexPage = function(data) {
        console.log(divider());
        console.log('createIndexPage');
    };

    var getComics = function() {
        getListOfComics().then(getComicImageUrls).then(downloadImages);
    };

    return {
        get: getComics
    };
})();

dailyComics.get();
