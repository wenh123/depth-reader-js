/*
 * depth-reader-js unit tests
 *
 * MIT Licensed
 * Copyright © 2016 Intel Corporation
 */
'format global';
(function() {
'use strict';

  var root = this // _window_ if in browser
    , Image
    , Promise
    , DepthReader
    , chaiAsPromised
    , chai;

  console.error = console.warn = function() {};

  if ('undefined' === typeof window) { // Node.js
    Image          = require('canvas').Image;
    Promise        = require('rsvp').Promise;
    DepthReader    = require('../depth-reader');
    chaiAsPromised = require('chai-as-promised');
    chai           = require('chai');
  } else { // browser
    Image          = root.Image;
    Promise        = root.Promise ||
                     root.RSVP.Promise;
    DepthReader    = root.DepthReader;
    chaiAsPromised = root.chaiAsPromised;
    chai           = root.chai;
  }
  var should = chai.should();
  chai.use(chaiAsPromised);

  describe('DepthReader Class', function() {
    var baseUrl = 'http://localhost:9000/images/'
      , jpgData
      , pngData
      , image;

    // register silly normalizer that sets
    // all depthmap pixels to (0,0,255,0)
    DepthReader.registerNormalizer('blue'
      , function(data, opts) {
          for (var i = 0, n = data.length; i < n; i++) {
            data[i] = 2 === (i % 4) ? 255 : 0;
          }
        });

    context('"xdm-photo1.jpg" (XDM v1.0)', function() {
      var jpegUrl = baseUrl + 'xdm-photo1.jpg'
        , reader  = new DepthReader;
      reader.debug = true;

      it('should successfully load JPEG file', function() {
        return reader.loadFile(jpegUrl).should.eventually.equal(reader);
      });

      it('should have set this.isXDM to true', function() {
        reader.isXDM.should.be.true;
      });

      it('should have set this.revision to 1.0', function() {
        reader.revision.should.equal(1);
      });

      it('should have set device manufacturer to "Intel Corporation"', function() {
        reader.device.vendor.manufacturer.should.equal('Intel Corporation');
      });

      it('should have set camera manufacturer to "Intel Corporation"', function() {
        reader.camera.vendor.manufacturer.should.equal('Intel Corporation');
      });

      it('should have set device model to "R200"', function() {
        reader.device.vendor.model.should.equal('R200');
      });

      it('should have set camera model to "R200"', function() {
        reader.camera.vendor.model.should.equal('R200');
      });

      it('should have set device.pose to (0,0,0)', function() {
        reader.device.pose.latitude.should.equal(0.0);
        reader.device.pose.longitude.should.equal(0.0);
        reader.device.pose.altitude.should.equal(0.0);
      });

      it('should have set camera position to (54.112148,-14.849542,-0.822005)', function() {
        reader.camera.pose.positionX.should.equal(54.112148);
        reader.camera.pose.positionY.should.equal(-14.849542);
        reader.camera.pose.positionZ.should.equal(-0.822005);
      });

      it('should have set camera rotation axis to (0.991072,-0.076687,0.109065)', function() {
        reader.camera.pose.rotationAxisX.should.equal(0.991072);
        reader.camera.pose.rotationAxisY.should.equal(-0.076687);
        reader.camera.pose.rotationAxisZ.should.equal(0.109065);
      });

      it('should have set camera rotation angle to 6.262739', function() {
        reader.camera.pose.rotationAngle.should.equal(6.262739);
      });

      it('should have set focal length to (0.883098,0.884171)', function() {
        reader.perspective.focalLengthX.should.equal(0.883098);
        reader.perspective.focalLengthY.should.equal(0.884171);
      });

      it('should have set principal point to (0.538516,0.512869)', function() {
        reader.perspective.principalPointX.should.equal(0.538516);
        reader.perspective.principalPointY.should.equal(0.512869);
      });

      it('should have set image.mime to "image/jpeg"', function() {
        reader.image.mime.should.equal('image/jpeg');
      });

      it('should have set image.data to a data URI', function() {
        reader.image.should.not.have.property('data', null);
        reader.image.data.should.match(/^data:/);
      });

      it('should have reference image at 2880x2067', function() {
        jpgData = reader.image.data;
        return loadImage(jpgData)
          .then(function(img) {
            img.width.should.equal(2880);
            img.height.should.equal(2067);
          });
      });

      it('should have set depth.metric to false', function() {
        reader.depth.metric.should.be.false;
      });

      it('should have set depth.format to "RangeLinear"', function() {
        reader.depth.format.should.equal('RangeLinear');
      });

      it('should have set depth.near to 0.0', function() {
        reader.depth.near.should.equal(0.0);
      });

      it('should have set depth.far to 65535.0', function() {
        reader.depth.far.should.equal(65535.0);
      });

      it('should have set depth.mime to "image/png"', function() {
        reader.depth.mime.should.equal('image/png');
      });

      it('should have set depth.data to a data URI', function() {
        reader.depth.should.not.have.property('data', null);
        reader.depth.data.should.match(/^data:/);
      });

      // FIX: depthmap has different aspect ratio as reference
      it('should have depthmap image at 496x352', function() {
        return loadImage(reader.depth.data)
          .then(function(img) {
            image = img;
            img.width.should.equal(496);
            img.height.should.equal(352);
          });
      });

      it('should have depth.data:100- = "O0729vs7ux"', function() {
        reader.depth.data.substr(100, 10).should.equal('O0729vs7ux');
      });

      it('should have applied the default normalizer', function() {
        return reader.normalizeDepthMap(null)
          .then(function(data) {
            data.substr(250, 10).should.satisfy(function(value) {
              return -1 !== [
                  '7LOe9bb3uf' // canvas
                , '9m//9tuU8v' // Chrome
                , 'XhkZsS8nT2' // PhantomJS
                ].indexOf(value);
            });
          });
      });

      it('should have applied the "blue" normalizer', function() {
        return reader.normalizeDepthMap('blue')
          .then(function(data) {
            data.substr(250, 10).should.satisfy(function(value) {
              return -1 !== [
                  'AAAAAAAAAA' // canvas/PhantomJS
                , 'IECAAAECQQ' // Chrome
                ].indexOf(value);
            });
            pngData = data;
          });
      });

      it('should have set depth.raw.mime to "image/png"', function() {
        reader.depth.raw.mime.should.equal('image/png');
      });

      it('should have set depth.raw.data to a data URI', function() {
        reader.depth.raw.should.not.have.property('data', null);
        reader.depth.raw.data.should.match(/^data:/);
      });

      it('should have raw depthmap image at 480x360', function() {
        return loadImage(reader.depth.raw.data)
          .then(function(img) {
            img.width.should.equal(480);
            img.height.should.equal(360);
          });
      });

      it('should have set confidence.mime to "image/png"', function() {
        reader.confidence.mime.should.equal('image/png');
      });

      it('should have set confidence.data to a data URI', function() {
        reader.confidence.should.not.have.property('data', null);
        reader.confidence.data.should.match(/^data:/);
      });

      it('should have confidence same W & H as depthmap', function() {
        return loadImage(reader.confidence.data)
          .then(function(img) {
            img.width.should.equal(image.width);
            img.height.should.equal(image.height);
          });
      });

      it('should have generated custom serialized JSON', function() {
        JSON.stringify(reader).should.equal('{"is_xdm":true,"revision":1'
          + ',"device":{"vendor":{"manufacturer":"Intel Corporation","model":"R200"}'
            + ',"pose":{"latitude":0,"longitude":0,"altitude":0}}'
          + ',"camera":{"vendor":{"manufacturer":"Intel Corporation","model":"R200"}'
            + ',"pose":{"position_x":54.112148,"position_y":-14.849542,"position_z":-0.822005'
              + ',"rotation_axis_x":0.991072,"rotation_axis_y":-0.076687,"rotation_axis_z":0.109065'
              + ',"rotation_angle":6.262739}}'
          + ',"perspective":{"focal_length_x":0.883098,"focal_length_y":0.884171'
            + ',"principal_point_x":0.538516,"principal_point_y":0.512869}'
          + ',"depth":{"metric":false,"format":"RangeLinear","near":0,"far":65535}}');
      });
    });

    // xdm-photo3.jpg: metadata encoded as XML attributes
    context('"xdm-photo3.jpg" (XDM v1.0)', function() {
      var jpegUrl = baseUrl + 'xdm-photo3.jpg'
        , reader  = new DepthReader;

      it('should successfully load JPEG file', function() {
        return reader.loadFile(jpegUrl).should.eventually.equal(reader);
      });

      it('should have set this.isXDM to true', function() {
        reader.isXDM.should.be.true;
      });

      it('should have set this.revision to 1.0', function() {
        reader.revision.should.equal(1);
      });

      it('should have set device manufacturer to "Intel Corporation"', function() {
        reader.device.vendor.manufacturer.should.equal('Intel Corporation');
      });

      it('should have set camera manufacturer to "Intel Corporation"', function() {
        reader.camera.vendor.manufacturer.should.equal('Intel Corporation');
      });

      it('should have set device model to "R200"', function() {
        reader.device.vendor.model.should.equal('R200');
      });

      it('should have set camera model to "R200"', function() {
        reader.camera.vendor.model.should.equal('R200');
      });

      it('should have set device.pose to (0,0,0)', function() {
        reader.device.pose.latitude.should.equal(0.0);
        reader.device.pose.longitude.should.equal(0.0);
        reader.device.pose.altitude.should.equal(0.0);
      });

      it('should have set camera position to (32.797184,-15.309257,0.034321)', function() {
        reader.camera.pose.positionX.should.equal(32.797184);
        reader.camera.pose.positionY.should.equal(-15.309257);
        reader.camera.pose.positionZ.should.equal(0.034321);
      });

      it('should have set camera rotation axis to (0.731082,-0.438503,-0.522717)', function() {
        reader.camera.pose.rotationAxisX.should.equal(0.731082);
        reader.camera.pose.rotationAxisY.should.equal(-0.438503);
        reader.camera.pose.rotationAxisZ.should.equal(-0.522717);
      });

      it('should have set camera rotation angle to 6.255342', function() {
        reader.camera.pose.rotationAngle.should.equal(6.255342);
      });

      it('should have set focal length to (0.886988,0.888863)', function() {
        reader.perspective.focalLengthX.should.equal(0.886988);
        reader.perspective.focalLengthY.should.equal(0.888863);
      });

      it('should have set principal point to (0.540773,0.506522)', function() {
        reader.perspective.principalPointX.should.equal(0.540773);
        reader.perspective.principalPointY.should.equal(0.506522);
      });

      it('should have set image.mime to "image/jpeg"', function() {
        reader.image.mime.should.equal('image/jpeg');
      });

      it('should have set image.data to a data URI', function() {
        reader.image.should.not.have.property('data', null);
        reader.image.data.should.match(/^data:/);
      });

      it('should have reference image at 2966x2253', function() {
        return loadImage(reader.image.data)
          .then(function(img) {
            img.width.should.equal(2966);
            img.height.should.equal(2253);
          });
      });

      it('should have set depth.metric to false', function() {
        reader.depth.metric.should.be.false;
      });

      it('should have set depth.format to "RangeLinear"', function() {
        reader.depth.format.should.equal('RangeLinear');
      });

      it('should have set depth.near to 0.0', function() {
        reader.depth.near.should.equal(0.0);
      });

      it('should have set depth.far to 65535.0', function() {
        reader.depth.far.should.equal(65535.0);
      });

      it('should have set depth.mime to "image/png"', function() {
        reader.depth.mime.should.equal('image/png');
      });

      it('should have set depth.data to a data URI', function() {
        reader.depth.should.not.have.property('data', null);
        reader.depth.data.should.match(/^data:/);
      });

      it('should have depthmap image at 472x352', function() {
        return loadImage(reader.depth.data)
          .then(function(img) {
            image = img;
            img.width.should.equal(472);
            img.height.should.equal(352);
          });
      });

      it('should have set confidence.mime to "image/png"', function() {
        reader.confidence.mime.should.equal('image/png');
      });

      it('should have set confidence.data to a data URI', function() {
        reader.confidence.should.not.have.property('data', null);
        reader.confidence.data.should.match(/^data:/);
      });

      it('should have confidence same W & H as depthmap', function() {
        var w = image.width
          , h = image.height;
        return loadImage(reader.confidence.data)
          .then(function(img) {
            img.width.should.equal(w);
            img.height.should.equal(h);
          });
      });
    });

    // xdm-photo4.jpg: metadata encoded as XML elements
    context('"xdm-photo4.jpg" (XDM v1.0)', function() {
      var jpegUrl = baseUrl + 'xdm-photo4.jpg'
        , reader  = new DepthReader;

      it('should successfully load JPEG file', function() {
        return reader.loadFile(jpegUrl).should.eventually.equal(reader);
      });

      it('should have set this.isXDM to true', function() {
        reader.isXDM.should.be.true;
      });

      it('should have set this.revision to 1.0', function() {
        reader.revision.should.equal(1);
      });

      it('should have set camera manufacturer to "Intel Corporation"', function() {
        reader.camera.vendor.manufacturer.should.equal('Intel Corporation');
      });

      it('should have set camera model to "R200"', function() {
        reader.camera.vendor.model.should.equal('R200');
      });

      it('should have set device.pose to (0,0,0)', function() {
        reader.device.pose.latitude.should.equal(0.0);
        reader.device.pose.longitude.should.equal(0.0);
        reader.device.pose.altitude.should.equal(0.0);
      });

      it('should have set camera position to (32.797184,-15.309257,0.034321)', function() {
        reader.camera.pose.positionX.should.equal(32.797184);
        reader.camera.pose.positionY.should.equal(-15.309257);
        reader.camera.pose.positionZ.should.equal(0.034321);
      });

      it('should have set camera rotation axis to (0.020356,-0.012210,-0.014555)', function() {
        reader.camera.pose.rotationAxisX.should.equal(0.020356);
        reader.camera.pose.rotationAxisY.should.equal(-0.012210);
        reader.camera.pose.rotationAxisZ.should.equal(-0.014555);
      });

      it('should have set focal length to (0.887287,0.889163)', function() {
        reader.perspective.focalLengthX.should.equal(0.887287);
        reader.perspective.focalLengthY.should.equal(0.889163);
      });

      it('should have set principal point to (0.540955,0.507184)', function() {
        reader.perspective.principalPointX.should.equal(0.540955);
        reader.perspective.principalPointY.should.equal(0.507184);
      });

      it('should have set image.mime to "image/jpeg"', function() {
        reader.image.mime.should.equal('image/jpeg');
      });

      it('should have set image.data to a data URI', function() {
        reader.image.should.not.have.property('data', null);
        reader.image.data.should.match(/^data:/);
      });

      it('should have reference image at 2965x2254', function() {
        return loadImage(reader.image.data)
          .then(function(img) {
            img.width.should.equal(2965);
            img.height.should.equal(2254);
          });
      });

      it('should have set depth.metric to false', function() {
        reader.depth.metric.should.be.false;
      });

      it('should have set depth.format to "RangeLinear"', function() {
        reader.depth.format.should.equal('RangeLinear');
      });

      it('should have set depth.near to 0.0', function() {
        reader.depth.near.should.equal(0.0);
      });

      it('should have set depth.far to 65535.0', function() {
        reader.depth.far.should.equal(65535.0);
      });

      it('should have set depth.mime to "image/png"', function() {
        reader.depth.mime.should.equal('image/png');
      });

      it('should have set depth.data to a data URI', function() {
        reader.depth.should.not.have.property('data', null);
        reader.depth.data.should.match(/^data:/);
      });

      it('should have depthmap image at 472x352', function() {
        return loadImage(reader.depth.data)
          .then(function(img) {
            image = img;
            img.width.should.equal(472);
            img.height.should.equal(352);
          });
      });

      it('should have set confidence.mime to "image/png"', function() {
        reader.confidence.mime.should.equal('image/png');
      });

      it('should have set confidence.data to a data URI', function() {
        reader.confidence.should.not.have.property('data', null);
        reader.confidence.data.should.match(/^data:/);
      });

      it('should have confidence same W & H as depthmap', function() {
        var w = image.width
          , h = image.height;
        return loadImage(reader.confidence.data)
          .then(function(img) {
            img.width.should.equal(w);
            img.height.should.equal(h);
          });
      });
    });

    context('"lbr-photo1.jpg" (Lens Blur)', function() {
      var jpegUrl = baseUrl + 'lbr-photo1.jpg'
        , reader  = new DepthReader;
      reader.debug = true;

      it('should successfully load JPEG file', function() {
        return reader.loadFile(jpegUrl).should.eventually.equal(reader);
      });

      it('should have set this.isXDM to false', function() {
        reader.isXDM.should.be.false;
      });

      it('should have set image.mime to "image/jpeg"', function() {
        reader.image.mime.should.equal('image/jpeg');
      });

      it('should have set image.data to a data URI', function() {
        reader.image.should.not.have.property('data', null);
        reader.image.data.should.match(/^data:/);
      });

      it('should have reference image at 576x1024', function() {
        return loadImage(reader.image.data)
          .then(function(img) {
            img.width.should.equal(576);
            img.height.should.equal(1024);
          });
      });

      it('should have set depth.metric to false', function() {
        reader.depth.metric.should.be.false;
      });

      it('should have set depth.format to "RangeInverse"', function() {
        reader.depth.format.should.equal('RangeInverse');
      });

      it('should have set depth.near to 6.097831726074219', function() {
        reader.depth.near.should.equal(6.097831726074219);
      });

      it('should have set depth.far to 24.221643447875977', function() {
        reader.depth.far.should.equal(24.221643447875977);
      });

      it('should have set depth.mime to "image/png"', function() {
        reader.depth.mime.should.equal('image/png');
      });

      it('should have set depth.data to a data URI', function() {
        reader.depth.should.not.have.property('data', null);
        reader.depth.data.should.match(/^data:/);
      });

      it('should have depthmap image at 576x1024', function() {
        // here normalizeDepthMap() is just a
        // no-op (included for code coverage)
        return reader.normalizeDepthMap()
          .then(loadImage)
          .then(function(img) {
            img.width.should.equal(576);
            img.height.should.equal(1024);
          });
      });

      it('should have set focal point to (0.5,0.5)', function() {
        reader.focus.focalPointX.should.equal(0.5);
        reader.focus.focalPointY.should.equal(0.5);
      });

      it('should have set focus.focalDistance to 9.190595', function() {
        reader.focus.focalDistance.should.equal(9.190595);
      });

      it('should have set focus.blurAtInfinity to 0.014069436', function() {
        reader.focus.blurAtInfinity.should.equal(0.014069436);
      });

      it('should have generated custom serialized JSON', function() {
        JSON.stringify(reader).should.equal('{"is_xdm":false'
          + ',"focus":{"focal_point_x":0.5,"focal_point_y":0.5'
            + ',"focal_distance":9.190595,"blur_at_infinity":0.014069436}'
          + ',"depth":{"format":"RangeInverse","near":6.097831726074219'
            + ',"far":24.221643447875977}}');
      });
    });

    context('intentional failure cases', function() {
      var reader = new DepthReader
        , jpgBuf = new Uint8Array([
            0xff, 0xd8, 0xff, 0xe0, 0x00
          , 0x10, 0x4a, 0x46, 0x49, 0x46
          ])
        , parser = function(buf) {
            return function() {
              reader.parseFile(buf);
            };
          };

      it('should throw "file not found" / "protocol error" on file:// URL', function() {
        return reader.loadFile('file:///foo').should.be
          .rejectedWith(/protocol error|file not found/);
      });

      it('should throw "host not found" on http:// URL with invalid port', function() {
        return reader.loadFile('http://localhost:65535/')
          .should.be.rejectedWith(/host not found/);
      });

      it('should throw 404 error / "Cannot GET" on invalid http:// URL', function() {
        return reader.loadFile('http://localhost:9000/foo.jpg')
          .should.be.rejectedWith(/404|Cannot GET/);
      });

      it('should throw "file is not a JPEG image" on loading README.md', function() {
        return reader.loadFile('http://localhost:9000/README.md')
          .should.be.rejectedWith(/file is not a JPEG image/);
      });

      it('should throw "cannot parse the XMP XML" on loading flat JPEG', function() {
        var regex = /^data:image\/jpeg;base64,/;
        jpgData.should.match(regex);

        var  buf = atob(jpgData.replace(regex, ''));
        if (!buf.length) { // PhantomJS
          buf = jpgBuf;
        }
        parser(buf).should.throw(/cannot parse the XMP XML/);
      });

      it('should not set revision to 1.0 because Device NS is missing', function() {
        reader.xmpXapXml = '<?xpacket begin="ï»¿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
          + ' <x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 5.5.0">'
          + ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
          + ' <rdf:Description xmlns:xmpNote="http://ns.adobe.com/xmp/note/"'
          + ' xmpNote:HasExtendedXMP="D7666472D7D4AB721A6AB7C531E29117"/>'
          + ' </rdf:RDF> </x:xmpmeta>';
        reader.xmpExtXml = '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 5.5.0">'
          + ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
          + ' <rdf:Description xmlns:FooBar="http://ns.xdm.org/photos/1.0/foobar/"'
          + ' xmlns:Camera="http://ns.xdm.org/photos/1.0/camera/"'
          + ' xmlns:Image="http://ns.xdm.org/photos/1.0/image/"'
          + ' xmlns:Depthmap="http://ns.xdm.org/photos/1.0/depthmap/"'
          + ' FooBar:Revision="1.0"> <FooBar:Cameras> <rdf:Seq>'
          + ' <rdf:li rdf:parseType="Resource"> <Camera:DepthMap>'
          + ' <rdf:Description Depthmap:Format="RangeLinear" Depthmap:Mime="image/png"'
          + ' Depthmap:Data="iVBORw0KGgoAAAANSUhEUgAAAeAAAAFoEAAAAAD6zKu"/>'
          + ' </Camera:DepthMap> </rdf:li> </rdf:Seq> </FooBar:Cameras>'
          + ' </rdf:Description> </rdf:RDF> </x:xmpmeta>';

        parser(jpgBuf).should.not.throw();
        reader.revision.should.not.equal(1);
      });

      it('should throw "cannot load image" on normalizing depthmap', function() {
        reader.depth.mime.should.equal('image/png');
        reader.depth.data.should.match(/^data:/);

        return reader.normalizeDepthMap()
          .should.be.rejectedWith(/cannot load image/);
      });

      it('should throw "not registered" when normalizer is missing', function() {
        reader.depth.data = pngData;

        // first normalize call sets depth._origImage
        // for use by final "normalizer failed" test
        return reader.normalizeDepthMap()
          .then(function() {
            return reader.normalizeDepthMap('fail');
          })
          .should.be.rejectedWith(/not registered/);
      });

      it('should throw "invalid name/func" on registerNormalizer()', function() {
        DepthReader.registerNormalizer.should.throw(/invalid name/);
      });

      it('should throw "normalizer failed" when normalizer throws', function() {
        DepthReader.registerNormalizer('fail'
          , function(data, opts) {
              throw new Error('missing param');
            });
        return reader.normalizeDepthMap('fail')
          .should.be.rejectedWith(/normalizer failed/);
      });
    });
  });

  function loadImage(src, img) {
    return new Promise(function(resolve, reject) {
      if (!img) {
        img = new Image;
      }
      img.onload  = function() { resolve(img); };
      img.onerror = function() {
        reject(new Error('cannot load image'));
      };
      img.src = src;
    });
  }

  function atob(b64) {
    if (!root.atob) {
      return new Buffer(b64, 'base64');
    }
    try {
      var str = root.atob(b64)
        , len = str.length
        , buf = new Uint8Array(len);

      for (var i = 0; i < len; i++) {
        buf[i] = str.charCodeAt(i);
      }
      return buf;
    } catch (err) { // PhantomJS
      return new Uint8Array;
    }
  }
}).call(this);
