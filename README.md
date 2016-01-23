XDM Depth Reader
================

[![Bower Version][bower-image]][bower-url]
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![License][license-image]][license-url]

[bower-image]: https://img.shields.io/bower/v/depth-reader.svg?style=flat
[bower-url]: https://github.com/IntelRealSense/depth-reader-js
[npm-image]: https://img.shields.io/npm/v/depth-reader.svg?style=flat
[npm-url]: https://npmjs.org/package/depth-reader
[downloads-image]: https://img.shields.io/npm/dt/depth-reader.svg?style=flat
[downloads-url]: https://npmjs.org/package/depth-reader
[travis-image]: https://img.shields.io/travis/IntelRealSense/depth-reader-js.svg?style=flat
[travis-url]: https://travis-ci.org/IntelRealSense/depth-reader-js
[coveralls-image]: https://img.shields.io/coveralls/IntelRealSense/depth-reader-js.svg?style=flat
[coveralls-url]: https://coveralls.io/github/IntelRealSense/depth-reader-js?branch=master
[license-image]: https://img.shields.io/npm/l/depth-reader.svg?style=flat
[license-url]: LICENSE

This JavaScript library parses JPEG images in the XDM (eXtensible Device Metadata)
format, which succeeds the Google Lens Blur format generated by the Google Camera
app (it can also read the Lens Blur format as it maintains backward compatibility).

