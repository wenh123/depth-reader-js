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
    , DOMParser
    , Canvas
    , Image;

  if ('object' === typeof exports) { // Node.js
    Promise        = require('rsvp').Promise;
    XMLHttpRequest = require('xhr2');
    DOMParser      = require('xmldom').DOMParser;
    Canvas         = require('canvas');
    Image          = Canvas.Image;
  } else { // browser
    Promise        = root.Promise ||
                     root.RSVP.Promise;
    XMLHttpRequest = root.XMLHttpRequest;
    DOMParser      = root.DOMParser;
    Image          = root.Image;
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
    if (this.debug) {
      // expose for inspection
      this.xmpXapXml = xmpXapXml;
      this.xmpExtXml = xmpExtXml;
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
    var cameraNS = extDescElt.getAttribute('xmlns:Camera')
      ,  depthNS = extDescElt.getAttribute('xmlns:Depthmap')
      , imageElt = findChild(extDescElt, cameraNS, 'Image')
      , depthElt = findChild(extDescElt, cameraNS, 'DepthMap');

    self.depth.inMetric = parseBool(childValue(depthElt, depthNS, 'Metric'));
    self.depth.format   =           childValue(depthElt, depthNS, 'Format');
    self.depth.near     =          +childValue(depthElt, depthNS, 'Near');
    self.depth.far      =          +childValue(depthElt, depthNS, 'Far');

    self.image.mime = childValue(imageElt, imageNS, 'Mime');
    self.depth.mime = childValue(depthElt, depthNS, 'Mime');
    self.image.data = childValue(imageElt, imageNS, 'Data');
    self.depth.data = childValue(depthElt, depthNS, 'Data');
  }

  function parseLensBlur(self, imageNS, extDescElt, xapDescElt) {
    var focusNS = xapDescElt.getAttribute('xmlns:GFocus')
      , depthNS = extDescElt.getAttribute('xmlns:GDepth');

    self.focus.focalPointX    = +attrValue(xapDescElt, focusNS, 'FocalPointX');
    self.focus.focalPointY    = +attrValue(xapDescElt, focusNS, 'FocalPointY');
    self.focus.focalDistance  = +attrValue(xapDescElt, focusNS, 'FocalDistance');
    self.focus.blurAtInfinity = +attrValue(xapDescElt, focusNS, 'BlurAtInfinity');

    self.depth.inMetric = true; // assume metric as it's unspecified
    self.depth.format   =  attrValue(xapDescElt, depthNS, 'Format');
    self.depth.near     = +attrValue(xapDescElt, depthNS, 'Near');
    self.depth.far      = +attrValue(xapDescElt, depthNS, 'Far');

    self.image.mime = attrValue(xapDescElt, imageNS, 'Mime');
    self.depth.mime = attrValue(xapDescElt, depthNS, 'Mime');
    self.image.data = attrValue(extDescElt, imageNS, 'Data');
    self.depth.data = attrValue(extDescElt, depthNS, 'Data');
  }

  // parse given XML and return x:xmpmeta
  // -> rdf:RDF -> rdf:Description element
  function getDescElt(xmpXml) {
    try {
      var parser  = new DOMParser
        , xmlDoc  = parser.parseFromString(xmpXml, 'application/xml')
        , rootElt = xmlDoc.documentElement;

      return firstChild(firstChild(rootElt));
    } catch (err) {
      throw new Error('cannot parse XMP XML');
    }
  }

  function firstChild(elt) {
    // skip #text node if needed
    for (elt = elt.firstChild;
         elt && 1 !== elt.nodeType;
         elt = elt.nextSibling) {
    }
    return elt || null;
  }

  function findChild(parent, ns, name) {
    var elts = parent.getElementsByTagNameNS(ns, name);
    return elts && elts[0] || null;
  }

  function childValue(parent, ns, name) {
    var elt = findChild(parent, ns, name);
    return elt ? elt.textContent : '';
  }

  function attrValue(elt, ns, name) {
    return elt.getAttributeNS(ns, name) || '';
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

  /*
  normalize the depthmap so that depth
  values are scaled between 0 and 255
  (overwrites the original depth.data)
  */
  DepthReader.prototype.normalizeDepthmap = function() {
    if (!this.depth.data ||
         this.depth._normalized) {
      return;
    }
    var canvas
      , image = new Image;
    image.src = this.depth.data;
    var w = image.width
      , h = image.height;

    if (Canvas) { // Node.js
      canvas = new Canvas(w, h);
    } else { // browser
      canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
    }
    var ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    var pixels = ctx.getImageData(0, 0, w, h)
      , data   = pixels.data
      , len    = data.length
      , min    = 255
      , max    = 0
      , val, norm, prev, i, j;

    // get min/max depth values
    for (i = 0; i < len; i += 4) {
      val = data[i];
      if (val > max) {max = val;}
      if (val < min) {min = val;}
    }
    // --min so all values > 0
    var spread = max - (--min);
    for (i = 0; i < len; i += 4) {
      val = data[i];
      if (prev !== val) {
        norm = Math.round((val - min) / spread * 255);
        prev = val;
      }
      // modify R,G,B not alpha
      for (j = 0; j < 3; j++) {
        data[i + j] = norm;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    this.depth.data = canvas.toDataURL();
    this.depth._normalized = true;
  };

  if ('object' === typeof exports) {
    module.exports   = DepthReader;
  } else { // browser
    root.DepthReader = DepthReader;
  }
}).call(this);
