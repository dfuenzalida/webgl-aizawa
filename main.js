// Attractor WebGL Demo
// This file contains abundant comments for educational reference.

// Check for WebGL support
function getWebGLContext(canvas) {
  // Try to get WebGL2 context first
  let gl = canvas.getContext('webgl2');
  if (gl) {
    console.log('WebGL2 context acquired.');
    return gl;
  }
  // Fallback to WebGL1
  gl = canvas.getContext('webgl');
  if (gl) {
    console.log('WebGL1 context acquired.');
  } else {
    console.warn('WebGL not available.');
  }
  return gl;
}

// Aizawa attractor parameters
const a = 0.95;
const b = 0.7;
const c = 0.6;
const d = 3.5;
const e = 0.25;
const f = 0.1;

// Generate attractor points
function generateParticles(numParticles) {
  // Each particle has position and velocity
  const particles = [];
  for (let i = 0; i < numParticles; ++i) {
    // Initial position very close to origin for Aizawa
    let x = 0.01 + (Math.random() - 0.5) * 0.1;
    let y = (Math.random() - 0.5) * 0.1;
    let z = (Math.random() - 0.5) * 0.1;
    // Assign a bright color (HSV to RGB)
    let h = Math.random();
    let s = 0.8 + 0.2 * Math.random();
    let v = 0.9 + 0.1 * Math.random();
    let iH = Math.floor(h * 6);
    let f = h * 6 - iH;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (iH % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    particles.push({ x, y, z, r, g, b });
  }
  console.log(`Generated ${numParticles} particles.`);
  return particles;
}

// Normalize points for rendering
function normalizeParticles(particles) {
  // Use fixed min/max values for normalization
  const min = [-2, -2, -2];
  const max = [2, 2, 2];
  return particles.map(p => ({
    x: 2 * (p.x - min[0]) / (max[0] - min[0]) - 1,
    y: 2 * (p.y - min[1]) / (max[1] - min[1]) - 1,
    z: 2 * (p.z - min[2]) / (max[2] - min[2]) - 1,
    r: p.r, g: p.g, b: p.b
  }));
}

// Main rendering function
function main() {
  console.log('Starting Attractor WebGL Demo...');
  const canvas = document.getElementById('glcanvas');
  // Create gl context first so viewport can be set
  const gl = getWebGLContext(canvas);
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  if (!gl) {
    console.warn('Falling back to Canvas2D renderer.');
    renderCanvas2D(canvas);
    return;
  }

  // Generate animated particles
  const numParticles = 40000;
  let particles = generateParticles(numParticles);

  // Create shaders
  const vsSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uModelViewProj;
    varying vec3 vColor;
    void main() {
      gl_Position = uModelViewProj * vec4(aPosition, 1.0);
      gl_PointSize = 2.0;
      vColor = aColor;
    }
  `;
  const fsSource = `
    precision mediump float;
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, 1.0);
    }
  `;

  function compileShader(src, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // Create buffers for positions and colors
  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  const aColor = gl.getAttribLocation(program, 'aColor');

  const uModelViewProj = gl.getUniformLocation(program, 'uModelViewProj');
  function getMVPMatrix(angle) {
    // Perspective and view matrix for stable camera
    const fov = Math.PI / 4;
    const aspect = canvas.width / canvas.height;
    const near = 0.1, far = 100.0;
    const eyeDist = 2.0;
    // Perspective matrix (column-major)
    const f = 1.0 / Math.tan(fov / 2);
    const persp = new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0
    ]);
    // Camera rotation around Y axis
    const c = Math.cos(angle), s = Math.sin(angle);
    // View matrix (lookAt, column-major)
    const eye = [eyeDist * Math.sin(angle), 0, eyeDist * Math.cos(angle)];
    const center = [0, 0, 0];
    const up = [0, 1, 0];
    function normalize(v) {
      const len = Math.hypot(...v);
      return v.map(x => x / len);
    }
    function subtract(a, b) {
      return a.map((x, i) => x - b[i]);
    }
    function cross(a, b) {
      return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
      ];
    }
    const z = normalize(subtract(eye, center));
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    // Column-major view matrix
    const view = new Float32Array([
      x[0], x[1], x[2], 0,
      y[0], y[1], y[2], 0,
      z[0], z[1], z[2], 0,
      -x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2],
      -y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2],
      -z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2],
      1
    ]);
    // Matrix multiplication (persp * view)
    function mult(a, b) {
      const out = new Float32Array(16);
      for (let i = 0; i < 4; ++i) {
        for (let j = 0; j < 4; ++j) {
          out[j*4+i] = 0;
          for (let k = 0; k < 4; ++k) {
            out[j*4+i] += a[k*4+i] * b[j*4+k];
          }
        }
      }
      return out;
    }
    return mult(persp, view);
  }

  // Animation loop
  let angle = 0;
  function updateParticles(dt) {
    // Update each particle using Aizawa equations
    for (let p of particles) {
      const dx = (p.z - b) * p.x - d * p.y;
      const dy = d * p.x + (p.z - b) * p.y;
      const dz = c + a * p.z - (p.z ** 3) / 3 - (p.x ** 2 + p.y ** 2) * (1 + e * p.z) + f * p.z * (p.x ** 3);
      p.x += dx * dt;
      p.y += dy * dt;
      p.z += dz * dt;
    }
  }

  function render() {
    angle += 0.001; // Slower camera rotation
    updateParticles(0.01); // Animate particles (faster dt for quicker structure)
    const normParticles = normalizeParticles(particles);
    gl.viewport(0, 0, canvas.width, canvas.height); // Ensure viewport matches canvas
    // Prepare position and color arrays
    const positions = [];
    const colors = [];
    for (const p of normParticles) {
      positions.push(p.x, p.y, p.z);
      colors.push(p.r, p.g, p.b);
    }
    // Upload positions
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
    // Upload colors
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);
    // Draw
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(uModelViewProj, false, getMVPMatrix(angle));
    gl.drawArrays(gl.POINTS, 0, normParticles.length);
    requestAnimationFrame(render);
  }
  render();
}

// Canvas2D fallback renderer
function renderCanvas2D(canvas) {
  console.log('Rendering attractor with Canvas2D fallback.');
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  const ctx = canvas.getContext('2d');
  let particles = generateParticles(numParticles);
  function updateParticles(dt) {
    for (let p of particles) {
      const dx = sigma * (p.y - p.x);
      const dy = p.x * (rho - p.z) - p.y;
      const dz = p.x * p.y - beta * p.z;
      p.x += dx * dt;
      p.y += dy * dt;
      p.z += dz * dt;
    }
  }
  function normalizeParticles(particles) {
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (const p of particles) {
      if (p.x < min[0]) min[0] = p.x;
      if (p.y < min[1]) min[1] = p.y;
      if (p.z < min[2]) min[2] = p.z;
      if (p.x > max[0]) max[0] = p.x;
      if (p.y > max[1]) max[1] = p.y;
      if (p.z > max[2]) max[2] = p.z;
    }
    return particles.map(p => [
      2 * (p.x - min[0]) / (max[0] - min[0]) - 1,
      2 * (p.y - min[1]) / (max[1] - min[1]) - 1,
      2 * (p.z - min[2]) / (max[2] - min[2]) - 1
    ]);
  }
  function render() {
    updateParticles(0.005);
    const normPositions = normalizeParticles(particles);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2cf';
    for (const p of normPositions) {
      const x = (p[0] * 0.5 + 0.5) * canvas.width;
      const y = (p[1] * 0.5 + 0.5) * canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }
    requestAnimationFrame(render);
  }
  render();
  console.log('Canvas2D rendering complete.');
}

// Start
window.onload = function() {
  console.log('Window loaded. Initializing demo...');
  main();
};