The XDM 1.0 spec was jointly developed by Intel and Google, and is available on the
[Intel Developer Zone](https://software.intel.com/en-us/articles/the-extensible-device-metadata-xdm-specification-version-10).

This library does not currently parse all metadata described by the 1.0 spec.
However, it is hoped that this project will evolve into a complete reader and
possibly a writer as well in the future.

This library may be used in both browser and Node.js projects, but some tests
fail when run inside PhantomJS.

## Dependencies

 - [RSVP.js](https://github.com/tildeio/rsvp.js) *(polyfill for Promise)*
 - [XMLDOM](https://github.com/jindw/xmldom) *(polyfill for DOMParser in Node.js)*
 - [node-xhr2](https://github.com/pwnall/node-xhr2) *(polyfill for XMLHttpRequest in Node.js)*
 - [node-canvas](https://github.com/Automattic/node-canvas) *(polyfill for HTML5 canvas in Node.js)*

## Installation

    bower install depth-reader --save

*or*

    npm install depth-reader --save

For Node.js, unless previously installed, you'll need the `Cairo` graphics library.
Follow these [installation instructions](https://github.com/LearnBoost/node-canvas/wiki/_pages)
before continuing.

If you're having trouble compiling `Cairo` or installing the `node-canvas`
module on **Windows**, you can, alternatively, download a snapshot of the
[node_modules\canvas](http://cdn.intelrealsense.net/projects/depth-reader-js/node-canvas-1.3.1-node-5.0-win32.zip)
folder built for Node.js v5.0.

## Usage

*Browser:*

    <script src="/bower_components/rsvp/rsvp.js"></script>
    <script src="/bower_components/depth-reader/depth-reader.js"></script>

*Node.js:*

    var DepthReader = require('depth-reader'),
        Image       = require('canvas').Image;

*Example:*

    var fileURL = 'http://localhost/images/depth.jpg',
        reader  = new DepthReader();

    reader.loadFile(fileURL)
        .then(function(reader) {
            return loadImage(reader.fileData);
        })
        .then(function(img) {
            // container image may contain user-applied effects
            showDimensions(img, 'Container');

            return loadImage(reader.image.data);
        })
        .then(function(img) {
            // reference image is the pre-edited camera image,
            // but may be cropped to rid objectionable content
            showDimensions(img, 'Reference');

            // normalize depth values between 0-255
            // and shift them by 64 to boost effect
            return reader.normalizeDepthMap({bias: 64});
        })
        .then(function(data) { // depth.data
            return loadImage(data);
        })
        .then(function(img) {
            showDimensions(img, 'Depth Map');

            // confidence map may be missing
            var data = reader.confidence.data;
            return data && loadImage(data);
        })
        .then(function(img) {
            if (img) {
                // confidence map must be the
                // same size as the depth map
                showDimensions(img, 'Confidence');
            }
        })
        .then(function() {
            // dump serialized metadata
            // without data from images
            console.log('image metadata:');
            console.log(JSON.stringify(reader, null, 2));
        })
        .catch(function(err) {
            console.error('loading failed:', err);
        });

    function loadImage(src) {
        return new Promise(function(resolve, reject) {
            try {
                var img = new Image();
                img.onload = function() {
                    resolve(img);
                };
                img.onerror = function() {
                    reject(new Error('cannot load image'));
                };
                img.src = src;
            } catch (err) {
                reject(err);
            }
        });
    }

    function showDimensions(img, type) {
        console.log(type, 'image dimensions:',
            img.width + 'x' + img.height);
    }

## API Reference

Class **DepthReader** *(constructor takes no arguments)*

*Properties (read-only):*

- **isXDM** *boolean* - XDM or Lens Blur format
- **revision** *float* - XDM revision number
- **device** *object*
  - **vendor** *object*
    - **manufacturer** *string*
    - **model** *string*
  - **pose** *object* - world coordinates in degrees
    - **latitude** *float*
    - **longitude** *float*
    - **altitude** *float*
- **camera** *object*
  - **vendor** *object*
    - **manufacturer** *string*
    - **model** *string*
  - **pose** *object*
    - **positionX** *float*
    - **positionY** *float*
    - **positionZ** *float*
    - **rotationAxisX** *float*
    - **rotationAxisY** *float*
    - **rotationAxisZ** *float*
    - **rotationAngle** *float*
- **perspective** *object* *(XDM only)*
  - **focalLengthX** *float*
  - **focalLengthY** *float*
  - **principalPointX** *float*
  - **principalPointY** *float*
- **focus** *object* *(Lens Blur only)*
  - **focalPointX** *float*
  - **focalPointY** *float*
  - **focalDistance** *float*
  - **blurAtInfinity** *float*
- **fileData** *ArrayBuffer*/*Buffer* - container JPEG file loaded by loadFile()
- **image** *object* - reference image
  - **mime** *string* - generally image/jpeg
  - **data** *string* - data URI
- **depth** *object* - enhanced (and normalized) depth map image
  - **metric** *boolean* - if true, near/far values are in meters
  - **format** *string* - RangeInverse or RangeLinear (see spec)
  - **near** *float*
  - **far** *float*
  - **mime** *string* - generally image/png
  - **data** *string* - data URI
- **confidence** *object* - confidence map image (if available)
  - **mime** *string* - generally image/png
  - **data** *string* - data URI (null if not available)

*Properties (advanced):*

- **debug=** *boolean* - if set to true before calling loadFile() or parseFile(), exposes properties xmpXapXml and xmpExtXml for inspection
- **xmpXapXml** *string* - XMP segment with header http://ns.adobe.com/xap/1.0/
- **xmpExtXml** *string* - XMP segment with header http://ns.adobe.com/xmp/extension/
- **depth** *object* - enhanced depth map image
  - **raw** *object* - raw depth map image (if available)
    - **mime** *string* - generally image/png
    - **data** *string* - data URI (null if not available)

*Methods:*

- **loadFile(**fileUrl**)** - load XDM or Lens Blur image given JPEG file URL (parseFile() will be invoked automatically)
  - **fileUrl** *string* - URL to be loaded by XMLHttpRequest
  - *return:* Promise that will be resolved with this DepthReader instance
- **parseFile(**buffer**)** - parse XDM or Lens Blur JPEG image given its ArrayBuffer (browser) or Buffer (Node.js) (function is synchronous and returns nothing; exception will be thrown if parsing fails)
- **normalizeDepthMap(**[func], [opts]**)** - normalize XDM depth map so that depth values are distributed between 0 and 255 (function overwrites the original depth.data, but can be called more than once because the original depth map is retained internally; does nothing if JPEG is not XDM or depth.data is null)
  - **func** *string* - name of a registered normalizer function (default is "default")
  - **opts** *object* - options passed to the normalizer
    - **threshold** *number* - percentage of total pixels below which min/max outliers are discarded (default is 0.1)
    - **bias** *number* - shift depth values (brightness) after normalizing if using the default normalizer (default is 0)
  - *return:* Promise that will be resolved with modified depth.data
- **registerNormalizer(**name, func**)** ***static*** - register a normalizer function for use by normalizeDepthMap()
  - **name** *string* - name to identify this normalizer
  - **func** *function* - **function(**data, opts**)** where data (Uint8ClampedArray) is ImageData.data array that should be modified, opts (object) contains normalizer-specific options, and _this_ is Canvas from which the ImageData is obtained
- **toJSON()** - custom JSON serializer for JSON.stringify()
  - *return:* object containing non-image metadata (no `.mime` and `.data` properties)

## Contributing

To contribute to the development of this library and to run its unit tests,
you'll first need to fork this Github project and clone it into your local
environment, and then install the dev dependencies:

    bower install
    npm install -g grunt-cli node-gyp
    npm install

Rebuild the minified release after your changes have been tested, and then
submit a pull request:

    grunt build

## Tests

Install global dependencies:

    npm install -g grunt-cli mocha

Run Node.js tests in the console and browser tests in a web page:

    npm start

Print depth map information (run HTTP server in separate console):

    grunt serve
    node test/info

## Authors

- Erhhung Yuan <erhhung.yuan@intel.com>

## License

The MIT License. Sample images are provided under the
Creative Commons Attribution-ShareAlike 4.0 International License.
See the [LICENSE](LICENSE) file for the specific terms of these licenses.

Copyright © 2016 Intel Corporation
