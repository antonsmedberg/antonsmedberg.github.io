import * as THREE from '../vendor/three.module.js';

const canvas = document.querySelector('[data-depth-canvas]');
if (!canvas) return;

// Respect reduced motion
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  canvas.style.display = 'none';
  return;
}

initDepthHero(canvas);

async function initDepthHero(canvas) {
  const model = canvas.closest('.identity-model');
  const stage = canvas.closest('.identity-stage');
  if (!model || !stage) return;
  
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  
  const scene = new THREE.Scene();
  
  // Orthographic camera for proper 2D registration
  const aspect = 4 / 5;
  const camera = new THREE.OrthographicCamera(
    -aspect / 2, aspect / 2,
    0.5, -0.5,
    -2, 2
  );
  camera.position.z = 1;

  const texture = await new THREE.TextureLoader().loadAsync('/assets/img/portrait-depth.png');
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // Responsive point count
  const isMobile = matchMedia('(max-width: 700px)').matches;
  const columns = isMobile ? 52 : 88;
  const rows = Math.round(columns * 1.25);
  const positions = [];
  const uvs = [];
  const seeds = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const u = x / (columns - 1);
      const v = y / (rows - 1);
      positions.push(
        (u - 0.5) * aspect,
        0.5 - v,
        0
      );
      uvs.push(u, 1 - v);
      seeds.push(Math.random());
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDepth: { value: texture },
      uPointer: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: `
      uniform sampler2D uDepth;
      uniform vec2 uPointer;
      uniform float uTime;
      uniform float uPixelRatio;
      attribute float aSeed;
      varying float vAlpha;
      varying float vDepth;
      void main() {
        vec4 depthSample = texture2D(uDepth, uv);
        float depth = depthSample.r;
        float alpha = depthSample.a;
        
        // Seam: only show points in transition zone
        float enter = smoothstep(0.14, 0.27, uv.x);
        float exit = 1.0 - smoothstep(0.48, 0.61, uv.x);
        float seam = enter * exit;
        
        // Sparse density
        float density = step(0.42, fract(aSeed * 19.71));
        
        vec3 p = position;
        p.z = (depth - 0.5) * 0.18;
        p.x += uPointer.x * depth * 0.02;
        p.y += uPointer.y * depth * 0.012;
        p.z += sin(uTime * 0.35 + aSeed * 8.0) * 0.004;
        
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = mix(1.0, 2.4, depth) * uPixelRatio;
        vDepth = depth;
        vAlpha = alpha * seam * density;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vDepth;
      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float distanceToCenter = length(point);
        if (distanceToCenter > 0.5) {
          discard;
        }
        float edge = 1.0 - smoothstep(0.25, 0.5, distanceToCenter);
        vec3 farColour = vec3(0.66, 0.73, 0.82);
        vec3 nearColour = vec3(0.18, 0.29, 0.72);
        vec3 colour = mix(farColour, nearColour, vDepth);
        gl_FragColor = vec4(colour, vAlpha * edge * 0.72);
      }
    `
  });

  const cloud = new THREE.Points(geometry, material);
  scene.add(cloud);

  let targetX = 0;
  let targetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  function pointerMove(event) {
    const rect = stage.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  }
  stage.addEventListener('pointermove', pointerMove, { passive: true });

  function resize() {
    const rect = model.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
  }
  new ResizeObserver(resize).observe(model);

  const clock = new THREE.Clock();
  let active = true;
  let raf = 0;

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) start();
    else stop();
  }, { rootMargin: '150px' });
  observer.observe(stage);

  function render() {
    raf = requestAnimationFrame(render);
    if (!active) return;
    
    pointerX += (targetX - pointerX) * 0.045;
    pointerY += (targetY - pointerY) * 0.045;
    material.uniforms.uPointer.value.set(pointerX, -pointerY);
    material.uniforms.uTime.value = clock.getElapsedTime();
    cloud.rotation.y = pointerX * 0.03;
    cloud.rotation.x = pointerY * -0.015;
    renderer.render(scene, camera);
  }

  function start() {
    if (raf) return;
    active = true;
    render();
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    active = false;
  }

  resize();
  start();
}
