goog.provide('ol.layer.Base');
goog.provide('ol.layer.LayerProperty');
goog.provide('ol.layer.LayerState');

goog.require('goog.object');
goog.require('ol');
goog.require('ol.Object');
goog.require('ol.math');
goog.require('ol.source.State');

goog.require('goog.color.Rgb');

/**
 * @enum {string}
 */
ol.layer.LayerProperty = {
  OPACITY: 'opacity',
  VISIBLE: 'visible',
  EXTENT: 'extent',
  Z_INDEX: 'zIndex',
  MAX_RESOLUTION: 'maxResolution',
  MIN_RESOLUTION: 'minResolution',
  ADDITIVE_BLEND: 'additiveBlend',
  DRAW_BLACK_PIXELS: 'drawBlackPixels',
  DRAW_WHITE_PIXELS: 'drawWhitePixels',
  SOURCE: 'source',
  COLOR: 'color',
  MAX: 'max',
  MIN: 'min'
};


/**
 * @typedef {{layer: ol.layer.Layer,
 *            opacity: number,
 *            sourceState: ol.source.State,
 *            visible: boolean,
 *            managed: boolean,
 *            extent: (ol.Extent|undefined),
 *            color: goog.color.Rgb,
 *            min: number,
 *            max: number,
 *            additiveBlend: boolean,
 *            drawBlackPixels: boolean,
 *            drawWhitePixels: boolean,
 *            zIndex: number,
 *            maxResolution: number,
 *            minResolution: number}}
 */
ol.layer.LayerState;


/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Note that with `ol.layer.Base` and all its subclasses, any property set in
 * the options is set as a {@link ol.Object} property on the layer object, so
 * is observable, and has get/set accessors.
 *
 * @constructor
 * @extends {ol.Object}
 * @param {olx.layer.BaseOptions} options Layer options.
 * @api stable
 */
ol.layer.Base = function(options) {

  goog.base(this);

  /**
   * @type {Object.<string, *>}
   */
  var properties = goog.object.clone(options);
  properties[ol.layer.LayerProperty.OPACITY] =
      options.opacity !== undefined ? options.opacity : 1;
  properties[ol.layer.LayerProperty.VISIBLE] =
      options.visible !== undefined ? options.visible : true;
  properties[ol.layer.LayerProperty.Z_INDEX] =
      options.zIndex !== undefined ? options.zIndex : 0;
  properties[ol.layer.LayerProperty.MAX_RESOLUTION] =
      options.maxResolution !== undefined ? options.maxResolution : Infinity;
  properties[ol.layer.LayerProperty.MIN_RESOLUTION] =
      options.minResolution !== undefined ? options.minResolution : 0;

  properties[ol.layer.LayerProperty.COLOR] =
      goog.isDef(options.color) ? options.color : [1, 1, 1];
  properties[ol.layer.LayerProperty.MAX] =
      goog.isDef(options.max) ? options.max : 1;
  properties[ol.layer.LayerProperty.MIN] =
      goog.isDef(options.min) ? options.min : 0;
  properties[ol.layer.LayerProperty.ADDITIVE_BLEND] =
      goog.isDef(options.additiveBlend) ? options.additiveBlend : false;
  properties[ol.layer.LayerProperty.DRAW_BLACK_PIXELS] =
      goog.isDef(options.drawBlackPixels) ? options.drawBlackPixels : true;
  properties[ol.layer.LayerProperty.DRAW_WHITE_PIXELS] =
      goog.isDef(options.drawWhitePixels) ? options.drawWhitePixels : true;

  this.setProperties(properties);
};
goog.inherits(ol.layer.Base, ol.Object);


/**
 * @return {ol.layer.LayerState} Layer state.
 */
ol.layer.Base.prototype.getLayerState = function() {
  var opacity = this.getOpacity();
  var sourceState = this.getSourceState();
  var visible = this.getVisible();
  var extent = this.getExtent();
  var zIndex = this.getZIndex();
  var maxResolution = this.getMaxResolution();
  var minResolution = this.getMinResolution();

  // ADDED
  var min = this.getMin();
  var max = this.getMax();
  var color = this.getColor();
  var additiveBlend = this.getAdditiveBlend();
  var drawBlackPixels = this.getDrawBlackPixels();
  var drawWhitePixels = this.getDrawWhitePixels();

  return {
    layer: /** @type {ol.layer.Layer} */ (this),
    opacity: ol.math.clamp(opacity, 0, 1),
    sourceState: sourceState,
    visible: visible,
    managed: true,
    extent: extent,
    color: goog.isDef(color) ? color : [1, 1, 1],
    min: goog.isDef(min) ? min : 0,
    max: goog.isDef(max) ? max : 1,
    additiveBlend: goog.isDef(additiveBlend) ? additiveBlend : false,
    drawBlackPixels: goog.isDef(drawBlackPixels) ? drawBlackPixels : true,
    drawWhitePixels: goog.isDef(drawWhitePixels) ? drawWhitePixels : true,
    zIndex: zIndex,
    maxResolution: maxResolution,
    minResolution: Math.max(minResolution, 0)
  };
};


