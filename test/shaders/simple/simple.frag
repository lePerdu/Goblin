#version 300 es
precision mediump float;

in vec4 color;
out vec4 fragment_color;

void main(void) {
	fragment_color = color;
}

