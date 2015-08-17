/*
MIT Licensed
https://github.com/DavisReef/depth-reader-js
XDM 1.0 spec: https://software.intel.com/en-us/articles/the-extensible-device-metadata-xdm-specification-version-10
Copyright (c)2015 Intel Corporation
*/
(function() {
  'use strict';

  var root = this // _window_ if in browser
    , Promise
    , XMLHttpRequest
    , DOMParser;

  if ('object' === typeof exports) { // Node.js
    Promise        = require('rsvp').Promise;
    XMLHttpRequest = require('xhr2');
    DOMParser      = require('xmldom').DOMParser;
  } else { // browser
    Promise        = root.Promise ||
                     root.RSVP.Promise;
    XMLHttpRequest = root.XMLHttpRequest;
    DOMParser      = root.DOMParser;
  }

  var DepthReader = function() {
    this.isXDM = false;
    this.image = {
      mime: ''
    , data: null // data URI
    };
    this.depth = {
      inMetric: false // unit is meter if true
    , format:   '' // RangeInverse/RangeLinear
    , near:     0
    , far:      0
    , mime:     ''
    , data:     null // data URI
    };
    this.focus = {
      focalPointX:    0
    , focalPointY:    0
    , focalDistance:  0
    , blurAtInfinity: 0
    };
  };

  /*
  parse XDM/LensBlur JPEG given its ArrayBuffer
  (function is synchronous and returns nothing;
  exception will be raised if parsing fails)
  */
  DepthReader.prototype.parseFile = function(buffer) {
    var bytes = new Uint8Array(buffer);
    if (bytes[0] !== 0xff ||
        bytes[1] !== 0xd8) { // JPEG start-of-image
      throw new Error('file is not JPEG image');
    }
    var xmpXapXml = ''
      , xmpExtXml = ''
      , payload
      , header
      , i = 0;

    while (-1 < (i = findMarker(bytes, i))) {
      i += 2; // skip marker to segment start

      if ((header = getHeader(bytes, i))) {
        // payload start = segment start + header length
        //               + sizeof word + null-terminator
        // if extension: + 32-byte HasExtendedXMP UUID
        //               +  8-byte "I don't know/care"
        var isXap = xmpXapNS === header
          , extra = header.length + (isXap ? 3 : 43)
          , size  = (bytes[i  ] << 8)
                  +  bytes[i+1]
                      - extra
          , start = i + extra;
        i = start + size;

        payload = baToStr(bytes, start, size);
        if (isXap) {
          xmpXapXml += payload;
        } else {
          xmpExtXml += payload;
        }
      }
    }
    var extDescElt = getDescElt(xmpExtXml)
      , imageNS    = extDescElt.getAttribute('xmlns:Image') ||
                     extDescElt.getAttribute('xmlns:GImage');

    if ((this.isXDM = /xdm\.org/.test(imageNS))) {
      parseXDM(this, imageNS, extDescElt);
    } else {
      var xapDescElt = getDescElt(xmpXapXml);
      parseLensBlur(this, imageNS, extDescElt
                                 , xapDescElt);
    }
    makeDataURI(this.image);
    makeDataURI(this.depth);
  };

  function parseXDM(self, imageNS, extDescElt) {
    var depthNS  = extDescElt.getAttribute('xmlns:Depthmap')
      , cameraNS = extDescElt.getAttribute('xmlns:Camera')
      , imageElt = extDescElt.getElementsByTagNameNS(cameraNS, 'Image'   )[0]
      , depthElt = extDescElt.getElementsByTagNameNS(cameraNS, 'DepthMap')[0]
      , descElt  = depthElt.firstChild.nextSibling; // rdf:Description

    self.depth.inMetric = parseBool(descElt.getAttributeNS(depthNS, 'Metric'));
    self.depth.format   =           descElt.getAttributeNS(depthNS, 'Format');
    self.depth.near     =          +descElt.getAttributeNS(depthNS, 'Near');
    self.depth.far      =          +descElt.getAttributeNS(depthNS, 'Far');

    self.image.mime = imageElt.getAttributeNS(imageNS, 'Mime');
    self.depth.mime =  descElt.getAttributeNS(depthNS, 'Mime');
    self.image.data = imageElt.getAttributeNS(imageNS, 'Data');
    self.depth.data =  descElt.getAttributeNS(depthNS, 'Data');
  }

  function parseLensBlur(self, imageNS, extDescElt, xapDescElt) {
    var focusNS = xapDescElt.getAttribute('xmlns:GFocus')
      , depthNS = extDescElt.getAttribute('xmlns:GDepth');

    self.focus.focalPointX    = +xapDescElt.getAttributeNS(focusNS, 'FocalPointX');
    self.focus.focalPointY    = +xapDescElt.getAttributeNS(focusNS, 'FocalPointY');
    self.focus.focalDistance  = +xapDescElt.getAttributeNS(focusNS, 'FocalDistance');
    self.focus.blurAtInfinity = +xapDescElt.getAttributeNS(focusNS, 'BlurAtInfinity');

    self.depth.inMetric = true; // assume metric as it's unspecified
    self.depth.format   =  xapDescElt.getAttributeNS(depthNS, 'Format');
    self.depth.near     = +xapDescElt.getAttributeNS(depthNS, 'Near');
    self.depth.far      = +xapDescElt.getAttributeNS(depthNS, 'Far');

    self.image.mime = xapDescElt.getAttributeNS(imageNS, 'Mime');
    self.depth.mime = xapDescElt.getAttributeNS(depthNS, 'Mime');
    self.image.data = extDescElt.getAttributeNS(imageNS, 'Data');
    self.depth.data = extDescElt.getAttributeNS(depthNS, 'Data');
  }

  // parse given XML and return x:xmpmeta
  // -> rdf:RDF -> rdf:Description element
  function getDescElt(xmpXml) {
    try {
      var parser  = new DOMParser
        , xmlDoc  = parser.parseFromString(xmpXml, 'application/xml')
        , rootElt = xmlDoc.documentElement;

      // firstChild is #text node, so skip
      return rootElt.firstChild.nextSibling  // rdf:RDF
                    .firstChild.nextSibling; // rdf:Description
    } catch (err) {
      throw new Error('cannot parse XMP XML');
    }
  }

  // make image.data a data URI
  function makeDataURI(image) {
    if (image.mime && image.data) {
      image.data =   'data:'  + image.mime
                 + ';base64,' + image.data;
    }
  }

  /*
  get index of next APP1 marker
  pos: starting index within buf
  return: index; -1 if not found
  */
  function findMarker(buf, pos) {
    for (var i = pos; i < buf.length; i++) {
      if (0xff === buf[i  ] &&
          0xe1 === buf[i+1]) {
        return i;
      }
    }
    return -1;
  }

  /*
  get XMP segment header string
  pos: starting index of segment
  return: header; '' if not found
  */
  function getHeader(arr, pos) {
    pos += 2; // skip segment size
    return hasHeader(xmpXapNS) ? xmpXapNS :
           hasHeader(xmpExtNS) ? xmpExtNS : '';

    function hasHeader(header) {
      var str = baToStr(arr, pos, header.length);
      return header === str;
    }
  }
  var xmpXapNS = 'http://ns.adobe.com/xap/1.0/'
    , xmpExtNS = 'http://ns.adobe.com/xmp/extension/';

  // convert sub-Uint8Array to string
  function baToStr(arr, pos, len) {
    arr = arr.subarray(pos, pos + len);
    try {
      return String.fromCharCode.apply(null, arr);
    } catch (err) {
      // workaround PhantomJS bug:
      // https://github.com/ariya/phantomjs/issues/11172
      var i = -1
        , j = arr.length
        , a = new Array(j);
      while (++i < j) {
        a[i] = arr[i];
      }
      return String.fromCharCode.apply(null, a);
    }
  }

  // parse '1'/'true'/'yes'
  function parseBool(str) {
    return !!String(str).match(/^\s*1|true|yes\s*$/i);
  }

  /*
  load XDM/LensBlur image given JPEG file URL
  (parseFile() will be invoked automatically)
  return: Promise to be fulfilled with _this_
  */
  DepthReader.prototype.loadFile = function(fileUrl) {
    var self = this;

    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest;
      xhr.open('GET', fileUrl);
      xhr.responseType = 'arraybuffer';

      xhr.onload = function() {
        if (this.response) {
          try { // parsing is synchronous
            self.parseFile.call(self, this.response);
            resolve(self);
          } catch (err) {
            reject(err);
          }
        } else {
          var msg = 'cannot load file [' + this.status + ']';
          reject(new Error(msg));
        }
      };
      xhr.send();
    });
  };

  if ('object' === typeof exports) {
    module.exports   = DepthReader;
  } else { // browser
    root.DepthReader = DepthReader;
  }
}).call(this);
