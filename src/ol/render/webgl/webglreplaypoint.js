goog.provide('ol.render.webgl.PointReplay');

goog.require('goog.asserts');
goog.require('goog.object');
goog.require('ol.color');
goog.require('ol.extent');
goog.require('ol.webgl.Buffer');
goog.require('ol.webgl.Context');
goog.require('ol.render.VectorContext');
goog.require('ol.render.webgl.pointreplay.shader.Default');


/**
 * A point replay is in charge of rendering a collection of point geometries.
 * @constructor
 * @extends {ol.render.VectorContext}
 * @param {number} tolerance Tolerance.
 * @param {ol.Extent} maxExtent Max extent.
 * @struct
 */
ol.render.webgl.PointReplay = function(tolerance, maxExtent) {
  goog.base(this);

  /**
   * The point size.
   * TODO: Make this settable via style.
   * @private
   * @type {number}
   */
  this.pointSize_ = 10;

  /**
   * The default fill color to use.
   * @private
   * @type {ol.Color}
   */
  this.fillColor_ = null;

  /**
   * @type {!goog.vec.Mat4.Number}
   * @private
   */
  this.projectionMatrix_ = goog.vec.Mat4.createNumberIdentity();

  /**
   * The origin of the coordinate system for the point coordinates sent to
   * the GPU.
   * @private
   * @type {ol.Coordinate}
   */
  this.origin_ = ol.extent.getCenter(maxExtent);

  /**
   * An array that holds all the vertices of the points rendered by this replay.
   * Following each point the color of the point is stored. Therefore,
   * for n vertices the format would look like the following:
   *
   * [x1, y1, r1, g1, b1, a1,  // coordinates and colors for point 1
   *  x2, y2, r2, g2, b2, a2,  // coordinates and colors for point 2
   *  ...
   *  xn, yn, rn, gn, bn, an]  // coordinates and colors for point n
   *
   * Before a draw call is executed this array is used to populate a vertexBuffer.
   *
   * @type {Array.<number>}
   * @private
   */
  this.vertexAttributes_ = [];

  /**
   * The vertex buffer populated form `vertices_` that is bound as an array buffer. 
   * @type {ol.webgl.Buffer}
   * @private
   */
  this.vertexAttributesBuffer_ = null;

  /**
   * The features whose points are rendered by this replay.
   * @type {Array.<ol.Feature>}
   * @private
   */
  this.features_ = [];

  /**
   * @private
   * @type {ol.render.webgl.pointreplay.shader.Default.Locations}
   */
  this.defaultLocations_ = null;
};
goog.inherits(ol.render.webgl.PointReplay, ol.render.VectorContext);


/**
 * Populate the vertex array for a point geometry.
 * @param {ol.Coordinate} coordinate
 * @param {Array.<number>} fillColor The fill color of the point.
 * This has to be an array of size 4 and each value has to be between 0 and one.
 * @param {number} pointSize The size of the point
 * @private
 */
ol.render.webgl.PointReplay.prototype.populateVerticesArray_ =
    function(coordinate, fillColor, pointSize) {
  this.vertexAttributes_.push(coordinate[0]);
  this.vertexAttributes_.push(coordinate[1]);
  this.vertexAttributes_.push(fillColor[0]);
  this.vertexAttributes_.push(fillColor[1]);
  this.vertexAttributes_.push(fillColor[2]);
  this.vertexAttributes_.push(fillColor[3]);
  this.vertexAttributes_.push(pointSize);
};


/**
 * @inheritDoc
 */
ol.render.webgl.PointReplay.prototype.drawMultiPoint =
    function(geometry, feature) {
  var fillColor = this.getFillColorForFeature_(feature);
  if (!fillColor) {
    return;
  }

  var coordinates = geometry.getCoordinates();
  var i, n;
  for (i = 0, n = coordinates.length; i < n; i++) {
    this.populateVerticesArray_(coordinates[i], fillColor, this.pointSize_);
  }
};


/**
 * @private
 * @param {ol.Feature|ol.render.Feature} feature The feature for which to get the color
 * @returns {Array.<number>} An array of normalized color components.
 */
ol.render.webgl.PointReplay.prototype.getFillColorForFeature_ = function(feature) {
  var fillColor;
  if (feature.getStyle() !== null) {
    var color = feature.getStyle().getFill().getColor();
    fillColor = this.normalizeColor_(/** @type {ol.Color} */ (color));
  } else {
    // Get the default color
    fillColor = this.fillColor_;
  }
  return fillColor;
};


/**
 * @inheritDoc
 */
