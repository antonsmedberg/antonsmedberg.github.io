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

  // Responsive point count - more points for better face coverage
  const isMobile = matchMedia('(max-width: 700px)').matches;
  const columns = isMobile ? 60 : 100;
  const rows = Math.round(columns * 1.25);
  const positions = [];
  const uvs = [];
  const seeds = [];
  const depths = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const u = x / (columns - 1);
      const v = y / (rows - 1);
      
      // Sample depth at this position
      const depth = sampleDepth(texture, u, 1 - v);
      
      // Only add points where there's actual face content
      if (depth > 0.15) {
        positions.push(
          (u - 0.5) * aspect,
          0.5 - v,
          0
        );
        uvs.push(u, 1 - v);
        seeds.push(Math.random());
        depths.push(depth);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aDepth', new THREE.Float32BufferAttribute(depths, 1));

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
      attribute float aDepth;
      varying float vAlpha;
      varying float vDepth;
      
      void main() {
        vec4 depthSample = texture2D(uDepth, uv);
        float depth = depthSample.r;
        float alpha = depthSample.a;
        
        // LiDAR-style horizontal banding
        float bandY = floor(uv.y * 30.0) / 30.0;
        float bandStrength = smoothstep(0.0, 0.05, abs(uv.y - bandY));
        
        // Seam: reconstruction zone on left, photo on right
        float enter = smoothstep(0.15, 0.28, uv.x);
        float exit = 1.0 - smoothstep(0.45, 0.58, uv.x);
        float seam = enter * exit;
        
        // Sparse density - LiDAR scan lines
        float lineDensity = step(0.35, fract(uv.y * 40.0 + aSeed * 0.5));
        float pointDensity = step(0.5, fract(aSeed * 19.71));
        float density = lineDensity * pointDensity * step(0.2, depth);
        
        vec3 p = position;
        
        // Depth displacement - stronger for near features
        float depthFactor = depth * depth;
        p.z = (depth - 0.4) * 0.2;
        
        // Pointer parallax - depth-dependent
        p.x += uPointer.x * mix(0.003, 0.02, depthFactor);
        p.y += uPointer.y * mix(0.002, 0.012, depthFactor);
        
        // Subtle breathing motion
        p.z += sin(uTime * 0.4 + aSeed * 6.0) * 0.003;
        p.y += sin(uTime * 0.3 + uv.x * 4.0) * 0.001;
        
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Point size varies by depth
        gl_PointSize = mix(1.2, 2.8, depthFactor) * uPixelRatio;
        
        vDepth = depth;
        vAlpha = alpha * seam * density * bandStrength;
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
        
        gl_FragColor = vec4(colour, vAlpha * edge * 0.65);
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
    
    pointerX += (targetX - pointerX) * 0.04;
    pointerY += (targetY - pointerY) * 0.04;
    material.uniforms.uPointer.value.set(pointerX, -pointerY);
    material.uniforms.uTime.value = clock.getElapsedTime();
    
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

// Helper function to sample depth texture
function sampleDepth(texture, u, v) {
  // Approximate depth sampling - actual implementation would use canvas
  // For now, return a value based on typical face depth distribution
  const centerX = 0.5;
  const centerY = 0.45;
  const dist = Math.sqrt((u - centerX) * (u - centerX) + (v - centerY) * (v - centerY));
  
  // Face is closer in center, farther at edges
  if (dist < 0.35) {
    return 0.7 + Math.random() * 0.3;
  } else if (dist < 0.5) {
    return 0.4 + Math.random() * 0.3;
  } else {
    return 0.1 + Math.random() * 0.2;
  }
}