/**
 * @param {Array.<ol.layer.Layer>=} opt_array Array of layers (to be
 *     modified in place).
 * @return {Array.<ol.layer.Layer>} Array of layers.
 */
ol.layer.Base.prototype.getLayersArray = goog.abstractMethod;


/**
 * @param {Array.<ol.layer.LayerState>=} opt_states Optional list of layer
 *     states (to be modified in place).
 * @return {Array.<ol.layer.LayerState>} List of layer states.
 */
ol.layer.Base.prototype.getLayerStatesArray = goog.abstractMethod;


/**
 * Return the {@link ol.Extent extent} of the layer or `undefined` if it
 * will be visible regardless of extent.
 * @return {ol.Extent|undefined} The layer extent.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.getExtent = function() {
  return /** @type {ol.Extent|undefined} */ (
      this.get(ol.layer.LayerProperty.EXTENT));
};


/**
 * Return the maximum resolution of the layer.
 * @return {number} The maximum resolution of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.getMaxResolution = function() {
  return /** @type {number} */ (
      this.get(ol.layer.LayerProperty.MAX_RESOLUTION));
};


/**
 * Return the minimum resolution of the layer.
 * @return {number} The minimum resolution of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.getMinResolution = function() {
  return /** @type {number} */ (
      this.get(ol.layer.LayerProperty.MIN_RESOLUTION));
};


/**
 * Return the opacity of the layer (between 0 and 1).
 * @return {number} The opacity of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.getOpacity = function() {
  return /** @type {number} */ (this.get(ol.layer.LayerProperty.OPACITY));
};


/**
 * @return {ol.source.State} Source state.
 */
ol.layer.Base.prototype.getSourceState = goog.abstractMethod;


/**
 * Return the visibility of the layer (`true` or `false`).
 * @return {boolean} The visibility of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.getVisible = function() {
  return /** @type {boolean} */ (this.get(ol.layer.LayerProperty.VISIBLE));
};


/**
 * Return the Z-index of the layer, which is used to order layers before
 * rendering. The default Z-index is 0.
 * @return {number} The Z-index of the layer.
 * @observable
 * @api
 */
ol.layer.Base.prototype.getZIndex = function() {
  return /** @type {number} */ (this.get(ol.layer.LayerProperty.Z_INDEX));
};


/**
 * Set the extent at which the layer is visible.  If `undefined`, the layer
 * will be visible at all extents.
 * @param {ol.Extent|undefined} extent The extent of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.setExtent = function(extent) {
  this.set(ol.layer.LayerProperty.EXTENT, extent);
};


/**
 * Set the maximum resolution at which the layer is visible.
 * @param {number} maxResolution The maximum resolution of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.setMaxResolution = function(maxResolution) {
  this.set(ol.layer.LayerProperty.MAX_RESOLUTION, maxResolution);
};


/**
 * Set the minimum resolution at which the layer is visible.
 * @param {number} minResolution The minimum resolution of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.setMinResolution = function(minResolution) {
  this.set(ol.layer.LayerProperty.MIN_RESOLUTION, minResolution);
};


/**
 * Set the opacity of the layer, allowed values range from 0 to 1.
 * @param {number} opacity The opacity of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.setOpacity = function(opacity) {
  this.set(ol.layer.LayerProperty.OPACITY, opacity);
};


/**
 * Set the visibility of the layer (`true` or `false`).
 * @param {boolean} visible The visibility of the layer.
 * @observable
 * @api stable
 */
ol.layer.Base.prototype.setVisible = function(visible) {
  this.set(ol.layer.LayerProperty.VISIBLE, visible);
};

/**
 * Set Z-index of the layer, which is used to order layers before rendering.
 * The default Z-index is 0.
 * @param {number} zindex The z-index of the layer.
 * @observable
 * @api
 */
ol.layer.Base.prototype.setZIndex = function(zindex) {
  this.set(ol.layer.LayerProperty.Z_INDEX, zindex);
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'setVisible',
    ol.layer.Base.prototype.setVisible);



/**
 * @return {goog.color.Rgb|undefined} The color with which this layer should be dyed.
 * @observable
 * @api
 */
