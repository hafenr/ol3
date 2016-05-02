goog.require('ol');
goog.require('ol.ImageTile');
goog.require('ol.TileState');

/**
 * A tile class that allows for non-squared tile images.
 * This is exactly the same implementation as the tile class employed by zoomify.
 * @constructor
 * @extends {ol.ImageTile}
 * @param {ol.TileCoord} tileCoord Tile coordinate.
 * @param {ol.TileState} state State.
 * @param {string} src Image source URI.
 * @param {?string} crossOrigin Cross origin.
 * @param {ol.TileLoadFunctionType} tileLoadFunction Tile load function.
 * @api stable
 */
ol.source.NonsquaredTile = function(
    tileCoord, state, src, crossOrigin, tileLoadFunction) {

  goog.base(this, tileCoord, state, src, crossOrigin, tileLoadFunction);

  /**
   * @private
   * @type {Object.<string,
   *                HTMLCanvasElement|HTMLImageElement|HTMLVideoElement>}
   */
  this.nonsquaredImageByContext_ = {};

};
goog.inherits(ol.source.NonsquaredTile, ol.ImageTile);

/**
 * @inheritDoc
 */
ol.source.NonsquaredTile.prototype.getImage = function(opt_context) {
  var tileSize = ol.DEFAULT_TILE_SIZE;
  var key = opt_context !== undefined ?
      goog.getUid(opt_context).toString() : '';
  if (key in this.nonsquaredImageByContext_) {
    return this.nonsquaredImageByContext_[key];
  } else {
    var image = goog.base(this, 'getImage', opt_context);
    if (this.state == ol.TileState.LOADED) {
      if (image.width == tileSize && image.height == tileSize) {
        this.nonsquaredImageByContext_[key] = image;
        return image;
      } else {
        var context = ol.dom.createCanvasContext2D(tileSize, tileSize);
        context.drawImage(image, 0, 0);
        this.nonsquaredImageByContext_[key] = context.canvas;
        return context.canvas;
      }
    } else {
      return image;
    }
  }
};
