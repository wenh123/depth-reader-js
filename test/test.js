(function() {
  'use strict';

  var root = this // _window_ if in browser
    , Image
    , DepthReader
    , chaiAsPromised
    , chai;

  if ('object' === typeof exports) { // Node.js
    Image          = require('canvas').Image;
    DepthReader    = require('../src/depth-reader');
    chaiAsPromised = require('chai-as-promised');
    chai           = require('chai');
  } else { // browser
    Image          = root.Image;
    DepthReader    = root.DepthReader;
    chaiAsPromised = root.chaiAsPromised;
    chai           = root.chai;
  }
  var should = chai.should();
  chai.use(chaiAsPromised);

  describe('DepthReader Class', function() {
    var baseUrl = 'http://localhost:9000/images/';

    context('"xdm-photo1.jpg" (XDM Beta)', function() {
      var jpegUrl = baseUrl + 'xdm-photo1.jpg'
        , reader  = new DepthReader
        , image   = new Image;

      it('should successfully load JPEG file', function() {
        return reader.loadFile(jpegUrl).should.eventually.equal(reader);
      });

      it('should have set this.isXDM to true', function() {
        reader.isXDM.should.be.true;
      });

      it('should have set this.revision to 1.0', function() {
        reader.revision.should.equal(1.0);
      });

      it('should have set image.mime to "image/jpeg"', function() {
        reader.image.mime.should.equal('image/jpeg');
      });

      it('should have set image.data to a data URI', function() {
        reader.image.should.not.have.property('data', null);
        reader.image.data.slice(0, 5).should.equal('data:');
      });

      it('should have reference image at 2965x2254', function() {
        image.src = reader.image.data;
        image.width.should.equal(2965);
        image.height.should.equal(2254);
      });

      it('should have set depth.inMetric to false', function() {
        reader.depth.inMetric.should.be.false;
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
        reader.normalizeDepthmap();
        image.src = reader.depth.data;
        image.width.should.equal(472);
        image.height.should.equal(352);
      });
    });

    context('"lbr-photo1.jpg" (Lens Blur)', function() {
      var jpegUrl = baseUrl + 'lbr-photo1.jpg'
        , reader  = new DepthReader
        , image   = new Image;

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
        image.src = reader.image.data;
        image.width.should.equal(576);
        image.height.should.equal(1024);
      });

      it('should have set depth.inMetric to true', function() {
        reader.depth.inMetric.should.be.true;
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
        image.src = reader.depth.data;
        image.width.should.equal(576);
        image.height.should.equal(1024);
      });

      it('should have set focus.focalPointX to 0.5', function() {
        reader.focus.focalPointX.should.equal(0.5);
      });

      it('should have set focus.focalPointY to 0.5', function() {
        reader.focus.focalPointY.should.equal(0.5);
      });

      it('should have set focus.focalDistance to 9.190595', function() {
        reader.focus.focalDistance.should.equal(9.190595);
      });

      it('should have set focus.blurAtInfinity to 0.014069436', function() {
        reader.focus.blurAtInfinity.should.equal(0.014069436);
      });
    });
  });
}).call(this);
