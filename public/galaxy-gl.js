"use strict";
// WebGL star field (the "Galaxy" shader). Used for the home background, the dive transition and the intro.
// window.VodiousGL.create(canvas, options) returns a controller; see the bottom of this file.
(() => {
	const MAX_LAYERS = 8;
	const MAX_COLORS = 4;
	const INTRO_SECONDS = 2.2;

	const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

	const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uGloss;
uniform float uDepth;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uStarGlow;
uniform float uFlareGain;
uniform float uSquash;
uniform float uSaturation;
uniform float uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationAngle;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform int uLayers;
uniform vec3 uColors[4];
uniform int uColorCount;
uniform float uWarp;
uniform float uReveal;
uniform float uMode;
uniform vec3 uBackground;
uniform float uOpacity;
out vec4 outColor;

#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float Star(vec2 uv, float flare, vec2 radial, float invReach) {
#ifdef WARP
  float along = dot(uv, radial);
  float d = sqrt(max(dot(uv, uv) - uSquash * along * along, 0.0));
#else
  float d = length(uv);
#endif
  float m = uStarGlow / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uFlareGain;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uFlareGain;
  m *= smoothstep(1.0, 0.2, d * invReach);
#ifdef WARP
  m *= mix(1.0, smoothstep(1.0, 0.55, length(uv) * invReach), min(uWarp * 4.0, 1.0));
#endif
  return m;
}

vec3 StarLayer(vec2 uv, vec2 radial, vec2 repelAt, float pushCells, float spread) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + offset;
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uGloss / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

#ifdef PALETTE
      float pick = Hash21(si + 7.0) * float(uColorCount);
      vec3 base = uColors[int(min(floor(pick), float(uColorCount - 1)))];
#else
      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);
      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));
#endif

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;
      vec2 shift = vec2(0.0);
      float invReach = 1.0;
#ifdef REPEL
      vec2 away = si + 0.5 + pad - repelAt;
      float dist = length(away);
      float q = dist * spread;
      float cells = pushCells * exp(-q * q);
      float moved = cells * inversesqrt(1.0 + cells * cells * 2.78);
      shift = away * (moved / max(dist, 0.0001));
      invReach = 1.0 / (1.0 - moved);
