goog.provide('ol.renderer.webgl.VectorTileLayer');

goog.require('ol.array');
goog.require('ol.TileState');
goog.require('ol.extent');
goog.require('ol.Extent');
goog.require('ol.TileRange');
goog.require('ol.renderer.webgl.Layer');
goog.require('ol.layer.VectorTile');
goog.require('ol.render.webgl.ReplayGroup');
goog.require('ol.style.Style');
goog.require('ol.style.Stroke');
goog.require('ol.style.Fill');


/**
 * @constructor
 * @extends {ol.renderer.webgl.Layer}
 * @param {ol.renderer.webgl.Map} mapRenderer Map renderer.
 * @param {ol.layer.VectorTile} vectorLayer VectorTile layer.
 */
ol.renderer.webgl.VectorTileLayer = function(mapRenderer, vectorLayer) {

  goog.base(this, mapRenderer, vectorLayer);

  /**
   * @private
   * @type {boolean}
   */
  this.dirty_ = false;

  /**
   * @private
   * @type {Array.<ol.VectorTile>}
   */
  this.renderedTiles_ = [];

  /**
   * @private
   * @type {ol.Extent}
   */
  this.tmpExtent_ = ol.extent.createEmpty();

  /**
   * The last layer state.
   * @private
   * @type {?ol.layer.LayerState}
   */
  this.layerState_ = null;
};
goog.inherits(ol.renderer.webgl.VectorTileLayer, ol.renderer.webgl.Layer);


/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorTileLayer.prototype.prepareFrame =
    function(frameState, layerState, context) {

  var layer = this.getLayer();
  goog.asserts.assertInstanceof(layer, ol.layer.VectorTile,
      'layer is an instance of ol.layer.VectorTile');
  var source = layer.getSource();
  goog.asserts.assertInstanceof(source, ol.source.VectorTile,
      'Source is an ol.source.VectorTile');

  this.updateAttributions(
      frameState.attributions, source.getAttributions());
  this.updateLogos(frameState, source);

  var animating = frameState.viewHints[ol.ViewHint.ANIMATING];
  var interacting = frameState.viewHints[ol.ViewHint.INTERACTING];
  var updateWhileAnimating = layer.getUpdateWhileAnimating();
  var updateWhileInteracting = layer.getUpdateWhileInteracting();

  if (!this.dirty_ && (!updateWhileAnimating && animating) ||
      (!updateWhileInteracting && interacting)) {
    return true;
  }

  // Check if the layer is in view; if not the layer should not be rendered. 
  var extent = frameState.extent;
  if (layerState.extent) {
    extent = ol.extent.getIntersection(extent, layerState.extent);
  }
  if (ol.extent.isEmpty(extent)) {
    // Return false to prevent the rendering of the layer.
    return false;
  }

  var viewState = frameState.viewState;
  var projection = viewState.projection;
  var resolution = viewState.resolution;
  var pixelRatio = frameState.pixelRatio;

  var tileGrid = source.getTileGrid();

  // Get closest zoom value for current resolution
  var resolutions = tileGrid.getResolutions();
  var z = resolutions.length - 1;
  while (z > 0 && resolutions[z] < resolution) {
    --z;
  }

  var tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z);

  this.updateUsedTiles(frameState.usedTiles, source, z, tileRange);
  this.manageTilePyramid(frameState, source, tileGrid, pixelRatio,
      projection, extent, z, layer.getPreload());
  this.scheduleExpireCache(frameState, source);

  /**
   * @type {Object.<number, Object.<string, ol.VectorTile>>}
   */
  var tilesToDrawByZ = {};
  tilesToDrawByZ[z] = {};

  // This function can be called with a zoom level and it will
  // add loaded tiles to tilesToDrawByZ. It will be used later.
  var findLoadedTiles = this.createLoadedTileFinder(source, projection,
      tilesToDrawByZ);

  var useInterimTilesOnError = layer.getUseInterimTilesOnError();

  var tmpExtent = this.tmpExtent_;
  var tmpTileRange = new ol.TileRange(0, 0, 0, 0);
  var childTileRange, fullyLoaded, tile, tileState, x, y;

  // Step though all tile coordinates that are within the current tile range
  // that falls within the current extent.
  for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
    for (y = tileRange.minY; y <= tileRange.maxY; ++y) {

      tile = source.getTile(z, x, y, pixelRatio, projection);
      goog.asserts.assertInstanceof(tile, ol.VectorTile,
          'Tile is an ol.VectorTile');
      tileState = tile.getState();
      if (tileState == ol.TileState.LOADED ||
          tileState == ol.TileState.EMPTY ||
          (tileState == ol.TileState.ERROR && !useInterimTilesOnError)) {
        tilesToDrawByZ[z][tile.tileCoord.toString()] = tile;
        continue;
      }

      // If the tilestate is ol.TileState.IDLE or ol.TileState.LOADING the following block is executed.
      // Call the function findLoadedTiles for each parent tile range, i.e.
      // each tilerange with [z-1, z-2, ..., minZoom] that contains the current tile
      // range and the current zoom level.
      // (This function will add tiles to the 'tilesToDrawByZ' hash).
      // So if a tile is not loaded yet but one of its 'parent tiles' is, the parent tile is loaded instead.
      fullyLoaded = tileGrid.forEachTileCoordParentTileRange(
          tile.tileCoord, findLoadedTiles, null, tmpTileRange, tmpExtent);
      // If none was found, the same is done for 'children' tile ranges that 
      // are on the next higher zoom level.
      if (!fullyLoaded) {
        childTileRange = tileGrid.getTileCoordChildTileRange(
            tile.tileCoord, tmpTileRange, tmpExtent);
        if (childTileRange) {
          findLoadedTiles(z + 1, childTileRange);
        }
      }

    }
  }

  this.dirty_ = false;

  /** @type {Array.<number>} */
  var zs = Object.keys(tilesToDrawByZ).map(Number);
  zs.sort(ol.array.numberSafeCompareFunction);
  var replayables = [];
  var i, ii, currentZ, tileCoordKey, tilesToDraw;
  // For each tile that should be drawn a replay group is created.
  // The replay group is saved on the replayState attribute on the tile itself.
  for (i = 0, ii = zs.length; i < ii; ++i) {
    currentZ = zs[i];
    tilesToDraw = tilesToDrawByZ[currentZ];
    for (tileCoordKey in tilesToDraw) {
      tile = tilesToDraw[tileCoordKey];
      if (tile.getState() == ol.TileState.LOADED) {
        replayables.push(tile);
        this.createReplayGroup_(tile, layer, resolution, extent, pixelRatio, context);
      }
    }
  }

  // The tiles that should be rendered in the next composeFrame call.
  this.renderedTiles_ = replayables;

  return true;
}


