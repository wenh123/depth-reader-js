/*
print depthmap info
node test/info [url]
*/

var DepthReader = require('../src/depth-reader')
  , Promise     = require('rsvp').Promise
  , Canvas      = require('canvas')
  , path        = require('path')
  , fs          = require('fs');

var fileUrl = process.argv[2] ||
  'http://localhost:9000/images/xdm-photo1.jpg';

var reader = new DepthReader;
reader.debug = true; // save xmpXapXml/xmpExtXml

reader.loadFile(fileUrl)
  .then(function(reader)
  {
    var image = new Canvas.Image;
    image.src = reader.depth.data
    var w = image.width
      , h = image.height;

    var canvas = new Canvas(w, h)
      , ctx    = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    var range  = getBrightness(canvas, true)
      , histo  = getHistogram (canvas, 'r')
      , maxVal = histo.max.r
      , total  = w * h;

    console.log('Depthmap\n--------');
    console.log('    wrote: xmpxap.xml');
    console.log('    wrote: xmpext.xml');
    console.log('    wrote: depthmap.png');
    console.log('   is XDM:', reader.isXDM);
    console.log(' revision:', reader.revision.toFixed(1));
    console.log('    width:', w);
    console.log('   height:', h);
    console.log('   format:', reader.depth.format);
    console.log('     near:', reader.depth.near);
    console.log('      far:', reader.depth.far);
    console.log('in metric:', reader.depth.inMetric);
    console.log('min value:', range.min);
    console.log('max value:', range.max);
    console.log('histogram:');

    for (var i = range.min; i <= range.max; i++) {
      var value = histo.freq.r[i]
        , isMax = value === maxVal
        , prcnt = value / total * 100;

      console.log(  padZero(i,  3) + ':'
        , pad(prcnt.toFixed(1), 4) + '%'
        , value + (isMax ? ' *' : ''));
    }

    if (reader.isXDM) {
      // save normalized depthmap
      reader.normalizeDepthmap(64);
      image.src = reader.depth.data;
      ctx.drawImage(image, 0, 0);
    }
    var pathname = path.join(__dirname, 'depthmap.png');
    return saveCanvas(canvas, pathname);
  })
  .then(function() {
    if (reader.xmpXapXml)
    {
      var pathname = path.join(__dirname, 'xmpxap.xml');
      return saveString(reader.xmpXapXml, pathname);
    }
  })
  .then(function() {
    if (reader.xmpExtXml)
    {
      var pathname = path.join(__dirname, 'xmpext.xml');
      return saveString(reader.xmpExtXml, pathname);
    }
  })
  .catch(function(error) {
    console.error('loading failed:', error);
  });

/**
save @string to @pathname
return: Promise
*/
function saveString(string, pathname)
{
  return new Promise(function(resolve, reject) {
    try {
      fs.writeFile(pathname, string, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (err) {
      var msg = 'saveString failed: ' + err.message;
      reject(new Error(msg));
    }
  });
}

/**
save @canvas to @pathname
@pathname: .png/.jpg file
return: Promise
*/
function saveCanvas(canvas, pathname)
{
  return new Promise(function(resolve, reject) {
    try {
      var ext      = path.extname(pathname)
        , encoder  = '.png' === ext ?  'pngStream'
                                    : 'jpegStream'
        , writable = fs.createWriteStream(pathname)
        , readable = canvas[encoder]();

      writable.on('finish', resolve)
        .on('error', function(err) {
          var msg = 'stream.Writable error: ' + err.message;
          reject(new Error(msg));
        });
      readable.on('end', function() {
          writable.end();
        })
        .on('error', function(err) {
          var msg = 'Canvas.' + encoder + ' error: ' + err.message;
          reject(new Error(msg));
        })
        .pipe(writable);
    }
    catch (err) {
      var msg = 'saveCanvas failed: ' + err.message;
      reject(new Error(msg));
    }
  });
}

/**
get {min,max} range of the brightness of pixels in @object
using the formula: sqrt(0.299*R^2 + 0.587*G^2 + 0.114*B^2)

@object: Canvas, ImageData, or
         ImageData.data (Canvas.PixelArray)
[@mono]: if true, uses only R value
*/
function getBrightness(object, mono)
{
  var data = getPixelData(object)
    , len  = data.length
    , min  = 255
    , max  = 0
    , val, i;

  for (i = 0; i < len; i += 4) {
    // avoid function overhead
    if (mono) {
      val = data[i];
    } else {
      var r = data[i    ]
        , g = data[i + 1]
        , b = data[i + 2];

      val = Math.round(Math.sqrt(
          0.299 * r*r +
          0.587 * g*g +
          0.114 * b*b));
    }
    if (val > max) {max = val;}
    if (val < min) {min = val;}
  }
  return {min: min, max: max};
}

/**
get the histogram of an image with pixels in @object
returns {freq:{r[0-255],g[],b[],a[]}, max:{r,g,b,a}}

@object:    Canvas, ImageData, or
            ImageData.data (Canvas.PixelArray)
[@channel]: 'r', 'g', 'b', 'a', or undefined
*/
function getHistogram(object, channel)
{
  var data =  getPixelData(object)
    , len  =  data.length
    , ch   =  String(channel || 0).toLowerCase()
    , chan = 'rgba'.indexOf(ch)
    , freq = {}
    , max  = {};

  'rgba'.split('').forEach(function(c, i)
  {
    if (-1 === chan ||
         i === chan) {
      var a = new Array(256)
        , j, m, n, val;

      for (j = 0; j < 256; a[j++] = 0) {}
      for (m = 0, j = i; j < len; j += 4)
      {
        val = data[j];
        if (m < (n = ++a[val])) {
          m = n;
        }
      }
      freq[c] = a;
       max[c] = m;
    }
  });
  return {freq: freq, max: max};
}

/**
get ImageData.data as an Uint8ClampedArray

@object: Canvas, ImageData, or
         ImageData.data (Canvas.PixelArray)
*/
function getPixelData(object)
{
  var type = object.toString.call(object);

  if ('[object CanvasPixelArray]' === type) {
    return object;
  } else if ('[object ImageData]' === type) {
    return object.data;
  }
  var w      = object.width
    , h      = object.height
    , ctx    = object.getContext('2d')
    , pixels = ctx.getImageData(0, 0, w, h);

  return pixels.data;
}

// pad @value converted to string with leading zeros
// so it's at least @width characters long (up to 6)
function padZero(value, width) {
  return pad(value, width, '000000')
}

/**
pad given string with filler characters on left/right

@width:    if > 0, pad left; if < 0, pad right
[@filler]: padding characters (length >= width)
*/
function pad(string, width, filler)
{
  filler = String(filler || '                    ');
  string = String(string || '');
  if (!(width = ~~width)) {
    return string;
  }
  var padLen = Math.abs(width) - string.length
    , padStr = filler.slice(0, padLen);
  return 0 < width ? padStr + string
                   : string + padStr;
}