#endif
      float star = Star(gv - offset - pad - shift, flareSize, radial, invReach);
      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      col += star * twinkle * size * base;
    }
  }
  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution;
  vec2 uv = (gl_FragCoord.xy - focalPx) / uResolution.y;
  vec2 mouseNorm = uMouse - vec2(0.5);

  vec2 repelAt = vec2(0.0);
  float strength = 0.0;
  float push = 0.0;
  if (uAutoCenterRepulsion > 0.0) {
    strength = uAutoCenterRepulsion;
    push = strength * 0.05;
  } else if (uMouseRepulsion > 0.5) {
    repelAt = (uMouse * uResolution - focalPx) / uResolution.y;
    strength = max(uRepulsionStrength, 0.0);
    push = strength * 0.05 * uMouseActiveFactor;
  } else {
    uv += mouseNorm * 0.1 * uMouseActiveFactor;
  }
  float radius = 0.16 + 0.04 * strength;

  vec2 radial = length(uv) > 0.0001 ? normalize(uv) : vec2(1.0, 0.0);
  float angle = uRotationAngle;
  uv = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * uv;
  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;
  radial = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * radial;
  radial = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * radial;
  repelAt = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * repelAt;
  repelAt = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * repelAt;

  vec3 col = vec3(0.0);
  float layers = float(uLayers);
  for (int k = 0; k < 8; k++) {
    if (k >= uLayers) break;
    float i = float(k) / layers;
    float depth = fract(i + uDepth);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    vec2 offset = vec2(i * 453.32);
    col += StarLayer(uv * scale + offset, radial, repelAt * scale + offset, push * scale, 1.0 / (scale * radius)) * fade;
  }
  col *= uReveal;

  if (uMode > 1.5) {
    vec3 lit = col * smoothstep(0.0, 0.3, length(col));
    float energy = max(max(lit.r, lit.g), lit.b);
    vec3 tint = lit / max(energy, 0.0001);
    vec3 ink = tint * (0.16 / max(dot(tint, vec3(0.2126, 0.7152, 0.0722)), 0.16));
    float coverage = pow(min(energy * 1.3, 1.0), 1.3) * 0.92 * uOpacity;
    outColor = uMode > 2.5 ? vec4(ink * coverage, coverage) : vec4(mix(uBackground, ink, coverage), 1.0);
  } else if (uMode > 0.5) {
    float alpha = min(smoothstep(0.0, 0.3, length(col)), 1.0) * uOpacity;
    outColor = vec4(col * alpha, alpha);
  } else {
    outColor = vec4(mix(uBackground, col, uOpacity), 1.0);
  }
}`;

	// Star colours for each galaxy choice on the Design page (empty list = the shader's own rainbow)
	const PALETTES = {
		purple: ["#c084fc", "#a855f7", "#e9d5ff", "#7c3aed"],
		blue: ["#7dd3fc", "#3b82f6", "#dbeafe", "#2563eb"],
		green: ["#86efac", "#22c55e", "#dcfce7", "#10b981"],
		red: ["#fca5a5", "#ef4444", "#fee2e2", "#f97316"],
		pink: ["#f9a8d4", "#ec4899", "#fce7f3", "#d946ef"],
		gold: ["#fde68a", "#f59e0b", "#fef9c3", "#fb923c"],
		white: ["#ffffff", "#e2e8f0", "#c7d2fe", "#f8fafc"],
		rainbow: [],
	};

	function paletteFor(id) {
		if (!id) {
			try {
				const d = JSON.parse(localStorage.getItem("vodious-design") || "null");
				id = d && d.bg;
			} catch (err) {
				id = "";
			}
		}
		return Object.prototype.hasOwnProperty.call(PALETTES, id) ? PALETTES[id] : PALETTES.purple;
	}

	const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
	const keyOf = (palette, repel, warp) => (palette ? 4 : 0) + (repel ? 2 : 0) + (warp ? 1 : 0);

	function compile(gl, palette, repel, warp) {
		const defines = (palette ? "#define PALETTE\n" : "") + (repel ? "#define REPEL\n" : "") + (warp ? "#define WARP\n" : "");
		const program = gl.createProgram();
		const vertex = gl.createShader(gl.VERTEX_SHADER);
		const fragment = gl.createShader(gl.FRAGMENT_SHADER);
		if (!program || !vertex || !fragment) return null;
		gl.shaderSource(vertex, VERTEX);
		gl.shaderSource(fragment, FRAGMENT.replace("\n", "\n" + defines));
		gl.compileShader(vertex);
		gl.compileShader(fragment);
		gl.attachShader(program, vertex);
		gl.attachShader(program, fragment);
		gl.bindAttribLocation(program, 0, "aPosition");
		gl.linkProgram(program);
		gl.deleteShader(vertex);
		gl.deleteShader(fragment);
		return program;
	}

	function finish(gl, program) {
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
		const uniforms = {};
		const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
		for (let i = 0; i < count; i++) {
			const info = gl.getActiveUniform(program, i);
			if (info) uniforms[info.name.replace("[0]", "")] = gl.getUniformLocation(program, info.name);
		}
		return { program, uniforms };
	}

	// options: palette (array of CSS colours), dpr (max pixel ratio), intro (stars fly in at the start),
	// auto (run its own animation loop, default true), interactive (stars react to the pointer, default true),
	// clickWarp, focal ([x,y] 0..1), density, glow
	function create(canvas, opts) {
		opts = opts || {};
		const gl = canvas.getContext("webgl2", {
			alpha: true,
			premultipliedAlpha: true,
			antialias: false,
			depth: false,
			stencil: false,
		});
		if (!gl) return null;

		const S = {
			focal: opts.focal || [0.5, 0.5],
			rotation: [1, 0],
			starSpeed: opts.starSpeed != null ? opts.starSpeed : 0.5,
			density: opts.density || 1,
			hueShift: 140,
			speed: 1,
			glowIntensity: opts.glow != null ? opts.glow : 0.3,
			saturation: opts.saturation != null ? opts.saturation : (opts.palette && opts.palette.length ? 0 : 1.1),
			mouseRepulsion: opts.interactive !== false,
			repulsionStrength: 2,
			twinkleIntensity: 0.3,
			rotationSpeed: 0.1,
			autoCenterRepulsion: 0,
			starSize: 1,
			flareIntensity: 1,
			layers: 4,
			clickWarp: opts.clickWarp !== false && opts.interactive !== false,
			intro: !!opts.intro,
			opacity: 1,
			dpr: opts.dpr || 1,
			palette: (opts.palette || []).slice(0, MAX_COLORS),
			mouseInteraction: opts.interactive !== false,
		};

		const parallel = gl.getExtension("KHR_parallel_shader_compile");
		const programs = new Map();
		const entry = (palette, repel, warp) => {
			const key = keyOf(palette, repel, warp);
			let found = programs.get(key);
			if (!found) {
				found = { program: compile(gl, palette, repel, warp), linked: null, done: false };
				programs.set(key, found);
			}
			return found;
		};
		const variant = (palette, repel, warp, wait) => {
			const found = entry(palette, repel, warp);
			if (!found.done && found.program) {
				if (!wait && parallel && !gl.getProgramParameter(found.program, parallel.COMPLETION_STATUS_KHR)) return null;
				found.linked = finish(gl, found.program);
				found.done = true;
			}
			return found.linked;
		};
		const tryBase = (palette) => variant(palette, false, false, true);
		if (!tryBase(S.palette.length > 0) && !tryBase(false)) return null;

		const buffer = gl.createBuffer();
		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
		const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const cache = new Map();
		const parse = (value, fallback) => {
			if (!value) return fallback;
			const key = String(value);
			if (cache.has(key)) return cache.get(key);
			let rgb = fallback;
			if (probe) {
				probe.clearRect(0, 0, 1, 1);
				probe.fillStyle = "#000000";
				probe.fillStyle = key;
				probe.fillRect(0, 0, 1, 1);
				const d = probe.getImageData(0, 0, 1, 1).data;
				rgb = [d[0] / 255, d[1] / 255, d[2] / 255];
			}
			cache.set(key, rgb);
			return rgb;
		};
		const colors = new Float32Array(MAX_COLORS * 3);

		const pointer = { x: 0.5, y: 0.5, inside: false };
		const state = {
			time: 0,
			gloss: 0,
			depth: 0,
			angle: 0,
			mx: 0.5,
			my: 0.5,
			active: 0,
			boost: 0,
			reveal: S.intro && !reduce ? 0 : 1,
		};
		const ctl = { state, force: null, paused: false, speedUp: 1 };
		let raf = 0;
		let last = 0;
		let dead = false;

		function render() {
			const palette = S.palette.length > 0;
			S.palette.forEach((value, index) => colors.set(parse(value, [1, 1, 1]), index * 3));
			const repel = S.mouseRepulsion && S.repulsionStrength > 0 && state.active > 0;
			const warp = state.boost > 0;
			const base = variant(palette, false, false, true);
			if (!base) return;
			const program = (repel || warp ? variant(palette, repel, warp, false) : null) || base;
			const u = program.uniforms;
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.useProgram(program.program);
			gl.bindVertexArray(vao);
			gl.uniform1f(u.uTime, state.time);
			gl.uniform2f(u.uResolution, canvas.width, canvas.height);
			gl.uniform2f(u.uFocal, S.focal[0], S.focal[1]);
			gl.uniform2f(u.uRotation, S.rotation[0], S.rotation[1]);
			gl.uniform1f(u.uGloss, state.gloss);
			gl.uniform1f(u.uDepth, state.depth);
			gl.uniform1f(u.uDensity, S.density);
			gl.uniform1f(u.uHueShift, S.hueShift);
			gl.uniform1f(u.uSpeed, S.speed);
			gl.uniform2f(u.uMouse, state.mx, state.my);
			const stretch = 1 + state.boost * 5;
			gl.uniform1f(u.uStarGlow, (0.05 * S.glowIntensity * S.starSize) / Math.pow(stretch, 0.6));
			gl.uniform1f(u.uFlareGain, S.glowIntensity * S.flareIntensity);
			gl.uniform1f(u.uSquash, 1 - 1 / (stretch * stretch));
			gl.uniform1f(u.uSaturation, S.saturation);
			gl.uniform1f(u.uMouseRepulsion, S.mouseRepulsion ? 1 : 0);
			gl.uniform1f(u.uTwinkleIntensity, S.twinkleIntensity);
			gl.uniform1f(u.uRotationAngle, state.angle);
			gl.uniform1f(u.uRepulsionStrength, S.repulsionStrength);
			gl.uniform1f(u.uMouseActiveFactor, state.active);
			gl.uniform1f(u.uAutoCenterRepulsion, S.autoCenterRepulsion);
			gl.uniform1i(u.uLayers, S.layers);
			gl.uniform3fv(u.uColors, colors);
			gl.uniform1i(u.uColorCount, S.palette.length);
			gl.uniform1f(u.uWarp, state.boost);
			const fade = Math.min(1, state.reveal / 0.35);
			gl.uniform1f(u.uReveal, fade * fade * (3 - 2 * fade));
			gl.uniform1f(u.uMode, 1);
			gl.uniform3fv(u.uBackground, [0, 0, 0]);
			gl.uniform1f(u.uOpacity, S.opacity);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}

		// Moves the animation forward by dt seconds and draws. A number for `boost` forces the warp amount.
		function advance(dt, boost) {
			const motion = reduce ? 0 : 1;
			if (S.intro && !reduce && state.reveal < 1) {
				state.reveal = Math.min(1, state.reveal + dt / INTRO_SECONDS);
				state.boost = Math.max(state.boost, Math.pow(1 - state.reveal, 2) * 1.4);
			} else {
				state.reveal = 1;
			}
			const flight = (S.starSpeed / 10) * ctl.speedUp;
			state.time += dt * motion;
			state.gloss += dt * flight * motion;
			state.depth += dt * flight * S.speed * motion * (1 + state.boost * 14);
			state.angle += dt * S.rotationSpeed * motion;
			if (typeof boost === "number") {
				state.boost = boost;
			} else {
				state.boost *= Math.exp(-dt * 1.3);
				if (state.boost < 0.001) state.boost = 0;
			}
			const follow = 1 - Math.exp(-dt / 0.325);
			const engaged = S.mouseInteraction && pointer.inside && !reduce;
			if (engaged) {
				state.mx += (pointer.x - state.mx) * follow;
				state.my += (pointer.y - state.my) * follow;
			}
			const target = engaged ? 1 : 0;
			state.active += (target - state.active) * follow;
			if (Math.abs(target - state.active) < 0.001) state.active = target;
			render();
		}

		function frame(now) {
			raf = 0;
			if (dead) return;
			raf = requestAnimationFrame(frame);
			if (document.hidden || ctl.paused) {
				last = 0;
				return;
			}
			const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
			last = now;
			advance(dt, ctl.force);
		}

		function resize() {
			const width = Math.max(1, canvas.clientWidth || window.innerWidth);
			const height = Math.max(1, canvas.clientHeight || window.innerHeight);
			const ratio = Math.min(S.dpr, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.round(width * ratio));
			canvas.height = Math.max(1, Math.round(height * ratio));
			render();
		}

		const locate = (event) => {
			pointer.inside = event.clientX >= 0 && event.clientY >= 0 && event.clientX <= window.innerWidth && event.clientY <= window.innerHeight;
			pointer.x = event.clientX / Math.max(1, window.innerWidth);
			pointer.y = 1 - event.clientY / Math.max(1, window.innerHeight);
		};
		const onMove = (event) => locate(event);
		const onDown = (event) => {
			locate(event);
			if (S.clickWarp && !reduce) state.boost = Math.min(1.6, state.boost + 1);
		};
		const onUp = (event) => {
			if (event.pointerType !== "mouse") pointer.inside = false;
		};
		const onLeave = () => {
			pointer.inside = false;
		};
		const onContextLost = (event) => event.preventDefault();

		if (S.mouseInteraction) {
			window.addEventListener("pointermove", onMove, { passive: true });
			window.addEventListener("pointerdown", onDown, { passive: true });
			window.addEventListener("pointerup", onUp, { passive: true });
			window.addEventListener("pointercancel", onUp, { passive: true });
			document.documentElement.addEventListener("pointerleave", onLeave);
		}
		canvas.addEventListener("webglcontextlost", onContextLost);
		window.addEventListener("resize", resize);
		resize();

		// Compile the other shader variants in the background so the first click or mouse move does not stall
		const tinted = S.palette.length > 0;
		entry(tinted, false, true);
		if (S.mouseRepulsion) {
			entry(tinted, true, false);
			entry(tinted, true, true);
		}

		ctl.advance = advance;
		ctl.resize = resize;
		ctl.draw = render;
		ctl.setPalette = (list) => {
			const next = (list || []).slice(0, MAX_COLORS);
			const wasTinted = S.palette.length > 0;
			S.palette = next;
			if (next.length > 0 !== wasTinted) {
				const t = next.length > 0;
				entry(t, false, true);
				if (S.mouseRepulsion) {
					entry(t, true, false);
					entry(t, true, true);
				}
			}
			S.saturation = next.length ? 0 : 1.1;
			render();
		};
		ctl.canvas = canvas;
		ctl.setFocal = (x, y) => {
			S.focal = [x, y];
		};
		ctl.setIntro = (on) => {
			S.intro = !!on;
			if (on) state.reveal = 0;
		};
		ctl.warp = (amount) => {
			state.boost = Math.max(state.boost, amount);
		};
		ctl.destroy = () => {
			dead = true;
			cancelAnimationFrame(raf);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerdown", onDown);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
			window.removeEventListener("resize", resize);
			document.documentElement.removeEventListener("pointerleave", onLeave);
			canvas.removeEventListener("webglcontextlost", onContextLost);
			programs.forEach((found) => found.program && gl.deleteProgram(found.program));
			gl.deleteBuffer(buffer);
			gl.deleteVertexArray(vao);
			const lose = gl.getExtension("WEBGL_lose_context");
			if (lose) lose.loseContext();
		};
		if (opts.auto !== false) raf = requestAnimationFrame(frame);
		return ctl;
	}

	window.VodiousGL = { create, paletteFor, PALETTES };
})();
