XDM Depth Reader
================

This JavaScript library parses JPEG images in the XDM (eXtensible Device Metadata)
format, which succeeds the Google Lens Blur format generated by the Google Camera
app (it can also read the Lens Blur format as it maintains backward compatibility).

The XDM 1.0 spec was jointly developed by Intel and Google, and is available on the
[Intel Developer Zone](https://software.intel.com/en-us/articles/the-extensible-device-metadata-xdm-specification-version-10).

:exclamation: This library does not currently parse all metadata described by the
spec. However, it's hoped that this project will evolve into a generic reader and
possibly a writer as well in the near future.

This library may be used in both browser and Node.js projects, but some tests fail
if run inside PhantomJS.

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
[node_modules](http://storage.realsense.photo/projects/depth-reader-js/node_modules_windows.zip)
folder.

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

            // normalize depth values between 1-255
            // and shift them by 64 to boost effect
            return reader.normalizeDepthMap(64);
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
  - **mime** *string* - image/jpeg or image/png
  - **data** *string* - data URI
- **depth** *object* - depth map image
  - **metric** *boolean* - if true, near/far values are in meters
  - **format** *string* - RangeInverse or RangeLinear (see specs)
  - **near** *float*
  - **far** *float*
  - **mime** *string* - generally image/png
  - **data** *string* - data URI
- **confidence** *object* - confidence map image
  - **mime** *string* - generally image/png
  - **data** *string* - data URI

*Properties (advanced):*

- **debug** *boolean* - if set to true before calling loadFile() or parseFile(), exposes properties xmpXapXml and xmpExtXml for inspection
- **xmpXapXml** *string* - XMP segment with header http://ns.adobe.com/xap/1.0/
- **xmpExtXml** *string* - XMP segment with header http://ns.adobe.com/xmp/extension/

*Methods:*

- **loadFile(***fileUrl***)** - load XDM or Lens Blur image given JPEG file URL (parseFile() will be invoked automatically)
  - *return:* Promise that will be resolved with this DepthReader instance
- **parseFile(***buffer***)** - parse XDM or Lens Blur JPEG image given its ArrayBuffer (browser) or Buffer (Node.js) (function is synchronous and returns nothing; exception will be thrown if parsing fails)
- **normalizeDepthMap(***bias***)** - normalize XDM depth map so that depth values are distributed between 1 and 255 (overwrites the original depth.data; does nothing if JPEG is not XDM or depth.data is null)
  - **bias** *signed int* - shift depth values (brightness) after distribution (values will be clamped between 1 and 255)
  - *return:* Promise that will be resolved with modified depth.data

## Development

To contribute to the development of this library and to run its unit tests,
you'll first need to fork this Github project and clone it into your local
environment, and then install the dev dependencies:

    npm install

Rebuild the minified release after your changes have been tested:

    grunt build

## Tests

Install global dependencies:

    npm install -g grunt mocha

Run Node.js tests in the console and browser tests in a web page:

    npm start

Print depth map information (run HTTP server in separate console):

    grunt serve
    node test/info

## Authors

  - Erhhung Yuan <erhhung.yuan@intel.com>

## License

The MIT License

Copyright (c)2015 Intel Corporation
