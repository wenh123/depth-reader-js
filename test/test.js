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

  function loadImage(src, img) {
    return new Promise(function(resolve, reject) {
      try {
        if (!img) {
          img = new Image;
        }
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

  describe('DepthReader Class', function() {
    var baseUrl = 'http://localhost:9000/images/'
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

      it('should successfully load JPEG file', function() {
        return reader.loadFile(jpegUrl).should.eventually.equal(reader);
      });

      it('should have set this.isXDM to true', function() {
        reader.isXDM.should.be.true;
      });

      it('should have set this.revision to 1.0', function() {
        reader.revision.should.equal(1.0);
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
        reader.image.data.slice(0, 5).should.equal('data:');
      });

      it('should have reference image at 2880x2067', function() {
        return loadImage(reader.image.data)
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
        reader.depth.data.slice(0, 5).should.equal('data:');
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
        return reader.normalizeDepthMap()
          .then(function(data) {
            data.substr(100, 10).should.satisfy(function(value) {
              return 'R4nOy9XYtc' === value  // canvas
                  || 'JKWxEPeMAD' === value; // Chrome
            });
          });
      });

      it('should have applied the "blue" normalizer', function() {
        return reader.normalizeDepthMap('blue')
          .then(function(data) {
            data.substr(100, 10).should.satisfy(function(value) {
              return 'R4nO3BMQEA' === value  // canvas
                  || 'aQM3DnCBAg' === value; // Chrome
            });
          });
      });

      it('should have set depth.raw.mime to "image/png"', function() {
        reader.depth.raw.mime.should.equal('image/png');
      });

      it('should have set depth.raw.data to a data URI', function() {
        reader.depth.raw.should.not.have.property('data', null);
        reader.depth.raw.data.slice(0, 5).should.equal('data:');
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
        reader.confidence.data.slice(0, 5).should.equal('data:');
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
            + ',"pose":{"position_x":54.112148,"position_y":-14.849542,"position_z":-0.822005,"rotation_axis_x":0.991072,"rotation_axis_y":-0.076687,"rotation_axis_z":0.109065,"rotation_angle":6.262739}}'
          + ',"perspective":{"focal_length_x":0.883098,"focal_length_y":0.884171,"principal_point_x":0.538516,"principal_point_y":0.512869}'
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
        reader.revision.should.equal(1.0);
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
        reader.image.data.slice(0, 5).should.equal('data:');
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
        reader.depth.data.slice(0, 5).should.equal('data:');
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
        reader.confidence.data.slice(0, 5).should.equal('data:');
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
        reader.revision.should.equal(1.0);
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
        reader.image.data.slice(0, 5).should.equal('data:');
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
        reader.depth.data.slice(0, 5).should.equal('data:');
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
        reader.confidence.data.slice(0, 5).should.equal('data:');
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
        reader.image.data.slice(0, 5).should.equal('data:');
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
        reader.depth.data.slice(0, 5).should.equal('data:');
      });

      it('should have depthmap image at 576x1024', function() {
        return loadImage(reader.depth.data)
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
          + ',"focus":{"focal_point_x":0.5,"focal_point_y":0.5,"focal_distance":9.190595,"blur_at_infinity":0.014069436}'
          + ',"depth":{"format":"RangeInverse","near":6.097831726074219,"far":24.221643447875977}}');
      });
    });
  });
}).call(this);