/**
 * @param {ol.VectorTile} tile Tile.
 * @param {ol.layer.VectorTile} layer Vector tile layer.
 * @param {number} resolution Resolution.
 * @param {ol.Extent} extent Extent.
 * @param {number} pixelRatio Pixel ratio.
 * @param {ol.webgl.Context} context WebGL context.
 * @private
 */
ol.renderer.webgl.VectorTileLayer.prototype.createReplayGroup_ =
    function(tile, layer, resolution, extent, pixelRatio, context) {
  var revision = layer.getRevision();
  var renderOrder = layer.getRenderOrder() || null;
  var replayState = tile.getReplayState();

  if (!replayState.dirty
      && replayState.renderedRevision == revision
      && replayState.renderedRenderOrder == renderOrder
      && replayState.resolution == resolution) {
    return;
  }

  // FIXME dispose of old replayGroup in post render
  goog.dispose(replayState.replayGroup);
  replayState.replayGroup = null;
  replayState.dirty = false;

  var tol = ol.renderer.vector.getTolerance(resolution, pixelRatio);
  var replayGroup = new ol.render.webgl.ReplayGroup(
    tol, extent, layer.getRenderBuffer()
  );

  var self = this;
  // Callback function that is executed for each feature to be rendered.
  // This function should be called once for each replaygroup. It will
  // call the renderFeature function of the vector rendered. This function 
  // in turn will lookup the feature's type (e.g. Polygon) and will get/request a new 
  // replay from the replaygroup (e.g. Polygon) replay. The replay is initialized by calling functions like drawPolygonGeometry.
  // This function will for example triangulate the coordinates and add the 
  // vertices to an array that can later be bound to a vertex buffer during the 'replay' call that is executed
  // during composeFrame.
  var renderFeature = function(feature) {
    var styles;
    var styleFunction = feature.getStyleFunction();
    if (styleFunction) {
      styles = styleFunction.call(feature, resolution);
    } else {
      styleFunction = layer.getStyleFunction();
      if (styleFunction) {
        styles = styleFunction(feature, resolution);
      }
    }

    if (styles) {
      var dirty = self.renderFeature(
          feature, resolution, pixelRatio, styles, replayGroup);
      this.dirty_ = this.dirty_ || dirty;
    }
  };

  var features = tile.getFeatures();
  features.forEach(renderFeature, this);

  replayGroup.finish(context);

  replayState.renderedRevision = revision;
  replayState.renderedRenderOrder = renderOrder;
  replayState.resolution = resolution;
  replayState.replayGroup = replayGroup;
}

