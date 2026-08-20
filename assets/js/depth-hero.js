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
  const columns = isMobile ? 48 : 88;
  const rows = Math.round(columns * 1.25);
  const positions = [];
  const uvs = [];

  // Generate full grid - let depth texture determine visibility
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
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDepth: { value: texture },
      uPointer: { value: new THREE.Vector2() },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: `
      uniform sampler2D uDepth;
      uniform vec2 uPointer;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vDepth;
      
      void main() {
        vec4 depthSample = texture2D(uDepth, uv);
        float depth = depthSample.r;
        float alpha = depthSample.a;
        
        // Seam: reconstruction zone on left, photo on right
        float enter = smoothstep(0.15, 0.28, uv.x);
        float exit = 1.0 - smoothstep(0.45, 0.58, uv.x);
        float seam = enter * exit;
        
        // Deterministic thinning based on UV position
        float hash = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
        float density = step(0.55, hash) * step(0.15, depth);
        
        vec3 p = position;
        
        // Depth displacement - stronger for near features
        float depthFactor = depth * depth;
        p.z = (depth - 0.4) * 0.16;
        
        // Pointer parallax - depth-dependent
        p.x += uPointer.x * mix(0.002, 0.018, depthFactor);
        p.y += uPointer.y * mix(0.001, 0.009, depthFactor);
        
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Point size varies by depth
        gl_PointSize = mix(1.0, 2.5, depthFactor) * uPixelRatio;
        
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
        
        float edge = 1.0 - smoothstep(0.2, 0.5, distanceToCenter);
        
        // Depth-based color: far = pale blue, near = deep indigo
        vec3 farColour = vec3(0.62, 0.70, 0.80);
        vec3 midColour = vec3(0.35, 0.45, 0.75);
        vec3 nearColour = vec3(0.15, 0.25, 0.65);
        
        vec3 colour;
        if (vDepth < 0.5) {
          colour = mix(farColour, midColour, vDepth * 2.0);
        } else {
          colour = mix(midColour, nearColour, (vDepth - 0.5) * 2.0);
        }
        
        gl_FragColor = vec4(colour, vAlpha * edge * 0.6);
      }
    `
  });

  const cloud = new THREE.Points(geometry, material);
  scene.add(cloud);

  let targetX = 0;
  let targetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  // Single pointer handler for entire hero
  function pointerMove(event) {
    const rect = stage.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    
    // Update CSS custom properties for DOM layers
    stage.style.setProperty('--px', targetX.toFixed(3));
    stage.style.setProperty('--py', targetY.toFixed(3));
  }
  stage.addEventListener('pointermove', pointerMove, { passive: true });

  function resize() {
    const rect = model.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
  }
  new ResizeObserver(resize).observe(model);

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
    
    // Smooth pointer interpolation
    pointerX += (targetX - pointerX) * 0.04;
    pointerY += (targetY - pointerY) * 0.04;
    
    material.uniforms.uPointer.value.set(pointerX, -pointerY);
    
    // Very subtle rotation
    cloud.rotation.y = pointerX * 0.02;
    cloud.rotation.x = pointerY * -0.01;
    
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
