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
    antialias: false,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  // The CSS model is 4:5, so an orthographic camera gives one stable
  // coordinate system for depth texture, particles and portrait.
  const aspect = 4 / 5;
  const camera = new THREE.OrthographicCamera(
    -aspect / 2,
     aspect / 2,
     0.5,
    -0.5,
    -2,
     2
  );

  camera.position.z = 1;

  const loader = new THREE.TextureLoader();

  loader.load(
    '/assets/img/portrait-depth.png',
    (texture) => {
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      const mobile = matchMedia('(max-width: 700px)').matches;
      const columns = mobile ? 52 : 84;
      const rows = Math.round(columns * 1.25);

      const positions = new Float32Array(columns * rows * 3);
      const uvs = new Float32Array(columns * rows * 2);

      let p = 0;
      let t = 0;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const u = x / (columns - 1);
          const v = y / (rows - 1);

          positions[p++] = (u - 0.5) * aspect;
          positions[p++] = 0.5 - v;
          positions[p++] = 0;

          uvs[t++] = u;
          uvs[t++] = 1 - v;
        }
      }

      const geometry = new THREE.BufferGeometry();

      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );

      geometry.setAttribute(
        'uv',
        new THREE.BufferAttribute(uvs, 2)
      );

      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,

        uniforms: {
          uDepth: { value: texture },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uPixelRatio: { value: renderer.getPixelRatio() },
          uReveal: { value: 0 }
        },

        vertexShader: `
          uniform sampler2D uDepth;
          uniform vec2 uPointer;
          uniform float uPixelRatio;
          uniform float uReveal;

          varying float vAlpha;
          varying float vDepth;

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          void main() {
            vec4 sampleValue = texture2D(uDepth, uv);

            float depth = sampleValue.r;
            float alpha = sampleValue.a;

            /* Narrow reconstruction seam:
               flat scan -> sparse depth samples -> clean photograph. */
            float enter = smoothstep(0.12, 0.23, uv.x);
            float exit = 1.0 - smoothstep(0.43, 0.53, uv.x);
            float seam = enter * exit;

            /* Stable thinning. No per-load Math.random() noise. */
            float keep = step(0.43, hash21(uv * 251.0));

            vec3 position3d = position;
            float nearFactor = depth * depth;

            position3d.z = (depth - 0.5) * 0.17;

            position3d.x +=
              uPointer.x *
              mix(0.0015, 0.017, nearFactor);

            position3d.y +=
              uPointer.y *
              mix(0.001, 0.008, nearFactor);

            /* One-time reconstruction settle, not perpetual motion. */
            position3d.x -=
              (1.0 - uReveal) *
              mix(0.045, 0.012, uv.x);

            vec4 mv =
              modelViewMatrix *
              vec4(position3d, 1.0);

            gl_Position =
              projectionMatrix *
              mv;

            gl_PointSize =
              mix(1.0, 2.25, nearFactor) *
              uPixelRatio;

            vDepth = depth;

            vAlpha =
              alpha *
              seam *
              keep *
              smoothstep(0.05, 0.45, uReveal);
          }
        `,

        fragmentShader: `
          varying float vAlpha;
          varying float vDepth;

          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float radius = length(d);

            if (radius > 0.5) discard;

            float softEdge =
              1.0 -
              smoothstep(
                0.22,
                0.5,
                radius
              );

            vec3 farColour =
              vec3(0.62, 0.69, 0.79);

            vec3 midColour =
              vec3(0.39, 0.48, 0.71);

            vec3 nearColour =
              vec3(0.20, 0.32, 0.70);

            vec3 colour =
              vDepth < 0.5
              ? mix(
                  farColour,
                  midColour,
                  vDepth * 2.0
                )
              : mix(
                  midColour,
                  nearColour,
                  (vDepth - 0.5) * 2.0
                );

            gl_FragColor =
              vec4(
                colour,
                vAlpha *
                softEdge *
                0.78
              );
          }
        `
      });

      const cloud = new THREE.Points(geometry, material);
      scene.add(cloud);

      let visible = true;
      let frame = 0;

      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;

      const revealStartedAt = performance.now();

      function requestFrame() {
        if (!visible || frame) return;
        frame = requestAnimationFrame(draw);
      }

      function draw(now) {
        frame = 0;
        if (!visible) return;

        currentX += (targetX - currentX) * 0.085;
        currentY += (targetY - currentY) * 0.085;

        const reveal = Math.min(
          1,
          (now - revealStartedAt) / 780
        );

        material.uniforms.uReveal.value =
          1 - Math.pow(1 - reveal, 3);

        material.uniforms.uPointer.value.set(
          currentX,
          -currentY
        );

        renderer.render(scene, camera);

        const pointerMoving =
          Math.abs(targetX - currentX) > 0.001 ||
          Math.abs(targetY - currentY) > 0.001;

        if (reveal < 1 || pointerMoving) {
          requestFrame();
        }
      }

      function setPointer(event) {
        const rect = stage.getBoundingClientRect();

        targetX =
          Math.max(
            -1,
            Math.min(
              1,
              ((event.clientX - rect.left) / rect.width - 0.5) * 2
            )
          );

        targetY =
          Math.max(
            -1,
            Math.min(
              1,
              ((event.clientY - rect.top) / rect.height - 0.5) * 2
            )
          );

        stage.style.setProperty(
          '--px',
          targetX.toFixed(3)
        );

        stage.style.setProperty(
          '--py',
          targetY.toFixed(3)
        );

        requestFrame();
      }

      function resetPointer() {
        targetX = 0;
        targetY = 0;

        stage.style.setProperty('--px', '0');
        stage.style.setProperty('--py', '0');

        requestFrame();
      }

      stage.addEventListener(
        'pointermove',
        setPointer,
        { passive: true }
      );

      stage.addEventListener(
        'pointerleave',
        resetPointer,
        { passive: true }
      );

      const resizeObserver =
        new ResizeObserver(() => {
          const rect =
            model.getBoundingClientRect();

          renderer.setSize(
            Math.max(1, rect.width),
            Math.max(1, rect.height),
            false
          );

          requestFrame();
        });

      resizeObserver.observe(model);

      const visibilityObserver =
        new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;

            if (visible) {
              requestFrame();
            } else if (frame) {
              cancelAnimationFrame(frame);
              frame = 0;
            }
          },
          { rootMargin: '160px' }
        );

      visibilityObserver.observe(stage);

      const rect =
        model.getBoundingClientRect();

      renderer.setSize(
        Math.max(1, rect.width),
        Math.max(1, rect.height),
        false
      );

      requestFrame();
    },
    undefined,
    () => {
      /* Static SVG/photo fallback already remains visible. */
      canvas.hidden = true;
    }
  );
}
