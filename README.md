# OpenLayers 3 extended with additional features

This version of openlayers adds the following properties to layers:

- Pixels of a layers can be multiplied with a color. New layer methods:
    1. `getColor(): goog.color.Rgb`
    2. `setColor(color: goog.color.Rgb)`
- The range of pixel values can be changes by setting the `min` and `max` attributes, which are then used to compute the resulting value according to [this formula](https://en.wikipedia.org/wiki/Normalization_(image_processing)). Accessors:
    1. `getMin(): number`, `setMin(min: number)`
    2. `getMax(): number`, `setMax(number)`
        where `number` is a float between 0 and 1.
- Each layer can specify if it should be blended additively together with all other layers that are marked as such.
  When rendering the current map state, the additive layers are rendered first followed by all other layers.
  The default for this property is `false`. The accessors for this property:
    1. `getAdditiveBlend(): boolean`, `setAdditiveBlend(doBlend: boolean): number`, `setMax(number)`

All of the above properties can be passed to the layer's constructor like standard TissueMAPS layer properties, i.e.:

    var layer = ol.layer.TileLayer({
        color: [1, 0, 0],
        min: 0,
        max: 0.8,
        additiveBlend: true
    });

The properties are added like normal OpenLayers properties to the base class of all layers in the file: `ol/layer/layerbase.js` and to the type of the options that are passed to the constructors (`ol/externs/olx.js`).

Additionally, this version provides:

- WebGL-based rendering of polygon and point geometries
- WebGL-based rendering of tiled vector layers

A large part of the code enabling these features is based on code produced by
camptocamp: http://www.camptocamp.com/en/actualite/openlayers-3-towards-many-vector-features-with-webgl-2/

## Development requirements

Some of the build steps require Java 8. Also, make sure to
If you are on OSX and encounter some problems during the build step, make sure that you are actually running java 8.

    java -version

Should be something like:

    λ ~/ java -version
    java version "1.8.0_31"
    Java(TM) SE Runtime Environment (build 1.8.0_31-b13)
    Java HotSpot(TM) 64-Bit Server VM (build 25.31-b07, mixed mode)

Otherwise install Java 8 and if the output of `java -version` doesn't change check that `/usr/bin/java` points to `/Library/Internet\ Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java`, rather than  `/System/Library/Frameworks/JavaVM.framework/Versions/Current/Commands/java`.


# OpenLayers 3 - original README

[![Travis CI Status](https://secure.travis-ci.org/openlayers/ol3.svg)](http://travis-ci.org/#!/openlayers/ol3)
[![Coverage Status](https://coveralls.io/repos/openlayers/ol3/badge.svg?branch=master)](https://coveralls.io/r/openlayers/ol3?branch=master)
[![OSGeo Project](https://img.shields.io/badge/OSGeo-Project-brightgreen.svg)](http://osgeo.org/)

[OpenLayers 3](http://openlayers.org/) is a high-performance, feature-packed library for creating interactive maps on the web.

## Getting Started

- Download the [latest release](http://openlayers.org/download/)
- Install with npm: `npm install openlayers`
- Clone the repo: `git clone git@github.com:openlayers/ol3.git`

## Documentation

Check out the [hosted examples](http://openlayers.org/en/master/examples/), the [workshop](http://openlayers.org/workshop/) or [API docs](http://openlayers.org/en/master/apidoc/).

## Bugs

Please use the [GitHub issue tracker](https://github.com/openlayers/ol3/issues) for all bugs and feature requests. Before creating a new issue, do a quick search to see if the problem has been reported already.

## Contributing

Please see our guide on [contributing](CONTRIBUTING.md) if you're interested in getting involved.

## Community

- Need help? Find it on [stackoverflow using the tag 'openlayers-3'](http://stackoverflow.com/questions/tagged/openlayers-3)
- Follow [@openlayers](https://twitter.com/openlayers) on Twitter
- Discuss with openlayers users on IRC in `#openlayers` at `chat.freenode`