ol.render.webgl.PointReplay.prototype.drawPoint =
    function(pointGeometry, feature) {
  var fillColor = this.getFillColorForFeature_(feature);
  if (!fillColor) {
    return;
  }

  // Populate the vertex attribute array with the right values for this
  // point. 
  if (fillColor) {
    var coordinates = pointGeometry.getCoordinates();
    this.features_.push(/** @type {ol.Feature} */ (feature));
    this.populateVerticesArray_(coordinates, fillColor, this.pointSize_);
  } else {
    console.log('No fill color set for point, won\'t draw!');
    return;
  }
};


/**
 * @param {ol.webgl.Context} context Context.
 **/
ol.render.webgl.PointReplay.prototype.finish = function(context) {
  // Create, bind, and populate the vertices buffer
  this.vertexAttributesBuffer_ = new ol.webgl.Buffer(this.vertexAttributes_);
  context.bindBuffer(goog.webgl.ARRAY_BUFFER, this.vertexAttributesBuffer_);
};


/**
 * @param {ol.webgl.Context} context WebGL context.
 * @return {function()} Delete resources function.
 */
ol.render.webgl.PointReplay.prototype.getDeleteResourcesFunction =
    function(context) {
  goog.asserts.assert(this.vertexAttributesBuffer_ !== null,
      'verticesBuffer must not be null');
  var verticesBuffer = this.vertexAttributesBuffer_;

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
ol.render.webgl.PointReplay.prototype.replay = function(context,
    center, resolution, rotation, size, pixelRatio,
    opacity, skippedFeaturesHash,
    featureCallback, oneByOne, opt_hitExtent) {
  var gl = context.getGL();

  // Get the program
  var fragmentShader, vertexShader;
  fragmentShader =
      ol.render.webgl.pointreplay.shader.DefaultFragment.getInstance();
  vertexShader =
      ol.render.webgl.pointreplay.shader.DefaultVertex.getInstance();
  var program = context.getProgram(fragmentShader, vertexShader);

  context.useProgram(program);

  // Get the locations
  var locations;
  if (this.defaultLocations_ === null) {
    locations = new ol.render.webgl.pointreplay.shader.Default
      .Locations(gl, program);
    this.defaultLocations_ = locations;
  } else {
    locations = this.defaultLocations_;
  }

  gl.uniform1f(locations.u_opacity, opacity);

  //// Specify the vertex attributes
  // In this case the structure of a vertex attrib array looks like this:
  // [x1 y1 r1 g1 b1 a1 size1
  //  x2 y2 r2 g2 b2 a2 size2
  //  ....]
  
  // The total length of attributes for one vertex is therefore calculated as:
  // (2 positional attributes + 4 color attributes + 1 size attribute) * 4 bytes per float = 28
  var nBytesPerPoint = 28;

  // Bind the vertices buffer s.t. the pointers are set correctly
  goog.asserts.assert(this.vertexAttributesBuffer_ !== null,
      'verticesBuffer must not be null');
  context.bindBuffer(goog.webgl.ARRAY_BUFFER, this.vertexAttributesBuffer_);

  /// Set the pointer for the position attribute
  // Function signature:
  // glVertexAttribPointer(index, size, type, normalized, stride, offset)
  gl.enableVertexAttribArray(locations.a_position);
  gl.vertexAttribPointer(locations.a_position, 2, goog.webgl.FLOAT,
    false, nBytesPerPoint, 0);

  /// Set the pointer for the color attribute
  // Offset of color attributes pointer to positional attributes:
  // 2 positional attributes * 4 bytes per float = 8
  var offsetColorAttr = 8;
  gl.enableVertexAttribArray(locations.a_color);
  gl.vertexAttribPointer(locations.a_color, 4, goog.webgl.FLOAT,
    false, nBytesPerPoint, offsetColorAttr);

  /// Set the pointer for the size attribute
  // Offset of size attribute pointer to positional attributes:
  // (2 positional attributes + 4 color attributes) * 4 bytes per float = 24
  var offsetSizeAttr = 24;  // 24
  gl.enableVertexAttribArray(locations.a_pointsize);
  gl.vertexAttribPointer(locations.a_pointsize, 1, goog.webgl.FLOAT,
    false, nBytesPerPoint, offsetSizeAttr);

  // TODO: use RTE to avoid jitter
  var projectionMatrix = this.projectionMatrix_;
  ol.vec.Mat4.makeTransform2D(projectionMatrix,
      0.0, 0.0,
      pixelRatio * 2 / (resolution * size[0]),
      pixelRatio * 2 / (resolution * size[1]),
      -rotation,
      -center[0], -center[1]);
  gl.uniformMatrix4fv(locations.u_projectionMatrix, false, projectionMatrix);

  var result;
  if (!goog.isDef(featureCallback)) {
    // DRAW FOR VISUALIZATION
    this.drawReplay_(gl, context, skippedFeaturesHash);
  } else {
    // DRAW FOR HIT DETECTION
    //
    // Set the blend function to additive blending for hit detection.
    // In this way one can detect wether a pixel was drawn with a color like (1, 1, 1, 0), i.e.
    // white with 100% opacity.
    gl.blendFunc(gl.ONE, gl.ONE);
    var elementType = context.hasOESElementIndexUint ?
        goog.webgl.UNSIGNED_INT : goog.webgl.UNSIGNED_SHORT;

    var feature, dontSkipFeature, featureIntersectsHitExtent, featureUid;
    var featureIndex = this.features_.length - 1;
    var elementSize = context.hasOESElementIndexUint ? 4 : 2;
    var featureHasGeometry;

    while (featureIndex >= 0) {

      feature = this.features_[featureIndex];

      featureUid = goog.getUid(feature).toString();
      dontSkipFeature = !goog.isDef(skippedFeaturesHash[featureUid]);
      featureHasGeometry = goog.isDefAndNotNull(feature.getGeometry());
      featureIntersectsHitExtent = !goog.isDef(opt_hitExtent) || ol.extent.intersects(
          opt_hitExtent, feature.getGeometry().getExtent());

      if (dontSkipFeature && featureHasGeometry && featureIntersectsHitExtent) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (numItems > 0) {
          gl.drawArrays(goog.webgl.POINTS, featureIndex, 1);
        }

        result = featureCallback(feature);
        if (result) {
          return result;
        }
      }
      featureIndex--;
    }

    // Reset the blend function to the original value
    gl.blendFuncSeparate(
      goog.webgl.SRC_ALPHA, goog.webgl.ONE_MINUS_SRC_ALPHA,
      goog.webgl.ONE, goog.webgl.ONE_MINUS_SRC_ALPHA
    );
  }

  // Disable the vertex attrib arrays
  gl.disableVertexAttribArray(locations.a_position);
  gl.disableVertexAttribArray(locations.a_color);
  gl.disableVertexAttribArray(locations.a_pointsize);

  // FIXME get result
  return result;
};

