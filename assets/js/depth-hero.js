const canvas = document.querySelector('[data-depth-canvas]');

if (!canvas) {
  // No hero on this page.
} else if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  canvas.hidden = true;
} else {
  const THREE = await import('../vendor/three.module.js');
  initDepthHero(canvas, THREE);
}

function initDepthHero(canvas, THREE) {
  const model = canvas.closest('.identity-model');
  const stage = canvas.closest('.identity-stage');

  if (!model || !stage) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  // Orthographic camera for proper 2D registration
  const aspect = 4 / 5;
  const frustumSize = 1.0;
  const camera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    10
  );

  camera.position.z = 5;

  const loader = new THREE.TextureLoader();

  loader.load(
    '/assets/img/portrait-depth.png',
    (texture) => {
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      const mobile = matchMedia('(max-width: 700px)').matches;
      const columns = mobile ? 60 : 120;
      const rows = Math.round(columns * 1.25);

      const positions = [];
      const uvs = [];
      const sizes = [];
      const alphas = [];

      // Generate grid points
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const u = x / (columns - 1);
          const v = y / (rows - 1);

          // Position in normalized space
          const px = (u - 0.5) * aspect;
          const py = 0.5 - v;

          positions.push(px, py, 0);
          uvs.push(u, 1 - v);

          // Deterministic hash for stable point distribution
          const hash = fractSinHash(u * 311.7, v * 191.3);
          
          // Size variation based on position
          const sizeBase = 0.8 + hash * 0.8;
          sizes.push(sizeBase);

          // Alpha variation
          alphas.push(0.4 + hash * 0.6);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
      geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));

      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,

        uniforms: {
          uDepth: { value: texture },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uTime: { value: 0 },
          uPixelRatio: { value: renderer.getPixelRatio() },
          uReveal: { value: 0 }
        },

        vertexShader: `
          uniform sampler2D uDepth;
          uniform vec2 uPointer;
          uniform float uTime;
          uniform float uPixelRatio;
          uniform float uReveal;

          attribute float aSize;
          attribute float aAlpha;

          varying float vAlpha;
          varying float vDepth;
          varying float vSize;

          void main() {
            vec4 depthSample = texture2D(uDepth, uv);
            float depth = depthSample.r;
            float alpha = depthSample.a;

            // Seam: reconstruction zone
            float enter = smoothstep(0.10, 0.22, uv.x);
            float exit = 1.0 - smoothstep(0.42, 0.55, uv.x);
            float seam = enter * exit;

            // Depth-based displacement
            float nearFactor = depth * depth;
            vec3 pos = position;
            pos.z = (depth - 0.45) * 0.2;

            // Pointer parallax - depth-dependent
            pos.x += uPointer.x * mix(0.002, 0.025, nearFactor);
            pos.y += uPointer.y * mix(0.001, 0.012, nearFactor);

            // Reveal animation - points converge from left
            float revealDelay = uv.x * 0.5;
            float localReveal = smoothstep(revealDelay, revealDelay + 0.4, uReveal);
            pos.x -= (1.0 - localReveal) * mix(0.08, 0.02, uv.x);
            pos.z += (1.0 - localReveal) * 0.1;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            // Size based on depth and reveal
            float sizeMult = mix(0.5, 1.5, nearFactor) * localReveal;
            gl_PointSize = aSize * sizeMult * uPixelRatio * 3.0;

            vAlpha = alpha * seam * aAlpha * localReveal;
            vDepth = depth;
            vSize = aSize;
          }
        `,

        fragmentShader: `
          precision mediump float;

          varying float vAlpha;
          varying float vDepth;
          varying float vSize;

          void main() {
            vec2 center = gl_PointCoord - 0.5;
            float dist = length(center);

            if (dist > 0.5) discard;

            // Soft circular point
            float softness = 1.0 - smoothstep(0.1, 0.5, dist);

            // Depth-based color gradient
            vec3 farColor = vec3(0.55, 0.65, 0.85);
            vec3 midColor = vec3(0.35, 0.55, 0.95);
            vec3 nearColor = vec3(0.15, 0.35, 0.85);

            vec3 color;
            if (vDepth < 0.5) {
              color = mix(farColor, midColor, vDepth * 2.0);
            } else {
              color = mix(midColor, nearColor, (vDepth - 0.5) * 2.0);
            }

            // Add subtle glow
            float glow = exp(-dist * 3.0) * 0.5;
            color += glow * vec3(0.3, 0.5, 1.0);

            gl_FragColor = vec4(color, vAlpha * softness * 0.85);
          }
        `
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      // Animation state
      let visible = true;
      let frame = 0;
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;
      const revealStartTime = performance.now();

      function requestFrame() {
        if (!visible || frame) return;
        frame = requestAnimationFrame(draw);
      }

      function draw(now) {
        frame = 0;
        if (!visible) return;

        // Smooth pointer interpolation
        currentX += (targetX - currentX) * 0.06;
        currentY += (targetY - currentY) * 0.06;

        // Reveal animation (0 to 1 over ~800ms)
        const reveal = Math.min(1, (now - revealStartTime) / 800);

        material.uniforms.uReveal.value = 1 - Math.pow(1 - reveal, 3);
        material.uniforms.uPointer.value.set(currentX, -currentY);

        renderer.render(scene, camera);

        // Continue animating if still revealing or pointer moving
        const pointerMoving = Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002;
        if (reveal < 1 || pointerMoving) {
          requestFrame();
        }
      }

      function setPointer(event) {
        const rect = stage.getBoundingClientRect();
        targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
        targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));

        stage.style.setProperty('--px', targetX.toFixed(3));
        stage.style.setProperty('--py', targetY.toFixed(3));

        requestFrame();
      }

      function resetPointer() {
        targetX = 0;
        targetY = 0;
        stage.style.setProperty('--px', '0');
        stage.style.setProperty('--py', '0');
        requestFrame();
      }

      stage.addEventListener('pointermove', setPointer, { passive: true });
      stage.addEventListener('pointerleave', resetPointer, { passive: true });

      const resizeObserver = new ResizeObserver(() => {
        const rect = model.getBoundingClientRect();
        renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
        requestFrame();
      });
      resizeObserver.observe(model);

      const visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible) requestFrame();
          else if (frame) {
            cancelAnimationFrame(frame);
            frame = 0;
          }
        },
        { rootMargin: '100px' }
      );
      visibilityObserver.observe(stage);

      const rect = model.getBoundingClientRect();
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
      requestFrame();
    },
    undefined,
    () => {
      canvas.hidden = true;
    }
  );
}

function fractSinHash(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