/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorTileLayer.prototype.composeFrame = function(frameState, layerState, context) {

  var tilesToDraw = this.renderedTiles_;
  var viewState = frameState.viewState;

  var i, nTiles, replayState, replayGroup;
  var layer = /** @type {ol.layer.VectorTile} */ (layerState.layer);
  var layerRevision = layer.getRevision();
  var renderOrder = layer.getRenderOrder() || null;

  for (i = 0, nTiles = tilesToDraw.length; i < nTiles; ++i) {
    var tile = tilesToDraw[i];
    
    replayState = tile.getReplayState();
    replayGroup = replayState.replayGroup;

    if (replayGroup && !replayGroup.isEmpty() && !replayState.dirty
        // && replayState.renderedRevision !== layerRevision
        // && replayState.renderedRenderOrder !== renderOrder
    ) {

      replayState.replayGroup.replay(
        context,
        viewState.center, viewState.resolution, viewState.rotation,
        frameState.size, frameState.pixelRatio, layerState.opacity,
        layerState.managed ? frameState.skippedFeatureUids : {});

    }
  }
};

// /**
//  * @param {ol.Coordinate} coordinate Coordinate.
//  * @param {olx.FrameState} frameState Frame state.
//  * @return {boolean} Is there a feature at the given coordinate?
//  */
// ol.renderer.Layer.prototype.hasFeatureAtCoordinate = goog.functions.FALSE;

// /**
//  * @inheritDoc
//  */
// ol.renderer.webgl.VectorLayer.prototype.composeFrame =
//     function(frameState, layerState, context) {
// }

// /**
//  * @param {ol.Coordinate} coordinate Coordinate.
//  * @param {olx.FrameState} frameState Frame state.
//  * @return {boolean} Is there a feature at the given coordinate?
//  */
// ol.renderer.Layer.prototype.hasFeatureAtCoordinate = goog.functions.FALSE;

// /**
//  * @param {ol.Pixel} pixel Pixel.
//  * @param {olx.FrameState} frameState Frame state.
//  * @param {function(this: S, ol.layer.Layer): T} callback Layer callback.
//  * @param {S} thisArg Value to use as `this` when executing `callback`.
//  * @return {T|undefined} Callback result.
//  * @template S,T
//  */
// ol.renderer.Layer.prototype.forEachLayerAtPixel =
//     function(pixel, frameState, callback, thisArg) {
// }

/**
 * Handle changes in image style state.
 * @param {goog.events.Event} event Image style change event.
 * @private
 */
ol.renderer.webgl.VectorTileLayer.prototype.handleStyleImageChange_ =
    function(event) {
  this.renderIfReadyAndVisible();
};

/**
 * @param {ol.Feature} feature Feature.
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {(ol.style.Style|Array.<ol.style.Style>)} styles The style or array of
 *     styles.
 * @param {ol.render.webgl.ReplayGroup} replayGroup Replay group.
 * @return {boolean} `true` if an image is loading.
 */
ol.renderer.webgl.VectorTileLayer.prototype.renderFeature = function(feature, resolution, pixelRatio, styles, replayGroup) {
  if (!styles) {
    return false;
  }
  var loading = false;
  if (goog.isArray(styles)) {
    for (var i = 0, ii = styles.length; i < ii; ++i) {
      loading = ol.renderer.vector.renderFeature(
          replayGroup, feature, styles[i],
          ol.renderer.vector.getSquaredTolerance(resolution, pixelRatio),
          this.handleStyleImageChange_, this) || loading;
    }
  } else {
    loading = ol.renderer.vector.renderFeature(
        replayGroup, feature, styles,
        ol.renderer.vector.getSquaredTolerance(resolution, pixelRatio),
        this.handleStyleImageChange_, this) || loading;
  }
  return loading;
};