ol.layer.Base.prototype.getColor = function() {
  return /** @type {goog.color.Rgb|undefined} */ (this.get(
    ol.layer.LayerProperty.COLOR));
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'getColor',
    ol.layer.Base.prototype.getColor);

/**
 * @param {goog.color.Rgb|null} color The color with which to dye the layer.
 *  If the argument is null, the image won't be colored.
 * @observable
 * @api
 */
ol.layer.Base.prototype.setColor = function(color) {
  if (!goog.isNull(color)) {
    this.set(ol.layer.LayerProperty.COLOR, color);
  } else {
    // Setting [1.0, 1.0, 1.0] will result in the grayscale image
    // being rendered as an RGB image with equal amounts of equal color
    // (thus just creating a gray RGB image).
    this.set(ol.layer.LayerProperty.COLOR, [1.0, 1.0, 1.0]);
  }
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'setColor',
    ol.layer.Base.prototype.setColor);



/**
 * @return {number|undefined} Min.
 * @observable
 * @api
 */
ol.layer.Base.prototype.getMin = function() {
  return /** @type {number|undefined} */ (this.get(
    ol.layer.LayerProperty.MIN));
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'getMin',
    ol.layer.Base.prototype.getMin);

/**
 * @param {number} min Min.
 * @observable
 * @api
 */
ol.layer.Base.prototype.setMin = function(min) {
  if (min > this.getMax()) {
      this.setMax(min);
  }
  this.set(ol.layer.LayerProperty.MIN, min);
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'setMin',
    ol.layer.Base.prototype.setMin);



/**
 * @return {number|undefined} Max.
 * @observable
 * @api
 */
ol.layer.Base.prototype.getMax = function() {
  return /** @type {number|undefined} */ (this.get(
    ol.layer.LayerProperty.MAX));
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'getMax',
    ol.layer.Base.prototype.getMax);

/**
 * @param {number} max Max.
 * @observable
 * @api
 */
ol.layer.Base.prototype.setMax = function(max) {
  if (max < this.getMin()) {
      this.setMin(max);
  }
  this.set(ol.layer.LayerProperty.MAX, max);
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'setMax',
    ol.layer.Base.prototype.setMax);

/**
 * @return {boolean|undefined} If the layer should be blended additively.
 * @observable
 * @api
 */
ol.layer.Base.prototype.getAdditiveBlend = function() {
  return /** @type {boolean|undefined} */ (this.get(
    ol.layer.LayerProperty.ADDITIVE_BLEND));
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'getAdditiveBlend',
    ol.layer.Base.prototype.getAdditiveBlend);

/**
 * @param {boolean} doBlend If the layer should be blended additively.
 * @observable
 * @api
 */
ol.layer.Base.prototype.setAdditiveBlend = function(doBlend) {
  this.set(ol.layer.LayerProperty.ADDITIVE_BLEND, doBlend);
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'setAdditiveBlend',
    ol.layer.Base.prototype.setAdditiveBlend);


/**
 * @return {boolean|undefined} If black pixels should be drawn.
 * @observable
 * @api
 */
ol.layer.Base.prototype.getDrawBlackPixels = function() {
  return /** @type {boolean|undefined} */ (this.get(
    ol.layer.LayerProperty.DRAW_BLACK_PIXELS));
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'getDrawBlackPixels',
    ol.layer.Base.prototype.getDrawBlackPixels);

/**
 * @param {boolean} doDraw If black pxiels should be drawn.
 * @observable
 * @api
 */
ol.layer.Base.prototype.setDrawBlackPixels = function(doDraw) {
  this.set(ol.layer.LayerProperty.DRAW_BLACK_PIXELS, doDraw);
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'setDrawBlackPixels',
    ol.layer.Base.prototype.setDrawBlackPixels);


/**
 * @return {boolean|undefined} If white pixels should be drawn.
 * @observable
 * @api
 */
ol.layer.Base.prototype.getDrawWhitePixels = function() {
  return /** @type {boolean|undefined} */ (this.get(
    ol.layer.LayerProperty.DRAW_WHITE_PIXELS));
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'getDrawWhitePixels',
    ol.layer.Base.prototype.getDrawWhitePixels);

/**
 * @param {boolean} doDraw If white pixels should be drawn.
 * @observable
 * @api
 */
ol.layer.Base.prototype.setDrawWhitePixels = function(doDraw) {
  this.set(ol.layer.LayerProperty.DRAW_WHITE_PIXELS, doDraw);
};
goog.exportProperty(
    ol.layer.Base.prototype,
    'setDrawWhitePixels',
    ol.layer.Base.prototype.setDrawWhitePixels);