/**
 * @private
 * @param {WebGLRenderingContext} gl gl.
 * @param {ol.webgl.Context} context Context.
 * @param {Object} skippedFeaturesHash Ids of features to skip.
 */
ol.render.webgl.PointReplay.prototype.drawReplay_ =
    function(gl, context, skippedFeaturesHash) {
  var elementType = context.hasOESElementIndexUint ?
      goog.webgl.UNSIGNED_INT : goog.webgl.UNSIGNED_SHORT;
  //  var elementSize = context.hasOESElementIndexUint ? 4 : 2;
  if (!goog.object.isEmpty(skippedFeaturesHash)) {
    // TODO: draw by blocks to skip features
  } else {
    var numItems = this.features_.length;
    gl.drawArrays(gl.POINTS, 0, numItems);
  }
};


/**
 * Convert a color to an array of normalized component values that WebGL
 * understands. This function will divide every color components by 255.
 * @private
 * @param {ol.Color|string} color Color.
 */
ol.render.webgl.PointReplay.prototype.normalizeColor_ = function(color) {
  var color_ = ol.color.asArray(/** @type {ol.Color} */ (color));
  return color_.map(function(c, i) {
    return i !== 3 ? c / 255.0 : c;
  });
};


/**
 * @inheritDoc
 */
ol.render.webgl.PointReplay.prototype.setFillStrokeStyle =
    function(fillStyle, strokeStyle) {

  if (fillStyle) {
    var fillStyleColor = fillStyle.getColor();
    var fillColorNormalized;
    var defaultFillColorNormalized = [0.0, 0.0, 0.0, 1.0];
    if (fillStyleColor) {
      // Since the color might be a string, the color has to be convereted to
      // an array. fillStyle.getColor() could also return a ColorLike
      // therefore this typecast is necessary.
      fillColorNormalized = this.normalizeColor_(/** @type {ol.Color} */ (fillStyleColor));
    } else {
      fillColorNormalized = defaultFillColorNormalized;
    }
    this.fillColor_ = fillColorNormalized;
  } else {
    this.fillColor_ = null;
    // if (strokeStyle) {
      // NOOP, stroke style is ignored!
    // } 
  }
};
