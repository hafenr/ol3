goog.provide('ol.render.webgl.PolygonReplay');

goog.require('goog.asserts');
goog.require('goog.object');
goog.require('ol.color');
// goog.require('ol.color.Matrix');
goog.require('ol.ext.earcut');
goog.require('ol.extent');
goog.require('ol.webgl.Buffer');
goog.require('ol.webgl.Context');
goog.require('ol.render.webgl.LineStringReplay');
goog.require('ol.render.VectorContext');
goog.require('ol.render.webgl.polygonreplay.shader.Default');


/**
 * PolygonReplay
 *
 * A polygon replay is in charge of rendering a collection of polygon geometries.
 * To this end it triangulates and stores vertices belonging to these geometries.
 * It also has a linestring replay that is in charge of rendering the outlines.
 *
 * Draw
 * ====
 *
 * The following chain of function calls draws a polygon:
 *
 * Preperation
 * -----------
 * drawPolygonGeometry(polygonGeometry, feature)
 *  - sets the replay-wide fill color (taken from the feature object)
 * populateVerticesArray_(coordinates, fillColor)
 *  - called for the polygon geometry and on the linestring replay
 *  - triangulates the geometry in order to get a list of triangle coordinates
 *    that WebGL can work with.
 *  - The color values (RGBA) are appended inside the same array.
 *  - TODO: At the moment only the fill color can be different.
      The linereplay always uses the same color.
 *  - The start index where the coordinates and color values start for each triangle
 *    is stored inside the array indices_.
 *    End indices are stored inside endIndices_ (in function drawPolygonGeometry).
 *
 * Replay
 * ----
 * replay(context, ..., featureCallback)
 *  - binds the vertices buffer
 *  - binds the index buffer
 *  - gets the shaders programs
 *  - pushes values used by the shader to the GPU
 *  - if featureCallback was not supplied the chain continues
 *    with the function drawReplay_ (A), otherwise hit detection is done (B)).
 * A) drawReplay_(...)
 *  - calls the drawElements of WebGL
 * B) hit detection
 *  - Each 
 *  - A different off-screen framebuffer should be loaded before!.
 *  - Each feature is plotted separately and the callback is executed.
 *  - This scenario happens when forEachFeatureAtCoordinate is called.
 *  - forEachFeatureAtCoordinate will bind a offscreen framebuffer and 
 *    supply `replay` with a callback that reads a single pixel value
 *    and checks whether it was colored.
 *
 * Hit detection
 * =============
 * ReplayGroup.prototype.forEachFeatureAtCoordinate
 *  - binds offscreen framebuffer for hit detection
 * ReplayGroup.prototype.replayHitDetection_
 *  - calls replay for each replay in a specified order (REPLAY_ORDER)
 * PolyReplay.prototype.replay  # with feature callback
 *
 * @constructor
 * @extends {ol.render.VectorContext}
 * @param {number} tolerance Tolerance.
 * @param {ol.Extent} maxExtent Max extent.
 * @struct
 */
ol.render.webgl.PolygonReplay = function(tolerance, maxExtent) {
  goog.base(this);

  /**
   * @private
   * @type {ol.Color}
   */
  this.fillColor_ = null;

  /**
   * Flag to indicate whether the stroke color for the LineStringReplay was set.
   * The polygon outline is not drawn in case no color was supplied.
   * @private
   * @type {boolean}
   */
  this.hasLineStringReplayColor_ = false;

  /**
   * @private
   */
  this.lineStringReplay_ = new ol.render.webgl.LineStringReplay(
      tolerance, maxExtent);

  /**
   * The origin of the coordinate system for the point coordinates sent to
   * the GPU.
   * @private
   * @type {ol.Coordinate}
   */
  this.origin_ = ol.extent.getCenter(maxExtent);

  /**
   * @type {Array.<number>}
   * @private
   */
  this.indices_ = [];

  /**
   * @type {ol.webgl.Buffer}
   * @private
   */
  this.indicesBuffer_ = null;

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

  /**
   * Start index per feature (the index).
   * @type {Array.<number>}
   * @private
   */
  this.startIndices_ = [];

  /**
   * Start index per feature (the index).
   * @type {Array.<number>}
   * @private
   */
  this.endIndices_ = [];
  /**
   * Start index per feature (the feature).
   * @type {Array.<ol.Feature>}
   * @private
   */
  this.startIndicesFeature_ = [];
};
goog.inherits(ol.render.webgl.PolygonReplay, ol.render.VectorContext);


/**
 * Draw one polygon.
 * @param {Array.<Array.<ol.Coordinate>>} coordinates
 * @param {Array.<number>} fillColor Array of size 4. Each value ahs to be between 0 and one.
 * @private
 */
