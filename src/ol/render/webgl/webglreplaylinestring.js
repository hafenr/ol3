goog.provide('ol.render.webgl.LineStringReplay');

goog.require('goog.asserts');
goog.require('goog.object');
goog.require('goog.vec.Mat4');
goog.require('ol.color');
// goog.require('ol.color.Matrix');
goog.require('ol.extent');
goog.require('ol.render.VectorContext');
goog.require('ol.render.webgl.polygonreplay.shader.Default');
goog.require('ol.vec.Mat4');
goog.require('ol.webgl.Buffer');
goog.require('ol.webgl.Context');


/**
 * @constructor
 * @extends {ol.render.VectorContext}
 * @param {number} tolerance Tolerance.
 * @param {ol.Extent} maxExtent Max extent.
 * @struct
 */
ol.render.webgl.LineStringReplay = function(tolerance, maxExtent) {
  goog.base(this);

  /**
   * @private
   * @type {ol.Color}
   */
  this.strokeColor_ = null;


  /**
   * The origin of the coordinate system for the point coordinates sent to
   * the GPU.
   * @private
   * @type {ol.Coordinate}
   */
  this.origin_ = ol.extent.getCenter(maxExtent);


  /**
   * @private
   * @type {ol.render.webgl.polygonreplay.shader.Default.Locations}
   */
  this.defaultLocations_ = null;

  /**
   * @type {!goog.vec.Mat4.Number}
   * @private
   */
  this.projectionMatrix_ = goog.vec.Mat4.createNumberIdentity();

  /**
   * @type {Array.<number>}
   * @private
   */
  this.vertices_ = [];

  /**
   * @type {ol.webgl.Buffer}
   * @private
   */
  this.verticesBuffer_ = null;
};
goog.inherits(ol.render.webgl.LineStringReplay, ol.render.VectorContext);


/**
 * Draw one line.
 * @param {Array.<ol.Coordinate>} coordinates
 * @private
 */
ol.render.webgl.LineStringReplay.prototype.populateVerticesArray_ =
    function(coordinates) {
  var i, ii;

  // Shift the indices to take into account previously handled lines
  for (i = 0, ii = coordinates.length - 1; i < ii; ++i) {
    var point1 = coordinates[i];
    this.vertices_.push(point1[0]);
    this.vertices_.push(point1[1]);
    this.vertices_.push(this.strokeColor_[0]);
    this.vertices_.push(this.strokeColor_[1]);
    this.vertices_.push(this.strokeColor_[2]);
    this.vertices_.push(this.strokeColor_[3]);

    var point2 = coordinates[i + 1];
    this.vertices_.push(point2[0]);
    this.vertices_.push(point2[1]);
    this.vertices_.push(this.strokeColor_[0]);
    this.vertices_.push(this.strokeColor_[1]);
    this.vertices_.push(this.strokeColor_[2]);
    this.vertices_.push(this.strokeColor_[3]);
  }
};


/**
 * @inheritDoc
 */
ol.render.webgl.LineStringReplay.prototype.drawLineString =
    function(geometry, feature) {
  this.populateVerticesArray_(geometry.getCoordinates());
};

/**
 * Draw a linear ring geometry.
 * This function can be called by a PolygonReplay in order to 
 * prepare the drawing of its outline.
 * @param {ol.geom.LinearRing} geometry A linear ring geometry.
 */
ol.render.webgl.LineStringReplay.prototype.drawLinearRing =
    function(geometry) {
  this.populateVerticesArray_(geometry.getCoordinates());
};

/**
 * @inheritDoc
 */
ol.render.webgl.LineStringReplay.prototype.drawMultiLineString =
    function(geometry, feature) {
  var coordinatess = geometry.getCoordinates();
  var i, ii;
  for (i = 0, ii = coordinatess.length; i < ii; ++i) {
    this.populateVerticesArray_(coordinatess[i]);
  }
};


/**
 * @param {ol.webgl.Context} context Context.
 **/
ol.render.webgl.LineStringReplay.prototype.finish = function(context) {
  // create, bind, and populate the vertices buffer
  this.verticesBuffer_ = new ol.webgl.Buffer(this.vertices_);
  context.bindBuffer(goog.webgl.ARRAY_BUFFER, this.verticesBuffer_);
};


/**
 * @param {ol.webgl.Context} context WebGL context.
 * @return {function()} Delete resources function.
 */
ol.render.webgl.LineStringReplay.prototype.getDeleteResourcesFunction =
    function(context) {
  // We only delete our stuff here. The shaders and the program may
  // be used by other LineStringReplay instances (for other layers). And
  // they will be deleted when disposing of the ol.webgl.Context
  // object.
  goog.asserts.assert(!goog.isNull(this.verticesBuffer_),
      'verticesBuffer must not be null');
  var verticesBuffer = this.verticesBuffer_;
  return function() {
    context.deleteBuffer(verticesBuffer);
  };
};


