//! NAMESPACE=ol.render.webgl.pointreplay.shader.Default
//! CLASS=ol.render.webgl.pointreplay.shader.Default


//! COMMON
varying vec4 v_color;


//! VERTEX
attribute vec2 a_position;
attribute vec4 a_color;
attribute float a_pointsize;

uniform mat4 u_projectionMatrix;

void main(void) {
  v_color = a_color;
  gl_Position = u_projectionMatrix * vec4(a_position, 0., 1.);
  gl_PointSize = a_pointsize;
}


//! FRAGMENT

uniform float u_opacity;

void main(void) {
  gl_FragColor = v_color;
  gl_FragColor *= u_opacity;
}