ol.render.webgl.PolygonReplay.prototype.populateVerticesArray_ =
    function(coordinates, fillColor) {
  // Triangulate the polgon
  var triangulation = ol.ext.earcut(coordinates, true);
  var i, ii;
  var indices = triangulation.indices;

  // Shift the indices to take into account previously handled polygons
  var offset = this.vertices_.length / 6;
  for (i = 0, ii = indices.length; i < ii; ++i) {
    this.indices_.push(indices[i] + offset);
  }

  // Add the color property to each vertex
  // TODO performance: make it more efficient
  var vertices = triangulation.vertices;
  for (i = 0, ii = vertices.length / 2; i < ii; ++i) {
    this.vertices_.push(vertices[2 * i]);
    this.vertices_.push(vertices[2 * i + 1]);

    this.vertices_.push(fillColor[0]);
    this.vertices_.push(fillColor[1]);
    this.vertices_.push(fillColor[2]);
    this.vertices_.push(fillColor[3]);
  }
};


/**
 * @inheritDoc
 */
ol.render.webgl.PolygonReplay.prototype.drawMultiPolygonGeometry =
    function(geometry, feature) {
  if (goog.isNull(this.fillColor_)) {
    return;
  }

  var coordinatess = geometry.getCoordinates();
  this.startIndices_.push(this.indices_.length);
  this.startIndicesFeature_.push(feature);
  var i, ii;
  for (i = 0, ii = coordinatess.length; i < ii; i++) {
    this.populateVerticesArray_(coordinatess[i], this.fillColor_);
  }
};


/**
 * @inheritDoc
 */
ol.render.webgl.PolygonReplay.prototype.drawPolygonGeometry =
    function(polygonGeometry, feature) {
  var fillColor;
  if (!goog.isNull(feature.getStyle())) {
      var color = feature.getStyle().getFill().getColor();
      fillColor = ol.color.asArray(color);
  } else {
      fillColor = this.fillColor_;
  }

  // Plot polygon body
  if (fillColor) {
    var coordinates = polygonGeometry.getCoordinates();
    this.startIndices_.push(this.indices_.length);
    this.startIndicesFeature_.push(feature);
    this.populateVerticesArray_(coordinates, fillColor);
    var endIndex = this.indices_.length;
    this.endIndices_.push(endIndex);
  }

  // Plot polygon ring in case a stroke color has been set at one point.
  if (this.hasLineStringReplayColor_) {
    var linearRings = polygonGeometry.getLinearRings();
    var i, ii;
    for (i = 0, ii = linearRings.length; i < ii; i++) {
      this.lineStringReplay_.drawLinearRingGeometry(linearRings[i]);
    }
  }
};


/**
 * @param {ol.webgl.Context} context Context.
 **/
ol.render.webgl.PolygonReplay.prototype.finish = function(context) {
  // create, bind, and populate the vertices buffer
  this.verticesBuffer_ = new ol.webgl.Buffer(this.vertices_);
  context.bindBuffer(goog.webgl.ARRAY_BUFFER, this.verticesBuffer_);

  var indices = this.indices_;
  var bits = context.hasOESElementIndexUint ? 32 : 16;
  // FIXME
  // goog.asserts.assert(indices[indices.length - 1] < Math.pow(2, bits),
  //     'Too large element index detected [%s] (OES_element_index_uint "%s")',
  //     indices[indices.length - 1], context.hasOESElementIndexUint);

  // create, bind, and populate the indices buffer
  this.indicesBuffer_ = new ol.webgl.Buffer(indices);
  context.bindBuffer(goog.webgl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer_);
  this.lineStringReplay_.finish(context);
};


/**
 * @param {ol.webgl.Context} context WebGL context.
 * @return {function()} Delete resources function.
 */
