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

new DepthReader().loadFile(fileUrl)
  .then(function(reader)
  {
    var image = new Canvas.Image;
    image.src = reader.depth.data;

    var canvas = initCanvas(image)
      , range  = getBrightness(canvas, true)
      , histo  = getHistogram (canvas, 'r');

    console.log('Depthmap\n--------');
    console.log('    wrote: depthmap.png');
    console.log('    width:', canvas.width);
    console.log('   height:', canvas.height);
    console.log('   format:', reader.depth.format);
    console.log('     near:', reader.depth.near);
    console.log('      far:', reader.depth.far);
    console.log('min value:', range.min);
    console.log('max value:', range.max);
    console.log('histogram:');

    var total  = canvas.width * canvas.height
      , maxVal = histo.max.r;
    for (var i = range.min; i <= range.max; ++i) {
      var value = histo.freq.r[i]
        , isMax = maxVal === value
        , prcnt = value / total * 100;

      console.log(  padZero(i,  3) + ':'
        , pad(prcnt.toFixed(1), 4) + '%'
        , value + (isMax ? ' *' : ''));
    }
    var pathname = path.join(__dirname, 'depthmap.png');
    return saveCanvas(canvas, pathname);
  })
  .catch(function(error) {
    console.error('loading failed:', error);
  });

/**
get newly created Canvas with @image drawn at
the specified dimensions (or at original size
if @width and @height are not specified)
*/
function initCanvas(image, width, height)
{
  var iw = image.width
    , ih = image.height
    , w  = width  || iw
    , h  = height || ih
    , canvas
    , ctx;

  if (w < iw && h < ih)
  {
    canvas = new Canvas(iw, ih);
    ctx    = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return downscaleCanvas(canvas, w, h);
  }
  else {
    canvas = new Canvas(w, h);
    ctx    = canvas.getContext('2d');
    ctx.imageSmoothingEnabled =
                w !== iw || h !== ih;
    ctx.drawImage(image, 0, 0, w, h);
    return canvas;
  }
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

// taken from http://stackoverflow.com/questions/18922880/html5-canvas-resize-downscale-image-high-quality
// @width and @height must have same aspect ratio as @canvas
function downscaleCanvas(canvas, width, height)
{
  var sw = canvas.width  // source image width
    , sh = canvas.height // source image height
    , tw = width         // target image width
    , th = height        // target image height

    , wh = tw * th
    , ds = tw / sw   // downscale
    , ss = ds * ds   // = area of a source pixel within target
    , sx, sy, si, pi // source x,y, index within source array
    , tx, ty, ti, yi // target x,y, index within target array
    , tX, tY         // floored tx,ty

    // weight is weight of current source point within target, next
    // weight is weight of current source point within next target
    , w,  nw
    , wx, nwx // weight/next weight x,y
    , wy, nwy

    , cx // does scaled pixel cross its current pixel right  border?
    , cy // does scaled pixel cross its current pixel bottom border?

    , ctx  = canvas.getContext('2d')
    , img  = ctx.getImageData(0, 0, sw, sh)
    , tbuf = new Float32Array(3 * sw * sh)  // target buffer Float32 rgb
    , sbuf = img.data                       // source buffer  8-bit rgba
    , sR, sG, sB;                           // source current point rgb

  for (si = 0, sy = 0; sy < sh; sy++)
  {
    ty = sy * ds;     // source y position within target
    tY = 0  | ty;     // floored target pixel y
    yi = tw * tY * 3; // line index within target array

    cy = tY !== (0 | (ty + ds));
    if (cy) // if pixel is crossing bottom target pixel
    {
      wy  = tY + 1  - ty;     // weight of point within target pixel
      nwy = ty + ds - tY - 1; // ... within y+1 target pixel
    }

    for (sx = 0; sx < sw; sx++, si += 4)
    {
      tx = sx * ds;     // source x position within target
      tX = 0  | tx;     // floored target pixel x
      ti = yi + tX * 3; // target pixel index within target array

      cx = tX !== (0 | (tx + ds));
      if (cx) // if pixel is crossing target pixel's right
      {
        wx  = tX + 1  - tx;     // weight of point within target pixel
        nwx = tx + ds - tX - 1; // ... within x+1 target pixel
      }

      // get rgb for current source pixel
      sR = sbuf[si    ];
      sG = sbuf[si + 1];
      sB = sbuf[si + 2];

      if (!cx && !cy) // pixel does not cross
      {
        // just add components weighted by squared scale
        tbuf[ti    ] += sR * ss;
        tbuf[ti + 1] += sG * ss;
        tbuf[ti + 2] += sB * ss;
      }
      else if (cx && !cy) // cross on X only
      {
        // add weighted components for current pixel
        w = wx * ds;
        tbuf[ti    ] += sR * w;
        tbuf[ti + 1] += sG * w;
        tbuf[ti + 2] += sB * w;

        // add weighted components for next (tX+1) pixel
        nw = nwx * ds;
        tbuf[ti + 3] += sR * nw;
        tbuf[ti + 4] += sG * nw;
        tbuf[ti + 5] += sB * nw;
      }
      else if (!cx && cy) // cross on Y only
      {
        // add weighted components for current pixel
        w = wy * ds;
        tbuf[ti    ] += sR * w;
        tbuf[ti + 1] += sG * w;
        tbuf[ti + 2] += sB * w;

        // add weighted component for next (tY+1) pixel
        nw = nwy * ds;
        pi = ti  + 3 * tw;
        tbuf[pi    ] += sR * nw;
        tbuf[pi + 1] += sG * nw;
        tbuf[pi + 2] += sB * nw;
      }
      else // crosses both X and Y (4 target points involved)
      {
        // add weighted components for current pixel
        w = wx * wy;
        tbuf[ti    ] += sR * w;
        tbuf[ti + 1] += sG * w;
        tbuf[ti + 2] += sB * w;

        // for tX+1, tY pixel
        nw = nwx * wy;
        tbuf[ti + 3] += sR * nw;
        tbuf[ti + 4] += sG * nw;
        tbuf[ti + 5] += sB * nw;

        // for tX, tY+1 pixel
        nw = wx * nwy;
        pi = ti + 3 * tw;
        tbuf[pi    ] += sR * nw;
        tbuf[pi + 1] += sG * nw;
        tbuf[pi + 2] += sB * nw;

        // for tX+1, tY+1 pixel
        nw = nwx * nwy;
        tbuf[pi + 3] += sR * nw;
        tbuf[pi + 4] += sG * nw;
        tbuf[pi + 5] += sB * nw;
      }
    } // end for sx
  }   // end for sy

  // create result canvas
  canvas = new Canvas(tw, th);
  ctx    = canvas.getContext('2d');
  img    = ctx.getImageData(0, 0, tw, th);
  sbuf   = img.data;

  // convert Float32Array into Uint8ClampedArray
  for (pi = si = ti = 0; pi < wh; pi++, si += 3, ti += 4)
  {
    sbuf[ti    ] = 0 | tbuf[si    ];
    sbuf[ti + 1] = 0 | tbuf[si + 1];
    sbuf[ti + 2] = 0 | tbuf[si + 2];
    sbuf[ti + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
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