/**
 * @param {ol.webgl.Context} context Context.
 * @param {ol.Coordinate} center Center.
 * @param {number} resolution Resolution.
 * @param {number} rotation Rotation.
 * @param {ol.Size} size Size.
 * @param {number} pixelRatio Pixel ratio.
 * @param {number} opacity Global opacity.
 * @param {Object} skippedFeaturesHash Ids of features to skip.
 * @param {function(ol.Feature): T|undefined} featureCallback Feature callback.
 * @param {boolean} oneByOne Draw features one-by-one for the hit-detecion.
 * @param {ol.Extent=} opt_hitExtent Hit extent: Only features intersecting
 *  this extent are checked.
 * @return {T|undefined} Callback result.
 * @template T
 */
ol.render.webgl.LineStringReplay.prototype.replay = function(context,
    center, resolution, rotation, size, pixelRatio, opacity, 
    skippedFeaturesHash, featureCallback, oneByOne, opt_hitExtent) {
  var gl = context.getGL();

  // bind the vertices buffer
  goog.asserts.assert(!goog.isNull(this.verticesBuffer_),
      'verticesBuffer must not be null');
  context.bindBuffer(goog.webgl.ARRAY_BUFFER, this.verticesBuffer_);

  // get the program
  var fragmentShader, vertexShader;
  fragmentShader =
      ol.render.webgl.polygonreplay.shader.DefaultFragment.getInstance();
  vertexShader =
      ol.render.webgl.polygonreplay.shader.DefaultVertex.getInstance();
  var program = context.getProgram(fragmentShader, vertexShader);

  // get the locations
  var locations;
  if (goog.isNull(this.defaultLocations_)) {
    locations = new ol.render.webgl.polygonreplay.shader.Default
      .Locations(gl, program);
    this.defaultLocations_ = locations;
  } else {
    locations = this.defaultLocations_;
  }

  context.useProgram(program);

  // enable the vertex attrib arrays
  gl.enableVertexAttribArray(locations.a_position);
  gl.vertexAttribPointer(locations.a_position, 2, goog.webgl.FLOAT,
      false, 24, 0);

  gl.enableVertexAttribArray(locations.a_color);
  gl.vertexAttribPointer(locations.a_color, 4, goog.webgl.FLOAT,
      false, 24, 8);

  // set the "uniform" values
  // TODO: use RTE to avoid jitter
  var projectionMatrix = this.projectionMatrix_;
  ol.vec.Mat4.makeTransform2D(projectionMatrix,
      0.0, 0.0,
      pixelRatio * 2 / (resolution * size[0]),
      pixelRatio * 2 / (resolution * size[1]),
      -rotation,
      -center[0], -center[1]);

  gl.uniformMatrix4fv(locations.u_projectionMatrix, false, projectionMatrix);

  // draw!
  var result;
  if (!goog.isDef(featureCallback)) {
    this.drawReplay_(gl, context, skippedFeaturesHash);
  } else {
    // TODO: draw feature by feature for the hit-detection
  }

  // disable the vertex attrib arrays
  gl.disableVertexAttribArray(locations.a_position);
  gl.disableVertexAttribArray(locations.a_color);

  return result;
};


/**
 * @private
 * @param {WebGLRenderingContext} gl gl.
 * @param {ol.webgl.Context} context Context.
 * @param {Object} skippedFeaturesHash Ids of features to skip.
 */
ol.render.webgl.LineStringReplay.prototype.drawReplay_ =
    function(gl, context, skippedFeaturesHash) {
  if (!goog.object.isEmpty(skippedFeaturesHash)) {
    // TODO: draw by blocks to skip features
  } else {
    var numItems = this.vertices_.length / 6;
    // FIXME: not compatible with batching, hardcoding some arbitrary value
    gl.lineWidth(3);
    gl.drawArrays(goog.webgl.LINES, 0, numItems);
    gl.lineWidth(1);
  }
};


/**
 * @inheritDoc
 */
ol.render.webgl.LineStringReplay.prototype.setFillStrokeStyle =
    function(fillStyle, strokeStyle) {
  if (!goog.isNull(strokeStyle)) {
    var strokeStyleColor = strokeStyle.getColor();
    this.strokeColor_ = !goog.isNull(strokeStyleColor) ?
        ol.color.asArray(strokeStyleColor).map(function(c, i) {
          return i != 3 ? c / 255 : c;
        }) : [0.0, 0.0, 0.0, 1.0];
  } else {
    this.strokeColor_ = null;
  }
};