ol.render.webgl.PolygonReplay.prototype.getDeleteResourcesFunction =
    function(context) {
  // We only delete our stuff here. The shaders and the program may
  // be used by other PolygonReplay instances (for other layers). And
  // they will be deleted when disposing of the ol.webgl.Context
  // object.
  goog.asserts.assert(!goog.isNull(this.verticesBuffer_),
      'verticesBuffer must not be null');
  goog.asserts.assert(!goog.isNull(this.indicesBuffer_),
      'indicesBuffer must not be null');
  var verticesBuffer = this.verticesBuffer_;
  var indicesBuffer = this.indicesBuffer_;
  var lineDeleter = this.lineStringReplay_.getDeleteResourcesFunction(context);
  return function() {
    context.deleteBuffer(verticesBuffer);
    context.deleteBuffer(indicesBuffer);
    lineDeleter();
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
ol.render.webgl.PolygonReplay.prototype.replay = function(context,
    center, resolution, rotation, size, pixelRatio,
    opacity, skippedFeaturesHash,
    featureCallback, oneByOne, opt_hitExtent) {
  var gl = context.getGL();

  // bind the vertices buffer
  goog.asserts.assert(!goog.isNull(this.verticesBuffer_),
      'verticesBuffer must not be null');
  context.bindBuffer(goog.webgl.ARRAY_BUFFER, this.verticesBuffer_);

  // bind the indices buffer
  goog.asserts.assert(!goog.isNull(this.indicesBuffer_),
      'indicesBuffer must not be null');
  context.bindBuffer(goog.webgl.ELEMENT_ARRAY_BUFFER, this.indicesBuffer_);

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

  gl.uniform1f(locations.u_opacity, opacity);

  // Structure of vertex attrib array:
  // [x1 y1 r1 g1 b1 a1 x2 y2 r2 g2 b2 a2....]
  // Total length of attributes for one vertex:
  // (2 positional + 4 color) * 4 bytes per int = 24
  // Offset of color attribute pointer to positional attribute:
  // 2 positional attributes * 4 bytes per int = 8
  //
  // Enable the vertex attrib position arrays
  gl.enableVertexAttribArray(locations.a_position);
  gl.vertexAttribPointer(locations.a_position, 2, goog.webgl.FLOAT,
      false, 24, 0);
  // Enable the array holding the feature colors
  gl.enableVertexAttribArray(locations.a_color);
  gl.vertexAttribPointer(locations.a_color, 4, goog.webgl.FLOAT,
    false, 24, 8);

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
    //
    gl.blendFunc(gl.ONE, gl.ONE);
    var elementType = context.hasOESElementIndexUint ?
        goog.webgl.UNSIGNED_INT : goog.webgl.UNSIGNED_SHORT;

    var feature, dontSkipFeature, featureIntersectsHitExtent, featureUid, end, start;
    var featureIndex = this.startIndices_.length - 1;
    var elementSize = context.hasOESElementIndexUint ? 4 : 2;
    var featureHasGeometry;

    while (featureIndex >= 0) {

      feature = this.startIndicesFeature_[featureIndex];

      featureUid = goog.getUid(feature).toString();
      dontSkipFeature = !goog.isDef(skippedFeaturesHash[featureUid]);
      featureHasGeometry = goog.isDefAndNotNull(feature.getGeometry());
      featureIntersectsHitExtent = !goog.isDef(opt_hitExtent) || ol.extent.intersects(
          opt_hitExtent, feature.getGeometry().getExtent());

      if (dontSkipFeature && featureHasGeometry && featureIntersectsHitExtent) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        start = this.startIndices_[featureIndex];
        end = this.endIndices_[featureIndex];

        var numItems = end - start;
        var offsetInBytes = start * elementSize;
        gl.drawElements(goog.webgl.TRIANGLES, numItems, elementType, offsetInBytes);

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

  this.lineStringReplay_.replay(context,
      center, resolution, rotation, size, pixelRatio,
      opacity, skippedFeaturesHash,
      featureCallback, oneByOne, opt_hitExtent);
  // FIXME get result
  return result;
};


/**
 * @private
 * @param {WebGLRenderingContext} gl gl.
 * @param {ol.webgl.Context} context Context.
 * @param {Object} skippedFeaturesHash Ids of features to skip.
 */
ol.render.webgl.PolygonReplay.prototype.drawReplay_ =
    function(gl, context, skippedFeaturesHash) {
  var elementType = context.hasOESElementIndexUint ?
      goog.webgl.UNSIGNED_INT : goog.webgl.UNSIGNED_SHORT;
  //  var elementSize = context.hasOESElementIndexUint ? 4 : 2;

  if (!goog.object.isEmpty(skippedFeaturesHash)) {
    // TODO: draw by blocks to skip features
  } else {
    var numItems = this.indices_.length;
    gl.drawElements(goog.webgl.TRIANGLES, numItems, elementType, 0);
  }
};


/**
 * @inheritDoc
 */

ol.render.webgl.PolygonReplay.prototype.setFillStrokeStyle =
    function(fillStyle, strokeStyle) {
  // TODO implement
  if (!goog.isNull(fillStyle)) {
    var fillStyleColor = fillStyle.getColor();
    this.fillColor_ = !goog.isNull(fillStyleColor) ?
        ol.color.asArray(fillStyleColor).map(function(c, i) {
          return i != 3 ? c / 255.0 : c;
        }) : [0.0, 0.0, 0.0, 1.0];
  } else {
    this.fillColor_ = null;
  }

  if (strokeStyle) {
      this.lineStringReplay_.setFillStrokeStyle(fillStyle, strokeStyle);
      this.hasLineStringReplayColor_ = true;
  } 
};



