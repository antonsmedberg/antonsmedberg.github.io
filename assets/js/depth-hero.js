import * as THREE from '../vendor/three.module.js';

const canvas = document.querySelector('[data-depth-canvas]');
if (canvas) {
  initDepthHero(canvas);
}

async function initDepthHero(canvas) {
  const container = canvas.parentElement;
  
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.z = 3.4;

  const texture = await new THREE.TextureLoader().loadAsync('/assets/img/portrait-depth.png');
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const columns = matchMedia('(max-width: 700px)').matches ? 52 : 88;
  const rows = Math.round(columns * 1.25);
  const positions = [];
  const uvs = [];
  const seeds = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const u = x / (columns - 1);
      const v = y / (rows - 1);
      positions.push(u - 0.5, 0.5 - v, 0);
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
        float seam = 1.0 - smoothstep(0.34, 0.64, uv.x);
        float density = step(0.25, fract(aSeed * 19.71));
        vec3 p = position;
        p.z += (depth - 0.5) * 0.45;
        p.x += uPointer.x * depth * 0.035;
        p.y += uPointer.y * depth * 0.022;
        p.z += sin(uTime * 0.35 + aSeed * 8.0) * 0.006;
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
  cloud.scale.set(1.65, 2.05, 1);
  scene.add(cloud);

  let targetX = 0;
  let targetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  function pointerMove(event) {
    const rect = container.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  }
  container.addEventListener('pointermove', pointerMove, { passive: true });

  function resize() {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  const clock = new THREE.Clock();
  let active = true;

  const observer = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
  }, { rootMargin: '150px' });
  observer.observe(container);

  function frame() {
    requestAnimationFrame(frame);
    if (!active) return;
    pointerX += (targetX - pointerX) * 0.045;
    pointerY += (targetY - pointerY) * 0.045;
    material.uniforms.uPointer.value.set(pointerX, -pointerY);
    material.uniforms.uTime.value = clock.getElapsedTime();
    cloud.rotation.y = pointerX * 0.055;
    cloud.rotation.x = pointerY * -0.025;
    renderer.render(scene, camera);
  }

  resize();
  frame();
}
