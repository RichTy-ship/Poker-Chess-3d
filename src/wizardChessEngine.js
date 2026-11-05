import * as THREE_NS from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  UNIT_BASE_STATS,
  UNIT_SKILLS,
  LEVEL_XP_THRESHOLDS,
  POKER_COMBO_DEFS,
  createPlayerPokerState,
  drawUpToSevenCards,
  prepareNextTurnDrawState,
  consumeSelected5CardsAndDraw,
  evaluate5CardCombo,
  findBest5Of7,
  injectPresetHand,
  attachRPGStatsToPiece,
  getUnitArmorCap,
  applyComboEmpowermentToUnit,
  countFriendlyUnits,
  simulateRPGCombat,
  grantUnitXP,
  triggerMeleeHapticVibration,
  BOARD_TILE_MODIFIER_DEFS,
  SPECIAL_BOARD_TILES_LIST,
  getBoardTileModifier,
  CHESS_SKIN_CATALOG,
  ELO_RANK_TIERS,
  getEloRankInfo,
  loadCommercialProfile,
  saveCommercialProfile,
  TACTICAL_PING_INTENTS,
  soundFX
} from './pokerChessCore.js';
import { multiplayerClient } from './multiplayerClient.js';

/** @type {any} */
const THREE = THREE_NS;
const SkeletonUtils = { clone: cloneSkeleton };

export function initWizardChess() {
    // =========================================================================
    // Constants & Board Coordinates
    // =========================================================================
    const PIECE_TYPES = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];
    const PIECE_VALUES = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 };
    const BOARD_SQ_SIZE = 0.34;
    const BOARD_SURFACE_Y = 0.775;

    function boardToWorld(r, c) {
      return new THREE.Vector3(
        (c - 3.5) * BOARD_SQ_SIZE,
        BOARD_SURFACE_Y,
        (r - 3.5) * BOARD_SQ_SIZE
      );
    }

    function easeInOutCubic(x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    function easeOutCubic(x) {
      return 1 - Math.pow(1 - x, 3);
    }

    // =========================================================================
    // Scene, Camera, Renderer, and Cathedral Lighting
    // =========================================================================
    const container = document.getElementById('canvas-container') || document.getElementById('viewport-container');
    if (container) container.innerHTML = '';
    const isAutomatedTest = Boolean(
      navigator.webdriver || new URLSearchParams(window.location.search).get('autotest') === '1'
    );
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: isAutomatedTest
    });

    let performancePreset = 'balanced';
    try {
      const savedPreset = localStorage.getItem('pokerchess_perf_mode');
      if (savedPreset === 'performance' || savedPreset === 'balanced' || savedPreset === 'ultra') {
        performancePreset = savedPreset;
      }
    } catch (e) {}

    function applyPerformanceSettings(preset) {
      performancePreset = preset;
      try {
        localStorage.setItem('pokerchess_perf_mode', preset);
      } catch (e) {}

      if (preset === 'performance') {
        renderer.setPixelRatio(0.85);
        renderer.shadowMap.enabled = false;
      } else if (preset === 'ultra') {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.needsUpdate = true;
      } else {
        // balanced: native 1.0 pixel ratio and fast PCF shadows
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.needsUpdate = true;
      }
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    applyPerformanceSettings(performancePreset);
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    function cyclePerformancePreset() {
      const order = ['balanced', 'performance', 'ultra'];
      const nextIdx = (order.indexOf(performancePreset) + 1) % order.length;
      applyPerformanceSettings(order[nextIdx]);
      emitPokerChessSync();
      return performancePreset;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);
    scene.fog = new THREE.FogExp2(0x080b14, 0.015);

    // Self-contained Cathedral PMREM Environment (inspired by three-gpu-pathtracer & realism-effects)
    function createCathedralPMREMEnvironment(glRenderer) {
      const pmremGen = new THREE.PMREMGenerator(glRenderer);
      pmremGen.compileEquirectangularShader();
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x161412);
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      const addPanel = (colorHex, intensity, pos, scl) => {
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(colorHex).multiplyScalar(intensity)
        });
        const m = new THREE.Mesh(boxGeo, mat);
        m.position.fromArray(pos);
        m.scale.fromArray(scl);
        envScene.add(m);
      };
      // Upper Gothic clerestory & Rose Window light panels
      addPanel(0xdce6f7, 2.4, [0, 9.5, -12.0], [10.0, 2.0, 1.5]);
      addPanel(0xffe0b5, 2.2, [0, 9.5, 12.0], [10.0, 2.0, 1.5]);
      addPanel(0xd4deee, 1.8, [-9.0, 6.5, 0.0], [1.2, 4.5, 16.0]);
      addPanel(0xd4deee, 1.8, [9.0, 6.5, 0.0], [1.2, 4.5, 16.0]);
      // Warm twin fire cauldron & limestone floor bounce panels
      addPanel(0xff9438, 3.2, [-4.5, 1.6, 0.0], [2.2, 2.2, 4.0]);
      addPanel(0xff9438, 3.2, [4.5, 1.6, 0.0], [2.2, 2.2, 4.0]);
      addPanel(0x6e5c49, 0.9, [0, -4.0, 0.0], [16.0, 1.0, 24.0]);
      const envTex = pmremGen.fromScene(envScene, 0.04).texture;
      boxGeo.dispose();
      pmremGen.dispose();
      return envTex;
    }

    scene.environment = createCathedralPMREMEnvironment(renderer);
    if ('environmentIntensity' in scene) {
      scene.environmentIntensity = 0.24;
    }

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.22, 65);
    camera.position.set(0, 2.22, 2.72);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.16;
    orbitControls.maxPolarAngle = Math.PI * 0.88;
    orbitControls.minPolarAngle = 0.05;
    orbitControls.minDistance = 0.95;
    orbitControls.maxDistance = 36.0;
    orbitControls.target.set(0, 0.85, -0.15);
    orbitControls.update();

    // =========================================================================
    // Feature 5: Hold Shift + Mouse Drag (Left=Rotate, Right=Pan) Axis Lock (X or Y)
    // =========================================================================
    let isShiftKeyDown = false;
    const shiftDragState = {
      active: false,
      startX: 0,
      startY: 0,
      lockedAxis: null // 'x' | 'y' | null
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') isShiftKeyDown = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        isShiftKeyDown = false;
        shiftDragState.lockedAxis = null;
      }
    });

    // Capture pointerdown BEFORE OrbitControls so Shift+LeftClick stays ROTATE (instead of OrbitControls' default Shift->PAN swap)
    renderer.domElement.addEventListener(
      'pointerdown',
      (e) => {
        shiftDragState.active = true;
        shiftDragState.startX = e.clientX;
        shiftDragState.startY = e.clientY;
        shiftDragState.lockedAxis = null;
        if (e.shiftKey) {
          isShiftKeyDown = true;
          if (e.button === 0) {
            try {
              Object.defineProperty(e, 'shiftKey', {
                get: () => false,
                configurable: true
              });
            } catch (err) {}
          }
        }
      },
      { capture: true }
    );

    window.addEventListener('pointerup', () => {
      shiftDragState.active = false;
      shiftDragState.lockedAxis = null;
    });

    const origHandleMouseMoveRotate = orbitControls._handleMouseMoveRotate.bind(orbitControls);
    orbitControls._handleMouseMoveRotate = function (event) {
      if (event.shiftKey || isShiftKeyDown) {
        const dx = Math.abs(event.clientX - shiftDragState.startX);
        const dy = Math.abs(event.clientY - shiftDragState.startY);
        if (!shiftDragState.lockedAxis && (dx > 2 || dy > 2)) {
          shiftDragState.lockedAxis = dx >= dy ? 'x' : 'y';
        }
        if (shiftDragState.lockedAxis === 'x') {
          return origHandleMouseMoveRotate({
            clientX: event.clientX,
            clientY: this._rotateStart.y
          });
        } else if (shiftDragState.lockedAxis === 'y') {
          return origHandleMouseMoveRotate({
            clientX: this._rotateStart.x,
            clientY: event.clientY
          });
        }
      } else {
        shiftDragState.lockedAxis = null;
      }
      return origHandleMouseMoveRotate(event);
    };

    const origHandleMouseMovePan = orbitControls._handleMouseMovePan.bind(orbitControls);
    orbitControls._handleMouseMovePan = function (event) {
      if (event.shiftKey || isShiftKeyDown) {
        const dx = Math.abs(event.clientX - shiftDragState.startX);
        const dy = Math.abs(event.clientY - shiftDragState.startY);
        if (!shiftDragState.lockedAxis && (dx > 2 || dy > 2)) {
          shiftDragState.lockedAxis = dx >= dy ? 'x' : 'y';
        }
        if (shiftDragState.lockedAxis === 'x') {
          return origHandleMouseMovePan({
            clientX: event.clientX,
            clientY: this._panStart.y
          });
        } else if (shiftDragState.lockedAxis === 'y') {
          return origHandleMouseMovePan({
            clientX: this._panStart.x,
            clientY: event.clientY
          });
        }
      } else {
        shiftDragState.lockedAxis = null;
      }
      return origHandleMouseMovePan(event);
    };

    // Dramatic Chiaroscuro Cathedral & Board Lighting (restoring original-example 3D stone relief & warm firelight contrast)
    const hemiLight = new THREE.HemisphereLight(0xd8ccb8, 0x261d14, 0.62);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff0d6, 2.55);
    keyLight.position.set(3.8, 8.5, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 22.0;
    const d = 3.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Subtle directional rim/fill (kept low so opposing directional lights never cancel normal-map mortar shadows)
    const rimLight = new THREE.DirectionalLight(0xd8cbb8, 0.72);
    rimLight.position.set(-4.5, 6.0, -6.5);
    scene.add(rimLight);

    const southFillLight = new THREE.DirectionalLight(0xffe4c0, 0.52);
    southFillLight.position.set(4.2, 5.8, 7.5);
    scene.add(southFillLight);

    // Twin Flickering Brazier Point Lights (centered at x = +/-3.65, z = 0.00; flanking column bounce is evaluated in shader)
    const brazierCoords = [
      { pos: [-3.65, 1.08, 0.00], baseIntensity: 4.35, dist: 18.0 },
      { pos: [3.65, 1.08, 0.00], baseIntensity: 4.35, dist: 18.0 }
    ];
    const brazierLights = [];
    for (const cfg of brazierCoords) {
      const pLight = new THREE.PointLight(0xff8e32, cfg.baseIntensity, cfg.dist, 1.40);
      pLight.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      pLight.userData.baseIntensity = cfg.baseIntensity;
      scene.add(pLight);
      brazierLights.push(pLight);
    }

    // Realistic Gaseous GLSL Brazier Flames & Soft Warm Firelight Glow (zero bouncing shapes)
    const brazierFireUniforms = [];
    const brazierGlowSprites = [];

    function createSoftGlowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(128, 128, 2, 128, 128, 128);
      grad.addColorStop(0.0, 'rgba(255, 226, 155, 0.88)');
      grad.addColorStop(0.18, 'rgba(255, 154, 52, 0.50)');
      grad.addColorStop(0.45, 'rgba(255, 92, 16, 0.18)');
      grad.addColorStop(0.75, 'rgba(210, 48, 4, 0.04)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // Strip the 14 tiny static icosphere spark balls baked above Opt8_Brazier_Flame_Mid (y > 1.26, height < 0.10)
    // while preserving 100% of the sculpted flame tongues (which start at y = 0.59..0.61)
    function stripIcosphereSparksFromFlameGeometry(geometry) {
      if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
      const pos = geometry.attributes.position;
      if (geometry.index) {
        const idx = geometry.index.array;
        for (let i = 0; i < idx.length; i += 3) {
          const i0 = idx[i];
          const i1 = idx[i + 1];
          const i2 = idx[i + 2];
          const y0 = pos.getY(i0);
          const y1 = pos.getY(i1);
          const y2 = pos.getY(i2);
          const minY = Math.min(y0, y1, y2);
          if (minY > 1.25) {
            idx[i] = 0;
            idx[i + 1] = 0;
            idx[i + 2] = 0;
          }
        }
        geometry.index.needsUpdate = true;
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          const y0 = pos.getY(i);
          const y1 = pos.getY(i + 1);
          const y2 = pos.getY(i + 2);
          if (Math.min(y0, y1, y2) > 1.25) {
            pos.setXYZ(i, 0, 0, 0);
            pos.setXYZ(i + 1, 0, 0, 0);
            pos.setXYZ(i + 2, 0, 0, 0);
          }
        }
        pos.needsUpdate = true;
      }
    }

    // =========================================================================
    // Cathedral Room Boundary Clamping (Floor, Ceiling, Side & End Walls)
    // & Solid Cylindrical Column Collision / Circumferential Sliding Solver
    // =========================================================================
    const CATHEDRAL_BOUNDS = {
      minX: -6.65,
      maxX: 6.65,
      minY: 0.34,
      maxY: 8.85,
      minZ: -18.10,
      maxZ: 18.10
    };

    // 12 freestanding columns spread wider across the nave; the 4 columns closest to the chessboard (z = +/-2.20)
    // have been removed to create a grand 13.70m open Atrium around the altar and centered fire braziers
    const CATHEDRAL_COLUMN_ROWS = [
      { z: -16.65, xAbs: 4.25 },
      { z: -11.85, xAbs: 4.25 },
      { z: -6.85,  xAbs: 4.65 },
      { z: 6.85,   xAbs: 4.65 },
      { z: 11.85,  xAbs: 4.25 },
      { z: 16.65,  xAbs: 4.25 }
    ];
    const CATHEDRAL_SOLID_PILLARS = [
      ...CATHEDRAL_COLUMN_ROWS.flatMap(({ z, xAbs }) => [
        { x: -xAbs, z, r: 0.86, maxY: 9.65, isColumn: true },
        { x: xAbs,  z, r: 0.86, maxY: 9.65, isColumn: true }
      ]),
      { x: -3.65, z: 0.00, r: 0.68, maxY: 1.95, isColumn: false },
      { x: 3.65,  z: 0.00, r: 0.68, maxY: 1.95, isColumn: false }
    ];

    function clampPointToCathedralRoom(pt, isTarget = false) {
      const margin = isTarget ? 0.15 : 0.0;
      pt.x = Math.max(CATHEDRAL_BOUNDS.minX - margin, Math.min(CATHEDRAL_BOUNDS.maxX + margin, pt.x));
      pt.z = Math.max(CATHEDRAL_BOUNDS.minZ - margin, Math.min(CATHEDRAL_BOUNDS.maxZ + margin, pt.z));
      // Account for the sloped side-aisle ceiling vault outside x = +/-4.15
      const aisleDrop = Math.max(0, Math.abs(pt.x) - 4.15) * 0.55;
      const localMaxY = Math.min(CATHEDRAL_BOUNDS.maxY, 9.05 - aisleDrop);
      const localMinY = isTarget ? 0.20 : CATHEDRAL_BOUNDS.minY;
      pt.y = Math.max(localMinY, Math.min(localMaxY, pt.y));
    }

    function enforceCathedralBoundsAndSolidColumns(prevPos, curPos, targetPos) {
      clampPointToCathedralRoom(targetPos, true);
      clampPointToCathedralRoom(curPos, false);

      if (isAnimatingMove) {
        if (Math.abs(curPos.x) < 2.48 && Math.abs(curPos.z) < 2.38) {
          curPos.y = Math.max(curPos.y, BOARD_SURFACE_Y + 0.30);
        }
        return;
      }

      const x0 = prevPos ? prevPos.x : curPos.x;
      const z0 = prevPos ? prevPos.z : curPos.z;
      let x1 = curPos.x;
      let z1 = curPos.z;
      const moveDx = x1 - x0;
      const moveDz = z1 - z0;
      const moveLenSq = moveDx * moveDx + moveDz * moveDz;
      const moveLen = Math.sqrt(moveLenSq);
      const isContinuousStep = Boolean(prevPos) && moveLen > 1e-5 && moveLen < 8.0;

      for (const p of CATHEDRAL_SOLID_PILLARS) {
        if (curPos.y > p.maxY) continue;

        let tClosest = 1.0;
        if (isContinuousStep) {
          tClosest = ((p.x - x0) * moveDx + (p.z - z0) * moveDz) / moveLenSq;
          tClosest = Math.max(0.0, Math.min(1.0, tClosest));
        }
        const cxSeg = x0 + moveDx * tClosest;
        const czSeg = z0 + moveDz * tClosest;
        const dSeg = isContinuousStep ? Math.hypot(cxSeg - p.x, czSeg - p.z) : Infinity;
        const dEnd = Math.hypot(x1 - p.x, z1 - p.z);

        if (dSeg < p.r || dEnd < p.r) {
          if (typeof window.__wizardChessTelemetry === 'object' && window.__wizardChessTelemetry && p.isColumn) {
            window.__wizardChessTelemetry.columnDeflections = (window.__wizardChessTelemetry.columnDeflections || 0) + 1;
          }

          if (isContinuousStep) {
            // Smooth tangential circumferential slide around the column
            const startAng = Math.atan2(z0 - p.z, x0 - p.x);
            const endAng = Math.atan2(z1 - p.z, x1 - p.x);
            let deltaAng = endAng - startAng;
            while (deltaAng > Math.PI) deltaAng -= Math.PI * 2;
            while (deltaAng < -Math.PI) deltaAng += Math.PI * 2;

            // Project step onto unit tangent at startAng; if pushing dead-on into column center, bias toward center aisle
            const tanX = -Math.sin(startAng);
            const tanZ = Math.cos(startAng);
            let tangMove = moveDx * tanX + moveDz * tanZ;
            if (Math.abs(tangMove) < moveLen * 0.18) {
              const aisleSign = (p.x >= 0 ? -1 : 1) * Math.sign(moveDz || 1);
              tangMove = (tangMove >= 0 ? 1 : aisleSign || 1) * moveLen * 0.65;
            }
            const arcStep = Math.sign(deltaAng || tangMove || 1) * Math.max(Math.abs(deltaAng), Math.min(Math.PI * 0.35, Math.abs(tangMove) / p.r));
            const newAng = startAng + arcStep;
            x1 = p.x + Math.cos(newAng) * p.r;
            z1 = p.z + Math.sin(newAng) * p.r;
          } else {
            const radX = x1 - p.x;
            const radZ = z1 - p.z;
            const radLen = Math.hypot(radX, radZ);
            if (radLen > 1e-4) {
              x1 = p.x + (radX / radLen) * p.r;
              z1 = p.z + (radZ / radLen) * p.r;
            } else {
              x1 = p.x + (p.x >= 0 ? -p.r : p.r);
              z1 = p.z;
            }
          }
        }
      }

      // Solid Black Marble Altar (4.40m x 4.20m slab + pedestal) & Chessboard collision
      // Prevents the camera from passing down through either the chessboard OR the surrounding black marble altar rim
      const ALTAR_TOP_Y = 0.722;
      const ALTAR_HALF_X = 2.48; // 2.22m black marble slab half-width + 0.26m camera frustum near-clip margin
      const ALTAR_HALF_Z = 2.38; // 2.12m black marble slab half-depth + 0.26m camera frustum near-clip margin
      const BOARD_HALF_XZ = 1.66;
      if (Math.abs(targetPos.x) < 2.36 && Math.abs(targetPos.z) < 2.26) {
        const minTargetY =
          Math.abs(targetPos.x) < 1.56 && Math.abs(targetPos.z) < 1.56
            ? BOARD_SURFACE_Y + 0.05
            : ALTAR_TOP_Y + 0.05;
        if (targetPos.y < minTargetY) {
          targetPos.y = minTargetY;
        }
      }
      if (Math.abs(x1) < ALTAR_HALF_X && Math.abs(z1) < ALTAR_HALF_Z) {
        const isOverChessboard = Math.abs(x1) < BOARD_HALF_XZ && Math.abs(z1) < BOARD_HALF_XZ;
        const solidAltarTopY = isOverChessboard ? (BOARD_SURFACE_Y + 0.25) : (ALTAR_TOP_Y + 0.28); // 1.035m on board, 1.002m on black marble altar
        if (curPos.y < solidAltarTopY) {
          const wasInsideAltarFootprint =
            Boolean(prevPos) &&
            Math.abs(x0) < ALTAR_HALF_X - 0.005 &&
            Math.abs(z0) < ALTAR_HALF_Z - 0.005;
          const wasAboveAltarSlab =
            wasInsideAltarFootprint ||
            (Boolean(prevPos) && prevPos.y >= ALTAR_TOP_Y - 0.04) ||
            curPos.y >= ALTAR_TOP_Y - 0.10;
          if (wasAboveAltarSlab) {
            curPos.y = Math.max(curPos.y, solidAltarTopY);
          } else {
            const penX = ALTAR_HALF_X - Math.abs(x1);
            const penZ = ALTAR_HALF_Z - Math.abs(z1);
            if (penX < penZ) {
              x1 = (x1 >= 0 ? 1 : -1) * ALTAR_HALF_X;
            } else {
              z1 = (z1 >= 0 ? 1 : -1) * ALTAR_HALF_Z;
            }
          }
        }
      }

      // Solid Marble & Obsidian Chess Pieces collision during manual camera movement
      // (Bypassed when isAnimatingMove is true so automated duel/attack camera choreography never gets pinned between statues)
      if (
        !isAnimatingMove &&
        curPos.y < BOARD_SURFACE_Y + 0.85 &&
        typeof boardState === 'object' &&
        Array.isArray(boardState)
      ) {
        const pieceRad = 0.185;
        for (let r = 0; r < 8; r++) {
          const row = boardState[r];
          if (!row) continue;
          for (let c = 0; c < 8; c++) {
            const pc = row[c];
            if (!pc || !pc.mesh || !pc.mesh.parent) continue;
            const px = pc.mesh.position.x;
            const pz = pc.mesh.position.z;
            const pieceH = (typeof PIECE_HEIGHTS === 'object' && PIECE_HEIGHTS[pc.type]) ? PIECE_HEIGHTS[pc.type] : 0.42;
            const pieceTopY = pc.mesh.position.y + pieceH + 0.10;
            if (curPos.y >= pieceTopY) continue;

            let tPiece = 1.0;
            if (isContinuousStep) {
              tPiece = ((px - x0) * moveDx + (pz - z0) * moveDz) / moveLenSq;
              tPiece = Math.max(0.0, Math.min(1.0, tPiece));
            }
            const cxP = x0 + moveDx * tPiece;
            const czP = z0 + moveDz * tPiece;
            const dSegP = isContinuousStep ? Math.hypot(cxP - px, czP - pz) : Infinity;
            const dEndP = Math.hypot(x1 - px, z1 - pz);

            if (dSegP < pieceRad || dEndP < pieceRad) {
              if (
                prevPos &&
                prevPos.y >= pieceTopY - 0.08 &&
                Math.hypot(x0 - px, z0 - pz) < pieceRad * 0.85
              ) {
                curPos.y = Math.max(curPos.y, pieceTopY);
              } else {
                const radX = x1 - px;
                const radZ = z1 - pz;
                const radLen = Math.hypot(radX, radZ);
                if (radLen > 1e-4) {
                  x1 = px + (radX / radLen) * pieceRad;
                  z1 = pz + (radZ / radLen) * pieceRad;
                } else {
                  x1 = px + pieceRad;
                }
              }
            }
          }
        }
      }

      curPos.x = x1;
      curPos.z = z1;
      clampPointToCathedralRoom(curPos, false);

      // Update minimum column clearance telemetry across all 12 freestanding columns
      if (typeof window.__wizardChessTelemetry === 'object' && window.__wizardChessTelemetry) {
        let minClear = Infinity;
        for (const p of CATHEDRAL_SOLID_PILLARS) {
          if (!p.isColumn) continue;
          const d = Math.hypot(curPos.x - p.x, curPos.z - p.z);
          if (d < minClear) minClear = d;
        }
        window.__wizardChessTelemetry.lastColumnClearance = Number(minClear.toFixed(3));
        if (
          window.__wizardChessTelemetry.minColumnClearance === undefined ||
          minClear < window.__wizardChessTelemetry.minColumnClearance
        ) {
          window.__wizardChessTelemetry.minColumnClearance = Number(minClear.toFixed(3));
        }
      }
    }

    function createSculptedFlameTongueShader(cfg) {
      const uniforms = {
        uTime: { value: 0 },
        uZMin: { value: cfg.zMin },
        uZMax: { value: cfg.zMax },
        uLayerSeed: { value: cfg.layerSeed },
        uStrength: { value: cfg.strength },
        uOpacity: { value: cfg.opacity },
        uBaseColor: { value: new THREE.Color(...cfg.baseColor) },
        uMidColor: { value: new THREE.Color(...cfg.midColor) },
        uTipColor: { value: new THREE.Color(...cfg.tipColor) }
      };
      brazierFireUniforms.push(uniforms);

      return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          uniform float uTime;
          uniform float uZMin;
          uniform float uZMax;
          uniform float uLayerSeed;
          varying vec3 vLocalPos;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          varying float vHeightNorm;

          void main() {
            vec3 pos = position;
            float h = clamp((pos.y - uZMin) / max(0.01, uZMax - uZMin), 0.0, 1.0);
            vHeightNorm = h;

            // Each brazier is centered at X = +/- 3.65, Z = 0.65 in local mesh space (world Z = 0.00)
            vec2 bCenter = vec2(sign(pos.x) * 3.65, 0.65);
            vec2 relXZ = vec2(pos.x, pos.z) - bCenter;

            // Distinct phase per sculpted tongue & fire layer so all 27 tongues dance independently
            float tonguePhase = relXZ.x * 14.0 + relXZ.y * 12.0 + uLayerSeed * 1.9;
            float sway = pow(h, 1.05);

            // Multi-frequency upward-propagating lateral flame wave (pinned at h = 0 in the logs)
            float waveX = sin(pos.y * 4.6 - uTime * 6.4 + tonguePhase) * 0.088
                        + cos(pos.y * 8.2 - uTime * 9.8 + tonguePhase * 1.35) * 0.048;
            float waveZ = cos(pos.y * 4.3 - uTime * 5.9 + tonguePhase * 1.15) * 0.088
                        + sin(pos.y * 7.8 - uTime * 9.1 + tonguePhase * 0.85) * 0.048;

            // Swirling thermal vortex twist + radial breathing around each brazier bowl
            float twistAngle = sin(uTime * 4.2 + pos.y * 4.5 + uLayerSeed) * 0.30 * sway;
            float cA = cos(twistAngle);
            float sA = sin(twistAngle);
            vec2 twistedXZ = vec2(relXZ.x * cA - relXZ.y * sA, relXZ.x * sA + relXZ.y * cA);
            float radialPulse = 1.0 + sin(uTime * 5.2 - h * 4.0 + tonguePhase) * 0.14 * sway;

            pos.x = bCenter.x + twistedXZ.x * radialPulse + waveX * sway;
            pos.z = bCenter.y + twistedXZ.y * radialPulse + waveZ * sway;

            // Active vertical flame-tongue licking (base h = 0 stays strictly anchored at uZMin)
            float lickStretch = 1.0 + (
              sin(uTime * 5.8 + tonguePhase * 1.3) * 0.22 +
              cos(uTime * 9.2 - tonguePhase * 0.9) * 0.12
            ) * smoothstep(0.05, 0.85, h);
            pos.y = uZMin + (pos.y - uZMin) * lickStretch;

            vLocalPos = pos;
            vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPosition.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uZMin;
          uniform float uZMax;
          uniform float uLayerSeed;
          uniform float uStrength;
          uniform float uOpacity;
          uniform vec3 uBaseColor;
          uniform vec3 uMidColor;
          uniform vec3 uTipColor;
          varying vec3 vLocalPos;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;
          varying float vHeightNorm;

          float hash3(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
          }

          float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x),
                f.y
              ),
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x),
                f.y
              ),
              f.z
            );
          }

          void main() {
            float h = clamp(vHeightNorm, 0.0, 1.0);
            vec3 V = normalize(cameraPosition - vWorldPos);
            vec3 N = normalize(vWorldNormal);

            // Real-time port of Cycles LayerWeight.Facing^2.4 gaseous feathering
            float facing = clamp(abs(dot(N, V)), 0.0, 1.0);
            float powFacing = pow(facing, 2.25);

            // Fast upward-convecting 3D flame turbulence that actively carves the flame tips
            float n1 = noise3(vec3(vLocalPos.x * 5.4, vLocalPos.y * 4.8 - uTime * 6.8, vLocalPos.z * 5.4 + uLayerSeed));
            float n2 = noise3(vec3(vLocalPos.x * 10.2 + 1.9, vLocalPos.y * 8.5 - uTime * 10.5, vLocalPos.z * 10.2 - uLayerSeed));
            float shimmer = mix(n1, n2, 0.45);

            // Dynamic tip erosion so flame tongues visibly lick up and recede
            float erodedH = clamp(h + (shimmer - 0.48) * 0.42 * smoothstep(0.08, 0.85, h), 0.0, 1.0);

            // Combine eroded height and (1.0 - facing) so grazing edges shift toward fiery orange-crimson
            float heatCoord = clamp(erodedH + (1.0 - facing) * 0.36 + (shimmer - 0.5) * 0.22, 0.0, 1.0);
            vec3 col = mix(uBaseColor, uMidColor, smoothstep(0.0, 0.45, heatCoord));
            col = mix(col, uTipColor, smoothstep(0.45, 0.90, heatCoord));

            float zAlpha = mix(0.96, 0.72, smoothstep(0.0, 0.68, erodedH)) * (1.0 - smoothstep(0.64, 0.98, erodedH));
            float baseSoft = smoothstep(0.0, 0.06, h);
            float flickerPulse = 0.76 + 0.48 * shimmer;
            float alpha = clamp(zAlpha * baseSoft * powFacing * uOpacity * flickerPulse, 0.0, 1.0);
            if (alpha < 0.004) discard;

            gl_FragColor = vec4(col * uStrength, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
    }

    function createCharredEmberLogsShader() {
      const uniforms = {
        uTime: { value: 0 }
      };
      brazierFireUniforms.push(uniforms);

      return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          varying vec3 vLocalPos;
          varying vec3 vWorldNormal;
          void main() {
            vLocalPos = position;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec3 vLocalPos;
          varying vec3 vWorldNormal;

          float hash3(vec3 p) {
            p = fract(p * vec3(443.897, 441.423, 437.195));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
          }

          float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x),
                f.y
              ),
              mix(
                mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x),
                f.y
              ),
              f.z
            );
          }

          void main() {
            // Dark charred timber bark (#0B0807) fissured with glowing incandescent 2200K orange cracks & glowing coal bed base
            float nCrack = noise3(vLocalPos * 18.0);
            float nFine = noise3(vLocalPos * 38.0 + vec3(0.0, uTime * 0.25, 0.0));
            float pulse = 0.88 + 0.12 * sin(uTime * 2.3 + vLocalPos.x * 4.0 + vLocalPos.z * 4.0);

            // Lower coal cone (y < 0.59) vs upper charred logs (y >= 0.59)
            float isCoalBed = 1.0 - smoothstep(0.56, 0.61, vLocalPos.y);
            float crackMask = smoothstep(0.68, 0.88, nCrack * 0.7 + nFine * 0.3);
            float underGlow = clamp(-vWorldNormal.y * 0.45 + 0.35, 0.0, 1.0) * smoothstep(0.72, 0.56, vLocalPos.y);

            vec3 charBark = vec3(0.035, 0.025, 0.020);
            vec3 emberOrange = vec3(1.0, 0.36, 0.04) * 1.45 * pulse;
            vec3 hotCoal = vec3(1.0, 0.58, 0.12) * 1.65 * pulse;

            float emberWeight = clamp(isCoalBed * (0.45 + 0.55 * nFine) + crackMask * 0.85 + underGlow * 0.45, 0.0, 1.0);
            vec3 col = mix(charBark, emberOrange, emberWeight);
            col = mix(col, hotCoal, smoothstep(0.72, 0.96, emberWeight));

            gl_FragColor = vec4(col, 1.0);
          }
        `
      });
    }

    function createBrazierWarmGlowHalos() {
      const glowTex = createSoftGlowTexture();
      const brazierCenters = [
        { x: -3.65, y: 0.56, z: 0.00, seed: 1.3 },
        { x: 3.65, y: 0.56, z: 0.00, seed: 5.8 }
      ];

      for (const b of brazierCenters) {
        // Layer 1: Inner warm hearth core glow halo centered in the flame body
        const coreGlowMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xffb866,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const coreSprite = new THREE.Sprite(coreGlowMat);
        coreSprite.position.set(b.x, b.y + 0.28, b.z);
        coreSprite.scale.set(1.15, 1.25, 1.0);
        coreSprite.userData = { baseOpacity: 0.42, seed: b.seed };
        scene.add(coreSprite);
        brazierGlowSprites.push(coreSprite);

        // Layer 2: Wide, soft atmospheric warm glow halo bathing the surrounding air & ironwork
        const haloGlowMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xff8524,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const haloSprite = new THREE.Sprite(haloGlowMat);
        haloSprite.position.set(b.x, b.y + 0.38, b.z);
        haloSprite.scale.set(2.45, 2.30, 1.0);
        haloSprite.userData = { baseOpacity: 0.28, seed: b.seed + 2.1 };
        scene.add(haloSprite);
        brazierGlowSprites.push(haloSprite);
      }
    }

    createBrazierWarmGlowHalos();

    // Consolidated Window Point Lights (4 side-aisle + 2 end-wall lights instead of 22 separate PointLights;
    // fine local window & column raking relief is evaluated analytically in applyCathedralStoneRealismShader)
    for (const wz of [-8.8, 8.2]) {
      for (const sideSign of [-1, 1]) {
        const winLight = new THREE.PointLight(0x90beff, 4.2, 16.5, 1.35);
        winLight.position.set(sideSign * 5.3, 4.1, wz);
        scene.add(winLight);
      }
    }
    const northWinLight = new THREE.PointLight(0x9bc4ff, 6.4, 20.0, 1.30);
    northWinLight.position.set(0, 5.2, -18.2);
    scene.add(northWinLight);

    const southWinLight = new THREE.PointLight(0xffb85c, 6.4, 20.0, 1.30);
    southWinLight.position.set(0, 5.2, 18.2);
    scene.add(southWinLight);

    // Impact Flash Light (kept visible=true with intensity=0 when idle so Three.js never recompiles shaders mid-attack!)
    const impactFlashLight = new THREE.PointLight(0xffb74d, 0, 6.0, 1.5);
    impactFlashLight.visible = true;
    scene.add(impactFlashLight);

    // =========================================================================
    // Materials for White & Black Sculpted Stone Chess Pieces & 10 3D Skins
    // =========================================================================
    const whitePieceMat = new THREE.MeshStandardMaterial({
      color: 0xf5efe6,
      roughness: 0.20,
      metalness: 0.10
    });

    const blackPieceMat = new THREE.MeshStandardMaterial({
      color: 0x141720,
      roughness: 0.16,
      metalness: 0.38
    });

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf6c543,
      roughness: 0.16,
      metalness: 0.94
    });

    const forgedSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe4edf7,
      roughness: 0.15,
      metalness: 0.92,
      emissive: 0x162030,
      emissiveIntensity: 0.28
    });

    const lightSqMat = new THREE.MeshStandardMaterial({
      color: 0xede5d6,
      roughness: 0.22,
      metalness: 0.08
    });

    const darkSqMat = new THREE.MeshStandardMaterial({
      color: 0x101319,
      roughness: 0.18,
      metalness: 0.24
    });

    let boardState = Array.from({ length: 8 }, () => Array(8).fill(null));
    let commercialProfile = loadCommercialProfile();
    let activeSkinSlashHex = 0xfde047;
    let activeRenderedSkinId = commercialProfile.equippedSkinId || 'classic_sanctum';

    // Shared glow/crystal accent materials updated dynamically per skin
    const skinGlowAccentMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xfde047,
      emissiveIntensity: 0.85,
      roughness: 0.14,
      metalness: 0.72,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide
    });

    const skinCrystalTranslucentMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.65,
      roughness: 0.08,
      metalness: 0.35,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide
    });

    // =========================================================================
    // 10 BESPOKE 3D SCULPTED SKIN MODEL ARCHITECTURES
    // Dynamically constructs & attaches distinct 3D models (Wings, Dragon Horns,
    // Levitating Greatswords, War-Scythes, 360° Gyroscopic Astrolabes, Jade
    // Mandorlas, Imperial Banners, and Saturnian Rings) onto every chess piece!
    // =========================================================================
    // =========================================================================
    // REFINED ARCHITECTURAL 3D SKIN SCULPTING SYSTEM
    // Elegant, non-gaudy, role-based hierarchy:
    // - Pawns: Clean heraldic bucklers & polished pedestals (Zero porcupine clutter!)
    // - Knights: Armored chanfron steed visors & crested manes
    // - Bishops: Slender liturgical finials & sacred spires
    // - Rooks: Architectural fortress crenellations & defensive bastions
    // - Queens: Majestic royal tiaras & graceful swept-back wing mantles
    // - Kings: Sovereign imperial crowns & regal halos / astrolabes
    // =========================================================================
    function attachCustomSkin3DModelToPiece(pieceObj, skinIdInput) {
      if (!pieceObj || !pieceObj.mesh) return;
      const skinId = skinIdInput || activeRenderedSkinId || 'classic_sanctum';
      const skin = CHESS_SKIN_CATALOG.find((s) => s.id === skinId) || CHESS_SKIN_CATALOG[0];

      // Clean up previous 3D attachments
      if (pieceObj.skinModelGroup) {
        pieceObj.mesh.remove(pieceObj.skinModelGroup);
        pieceObj.skinModelGroup.traverse((child) => {
          if (child.isMesh && child.geometry) {
            child.geometry.dispose();
          }
        });
        pieceObj.skinModelGroup = null;
        pieceObj.skinAnimParts = null;
      }

      const dimMap = {
        pawn:   { baseR: 0.36, headY: 0.96, guardPos: [-0.16, 0.52, 0.38], chestZ: 0.38, orbitR: 0.48 },
        rook:   { baseR: 0.40, topY: 1.28, rimR: 0.42 },
        knight: { baseR: 0.40, horseHead: [0, 1.26, 0.52], riderHead: [0, 1.47, 0.05] },
        bishop: { baseR: 0.37, mitreY: 1.46 },
        queen:  { baseR: 0.40, crownY: 1.40, backPos: [0, 0.85, -0.34], wingspan: 0.95 },
        king:   { baseR: 0.43, crownY: 1.48, backPos: [0, 1.15, -0.38], ringR: 0.58 }
      };
      const dims = dimMap[pieceObj.type] || dimMap.pawn;
      const baseR = dims.baseR;
      const role = pieceObj.type;

      // Overhead badge positioning: float cleanly ABOVE crowns, dragon horns, and wing tips
      const badgeYMap = { pawn: 1.38, rook: 1.68, knight: 1.88, bishop: 1.88, queen: 2.08, king: 2.28 };
      if (pieceObj.badgeSprite) {
        pieceObj.badgeSprite.position.set(0, badgeYMap[pieceObj.type] || 1.85, 0);
      }

      const bodyMat = pieceObj.color === 'w' ? whitePieceMat : blackPieceMat;
      const unitLvl = pieceObj.level || 1;
      const trimMat = goldTrimMat;
      const steelMat = forgedSteelMat;
      const glowMat = skinGlowAccentMat;
      const crystalMat = skinCrystalTranslucentMat;

      const skinGroup = new THREE.Group();
      skinGroup.name = 'skin3d_' + skinId;
      const animParts = {
        phaseOffset: ((pieceObj.r || 0) * 8 + (pieceObj.c || 0)) * 0.38,
        leftWing: null,
        rightWing: null,
        haloRing: null,
        orbitGroup: null,
        gyroOuter: null,
        gyroMid: null,
        gyroInner: null,
        floatingWeapons: [],
        levitatingCrystals: []
      };

      // -----------------------------------------------------------------------
      // 1. ELEGANT PEDESTAL BASE & BESPOKE SKIN FOOTING
      // -----------------------------------------------------------------------
      const baseGroup = new THREE.Group();
      baseGroup.position.set(0, 0.02, 0);

      if (skinId === 'classic_sanctum') {
        const octBase = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.95, baseR * 1.08, 0.045, 8), trimMat);
        baseGroup.add(octBase);
      } else if (skinId === 'royal_ivory_ebony') {
        const ringBase = new THREE.Mesh(new THREE.TorusGeometry(baseR * 0.98, 0.024, 8, 24), trimMat);
        ringBase.rotation.x = Math.PI / 2;
        baseGroup.add(ringBase);
      } else if (skinId === 'jade_dynasty') {
        const lotusRing = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.98, baseR * 1.10, 0.04, 12), bodyMat);
        const goldRim = new THREE.Mesh(new THREE.TorusGeometry(baseR * 1.10, 0.018, 6, 24), trimMat);
        goldRim.rotation.x = Math.PI / 2;
        baseGroup.add(lotusRing, goldRim);
      } else if (skinId === 'crimson_inquisitor') {
        const ironOct = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.95, baseR * 1.08, 0.045, 8), steelMat);
        const redBand = new THREE.Mesh(new THREE.TorusGeometry(baseR * 1.02, 0.020, 6, 8), trimMat);
        redBand.rotation.x = Math.PI / 2;
        baseGroup.add(ironOct, redBand);
      } else if (skinId === 'frost_valkyrie') {
        const iceHex = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.95, baseR * 1.08, 0.045, 6), crystalMat);
        const silverRim = new THREE.Mesh(new THREE.TorusGeometry(baseR * 1.06, 0.018, 6, 18), trimMat);
        silverRim.rotation.x = Math.PI / 2;
        baseGroup.add(iceHex, silverRim);
      } else if (skinId === 'solar_seraphim') {
        const sunRing = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.95, baseR * 1.08, 0.045, 16), trimMat);
        baseGroup.add(sunRing);
      } else if (skinId === 'abyssal_necromancer') {
        const cryptBase = new THREE.Mesh(new THREE.BoxGeometry(baseR * 2.1, 0.04, baseR * 2.1), bodyMat);
        const slateBand = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.95, baseR * 1.05, 0.03, 8), trimMat);
        baseGroup.add(cryptBase, slateBand);
      } else if (skinId === 'arcane_archmage') {
        const runeDisc = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.98, baseR * 1.08, 0.035, 18), bodyMat);
        const brassOrbit = new THREE.Mesh(new THREE.TorusGeometry(baseR * 1.08, 0.018, 6, 24), trimMat);
        brassOrbit.rotation.x = Math.PI / 2;
        baseGroup.add(runeDisc, brassOrbit);
      } else if (skinId === 'infernal_drake') {
        const basaltPlinth = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.96, baseR * 1.10, 0.05, 8), bodyMat);
        const copperVein = new THREE.Mesh(new THREE.TorusGeometry(baseR * 1.06, 0.022, 6, 16), trimMat);
        copperVein.rotation.x = Math.PI / 2;
        baseGroup.add(basaltPlinth, copperVein);
      } else if (skinId === 'celestial_eternity') {
        const starlightDisc = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.98, baseR * 1.12, 0.04, 24), bodyMat);
        const platOrbit = new THREE.Mesh(new THREE.TorusGeometry(baseR * 1.12, 0.018, 8, 32), trimMat);
        platOrbit.rotation.x = Math.PI / 2;
        baseGroup.add(starlightDisc, platOrbit);
      }

      // RPG LEVEL-UP 3D EVOLUTION (Tiers of honor directly visible on the piece)
      if (unitLvl >= 2) {
        const lvl2Ring = new THREE.Mesh(new THREE.TorusGeometry(baseR * 0.92, 0.020, 6, 20), trimMat);
        lvl2Ring.position.set(0, 0.065, 0);
        lvl2Ring.rotation.x = Math.PI / 2;
        baseGroup.add(lvl2Ring);

        const honorPipL = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), trimMat);
        honorPipL.position.set(-0.22, 0.60, 0.18);
        const honorPipR = honorPipL.clone();
        honorPipR.position.x = 0.22;
        skinGroup.add(honorPipL, honorPipR);
      }
      if (unitLvl >= 3) {
        const apexHalo = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.018, 6, 16), trimMat);
        apexHalo.position.set(0, (dims.headY || dims.topY || dims.crownY || 1.40) + 0.12, 0);
        apexHalo.rotation.x = Math.PI / 2;
        skinGroup.add(apexHalo);

        const groundAura = new THREE.Mesh(new THREE.RingGeometry(baseR * 1.15, baseR * 1.30, 24), glowMat);
        groundAura.position.set(0, 0.005, 0);
        groundAura.rotation.x = -Math.PI / 2;
        skinGroup.add(groundAura);
      }
      skinGroup.add(baseGroup);

      // -----------------------------------------------------------------------
      // 2. PAWNS (TỐT): Prominent shields & true-radius planetary orbits
      // -----------------------------------------------------------------------
      if (role === 'pawn') {
        const crestGroup = new THREE.Group();
        crestGroup.position.set(0, 0.52, 0.38);

        if (skinId === 'classic_sanctum') {
          // Classic Gothic cruciform heater shield
          const shield = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.04), bodyMat);
          const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.048), trimMat);
          const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.05, 0.048), trimMat);
          crossH.position.y = 0.04;
          shield.add(crossV, crossH);
          crestGroup.add(shield);
        } else if (skinId === 'royal_ivory_ebony') {
          // Roman Parma round buckler with golden imperial boss
          const buckler = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 18), bodyMat);
          buckler.rotation.x = Math.PI / 2;
          const boss = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), trimMat);
          boss.position.z = 0.03;
          buckler.add(boss);
          crestGroup.add(buckler);
        } else if (skinId === 'jade_dynasty') {
          // Carved Jade Lotus Medallion with gold trim
          const lotusDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 10), crystalMat);
          lotusDisc.rotation.x = Math.PI / 2;
          const goldTrim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 6, 20), trimMat);
          crestGroup.add(lotusDisc, goldTrim);
        } else if (skinId === 'crimson_inquisitor') {
          // Black Iron triangular kite shield with dark ruby edge
          const kite = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.38, 3), steelMat);
          kite.rotation.z = Math.PI;
          const stud = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), trimMat);
          stud.position.y = 0.04;
          kite.add(stud);
          crestGroup.add(kite);
        } else if (skinId === 'frost_valkyrie') {
          // Nordic snowflake ice rune roundel
          const runeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 6), crystalMat);
          runeDisc.rotation.x = Math.PI / 2;
          const iceStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), trimMat);
          iceStar.position.z = 0.03;
          crestGroup.add(runeDisc, iceStar);
        } else if (skinId === 'solar_seraphim') {
          // Solar sunburst medallion
          const sunDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 12), trimMat);
          sunDisc.rotation.x = Math.PI / 2;
          const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), bodyMat);
          core.position.z = 0.025;
          crestGroup.add(sunDisc, core);
        } else if (skinId === 'abyssal_necromancer') {
          // Crypt skull crest
          const skullDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 8), bodyMat);
          skullDisc.rotation.x = Math.PI / 2;
          const boneRivet = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), trimMat);
          boneRivet.position.z = 0.03;
          crestGroup.add(skullDisc, boneRivet);
        } else if (skinId === 'arcane_archmage') {
          // Arcane runic pentagram disc
          const arcaneDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 10), trimMat);
          arcaneDisc.rotation.x = Math.PI / 2;
          const runeCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), crystalMat);
          runeCore.position.z = 0.03;
          crestGroup.add(arcaneDisc, runeCore);
        } else if (skinId === 'infernal_drake') {
          // Dragon scale shield (Khiên Vảy Rồng Hỏa Tộc) with molten copper rim & glowing core
          const scaleShield = new THREE.Mesh(new THREE.OctahedronGeometry(0.20, 0), bodyMat);
          scaleShield.scale.set(1.1, 1.6, 0.28);
          scaleShield.position.set(-0.06, 0, 0);
          scaleShield.rotation.x = -0.10;
          const copperTrim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 4, 4), trimMat);
          copperTrim.rotation.z = Math.PI / 4;
          const magmaCore = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), glowMat);
          magmaCore.rotation.z = Math.PI;
          magmaCore.position.z = 0.045;
          scaleShield.add(copperTrim, magmaCore);
          crestGroup.add(scaleShield);
        } else if (skinId === 'celestial_eternity') {
          // Planetary Orbit Rings with orbiting Starlight Pearl Moon (Quỹ Đạo Tinh Cầu)
          const orbitGroup = new THREE.Group();
          const platOrbit = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.020, 8, 36), trimMat);
          platOrbit.rotation.x = 0.42;
          platOrbit.rotation.z = 0.25;
          const subOrbit = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.010, 6, 32), crystalMat);
          platOrbit.add(subOrbit);
          const pearlMoon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), crystalMat);
          pearlMoon.position.set(0.48, 0, 0);
          platOrbit.add(pearlMoon);
          orbitGroup.add(platOrbit);
          orbitGroup.position.set(0, 0, -0.38); // Center cleanly around pawn body
          crestGroup.add(orbitGroup);
          animParts.orbitGroup = platOrbit;
        }
        skinGroup.add(crestGroup);
      }

      // -----------------------------------------------------------------------
      // 3. KNIGHTS (MÃ): Natural sculpted steed & armored rider with lance
      // (Preserves clean un-occluded horse head & animated lance/shield)
      // -----------------------------------------------------------------------
      else if (role === 'knight') {
        // Knight has fully animated rider & steed rig; themed via pedestal plinth & skin materials
      }

      // -----------------------------------------------------------------------
      // 4. BISHOPS (TƯỢNG): Liturgical finial atop real mitre (Y = 1.46)
      // -----------------------------------------------------------------------
      else if (role === 'bishop') {
        const mitreGroup = new THREE.Group();
        mitreGroup.position.set(0, 1.46, 0);

        if (skinId === 'classic_sanctum' || skinId === 'royal_ivory_ebony') {
          const crossFinial = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), trimMat);
          const crossBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), trimMat);
          crossBar.position.y = 0.05;
          crossFinial.add(crossBar);
          mitreGroup.add(crossFinial);
        } else if (skinId === 'jade_dynasty') {
          const chimeDisc = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.026, 6, 20), crystalMat);
          chimeDisc.rotation.y = Math.PI / 4;
          const goldPin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 6), trimMat);
          mitreGroup.add(chimeDisc, goldPin);
        } else if (skinId === 'crimson_inquisitor') {
          const reliquaryCross = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), trimMat);
          const ironSpire = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.26, 4), steelMat);
          ironSpire.position.y = 0.12;
          mitreGroup.add(reliquaryCross, ironSpire);
        } else if (skinId === 'frost_valkyrie') {
          const icePrism = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), crystalMat);
          icePrism.scale.set(0.8, 1.8, 0.8);
          mitreGroup.add(icePrism);
        } else if (skinId === 'solar_seraphim') {
          const monstrance = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 6, 20), trimMat);
          const sunSphere = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), bodyMat);
          monstrance.add(sunSphere);
          mitreGroup.add(monstrance);
        } else if (skinId === 'abyssal_necromancer') {
          const soulLantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), trimMat);
          const soulCore = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), glowMat);
          soulLantern.add(soulCore);
          mitreGroup.add(soulLantern);
        } else if (skinId === 'arcane_archmage') {
          const astrolabeSphere = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 20), trimMat);
          astrolabeSphere.rotation.x = Math.PI / 3;
          const runeCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), crystalMat);
          mitreGroup.add(astrolabeSphere, runeCore);
          animParts.haloRing = astrolabeSphere;
        } else if (skinId === 'infernal_drake') {
          // Liturgical Volcanic Brazier (Đỉnh lư đồng tế nham thạch nung chảy)
          const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.08, 0.20, 6), trimMat);
          const magmaOrb = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 12), glowMat);
          magmaOrb.position.y = 0.10;
          brazier.add(magmaOrb);
          for (let i = 0; i < 3; i++) {
            const a = (i * Math.PI * 2) / 3;
            const fang = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.28, 4), bodyMat);
            fang.position.set(Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.16);
            fang.rotation.z = Math.cos(a) * -0.25;
            fang.rotation.x = Math.sin(a) * 0.25;
            brazier.add(fang);
          }
          mitreGroup.add(brazier);
        } else if (skinId === 'celestial_eternity') {
          // Armillary Sphere / Planetarium (Mô hình quả cầu thiên thể)
          const armillary = new THREE.Group();
          const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.020, 6, 28), trimMat);
          ring1.rotation.y = Math.PI / 4;
          const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 6, 28), trimMat);
          ring2.rotation.x = Math.PI / 3;
          const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 24), crystalMat);
          ring3.rotation.z = Math.PI / 3;
          const sapphireOrb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), glowMat);
          armillary.add(ring1, ring2, ring3, sapphireOrb);
          mitreGroup.add(armillary);
          animParts.haloRing = armillary;
        }
        skinGroup.add(mitreGroup);
      }

      // -----------------------------------------------------------------------
      // 5. ROOKS (XE): Crown battlements atop real tower (Y = 1.28, R = 0.42)
      // -----------------------------------------------------------------------
      else if (role === 'rook') {
        const battlements = new THREE.Group();
        battlements.position.set(0, 1.28, 0);

        if (skinId === 'jade_dynasty') {
          // Multi-tiered Pagoda roof eaves
          const eave1 = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.60, 0.07, 4), bodyMat);
          eave1.rotation.y = Math.PI / 4;
          const goldEaveTrim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.026, 4, 4), trimMat);
          goldEaveTrim.rotation.x = Math.PI / 2;
          goldEaveTrim.rotation.z = Math.PI / 4;
          battlements.add(eave1, goldEaveTrim);
        } else if (skinId === 'crimson_inquisitor') {
          // 4-corner spiked iron battlements
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 4), steelMat);
            spike.position.set(Math.cos(a) * 0.40, 0.12, Math.sin(a) * 0.40);
            battlements.add(spike);
          }
        } else if (skinId === 'frost_valkyrie') {
          // 4 Glacier crystal corner spire turrets
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2 + Math.PI / 4;
            const iceSpire = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), crystalMat);
            iceSpire.scale.set(0.7, 1.8, 0.7);
            iceSpire.position.set(Math.cos(a) * 0.40, 0.12, Math.sin(a) * 0.40);
            battlements.add(iceSpire);
          }
        } else if (skinId === 'infernal_drake') {
          // Fortified Volcanic Caldera (Miệng Núi Lửa kiên cố)
          const calderaFort = new THREE.Group();
          const calderaRim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.40, 0.12, 8), bodyMat);
          calderaFort.add(calderaRim);
          const lavaPool = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 16), glowMat);
          lavaPool.position.y = 0.05;
          calderaFort.add(lavaPool);
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI * 2) / 6;
            const crag = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 4), trimMat);
            crag.position.set(Math.cos(a) * 0.39, 0.10, Math.sin(a) * 0.39);
            calderaFort.add(crag);
          }
          battlements.add(calderaFort);
        } else if (skinId === 'celestial_eternity') {
          // Cosmic Observatory Dome (Đài Thiên Văn Vũ Trụ mái vòm)
          const obsTower = new THREE.Group();
          const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.08, 20), trimMat);
          obsTower.add(baseRing);
          const obsDome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), bodyMat);
          obsDome.position.y = 0.04;
          obsTower.add(obsDome);
          const meridianArch = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.024, 6, 28, Math.PI), trimMat);
          meridianArch.rotation.x = Math.PI / 2;
          meridianArch.rotation.y = Math.PI / 2;
          meridianArch.position.y = 0.04;
          obsTower.add(meridianArch);
          const horizonRing = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.018, 6, 32), crystalMat);
          horizonRing.position.y = 0.06;
          horizonRing.rotation.x = Math.PI / 2;
          obsTower.add(horizonRing);
          animParts.haloRing = horizonRing;
          const starlightBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), glowMat);
          starlightBeacon.position.y = 0.44;
          obsTower.add(starlightBeacon);
          battlements.add(obsTower);
        } else {
          // Classic / Imperial / Seraph crenellated parapet
          const parapetRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 6, 20), trimMat);
          parapetRing.rotation.x = Math.PI / 2;
          battlements.add(parapetRing);
        }
        skinGroup.add(battlements);
      }

      // -----------------------------------------------------------------------
      // 6. QUEENS (HẬU): Majestic Sovereign Wings & Diadems across all 10 Skins
      // -----------------------------------------------------------------------
      else if (role === 'queen') {
        const wingMat = trimMat;
        const membraneMat = glowMat;

        if (skinId === 'infernal_drake') {
          // Grand Volcanic Dragon Wings (Cánh Rồng Nham Thạch oai phong)
          for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(side * 0.22, 0.92, -0.06);
            wing.rotation.y = -side * 0.32;
            wing.rotation.x = 0.12;

            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), bodyMat);
            arm.position.set(side * 0.28, 0.32, 0);
            arm.rotation.z = -side * 0.75;
            wing.add(arm);

            const claw = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 4), wingMat);
            claw.position.set(side * 0.58, 0.62, 0.02);
            claw.rotation.z = -side * 0.95;
            wing.add(claw);

            const fAngles = [-0.15, 0.35, 0.80];
            const fLengths = [0.95, 0.82, 0.65];
            for (let f = 0; f < 3; f++) {
              const strutLen = fLengths[f];
              const strut = new THREE.Mesh(new THREE.BoxGeometry(0.045, strutLen, 0.045), wingMat);
              strut.position.set(side * (0.54 + f * 0.14), 0.38 - f * 0.20, 0);
              strut.rotation.z = -side * (0.75 + fAngles[f]);
              wing.add(strut);

              const web = new THREE.Mesh(new THREE.PlaneGeometry(0.32, strutLen * 0.85), membraneMat);
              web.position.set(side * (0.45 + f * 0.12), 0.34 - f * 0.16, 0.01);
              web.rotation.z = -side * (0.70 + fAngles[f]);
              wing.add(web);
            }

            skinGroup.add(wing);
            if (side === -1) animParts.leftWing = wing;
            else animParts.rightWing = wing;
          }

          // Volcanic Queen Horned Diadem
          const vDiadem = new THREE.Group();
          vDiadem.position.set(0, 1.42, 0);
          const vCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.032, 6, 20), trimMat);
          vCirclet.rotation.x = Math.PI / 2;
          vDiadem.add(vCirclet);
          for (let i = -2; i <= 2; i++) {
            const a = i * 0.45;
            const spLen = 0.30 - Math.abs(i) * 0.06;
            const sp = new THREE.Mesh(new THREE.ConeGeometry(0.048, spLen, 4), glowMat);
            sp.position.set(Math.sin(a) * 0.25, spLen * 0.45, Math.cos(a) * 0.25);
            sp.rotation.z = -i * 0.15;
            vDiadem.add(sp);
          }
          skinGroup.add(vDiadem);

        } else if (skinId === 'celestial_eternity') {
          // Prismatic Starlight Crystal Wings (Cánh Tinh Tú Lăng Kính)
          for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(side * 0.22, 0.92, -0.06);
            wing.rotation.y = -side * 0.28;
            wing.rotation.x = 0.10;

            const bladeConfigs = [
              { len: 1.10, angle: 0.42, thick: 0.09, mat: crystalMat, lift: 0.40, xOff: 0.26 },
              { len: 0.92, angle: 0.72, thick: 0.08, mat: trimMat,    lift: 0.22, xOff: 0.42 },
              { len: 0.75, angle: 1.02, thick: 0.07, mat: crystalMat, lift: 0.04, xOff: 0.54 },
              { len: 0.55, angle: 1.32, thick: 0.06, mat: glowMat,    lift: -0.15, xOff: 0.62 }
            ];

            for (const bc of bladeConfigs) {
              const blade = new THREE.Mesh(new THREE.OctahedronGeometry(bc.thick, 0), bc.mat);
              blade.scale.set(0.70, bc.len / bc.thick, 0.32);
              blade.position.set(side * bc.xOff, bc.lift, 0);
              blade.rotation.z = -side * bc.angle;
              wing.add(blade);
            }

            const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.25, 6), trimMat);
            lance.position.set(side * 0.35, 0.24, -0.02);
            lance.rotation.z = -side * 0.30;
            wing.add(lance);

            skinGroup.add(wing);
            if (side === -1) animParts.leftWing = wing;
            else animParts.rightWing = wing;
          }

          // Empress Starlight Diadem
          const starCrown = new THREE.Group();
          starCrown.position.set(0, 1.42, 0);
          const starCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.028, 8, 24), trimMat);
          starCirclet.rotation.x = Math.PI / 2;
          starCrown.add(starCirclet);
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI * 2) / 8;
            const isCard = i % 2 === 0;
            const hSp = isCard ? 0.26 : 0.16;
            const starSpire = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), crystalMat);
            starSpire.scale.set(0.6, hSp / 0.048, 0.6);
            starSpire.position.set(Math.cos(a) * 0.25, hSp * 0.45, Math.sin(a) * 0.25);
            starCrown.add(starSpire);
          }
          skinGroup.add(starCrown);

        } else if (skinId === 'frost_valkyrie') {
          // Nordic Glacial Ice Wings (Cánh Băng Vũ Pha Lê)
          for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(side * 0.22, 0.92, -0.06);
            wing.rotation.y = -side * 0.28;
            wing.rotation.x = 0.10;

            for (let f = 0; f < 4; f++) {
              const fLen = 0.95 - f * 0.16;
              const iceBlade = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), crystalMat);
              iceBlade.scale.set(0.55, fLen / 0.07, 0.28);
              iceBlade.position.set(side * (0.22 + f * 0.14), 0.28 - f * 0.14, 0);
              iceBlade.rotation.z = -side * (0.42 + f * 0.22);
              wing.add(iceBlade);
            }
            skinGroup.add(wing);
            if (side === -1) animParts.leftWing = wing;
            else animParts.rightWing = wing;
          }

          const frostTiara = new THREE.Group();
          frostTiara.position.set(0, 1.42, 0);
          const fCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.026, 6, 20), trimMat);
          fCirclet.rotation.x = Math.PI / 2;
          frostTiara.add(fCirclet);
          for (let i = -2; i <= 2; i++) {
            const a = i * 0.38;
            const sp = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.24 - Math.abs(i) * 0.04, 4), crystalMat);
            sp.position.set(Math.sin(a) * 0.25, 0.12, Math.cos(a) * 0.25);
            frostTiara.add(sp);
          }
          skinGroup.add(frostTiara);

        } else if (skinId === 'crimson_inquisitor') {
          // Damascus Executioner Scythe Wings (Cánh Lưỡi Hái Huyết Ngục)
          for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(side * 0.22, 0.92, -0.06);
            wing.rotation.y = -side * 0.30;
            wing.rotation.x = 0.12;

            for (let f = 0; f < 3; f++) {
              const fLen = 0.92 - f * 0.18;
              const scythe = new THREE.Mesh(new THREE.BoxGeometry(0.05, fLen, 0.08), steelMat);
              scythe.position.set(side * (0.24 + f * 0.15), 0.26 - f * 0.15, 0);
              scythe.rotation.z = -side * (0.50 + f * 0.24);
              const bloodEdge = new THREE.Mesh(new THREE.ConeGeometry(0.035, fLen * 0.5, 4), trimMat);
              bloodEdge.position.set(side * 0.04, fLen * 0.2, 0);
              scythe.add(bloodEdge);
              wing.add(scythe);
            }
            skinGroup.add(wing);
            if (side === -1) animParts.leftWing = wing;
            else animParts.rightWing = wing;
          }

          const inqTiara = new THREE.Group();
          inqTiara.position.set(0, 1.42, 0);
          const iCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.030, 6, 16), steelMat);
          iCirclet.rotation.x = Math.PI / 2;
          inqTiara.add(iCirclet);
          for (let i = -2; i <= 2; i++) {
            const a = i * 0.40;
            const sp = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.25 - Math.abs(i) * 0.05, 4), trimMat);
            sp.position.set(Math.sin(a) * 0.25, 0.12, Math.cos(a) * 0.25);
            inqTiara.add(sp);
          }
          skinGroup.add(inqTiara);

        } else if (skinId === 'solar_seraphim') {
          // Six-Winged Seraphim Angel Array (Đôi Cánh Seraphim Hoàng Kim)
          for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(side * 0.22, 0.92, -0.06);
            wing.rotation.y = -side * 0.26;

            for (let f = 0; f < 4; f++) {
              const fLen = 0.98 - f * 0.15;
              const feather = new THREE.Mesh(new THREE.BoxGeometry(0.042, fLen, 0.08), trimMat);
              feather.position.set(side * (0.20 + f * 0.12), 0.28 - f * 0.12, 0);
              feather.rotation.z = -side * (0.42 + f * 0.22);
              wing.add(feather);
            }
            skinGroup.add(wing);
            if (side === -1) animParts.leftWing = wing;
            else animParts.rightWing = wing;
          }

          const sunTiara = new THREE.Group();
          sunTiara.position.set(0, 1.42, 0);
          const sCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.028, 8, 24), trimMat);
          sCirclet.rotation.x = Math.PI / 2;
          sunTiara.add(sCirclet);
          for (let i = -3; i <= 3; i++) {
            const a = i * 0.32;
            const ray = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.24 - Math.abs(i) * 0.035, 4), glowMat);
            ray.position.set(Math.sin(a) * 0.25, 0.12, Math.cos(a) * 0.25);
            sunTiara.add(ray);
          }
          skinGroup.add(sunTiara);

        } else {
          // Standard / Jade / Arcane / Imperial Wings & Tiara
          const tiaraGroup = new THREE.Group();
          tiaraGroup.position.set(0, 1.42, 0);
          const tiaraCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.028, 6, 20), trimMat);
          tiaraCirclet.rotation.x = Math.PI / 2;
          tiaraGroup.add(tiaraCirclet);

          for (let i = -2; i <= 2; i++) {
            const a = (i * 0.38);
            const spLen = 0.24 - Math.abs(i) * 0.04;
            const sp = new THREE.Mesh(new THREE.ConeGeometry(0.040, spLen, 4), trimMat);
            sp.position.set(Math.sin(a) * 0.25, spLen * 0.45, Math.cos(a) * 0.25);
            tiaraGroup.add(sp);
          }
          skinGroup.add(tiaraGroup);

          const curWingMat = (skinId === 'jade_dynasty') ? crystalMat : trimMat;
          for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(side * 0.22, 0.92, -0.06);
            wing.rotation.y = -side * 0.26;
            wing.rotation.x = 0.10;

            for (let f = 0; f < 3; f++) {
              const fLen = 0.88 - f * 0.15;
              const feather = new THREE.Mesh(new THREE.BoxGeometry(0.042, fLen, 0.08), curWingMat);
              feather.position.set(side * (0.22 + f * 0.12), 0.24 - f * 0.12, 0);
              feather.rotation.z = -side * (0.44 + f * 0.22);
              wing.add(feather);
            }
            skinGroup.add(wing);
            if (side === -1) animParts.leftWing = wing;
            else animParts.rightWing = wing;
          }
        }
      }

      // -----------------------------------------------------------------------
      // 7. KINGS (VUA): Imperial crown (Y = 1.48) & 360° Sovereign Ring (Y = 1.15)
      // -----------------------------------------------------------------------
      else if (role === 'king') {
        const crownGroup = new THREE.Group();
        crownGroup.position.set(0, 1.48, 0);

        if (skinId === 'infernal_drake') {
          // Ancient Draconic Horned Crown (Vương miện Sừng Rồng cổ đại)
          const drakeCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.038, 8, 24), trimMat);
          drakeCirclet.rotation.x = Math.PI / 2;
          crownGroup.add(drakeCirclet);

          const magmaCore = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), glowMat);
          magmaCore.position.y = 0.14;
          crownGroup.add(magmaCore);

          const hornConfigs = [
            { x: -0.19, z: 0.13,  rotZ: 0.45,  rotX: -0.35, len: 0.48 },
            { x: 0.19,  z: 0.13,  rotZ: -0.45, rotX: -0.35, len: 0.48 },
            { x: -0.23, z: -0.11, rotZ: 0.55,  rotX: 0.40,  len: 0.60 },
            { x: 0.23,  z: -0.11, rotZ: -0.55, rotX: 0.40,  len: 0.60 }
          ];
          for (const hc of hornConfigs) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.058, hc.len, 5), trimMat);
            horn.position.set(hc.x, hc.len * 0.45, hc.z);
            horn.rotation.z = hc.rotZ;
            horn.rotation.x = hc.rotX;
            crownGroup.add(horn);
          }
          skinGroup.add(crownGroup);

          // Sovereign Caldera Halo: 360-degree centered Ring encircling the King
          const calderaHalo = new THREE.Group();
          calderaHalo.position.set(0, 1.15, 0);
          const magmaHaloRing = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.038, 8, 32), trimMat);
          magmaHaloRing.rotation.x = Math.PI / 2;
          calderaHalo.add(magmaHaloRing);
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI * 2) / 8;
            const flameSpike = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.22, 4), glowMat);
            flameSpike.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
            flameSpike.rotation.y = -a;
            flameSpike.rotation.z = -Math.PI / 2;
            calderaHalo.add(flameSpike);
          }
          skinGroup.add(calderaHalo);
          animParts.haloRing = calderaHalo;

        } else if (skinId === 'celestial_eternity') {
          // Imperial Starlight Crown (Vương Miện Tinh Đế)
          const astralCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 24), trimMat);
          astralCirclet.rotation.x = Math.PI / 2;
          crownGroup.add(astralCirclet);

          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI * 2) / 8;
            const isMain = i % 2 === 0;
            const spLen = isMain ? 0.36 : 0.20;
            const spire = new THREE.Mesh(new THREE.ConeGeometry(0.045, spLen, 4), trimMat);
            spire.position.set(Math.cos(a) * 0.28, spLen * 0.45, Math.sin(a) * 0.28);
            const gem = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), crystalMat);
            gem.position.set(Math.cos(a) * 0.28, spLen * 0.85, Math.sin(a) * 0.28);
            crownGroup.add(spire, gem);
          }
          const apexStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.10, 0), crystalMat);
          apexStar.position.y = 0.42;
          apexStar.scale.set(0.7, 1.4, 0.7);
          crownGroup.add(apexStar);
          skinGroup.add(crownGroup);

          // Tilted Saturnian Planetary Ring with Orbiting Starlight Moon (Vành Đai Sao Thổ 360°)
          const saturnRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.028, 8, 44), trimMat);
          saturnRing.position.set(0, 1.10, 0);
          saturnRing.rotation.x = 0.48;
          saturnRing.rotation.z = 0.22;

          const innerDustRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.015, 6, 36), crystalMat);
          saturnRing.add(innerDustRing);

          const moonOrb = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 12), crystalMat);
          moonOrb.position.set(0.62, 0, 0);
          saturnRing.add(moonOrb);

          skinGroup.add(saturnRing);
          animParts.orbitGroup = saturnRing;

        } else {
          // Classic / Imperial / Frost / Inquisitor Crown with Sovereign Cross
          const crownCirclet = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.034, 8, 24), trimMat);
          crownCirclet.rotation.x = Math.PI / 2;
          crownGroup.add(crownCirclet);

          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI * 2) / 8;
            const isMain = i % 2 === 0;
            const spH = isMain ? 0.30 : 0.18;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, spH, 4), trimMat);
            spike.position.set(Math.cos(a) * 0.28, spH * 0.45, Math.sin(a) * 0.28);
            crownGroup.add(spike);
          }
          const sovereignCross = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.26, 0.042), trimMat);
          sovereignCross.position.y = 0.28;
          const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.042, 0.042), trimMat);
          crossArm.position.y = 0.28;
          crownGroup.add(sovereignCross, crossArm);
          skinGroup.add(crownGroup);

          // Sovereign Regalia Halo: Encircles King symmetrically at Y = 1.15
          const haloGroup = new THREE.Group();
          haloGroup.position.set(0, 1.15, 0);

          if (skinId === 'crimson_inquisitor') {
            const ironHalo = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.032, 6, 24), steelMat);
            ironHalo.rotation.x = Math.PI / 2;
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI * 2) / 8;
              const spike = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.20, 4), trimMat);
              spike.position.set(Math.cos(a) * 0.60, 0, Math.sin(a) * 0.60);
              spike.rotation.y = -a;
              spike.rotation.z = -Math.PI / 2;
              ironHalo.add(spike);
            }
            haloGroup.add(ironHalo);
            animParts.haloRing = ironHalo;
          } else if (skinId === 'solar_seraphim') {
            const sunHalo = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.032, 8, 28), trimMat);
            sunHalo.rotation.x = Math.PI / 2;
            for (let i = 0; i < 12; i++) {
              const a = (i * Math.PI * 2) / 12;
              const ray = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.22, 4), glowMat);
              ray.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
              ray.rotation.y = -a;
              ray.rotation.z = -Math.PI / 2;
              sunHalo.add(ray);
            }
            haloGroup.add(sunHalo);
            animParts.haloRing = sunHalo;
          } else if (skinId === 'jade_dynasty') {
            const biDisc = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 8, 28), crystalMat);
            biDisc.rotation.x = Math.PI / 2;
            const goldTrim = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.024, 6, 28), trimMat);
            goldTrim.rotation.x = Math.PI / 2;
            haloGroup.add(biDisc, goldTrim);
          } else if (skinId === 'frost_valkyrie') {
            const iceHalo = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.030, 6, 24), crystalMat);
            iceHalo.rotation.x = Math.PI / 2;
            for (let i = 0; i < 6; i++) {
              const a = (i * Math.PI * 2) / 6;
              const iceStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), trimMat);
              iceStar.position.set(Math.cos(a) * 0.60, 0, Math.sin(a) * 0.60);
              iceHalo.add(iceStar);
            }
            haloGroup.add(iceHalo);
            animParts.haloRing = iceHalo;
          } else {
            const sovereignHalo = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.030, 8, 28), trimMat);
            sovereignHalo.rotation.x = Math.PI / 2;
            haloGroup.add(sovereignHalo);
          }
          skinGroup.add(haloGroup);
        }
      }

      pieceObj.mesh.add(skinGroup);
      pieceObj.skinModelGroup = skinGroup;
      pieceObj.skinAnimParts = animParts;
    }

    function syncAllBoardPieceSkinModels(skinId) {
      if (!boardState || !Array.isArray(boardState)) return;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r]?.[c];
          if (p && p.mesh) {
            attachCustomSkin3DModelToPiece(p, skinId);
          }
        }
      }
    }

    function applyChessSkinMaterials3D(skinId, showCelebration = false) {
      const skin =
        CHESS_SKIN_CATALOG.find((s) => s.id === skinId) || CHESS_SKIN_CATALOG[0];
      if (!skin || !skin.materials) return skin;

      activeRenderedSkinId = skin.id;
      const m = skin.materials;
      if (m.white) {
        whitePieceMat.color.setHex(m.white.color);
        whitePieceMat.roughness = m.white.roughness;
        whitePieceMat.metalness = m.white.metalness;
        whitePieceMat.emissive.setHex(m.white.emissive || 0x000000);
        whitePieceMat.emissiveIntensity = m.white.emissiveIntensity || 0;
        whitePieceMat.needsUpdate = true;
      }
      if (m.black) {
        blackPieceMat.color.setHex(m.black.color);
        blackPieceMat.roughness = m.black.roughness;
        blackPieceMat.metalness = m.black.metalness;
        blackPieceMat.emissive.setHex(m.black.emissive || 0x000000);
        blackPieceMat.emissiveIntensity = m.black.emissiveIntensity || 0;
        blackPieceMat.needsUpdate = true;
      }
      if (m.trim) {
        goldTrimMat.color.setHex(m.trim.color);
        goldTrimMat.roughness = m.trim.roughness;
        goldTrimMat.metalness = m.trim.metalness;
        goldTrimMat.emissive.setHex(m.trim.emissive || 0x000000);
        goldTrimMat.emissiveIntensity = m.trim.emissiveIntensity || 0;
        goldTrimMat.needsUpdate = true;
      }
      if (m.steel) {
        forgedSteelMat.color.setHex(m.steel.color);
        forgedSteelMat.roughness = m.steel.roughness;
        forgedSteelMat.metalness = m.steel.metalness;
        forgedSteelMat.emissive.setHex(m.steel.emissive || 0x000000);
        forgedSteelMat.emissiveIntensity = m.steel.emissiveIntensity || 0;
        forgedSteelMat.needsUpdate = true;
      }
      if (m.boardLight) {
        lightSqMat.color.setHex(m.boardLight.color);
        lightSqMat.roughness = m.boardLight.roughness;
        lightSqMat.metalness = m.boardLight.metalness;
        lightSqMat.needsUpdate = true;
      }
      if (m.boardDark) {
        darkSqMat.color.setHex(m.boardDark.color);
        darkSqMat.roughness = m.boardDark.roughness;
        darkSqMat.metalness = m.boardDark.metalness;
        darkSqMat.needsUpdate = true;
      }

      activeSkinSlashHex = m.slashTrailHex || 0xfde047;
      skinGlowAccentMat.color.setHex(activeSkinSlashHex);
      skinGlowAccentMat.emissive.setHex(activeSkinSlashHex);
      skinGlowAccentMat.emissiveIntensity = 0.95;
      skinGlowAccentMat.needsUpdate = true;

      const crystalCol = m.steel?.color || activeSkinSlashHex;
      skinCrystalTranslucentMat.color.setHex(crystalCol);
      skinCrystalTranslucentMat.emissive.setHex(activeSkinSlashHex);
      skinCrystalTranslucentMat.emissiveIntensity = 0.75;
      skinCrystalTranslucentMat.needsUpdate = true;

      // Rebuild bespoke 3D sculpted skin models across all active pieces on the board!
      syncAllBoardPieceSkinModels(skin.id);
      renderer.shadowMap.needsUpdate = true;

      if (showCelebration) {
        soundFX.playLevelUp();
        const centerPos = new THREE.Vector3(0, BOARD_SURFACE_Y + 0.15, 0);
        spawnCombatShockwave3D(centerPos, activeSkinSlashHex, false, true);
        spawnCombatSparks3D(centerPos, activeSkinSlashHex, 28, 1.15);
        spawnFloatingCombatText(
          centerPos,
          `${skin.icon} MODEL 3D: ${skin.nameVi.toUpperCase()}!`,
          skin.previewSwatches?.trailHex || '#fde047',
          0.95
        );
      }

      return skin;
    }

    // Apply equipped 3D skin on engine initialization
    applyChessSkinMaterials3D(commercialProfile.equippedSkinId, false);

    // =========================================================================
    // Asset Loading (Cathedral GLB + 12 Rigged Piece GLBs)
    // =========================================================================
    const gltfLoader = new GLTFLoader();
    const pieceTemplates = {};
    const activeMixers = [];
    let isAssetsLoaded = false;
    const shatterDebris = [];
    const clock = new THREE.Clock();
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let currentFPS = 60;
    let shadowUpdateFrameCounter = 0;
    let idleMixerFrameCounter = 0;
    let brazierThrottleCounter = 0;

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);
    const squareHighlightsGroup = new THREE.Group();
    scene.add(squareHighlightsGroup);
    const tacticalPingsGroup = new THREE.Group();
    scene.add(tacticalPingsGroup);
    const boardSquareMeshes = [];
    const boardSquareGrid = Array.from({ length: 8 }, () => Array(8).fill(null));

    function buildChessBoardGrid() {
      const tileH = 0.036;
      const sqGeo = new THREE.BoxGeometry(BOARD_SQ_SIZE * 0.985, tileH, BOARD_SQ_SIZE * 0.985);

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const isLight = (r + c) % 2 === 0;
          const sqMesh = new THREE.Mesh(sqGeo, isLight ? lightSqMat : darkSqMat);
          const pos = boardToWorld(r, c);
          sqMesh.position.set(pos.x, BOARD_SURFACE_Y - tileH * 0.5, pos.z);
          sqMesh.receiveShadow = true;
          sqMesh.userData = {
            r,
            c,
            isSquare: true,
            isLight
          };
          boardGroup.add(sqMesh);
          boardSquareMeshes.push(sqMesh);
          boardSquareGrid[r][c] = sqMesh;
        }
      }

      // Sculpted Golden Border Frame around the 8x8 tiles on top of the Obsidian Altar
      const halfB = 4.0 * BOARD_SQ_SIZE;
      const rimW = 0.06;
      const rimH = 0.042;
      const horizGeo = new THREE.BoxGeometry(halfB * 2 + rimW * 2, rimH, rimW);
      const vertGeo = new THREE.BoxGeometry(rimW, rimH, halfB * 2);
      for (const s of [-1, 1]) {
        const hBar = new THREE.Mesh(horizGeo, goldTrimMat);
        hBar.position.set(0, BOARD_SURFACE_Y - rimH * 0.45, s * (halfB + rimW * 0.5));
        hBar.receiveShadow = true;
        boardGroup.add(hBar);

        const vBar = new THREE.Mesh(vertGeo, goldTrimMat);
        vBar.position.set(s * (halfB + rimW * 0.5), BOARD_SURFACE_Y - rimH * 0.45, 0);
        vBar.receiveShadow = true;
        boardGroup.add(vBar);
      }
    }

    buildChessBoardGrid();

    // =========================================================================
    // 3D Consecrated ('Holy Aura') & Corrupted ('Ground Crack') Board Tile Overlays
    // =========================================================================
    const specialTileOverlaysGroup = new THREE.Group();
    scene.add(specialTileOverlaysGroup);

    function createSpecialTileOverlayTexture(tileType) {
      const isConsecrated = tileType === 'CONSECRATED';
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // 1. Deep radial aura / abyssal chasm wash across the square
      const rad = ctx.createRadialGradient(256, 256, 12, 256, 256, 248);
      if (isConsecrated) {
        rad.addColorStop(0, 'rgba(254, 249, 195, 0.58)');
        rad.addColorStop(0.45, 'rgba(250, 204, 21, 0.34)');
        rad.addColorStop(0.78, 'rgba(16, 185, 129, 0.22)');
        rad.addColorStop(1, 'rgba(202, 138, 4, 0.08)');
      } else {
        rad.addColorStop(0, 'rgba(192, 132, 252, 0.54)');
        rad.addColorStop(0.45, 'rgba(126, 34, 206, 0.36)');
        rad.addColorStop(0.78, 'rgba(225, 29, 72, 0.24)');
        rad.addColorStop(1, 'rgba(59, 7, 100, 0.10)');
      }
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.roundRect(14, 14, 484, 484, 30);
      ctx.fill();

      if (isConsecrated) {
        // 2A. HOLY AURA BORDER EFFECT: Luminous golden-emerald double sanctum border + radiant inward light rays
        ctx.save();
        ctx.translate(256, 256);
        const rayCount = 24;
        for (let i = 0; i < rayCount; i++) {
          const angle = (i * Math.PI * 2) / rayCount;
          const innerR = i % 2 === 0 ? 132 : 164;
          const outerR = 232;
          ctx.strokeStyle =
            i % 2 === 0 ? 'rgba(254, 240, 138, 0.52)' : 'rgba(110, 231, 183, 0.38)';
          ctx.lineWidth = i % 2 === 0 ? 4.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
          ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
          ctx.stroke();
        }
        ctx.restore();

        // Outer glowing holy border
        ctx.save();
        ctx.shadowColor = 'rgba(253, 224, 71, 0.95)';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.roundRect(18, 18, 476, 476, 26);
        ctx.stroke();

        // Inner filigreed golden-emerald sanctum frame
        ctx.strokeStyle = 'rgba(110, 231, 183, 0.88)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(34, 34, 444, 444, 18);
        ctx.stroke();
        ctx.restore();

        // Corner seraphic holy crests
        const corners = [
          [30, 30, 1, 1],
          [482, 30, -1, 1],
          [30, 482, 1, -1],
          [482, 482, -1, -1]
        ];
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        for (const [cx, cy, sx, sy] of corners) {
          ctx.beginPath();
          ctx.moveTo(cx, cy + sy * 48);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + sx * 48, cy);
          ctx.stroke();

          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(cx + sx * 14, cy + sy * 14, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // 2B. GROUND CRACK BORDER EFFECT: Jagged branching abyssal fissures & glowing magma-void cracks
        ctx.save();
        ctx.shadowColor = 'rgba(192, 132, 252, 0.95)';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.92)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(18, 18, 476, 476, 24);
        ctx.stroke();
        ctx.restore();

        // Deterministic jagged ground crack network radiating inward from all 4 borders & corners
        const crackChains = [
          // Top-left corner deep fissure
          [
            [22, 22],
            [58, 46],
            [84, 92],
            [128, 118],
            [154, 152]
          ],
          [
            [84, 92],
            [116, 62],
            [148, 74]
          ],
          // Top-right corner deep fissure
          [
            [490, 22],
            [448, 54],
            [416, 96],
            [372, 126],
            [348, 162]
          ],
          [
            [416, 96],
            [446, 132],
            [474, 146]
          ],
          // Bottom-left corner deep fissure
          [
            [22, 490],
            [64, 452],
            [98, 412],
            [138, 384],
            [164, 348]
          ],
          [
            [98, 412],
            [62, 376],
            [38, 358]
          ],
          // Bottom-right corner deep fissure
          [
            [490, 490],
            [446, 458],
            [408, 414],
            [368, 382],
            [342, 346]
          ],
          [
            [408, 414],
            [382, 454],
            [356, 476]
          ],
          // Edge mid-border ground cracks
          [
            [256, 16],
            [242, 54],
            [268, 92],
            [252, 126]
          ],
          [
            [256, 496],
            [270, 458],
            [244, 422],
            [258, 388]
          ],
          [
            [16, 256],
            [56, 242],
            [94, 268],
            [132, 250]
          ],
          [
            [496, 256],
            [454, 270],
            [418, 244],
            [382, 260]
          ]
        ];

        // Pass 1: Dark abyssal stone chasm outer trench
        ctx.lineCap = 'round';
        ctx.lineJoin = 'bevel';
        for (const chain of crackChains) {
          ctx.strokeStyle = 'rgba(15, 7, 28, 0.95)';
          ctx.lineWidth = 11;
          ctx.beginPath();
          chain.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.stroke();
        }
        // Pass 2: Glowing violet-crimson eldritch magma vein inside the cracks
        ctx.save();
        ctx.shadowColor = '#e879f9';
        ctx.shadowBlur = 14;
        for (let i = 0; i < crackChains.length; i++) {
          const chain = crackChains[i];
          ctx.strokeStyle = i % 2 === 0 ? '#e879f9' : '#fb7185';
          ctx.lineWidth = 5.2;
          ctx.beginPath();
          chain.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.stroke();

          ctx.strokeStyle = '#fae8ff';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          chain.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Sacred Sunburst (Consecrated) vs Abyssal Hexagram (Corrupted) sigil in the center
      ctx.save();
      ctx.translate(256, 256);
      ctx.strokeStyle = isConsecrated ? 'rgba(254, 249, 195, 0.86)' : 'rgba(232, 121, 249, 0.86)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, 138, 0, Math.PI * 2);
      ctx.stroke();

      const points = isConsecrated ? 8 : 6;
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const a1 = (i * Math.PI * 2) / points;
        const a2 = ((i + 2) * Math.PI * 2) / points;
        ctx.moveTo(Math.cos(a1) * 130, Math.sin(a1) * 130);
        ctx.lineTo(Math.cos(a2) * 130, Math.sin(a2) * 130);
      }
      ctx.stroke();
      ctx.restore();

      // 4. Crisp top & bottom diegetic labels on the 3D tile
      ctx.font = '900 34px Cinzel, Georgia, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(8, 10, 18, 0.94)';
      const topLabel = isConsecrated ? '✦ CONSECRATED' : '☠ CORRUPTED';
      const botLabel = isConsecrated ? '+1⚔  +1🛡' : '-1⚔  -1🛡';
      ctx.strokeText(topLabel, 256, 68);
      ctx.fillStyle = isConsecrated ? '#fef08a' : '#f5d0fe';
      ctx.fillText(topLabel, 256, 68);

      ctx.font = '900 38px monospace';
      ctx.strokeText(botLabel, 256, 446);
      ctx.fillStyle = isConsecrated ? '#4ade80' : '#f87171';
      ctx.fillText(botLabel, 256, 446);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // Animated GLSL ShaderMaterial for 'Holy Aura' (Consecrated) & 'Ground Crack' (Corrupted) Tile Borders
    function createSpecialTileBorderShaderMaterial(tileType, phaseOffset = 0) {
      const isConsecrated = tileType === 'CONSECRATED';
      return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: phaseOffset },
          uHover: { value: 0 },
          uOccupied: { value: 0 },
          uIsConsecrated: { value: isConsecrated ? 1.0 : 0.0 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uPhase;
          uniform float uHover;
          uniform float uOccupied;
          uniform float uIsConsecrated;
          varying vec2 vUv;

          float hash21(vec2 p) {
            p = fract(p * vec2(234.34, 435.345));
            p += dot(p, p + 34.23);
            return fract(p.x * p.y);
          }

          float noise2(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          void main() {
            vec2 centered = vUv * 2.0 - 1.0;
            float boxDist = max(abs(centered.x), abs(centered.y));
            float angle = atan(centered.y, centered.x);
            float t = uTime + uPhase;
            float boost = 1.0 + uOccupied * 0.28 + uHover * 0.45;

            if (uIsConsecrated > 0.5) {
              // HOLY AURA BORDER: Sweeping golden-emerald divine perimeter + shimmering angelic rays
              float outerRim = smoothstep(0.74, 0.94, boxDist) * (1.0 - smoothstep(0.96, 1.0, boxDist));
              float innerHalo = smoothstep(0.56, 0.88, boxDist) * (1.0 - smoothstep(0.88, 0.98, boxDist));
              float rayWave = 0.5 + 0.5 * sin(angle * 12.0 - t * 2.8);
              float counterWave = 0.5 + 0.5 * cos(angle * 8.0 + t * 2.1);
              float cornerGlow = smoothstep(0.62, 0.96, abs(centered.x) * abs(centered.y) * 1.35);

              vec3 goldCore = vec3(1.0, 0.92, 0.45);
              vec3 emeraldGlow = vec3(0.28, 0.96, 0.68);
              vec3 holyCol = mix(goldCore, emeraldGlow, 0.32 * counterWave);
              holyCol = mix(holyCol, vec3(1.0, 0.99, 0.88), outerRim * rayWave * 0.75 + cornerGlow * 0.5);

              float alpha = (outerRim * (0.68 + 0.32 * rayWave) + innerHalo * 0.36 * counterWave + cornerGlow * 0.42) * boost;
              gl_FragColor = vec4(holyCol * (1.25 * boost), clamp(alpha, 0.0, 0.96));
            } else {
              // GROUND CRACK BORDER: Jagged animated tectonic fissures & pulsing void-magma veins
              float borderZone = smoothstep(0.42, 0.95, boxDist) * (1.0 - smoothstep(0.97, 1.0, boxDist));
              vec2 warpUv = centered * 5.2;
              warpUv += 0.35 * vec2(
                noise2(centered * 8.0 + vec2(t * 0.35, -t * 0.25)),
                noise2(centered * 8.0 + vec2(-t * 0.3, t * 0.4))
              );
              float n1 = abs(noise2(warpUv * 2.4) - 0.5) * 2.0;
              float n2 = abs(noise2(warpUv * 4.8 + 3.7) - 0.5) * 2.0;
              // Sharp ridge-noise ground cracks
              float crackLine = 1.0 - smoothstep(0.02, 0.13, n1 * 0.65 + n2 * 0.35);
              float fineCrack = 1.0 - smoothstep(0.01, 0.08, n2);
              float outerFissure = smoothstep(0.80, 0.94, boxDist) * (1.0 - smoothstep(0.96, 1.0, boxDist));

              float pulse = 0.65 + 0.35 * sin(t * 3.8 - boxDist * 7.0 + angle * 3.0);
              vec3 voidViolet = vec3(0.76, 0.38, 1.0);
              vec3 crimsonMagma = vec3(1.0, 0.22, 0.48);
              vec3 crackCore = vec3(1.0, 0.86, 1.0);

              vec3 col = mix(voidViolet, crimsonMagma, 0.5 + 0.5 * sin(angle * 4.0 + t * 2.4));
              col = mix(col, crackCore, crackLine * 0.78);

              float crackAlpha = borderZone * (crackLine * 0.92 + fineCrack * 0.45) * pulse + outerFissure * (0.58 + 0.32 * pulse);
              gl_FragColor = vec4(col * (1.35 * boost), clamp(crackAlpha * boost, 0.0, 0.96));
            }
          }
        `
      });
    }

    const specialTileTextures = {
      CONSECRATED: createSpecialTileOverlayTexture('CONSECRATED'),
      CORRUPTED: createSpecialTileOverlayTexture('CORRUPTED')
    };

    const sharedSpecialTilePlaneGeo = new THREE.PlaneGeometry(
      BOARD_SQ_SIZE * 0.96,
      BOARD_SQ_SIZE * 0.96
    );
    sharedSpecialTilePlaneGeo.rotateX(-Math.PI / 2);

    const sharedSpecialTileBorderGeo = new THREE.PlaneGeometry(
      BOARD_SQ_SIZE * 0.985,
      BOARD_SQ_SIZE * 0.985
    );
    sharedSpecialTileBorderGeo.rotateX(-Math.PI / 2);

    // 3D Low-Profile Rising Aura / Fissure Crown along the 4 edges of the tile
    const sharedTileAuraCrownGeo = new THREE.BoxGeometry(
      BOARD_SQ_SIZE * 0.95,
      0.048,
      BOARD_SQ_SIZE * 0.95
    );
    const sharedTileEdgeWireGeo = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(BOARD_SQ_SIZE * 0.96, 0.012, BOARD_SQ_SIZE * 0.96)
    );

    const sharedConsecratedRingGeo = new THREE.RingGeometry(0.088, 0.122, 8);
    sharedConsecratedRingGeo.rotateX(-Math.PI / 2);

    const sharedCorruptedRingGeo = new THREE.RingGeometry(0.088, 0.122, 6);
    sharedCorruptedRingGeo.rotateX(-Math.PI / 2);

    function buildSpecialTile3DOverlays() {
      for (const item of SPECIAL_BOARD_TILES_LIST) {
        const isConsecrated = item.type === 'CONSECRATED';
        const pos = boardToWorld(item.r, item.c);
        const phaseOffset = (item.r * 3 + item.c * 7) * 0.45;

        const mat = new THREE.MeshBasicMaterial({
          map: specialTileTextures[item.type],
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const decalMesh = new THREE.Mesh(sharedSpecialTilePlaneGeo, mat);
        decalMesh.position.set(pos.x, BOARD_SURFACE_Y + 0.0022, pos.z);
        decalMesh.renderOrder = 4;

        // Animated GLSL 'Holy Aura' or 'Ground Crack' Border Shader Layer
        const borderShaderMat = createSpecialTileBorderShaderMaterial(item.type, phaseOffset);
        const borderAuraMesh = new THREE.Mesh(sharedSpecialTileBorderGeo, borderShaderMat);
        borderAuraMesh.position.set(0, 0.0012, 0);
        borderAuraMesh.renderOrder = 5;
        decalMesh.add(borderAuraMesh);

        // Luminous 3D Perimeter Wireframe Border Rim
        const edgeWireMat = new THREE.LineBasicMaterial({
          color: isConsecrated ? 0xfef08a : 0xe879f9,
          transparent: true,
          opacity: 0.86
        });
        const edgeWireMesh = new THREE.LineSegments(sharedTileEdgeWireGeo, edgeWireMat);
        edgeWireMesh.position.set(0, 0.007, 0);
        decalMesh.add(edgeWireMesh);

        // Subtle 3D Rising Aura / Energy Crown
        const crownMat = new THREE.MeshBasicMaterial({
          color: isConsecrated ? 0xfde047 : 0xa855f7,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending
        });
        const crownMesh = new THREE.Mesh(sharedTileAuraCrownGeo, crownMat);
        crownMesh.position.set(0, 0.024, 0);
        decalMesh.add(crownMesh);

        const ringMat = new THREE.MeshBasicMaterial({
          color: isConsecrated ? 0xfde047 : 0xc084fc,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending
        });
        const ringMesh = new THREE.Mesh(
          isConsecrated ? sharedConsecratedRingGeo : sharedCorruptedRingGeo,
          ringMat
        );
        ringMesh.position.set(0, 0.002, 0);
        decalMesh.add(ringMesh);

        decalMesh.userData = {
          r: item.r,
          c: item.c,
          tileType: item.type,
          ringMesh,
          ringMat,
          borderShaderMat,
          edgeWireMat,
          crownMesh,
          crownMat,
          phaseOffset
        };

        specialTileOverlaysGroup.add(decalMesh);
      }
    }

    buildSpecialTile3DOverlays();

    // =========================================================================
    // Native Baked Wall/Column Stone (Original Ashlar) & Floor Stone (Abbey Flagstone)
    // =========================================================================
    const WALL_STONE_LOOKS = [
      {
        name: 'Original Ashlar',
        fullName: 'Original Ashlar',
        useOriginalBaked: true,
        roughness: 0.78,
        normalScale: 1.18,
        colNormalScale: 1.06
      }
    ];

    const FLOOR_STONE_LOOKS = [
      {
        name: 'Abbey Flagstone',
        fullName: 'Abbey Flagstone',
        useOriginalBaked: true,
        roughness: 0.80,
        metalness: 0.02,
        normalScale: 1.18
      }
    ];

    let currentWallStoneLookIdx = 0;
    let currentFloorStoneLookIdx = 0;
    const cathedralWallMats = [];
    const cathedralColumnMats = [];
    const cathedralFloorMats = [];

    // Precomputed 128x128 tileable micro-chisel grain DataTexture (replaces 32 per-pixel 3D hashes every frame)
    const stoneMicroGrainTex = (() => {
      const size = 128;
      const data = new Uint8Array(size * size * 4);
      const fract = (v) => v - Math.floor(v);
      const hash2 = (x, y, s) => fract(Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453);
      const smoothNoise = (u, v, period, seed) => {
        const gx = u * period;
        const gy = v * period;
        const x0 = Math.floor(gx) % period;
        const y0 = Math.floor(gy) % period;
        const x1 = (x0 + 1) % period;
        const y1 = (y0 + 1) % period;
        const fx = gx - Math.floor(gx);
        const fy = gy - Math.floor(gy);
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const n00 = hash2(x0, y0, seed);
        const n10 = hash2(x1, y0, seed);
        const n01 = hash2(x0, y1, seed);
        const n11 = hash2(x1, y1, seed);
        return (n00 + (n10 - n00) * sx) * (1 - sy) + (n01 + (n11 - n01) * sx) * sy;
      };
      for (let y = 0; y < size; y++) {
        const v = y / size;
        for (let x = 0; x < size; x++) {
          const u = x / size;
          const mG1 = smoothNoise(u, v, 24, 1.7);
          const mG2 = smoothNoise(u, v, 64, 7.3);
          const idx = (y * size + x) * 4;
          data[idx] = Math.max(0, Math.min(255, Math.round(mG1 * 255)));
          data[idx + 1] = Math.max(0, Math.min(255, Math.round(mG2 * 255)));
          data[idx + 2] = Math.max(0, Math.min(255, Math.round((0.5 + (mG1 - mG2) * 0.7) * 255)));
          data[idx + 3] = 255;
        }
      }
      const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      return tex;
    })();

    // =========================================================================
    // Realism Stone Shader Enhancement (inspired by 0beqz/realism-effects HBAO/HBIL
    // & gkjohnson/three-gpu-pathtracer Cavity Micro-Occlusion + Specular Occlusion)
    // =========================================================================
    function applyCathedralStoneRealismShader(mat, isFloor = false) {
      if (!mat || mat.userData.hasRealismStoneShader) return;
      mat.userData.hasRealismStoneShader = true;
      mat.customProgramCacheKey = () => (isFloor ? 'cathedral-floor-realism-v3' : 'cathedral-stone-realism-v3');

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uCavityStrength = { value: isFloor ? 0.58 : 0.72 };
        shader.uniforms.uMicroDetailStrength = { value: isFloor ? 0.14 : 0.18 };
        shader.uniforms.uFireBounceStrength = { value: isFloor ? 0.16 : 0.24 };
        shader.uniforms.uMicroGrainMap = { value: stoneMicroGrainTex };

        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vStoneWorldPos;`
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vStoneWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vStoneWorldPos;
          uniform float uCavityStrength;
          uniform float uMicroDetailStrength;
          uniform float uFireBounceStrength;
          uniform sampler2D uMicroGrainMap;`
        );

        // Extract normal-map slope magnitude for Mortar/Crevice Cavity AO & Specular Micro-Occlusion,
        // plus precomputed tileable micro-chisel grain lookup (zero per-pixel 3D hash loops!).
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `float stoneCavityAO = 1.0;
          #include <normal_fragment_maps>
          #ifdef USE_NORMALMAP_TANGENTSPACE
            vec2 rawNrmXY = texture2D(normalMap, vNormalMapUv).xy * 2.0 - 1.0;
            float slopeSq = dot(rawNrmXY, rawNrmXY);
            stoneCavityAO = clamp(1.0 - slopeSq * uCavityStrength, 0.36, 1.0);
          #endif
          vec2 microUv = (vStoneWorldPos.xz + vStoneWorldPos.xy * 0.618) * 0.85;
          vec3 mgSample = texture2D(uMicroGrainMap, microUv).rgb - 0.5;
          float mG1 = mgSample.r;
          float mG2 = mgSample.g;
          vec3 microPerturb = vec3(mG1, mG2, mgSample.b) * uMicroDetailStrength;
          normal = normalize(normal + microPerturb * 0.22);
          diffuseColor.rgb *= mix(0.92, 1.07, clamp(0.5 + (mG1 * 0.65 + mG2 * 0.35), 0.0, 1.0));
          diffuseColor.rgb *= mix(1.0, stoneCavityAO, 0.68);
          roughnessFactor = clamp(roughnessFactor + (1.0 - stoneCavityAO) * 0.34 - mG1 * 0.06, 0.14, 0.99);`
        );

        // Add Horizon-Based Indirect Bounce (HBIL) from the twin fire cauldrons & upper lancet windows,
        // and apply Specular Micro-Occlusion in mortar crevices so grooves never have plastic shine.
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          reflectedLight.directDiffuse *= mix(1.0, stoneCavityAO, 0.45);
          reflectedLight.indirectDiffuse *= stoneCavityAO;
          reflectedLight.directSpecular *= stoneCavityAO * stoneCavityAO;
          reflectedLight.indirectSpecular *= stoneCavityAO * stoneCavityAO;

          // Physical multi-bounce warm firelight GI from the twin atrium braziers & flanking columns
          vec3 toBrazierL = vec3(-3.65, 1.35, 0.0) - vStoneWorldPos;
          vec3 toBrazierR = vec3(3.65, 1.35, 0.0) - vStoneWorldPos;
          float distSqL = dot(toBrazierL, toBrazierL) + 2.6;
          float distSqR = dot(toBrazierR, toBrazierR) + 2.6;
          vec3 wNormal = inverseTransformDirection(normal, viewMatrix);
          float bounceL = max(0.0, dot(wNormal, normalize(toBrazierL)) * 0.65 + 0.35) / distSqL;
          float bounceR = max(0.0, dot(wNormal, normalize(toBrazierR)) * 0.65 + 0.35) / distSqR;
          vec3 fireBounceGI = vec3(1.0, 0.54, 0.20) * (bounceL + bounceR) * 5.2 * uFireBounceStrength * stoneCavityAO;

          // Analytic raking window-sill & end-wall grazing light (replaces 14 static PointLights at zero BRDF cost)
          vec3 toSideWin = vec3(sign(vStoneWorldPos.x) * 6.8, 3.8, vStoneWorldPos.z) - vStoneWorldPos;
          float sideWinDistSq = dot(toSideWin, toSideWin) + 3.2;
          float sideWinGraze = max(0.0, dot(wNormal, normalize(toSideWin)) * 0.75 + 0.25) / sideWinDistSq;
          vec3 windowGrazeGI = vec3(0.84, 0.89, 0.96) * sideWinGraze * 0.95 * stoneCavityAO;
          reflectedLight.indirectDiffuse += (fireBounceGI + windowGrazeGI) * diffuseColor.rgb;`
        );
      };
      mat.needsUpdate = true;
    }

    function setWallStoneLook() {
      currentWallStoneLookIdx = 0;
      const cfg = WALL_STONE_LOOKS[0];

      for (const mat of cathedralWallMats) {
        mat.map = mat.userData.origMap || mat.map;
        mat.normalMap = mat.userData.origNormalMap || mat.normalMap;
        mat.roughnessMap = mat.userData.origRoughnessMap || mat.roughnessMap;
        mat.emissiveMap = mat.userData.origEmissiveMap || null;
        mat.emissiveIntensity = 0.08;
        mat.roughness = cfg.roughness;
        mat.metalness = 0.02;
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.45;
        if (mat.color) mat.color.setRGB(1, 1, 1);
        if (mat.normalScale) mat.normalScale.set(cfg.normalScale, cfg.normalScale);
        mat.needsUpdate = true;
      }

      for (const mat of cathedralColumnMats) {
        mat.map = mat.userData.origMap || mat.map;
        mat.normalMap = mat.userData.origNormalMap || mat.normalMap;
        mat.roughnessMap = mat.userData.origRoughnessMap || mat.roughnessMap;
        mat.emissiveMap = mat.userData.origEmissiveMap || null;
        mat.emissiveIntensity = 0.08;
        mat.roughness = cfg.roughness;
        mat.metalness = 0.02;
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.48;
        if (mat.color) mat.color.setRGB(1, 1, 1);
        if (mat.normalScale) mat.normalScale.set(cfg.colNormalScale, cfg.colNormalScale);
        mat.needsUpdate = true;
      }

      return { index: 0, name: cfg.name, fullName: cfg.fullName };
    }

    function setFloorStoneLook() {
      currentFloorStoneLookIdx = 0;
      const cfg = FLOOR_STONE_LOOKS[0];

      for (const mat of cathedralFloorMats) {
        mat.map = mat.userData.origMap || mat.map;
        mat.normalMap = mat.userData.origNormalMap || mat.normalMap;
        mat.roughnessMap = mat.userData.origRoughnessMap || mat.roughnessMap;
        mat.emissiveMap = mat.userData.origEmissiveMap || null;
        mat.emissiveIntensity = 0.06;
        mat.roughness = cfg.roughness;
        mat.metalness = cfg.metalness;
        if (mat.color) mat.color.setRGB(1, 1, 1);
        if ('envMapIntensity' in mat) mat.envMapIntensity = 0.36;
        if (mat.normalScale) mat.normalScale.set(cfg.normalScale, cfg.normalScale);
        mat.needsUpdate = true;
      }

      return { index: 0, name: cfg.name, fullName: cfg.fullName };
    }

    function nextWallStoneLook() {
      return setWallStoneLook(0);
    }
    function prevWallStoneLook() {
      return setWallStoneLook(0);
    }
    function nextFloorStoneLook() {
      return setFloorStoneLook(0);
    }
    function prevFloorStoneLook() {
      return setFloorStoneLook(0);
    }

    async function loadAllAssets() {
      const loaderBar = document.getElementById('loader-bar');
      const loaderText = document.getElementById('loader-text');
      const totalItems = PIECE_TYPES.length + 1;

      async function loadGltfModel(baseName) {
        let arrayBuffer = null;
        try {
          const resB64 = await fetch(`./assets/glb/${baseName}.glb.gz.b64`);
          if (resB64.ok) {
            const b64Text = (await resB64.text()).trim();
            if (b64Text.length > 64) {
              const binStr = atob(b64Text);
              const gzBytes = new Uint8Array(binStr.length);
              for (let i = 0; i < binStr.length; i++) {
                gzBytes[i] = binStr.charCodeAt(i);
              }
              const ds = new DecompressionStream('gzip');
              const stream = new Blob([gzBytes]).stream().pipeThrough(ds);
              arrayBuffer = await new Response(stream).arrayBuffer();
            }
          }
        } catch (e) {}

        if (!arrayBuffer) {
          const resGlb = await fetch(`./assets/glb/${baseName}.glb`);
          if (!resGlb.ok) throw new Error(`Failed to fetch ${baseName}`);
          arrayBuffer = await resGlb.arrayBuffer();
        }

        return new Promise((resolve, reject) => {
          gltfLoader.parse(arrayBuffer, './assets/glb/', (gltf) => resolve(gltf), (err) => reject(err));
        });
      }
      let loadedCount = 0;

      function bumpProgress(label) {
        loadedCount++;
        const pct = Math.min(100, Math.round((loadedCount / totalItems) * 100));
        if (loaderBar) loaderBar.style.width = `${pct}%`;
        if (loaderText) loaderText.textContent = label;
      }

      // Instantiate custom GLSL shaders for the 3 sculpted brazier flame layers & charred ember logs
      const flameCoreShader = createSculptedFlameTongueShader({
        baseColor: [1.0, 0.96, 0.72],
        midColor: [1.0, 0.64, 0.12],
        tipColor: [1.0, 0.36, 0.03],
        strength: 1.85,
        opacity: 0.92,
        zMin: 0.60,
        zMax: 1.64,
        layerSeed: 0.0
      });
      const flameMidShader = createSculptedFlameTongueShader({
        baseColor: [1.0, 0.78, 0.25],
        midColor: [1.0, 0.40, 0.04],
        tipColor: [0.92, 0.16, 0.01],
        strength: 1.35,
        opacity: 0.82,
        zMin: 0.60,
        zMax: 1.52,
        layerSeed: 2.1
      });
      const flameOuterShader = createSculptedFlameTongueShader({
        baseColor: [1.0, 0.45, 0.06],
        midColor: [0.88, 0.18, 0.015],
        tipColor: [0.45, 0.03, 0.002],
        strength: 0.95,
        opacity: 0.68,
        zMin: 0.60,
        zMax: 1.36,
        layerSeed: 4.4
      });
      const charredEmberLogsShader = createCharredEmberLogsShader();

      // 1. Load Native Full-Height Cathedral Environment (shifted by z = -0.65 so the Obsidian Altar is centered at 0, 0.7215, 0)
      const maxAniso = renderer.capabilities.getMaxAnisotropy() || 8;
      await new Promise((resolve) => {
        loadGltfModel('option8_cathedral').then(
          (gltf) => {
            const cathedralRoot = gltf.scene;
            cathedralRoot.position.set(0, 0, -0.65);

            cathedralRoot.traverse((child) => {
              if (!child.isMesh) return;
              child.receiveShadow = true;
              const meshName = child.name || '';
              const mNameFirst = (Array.isArray(child.material) ? child.material[0]?.name : child.material?.name) || '';

              if (meshName.includes('Brazier_Flame_Core') || mNameFirst.includes('Flame_Core')) {
                child.material = flameCoreShader;
                child.castShadow = false;
                child.receiveShadow = false;
                child.renderOrder = 12;
                return;
              }
              if (meshName.includes('Brazier_Flame_Mid') || mNameFirst.includes('Flame_Mid')) {
                stripIcosphereSparksFromFlameGeometry(child.geometry);
                child.material = flameMidShader;
                child.castShadow = false;
                child.receiveShadow = false;
                child.renderOrder = 11;
                return;
              }
              if (meshName.includes('Brazier_Flame_Outer') || mNameFirst.includes('Flame_Outer')) {
                child.material = flameOuterShader;
                child.castShadow = false;
                child.receiveShadow = false;
                child.renderOrder = 10;
                return;
              }
              if (meshName.includes('Embers_Logs') || mNameFirst.includes('Ember')) {
                child.material = charredEmberLogsShader;
                child.castShadow = false;
                child.receiveShadow = false;
                return;
              }

              // Only the central Obsidian Altar casts real-time directional shadows;
              // cathedral columns/walls/ceiling and twin braziers use baked 3D Chiaroscuro & BVH ray-traced AO
              // so they never project clipped or directional shadows across the floor.
              const isShadowCasterProp =
                meshName.includes('Obsidian_Altar') ||
                meshName.includes('Altar_Golden_Runes');

              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of mats) {
                if (!mat) continue;
                const mName = mat.name || '';
                const isAmberGlass =
                  mName.includes('Amber') ||
                  mName.includes('Narthex_Amber') ||
                  meshName.includes('Narthex_Amber');
                const isGlass =
                  isAmberGlass ||
                  mName.includes('Glass') ||
                  mName.includes('Lancet') ||
                  mName.includes('Rose') ||
                  meshName.includes('Glass') ||
                  meshName.includes('Window');
                const isRay = mName.includes('GodRay') || meshName.includes('GodRay');

                for (const texKey of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
                  if (mat[texKey]) {
                    mat[texKey].anisotropy = maxAniso;
                    mat[texKey].needsUpdate = true;
                  }
                }

                // Preserve native 1024x1024 GLB-baked textures before any look switching
                if (!mat.userData.origCaptured) {
                  mat.userData.origCaptured = true;
                  mat.userData.origMap = mat.map || null;
                  mat.userData.origNormalMap = mat.normalMap || null;
                  mat.userData.origRoughnessMap = mat.roughnessMap || null;
                  mat.userData.origEmissiveMap = mat.emissiveMap || null;
                }

                if (mat.normalMap && mat.normalScale) {
                  const isDoorMat = mName.includes('Oak') || mName.includes('Door') || meshName.includes('Door');
                  const nScale = isDoorMat ? 1.05 : 1.15;
                  mat.normalScale.set(nScale, nScale);
                }

                if (isAmberGlass) {
                  mat.vertexColors = false;
                  mat.color = new THREE.Color(0xffe6b8);
                  mat.emissive = new THREE.Color(0xffa033);
                  mat.emissiveIntensity = 2.45;
                  mat.roughness = 0.15;
                  mat.metalness = 0.0;
                  mat.side = THREE.DoubleSide;
                  child.castShadow = false;
                } else if (isGlass) {
                  mat.vertexColors = false;
                  mat.color = new THREE.Color(0xdbeeff);
                  mat.emissive = new THREE.Color(0x68a8ff);
                  mat.emissiveIntensity = 2.65;
                  mat.roughness = 0.15;
                  mat.metalness = 0.0;
                  mat.side = THREE.DoubleSide;
                  child.castShadow = false;
                } else if (isRay) {
                  child.visible = false;
                  child.castShadow = false;
                  child.receiveShadow = false;
                } else {
                  if (mat.map) {
                    mat.vertexColors = true;
                  }
                  child.castShadow = isShadowCasterProp;

                  // Register Wall, Column/Arch/Plinth, and Floor stone materials for live 6-look switching & Realism Shader
                  if (mName.includes('Floor') || mName.includes('Flagstone') || meshName.includes('Floor')) {
                    applyCathedralStoneRealismShader(mat, true);
                    if (!cathedralFloorMats.includes(mat)) cathedralFloorMats.push(mat);
                  } else if (
                    mName.includes('Column_Stone') ||
                    mName.includes('Tracery') ||
                    meshName.includes('Plinth') ||
                    meshName.includes('Tracery')
                  ) {
                    applyCathedralStoneRealismShader(mat, false);
                    if (!cathedralColumnMats.includes(mat)) cathedralColumnMats.push(mat);
                  } else if (
                    mName.includes('Gothic_Ashlar') ||
                    mName.includes('Ashlar') ||
                    mName.includes('Vault') ||
                    meshName.includes('Cathedral_Stone')
                  ) {
                    applyCathedralStoneRealismShader(mat, false);
                    if (!cathedralWallMats.includes(mat)) cathedralWallMats.push(mat);
                  }
                }
                mat.needsUpdate = true;
              }
            });

            // Initialize default Look 1/6 (Original Ashlar & Abbey Flagstone) on Wall/Column Stone and Floor Stone
            setWallStoneLook(0);
            setFloorStoneLook(0);
            scene.add(cathedralRoot);

            bumpProgress('Cathedral Architecture Loaded...');
            resolve();
          },
          (err) => {
            console.warn('Cathedral GLB load warning:', err);
            bumpProgress('Cathedral Loaded');
            resolve();
          }
        );
      });

      // 2. Load 6 Sculpted & Rigged Chess Piece Models (shared between White & Black with PBR materials)
      for (const type of PIECE_TYPES) {
        await new Promise((resolve) => {
          loadGltfModel(`${type}_white`).then(
            (gltf) => {
              const toRemove = [];
              gltf.scene.traverse((child) => {
                const nm = child.name || '';
                if (nm.includes('Icosphere') || nm.includes('glTF_not_exported')) {
                  child.visible = false;
                  toRemove.push(child);
                }
              });
              for (const rem of toRemove) {
                if (rem.parent) rem.parent.remove(rem);
              }

              const tpl = {
                scene: gltf.scene,
                animations: gltf.animations || []
              };
              pieceTemplates[`${type}_w`] = tpl;
              pieceTemplates[`${type}_b`] = tpl;
              bumpProgress(`Summoned ${type.toUpperCase()} Statue...`);
              resolve();
            },
            (err) => {
              console.warn(`Piece load warning (${type}):`, err);
              bumpProgress(`Loaded ${type}`);
              resolve();
            }
          );
        });
      }

      isAssetsLoaded = true;
      document.getElementById('loading-overlay')?.classList.add('hidden');
      emitPokerChessSync();
    }

    // =========================================================================
    // Chess Game State, Complete Move Rules, and AI Engine
    // =========================================================================
    boardState = Array.from({ length: 8 }, () => Array(8).fill(null));
    let currentTurn = 'w';
    let selectedSquare = null;
    let hoveredSquare = null;
    let validMoves = [];
    let isAnimatingMove = false;
    let moveAnimationStartTime = 0;
    let gameOver = false;
    let capturedByWhite = 0;
    let capturedByBlack = 0;
    let turnNumber = 1;
    const TURN_TIME_LIMIT = 60;
    let turnTimeRemaining = TURN_TIME_LIMIT;
    let lastSyncedTurnSecond = TURN_TIME_LIMIT;
    let lastTimeoutNotice = null;

    function resetTurnTimer() {
      turnTimeRemaining = TURN_TIME_LIMIT;
      lastSyncedTurnSecond = TURN_TIME_LIMIT;
      soundFX.stopLowTimeTickingLoop(true);
    }

    // Hearthstone-Style 4-Step Turn Phase ('DRAW_PHASE' | 'SELECT_CARDS' | 'EMPOWER_UNIT' | 'ULTIMATE_TARGETING' | 'MOVE_OR_COMBAT')
    let turnPhase = 'DRAW_PHASE';
    let pokerDecks = {
      w: createPlayerPokerState(),
      b: createPlayerPokerState()
    };
    let pendingComboEval = null;
    let lastEmpoweredSquare = null;
    let ultimateTargetSquares = []; // [{ r, c }] up to 8 enemy units for Tứ Quý (Thiên Phạt)
    let tacticalPingMode = false;
    let selectedPingIntent = 'AUTO';
    const activeTacticalPings = []; // Active 3D tactical tile ping markers [{ id, r, c, algebraic, intent, label, icon, colorHex, threeHex, group, life, maxLife, createdAt }]
    let combatLogFeed = []; // Recent tactical events
    const floatingTexts3D = []; // 3D rising combat numbers & callouts
    const lightningBeams3D = []; // 3D Ultimate divine judgment beams
    const combatShockwaves3D = []; // 3D expanding concentric combat shockwave rings
    const slashArcs3D = []; // 3D glowing crescent weapon slash waves
    const combatSparks3D = []; // 3D high-velocity molten combat sparks & embers
    const defendShields3D = []; // 3D hemispherical Aegis Shield Domes & Guard Rings for Melee Defend
    const activeUnitCombatAnims3D = []; // 3D standalone Melee Attack lunge & Melee Defend brace/recoil animations
    let activeCombatBanner = null; // Live HUD clash banner during melee combat
    let lastAggressorInfo = null; // Tracks last attacking piece so defending pieces prioritize retaliation

    function addCombatLog(text, type = 'info') {
      combatLogFeed.unshift({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text,
        type,
        turn: turnNumber
      });
      if (combatLogFeed.length > 8) combatLogFeed.length = 8;
    }

    function awardKillGoldBounty(killedPieceType, killerColor, worldPos) {
      // Only award Gold when the human player kills an enemy unit
      if (killerColor !== playerColor) return 0;
      const goldTable = {
        pawn: 25,
        knight: 40,
        bishop: 40,
        rook: 55,
        queen: 75,
        king: 150
      };
      const earnedGold = goldTable[killedPieceType] || 30;
      commercialProfile.gold = Math.max(0, (commercialProfile.gold || 0) + earnedGold);
      commercialProfile.totalKills = (commercialProfile.totalKills || 0) + 1;
      saveCommercialProfile(commercialProfile);
      if (worldPos) {
        spawnFloatingCombatText(
          new THREE.Vector3(worldPos.x, worldPos.y + 0.34, worldPos.z),
          `+${earnedGold} 🪙 VÀNG`,
          '#fde047',
          0.82
        );
      }
      return earnedGold;
    }

    function recordRankedMatchOutcome(winnerSide) {
      const isPlayerWin = winnerSide === playerColor;
      const prevElo = commercialProfile.elo || 1000;
      const rankBefore = getEloRankInfo(prevElo);
      let eloDelta = 0;
      let goldReward = 0;

      if (isPlayerWin) {
        commercialProfile.wins = (commercialProfile.wins || 0) + 1;
        commercialProfile.winStreak = (commercialProfile.winStreak || 0) + 1;
        const streakBonus = Math.min(20, (commercialProfile.winStreak - 1) * 5);
        eloDelta = 36 + streakBonus;
        goldReward = (rankBefore.winBonusGold || 200) + streakBonus * 3;
      } else {
        commercialProfile.losses = (commercialProfile.losses || 0) + 1;
        commercialProfile.winStreak = 0;
        eloDelta = -16;
        goldReward = 40; // Participation match completion gold
      }

      const nextElo = Math.max(800, prevElo + eloDelta);
      commercialProfile.elo = nextElo;
      commercialProfile.peakElo = Math.max(commercialProfile.peakElo || nextElo, nextElo);
      commercialProfile.gold = Math.max(0, (commercialProfile.gold || 0) + goldReward);

      const rankAfter = getEloRankInfo(nextElo);
      const matchRecord = {
        id: `m_${Date.now()}`,
        won: isPlayerWin,
        eloBefore: prevElo,
        eloAfter: nextElo,
        eloDelta,
        goldReward,
        tierNameVi: rankAfter.tierNameVi,
        tierIcon: rankAfter.tierIcon,
        turnCount: turnNumber,
        timestamp: Date.now()
      };
      commercialProfile.lastMatchDelta = matchRecord;
      commercialProfile.matchHistory = [
        matchRecord,
        ...(commercialProfile.matchHistory || []).slice(0, 7)
      ];
      saveCommercialProfile(commercialProfile);
      return matchRecord;
    }

    function buyAndEquipChessSkin(skinId) {
      const skin = CHESS_SKIN_CATALOG.find((s) => s.id === skinId);
      if (!skin) return { ok: false, reason: 'NOT_FOUND', message: 'Không tìm thấy bộ Skin này.' };

      const isOwned = (commercialProfile.ownedSkinIds || []).includes(skin.id);
      if (isOwned) {
        commercialProfile.equippedSkinId = skin.id;
        commercialProfile.previewSkinId = null;
        saveCommercialProfile(commercialProfile);
        applyChessSkinMaterials3D(skin.id, true);
        addCombatLog(
          `${skin.icon} Đã trang bị bộ Skin 3D "${skin.nameVi}" (Chỉ trang trí — Không cộng chỉ số)!`,
          'gold'
        );
        emitPokerChessSync();
        return { ok: true, action: 'EQUIPPED', skin };
      }

      const highestElo = Math.max(commercialProfile.elo || 1050, commercialProfile.peakElo || 1050);
      if (highestElo < skin.requiredElo) {
        soundFX.playClashImpact(false, false);
        return {
          ok: false,
          reason: 'ELO_LOCKED',
          message: `Cần đạt mốc ${skin.requiredElo} Elo (${skin.requiredRankName}) để mở khóa bộ Skin "${skin.nameVi}"! (Elo cao nhất của bạn: ${highestElo})`
        };
      }

      if ((commercialProfile.gold || 0) < skin.goldCost) {
        soundFX.playClashImpact(false, false);
        return {
          ok: false,
          reason: 'NOT_ENOUGH_GOLD',
          message: `Cần ${skin.goldCost.toLocaleString()} Vàng để sở hữu "${skin.nameVi}" (Hiện có: ${(commercialProfile.gold || 0).toLocaleString()} Vàng).`
        };
      }

      commercialProfile.gold -= skin.goldCost;
      if (!commercialProfile.ownedSkinIds.includes(skin.id)) {
        commercialProfile.ownedSkinIds.push(skin.id);
      }
      commercialProfile.equippedSkinId = skin.id;
      commercialProfile.previewSkinId = null;
      saveCommercialProfile(commercialProfile);
      applyChessSkinMaterials3D(skin.id, true);
      addCombatLog(
        `🎉 Đã mở khóa & trang bị bộ Skin "${skin.nameVi}" (-${skin.goldCost} 🪙 Vàng)!`,
        'gold'
      );
      emitPokerChessSync();
      return { ok: true, action: 'PURCHASED_AND_EQUIPPED', skin };
    }

    function equipChessSkin(skinId) {
      return buyAndEquipChessSkin(skinId);
    }

    function previewChessSkin3D(skinId) {
      if (!skinId || skinId === commercialProfile.equippedSkinId) {
        commercialProfile.previewSkinId = null;
        applyChessSkinMaterials3D(commercialProfile.equippedSkinId, false);
        emitPokerChessSync();
        return { ok: true, previewSkinId: null };
      }
      const skin = CHESS_SKIN_CATALOG.find((s) => s.id === skinId);
      if (!skin) return { ok: false };
      commercialProfile.previewSkinId = skin.id;
      applyChessSkinMaterials3D(skin.id, true);
      emitPokerChessSync();
      return { ok: true, previewSkinId: skin.id, skin };
    }

    function claimRankedBountyOrSimulateMatch() {
      // Production Fair-Play Lock: Free Elo & Gold simulation buttons are disabled so players grind through real matches
      return {
        ok: false,
        message: 'Hệ thống cộng nhanh đã đóng để đảm bảo công bằng — Hãy trực tiếp thi đấu để tích lũy Elo và Vàng!'
      };
    }

    // Mode & Player Configuration
    let gameMode = 'single'; // 'single' | 'multi'
    let playerColor = 'w';   // 'w' | 'b' | 'spectator'
    let aiAutoPlay = true;
    let autoMoveEnabled = false;
    let aiTimer = null;

    // Multiplayer State
    let roomCode = null;
    let playerToken = localStorage.getItem('wizard_chess_token') || '';
    let roomEventSource = null;
    let roomPollTimer = null;
    let appliedMoveSeq = 0;
    let appliedResetCount = 0;

    // Camera Animation & Telemetry State
    const cameraTelemetry = {
      lastAttackSamples: [],
      attackCount: 0,
      maxStepDelta: 0,
      columnDeflections: 0,
      minColumnClearance: Infinity,
      lastColumnClearance: Infinity,
      hapticTriggerCount: 0,
      lastHapticVibration: null
    };
    window.__wizardChessTelemetry = cameraTelemetry;

    function triggerCombatHapticFeedback(options = {}) {
      const payload = triggerMeleeHapticVibration(options);
      cameraTelemetry.hapticTriggerCount = (cameraTelemetry.hapticTriggerCount || 0) + 1;
      cameraTelemetry.lastHapticVibration = payload;
      return payload;
    }

    let activeCamTransition = null; // { startPos, endPos, startTarget, endTarget, elapsed, duration }

    function flushOrbitControlsDamping() {
      const wasDamping = orbitControls.enableDamping;
      orbitControls.enableDamping = false;
      orbitControls.update();
      enforceCathedralBoundsAndSolidColumns(null, camera.position, orbitControls.target);
      camera.lookAt(orbitControls.target);
      orbitControls.enableDamping = wasDamping;
    }

    function smoothCameraTo(targetPos, targetLookAt, duration = 0.75) {
      flushOrbitControlsDamping();
      const clampedPos = targetPos.clone();
      const clampedLook = targetLookAt.clone();
      enforceCathedralBoundsAndSolidColumns(clampedPos, clampedPos, clampedLook);
      activeCamTransition = {
        startPos: camera.position.clone(),
        endPos: clampedPos,
        startTarget: orbitControls.target.clone(),
        endTarget: clampedLook,
        elapsed: 0,
        duration: Math.max(0.05, duration)
      };
    }

    function setCameraForSide(color, immediate = false) {
      const zSign = color === 'b' ? -1 : 1;
      const desiredPos = new THREE.Vector3(0, 2.22, zSign * 2.72);
      const desiredTarget = new THREE.Vector3(0, 0.85, zSign * -0.15);
      if (immediate) {
        activeCamTransition = null;
        camera.position.copy(desiredPos);
        orbitControls.target.copy(desiredTarget);
        flushOrbitControlsDamping();
      } else {
        smoothCameraTo(desiredPos, desiredTarget, 0.8);
      }
    }

    // =========================================================================
    // 3D Diegetic Unit RPG Badge & Active Combo Seal Ring
    // =========================================================================
    function createUnit3DBadgeAndRing(pieceObj) {
      // 1. Base Aura Ring for Active Poker Seal
      const ringGeo = new THREE.RingGeometry(0.118, 0.148, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf5d76e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(0, 0.025, 0);
      pieceObj.mesh.add(ringMesh);
      pieceObj.sealRingMesh = ringMesh;

      // 2. Overhead Canvas Sprite for HP Bar, Armor, Level & Active Buff
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 96;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const spMat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(spMat);
      const hMap = { pawn: 1.18, rook: 1.46, knight: 1.56, bishop: 1.60, queen: 1.72, king: 1.85 };
      sprite.position.set(0, hMap[pieceObj.type] || 1.45, 0);
      sprite.scale.set(0.82, 0.31, 1);
      sprite.renderOrder = 15;
      pieceObj.mesh.add(sprite);
      pieceObj.badgeCanvas = canvas;
      pieceObj.badgeTex = tex;
      pieceObj.badgeSprite = sprite;
      updateUnit3DBadge(pieceObj);
    }

    function updateUnit3DBadge(pieceObj) {
      if (!pieceObj || !pieceObj.badgeCanvas) return;

      const shownHpFloat =
        typeof pieceObj.displayHp === 'number'
          ? Math.max(0, Math.min(pieceObj.maxHp || 1, pieceObj.displayHp))
          : Math.max(0, pieceObj.hp);
      const shownHpInt = Math.max(
        0,
        shownHpFloat > 0 ? Math.ceil(shownHpFloat - 0.04) : 0
      );
      const trailHpFloat =
        typeof pieceObj.trailHp === 'number'
          ? Math.max(shownHpFloat, Math.min(pieceObj.maxHp || 1, pieceObj.trailHp))
          : shownHpFloat;

      const isDamaged = shownHpFloat < pieceObj.maxHp - 0.05;
      const hasArmor = (pieceObj.armor || 0) > 0;
      const hasCombo = Boolean(pieceObj.activeCombo);
      const isLeveled = (pieceObj.level || 1) > 1;
      const isKing = pieceObj.type === 'king';
      const isMajorPiece = pieceObj.type !== 'pawn';
      const isSelectedOrHovered =
        (selectedSquare && selectedSquare.r === pieceObj.r && selectedSquare.c === pieceObj.c) ||
        (hoveredSquare && hoveredSquare.r === pieceObj.r && hoveredSquare.c === pieceObj.c);

      // Update base seal ring
      if (pieceObj.sealRingMesh) {
        if (hasCombo) {
          pieceObj.sealRingMesh.material.color.setHex(pieceObj.activeCombo.ringColor || 0xf5d76e);
          pieceObj.sealRingMesh.material.opacity = 0.92;
          pieceObj.sealRingMesh.visible = true;
        } else if (isKing) {
          pieceObj.sealRingMesh.material.color.setHex(pieceObj.color === 'w' ? 0xf5d76e : 0xe63946);
          pieceObj.sealRingMesh.material.opacity = 0.42;
          pieceObj.sealRingMesh.visible = true;
        } else {
          pieceObj.sealRingMesh.material.opacity = 0.0;
          pieceObj.sealRingMesh.visible = false;
        }
      }

      const tileMod = getBoardTileModifier(pieceObj.r, pieceObj.c);
      const tileAtkMod = tileMod ? tileMod.atkMod : 0;
      const tileArmorMod = tileMod ? tileMod.armorMod : 0;
      const effArmor = Math.max(0, (pieceObj.armor || 0) + tileArmorMod);
      const hasEffectiveArmor = effArmor > 0;

      // Show Hearthstone Attack/Health badge on all active/damaged/buffed/major/tile-modified units (and all units when hovered/selected)
      const shouldShowBadge =
        isDamaged || hasEffectiveArmor || hasCombo || isLeveled || isKing || isMajorPiece || Boolean(tileMod) || Boolean(isSelectedOrHovered);
      if (pieceObj.badgeSprite) {
        pieceObj.badgeSprite.visible = shouldShowBadge;
        pieceObj.badgeSprite.material.opacity =
          isSelectedOrHovered || hasCombo || isDamaged || isKing || Boolean(tileMod) ? 1.0 : 0.9;
      }

      const effAtk = Math.max(1, pieceObj.baseAtk + (pieceObj.activeCombo?.atkBonus || 0) + tileAtkMod);
      const isAtkBuffed = effAtk > pieceObj.baseAtk;
      const isAtkDebuffed = effAtk < pieceObj.baseAtk;
      const badgeSig = `hs|${pieceObj.level || 1}|${effAtk}|${shownHpFloat.toFixed(1)}|${trailHpFloat.toFixed(1)}|${pieceObj.maxHp}|${effArmor}|${tileMod?.id || ''}|${pieceObj.activeCombo?.id || pieceObj.activeCombo?.name || ''}|${isSelectedOrHovered ? 1 : 0}`;
      if (pieceObj._lastBadgeSig === badgeSig) {
        return;
      }
      pieceObj._lastBadgeSig = badgeSig;

      const ctx = pieceObj.badgeCanvas.getContext('2d');
      ctx.clearRect(0, 0, 256, 96);
      ctx.save();

      // 1. Center Tavern Stat Ribbon (connecting Left Attack Orb & Right Health Gem)
      ctx.fillStyle = 'rgba(9, 13, 22, 0.9)';
      ctx.strokeStyle = hasCombo
        ? pieceObj.activeCombo.colorHex
        : isKing
          ? '#f5d76e'
          : isSelectedOrHovered
            ? '#38bdf8'
            : pieceObj.color === 'w'
              ? 'rgba(240, 236, 225, 0.5)'
              : 'rgba(212, 175, 55, 0.5)';
      ctx.lineWidth = hasCombo || isKing || isSelectedOrHovered ? 2.8 : 1.6;
      ctx.beginPath();
      ctx.roundRect(42, 22, 172, 54, 10);
      ctx.fill();
      ctx.stroke();

      // Top center row: Level + Active Buff / Max HP
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = isLeveled ? '#fde047' : '#cbd5e1';
      ctx.fillText(`Lv.${pieceObj.level || 1}`, 66, 41);

      ctx.textAlign = 'right';
      if (hasCombo) {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = pieceObj.activeCombo.colorHex || '#f5d76e';
        ctx.fillText(pieceObj.activeCombo.name.slice(0, 9), 190, 40);
      } else {
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${shownHpInt}/${pieceObj.maxHp}`, 190, 40);
      }

      // Bottom center row: Crisp HP Bar with Smooth Damage Trail
      const barX = 66;
      const barY = 48;
      const barW = 124;
      const barH = 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 6);
      ctx.fill();

      const maxHpSafe = Math.max(1, pieceObj.maxHp);
      const hpRatio = Math.max(0, Math.min(1, shownHpFloat / maxHpSafe));
      const trailRatio = Math.max(hpRatio, Math.min(1, trailHpFloat / maxHpSafe));

      // Draw luminous gold-crimson damage trail chunk when HP is actively draining after a weapon blow
      if (trailRatio > hpRatio + 0.01) {
        const trailGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        trailGrad.addColorStop(0, '#fb7185');
        trailGrad.addColorStop(1, '#fde047');
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, Math.max(5, barW * trailRatio), barH, 6);
        ctx.fill();
      }

      if (hpRatio > 0.005) {
        const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        if (hpRatio > 0.55) {
          barGrad.addColorStop(0, '#16a34a');
          barGrad.addColorStop(1, '#4ade80');
        } else if (hpRatio > 0.28) {
          barGrad.addColorStop(0, '#d97706');
          barGrad.addColorStop(1, '#fbbf24');
        } else {
          barGrad.addColorStop(0, '#b91c1c');
          barGrad.addColorStop(1, '#f87171');
        }
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, Math.max(5, barW * hpRatio), barH, 6);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 6);
      ctx.stroke();

      // 2. LEFT HEARTHSTONE ATTACK ORB (Golden Sword Sphere)
      const atkX = 36;
      const atkY = 50;
      const atkR = 23;
      const atkGrad = ctx.createRadialGradient(atkX - 5, atkY - 6, 3, atkX, atkY, atkR);
      atkGrad.addColorStop(0, '#fef08a');
      atkGrad.addColorStop(0.55, '#eab308');
      atkGrad.addColorStop(1, '#854d0e');
      ctx.fillStyle = atkGrad;
      ctx.beginPath();
      ctx.arc(atkX, atkY, atkR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = isAtkBuffed ? '#4ade80' : '#fef08a';
      ctx.stroke();

      // Mini crossed sword crown hint at top-left of Attack orb
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillText('⚔', atkX, atkY - 12);

      // Bold Hearthstone Attack Numeral
      ctx.font = '900 22px Cinzel, Georgia, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = '#090b10';
      ctx.strokeText(`${effAtk}`, atkX, atkY + 3);
      ctx.fillStyle = isAtkBuffed ? '#4ade80' : isAtkDebuffed ? '#f87171' : '#ffffff';
      ctx.fillText(`${effAtk}`, atkX, atkY + 3);

      // 3. RIGHT HEARTHSTONE HEALTH DROP GEM (Crimson Blood Drop)
      const hpX = 220;
      const hpY = 52;
      const hpR = 22;
      const hpGrad = ctx.createRadialGradient(hpX - 5, hpY - 4, 3, hpX, hpY, hpR + 4);
      hpGrad.addColorStop(0, '#fca5a5');
      hpGrad.addColorStop(0.5, '#ef4444');
      hpGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      ctx.moveTo(hpX, hpY - 28);
      ctx.bezierCurveTo(hpX + 22, hpY - 10, hpX + 24, hpY + 20, hpX, hpY + 22);
      ctx.bezierCurveTo(hpX - 24, hpY + 20, hpX - 22, hpY - 10, hpX, hpY - 28);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = isDamaged ? '#fde047' : '#fecaca';
      ctx.stroke();

      // Bold Hearthstone Health Numeral
      ctx.font = '900 21px Cinzel, Georgia, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = '#090b10';
      ctx.strokeText(`${shownHpInt}`, hpX, hpY + 2);
      const hpRatio3D = shownHpFloat / Math.max(1, pieceObj.maxHp || 1);
      const isCriticalShatter3D = shownHpFloat > 0 && hpRatio3D < 0.2;
      ctx.fillStyle = isCriticalShatter3D ? '#fecaca' : isDamaged ? '#fca5a5' : '#ffffff';
      ctx.fillText(`${shownHpInt}`, hpX, hpY + 2);

      // Draw Shield-Shatter crack lines across 3D Health Gem when HP < 20%
      if (isCriticalShatter3D) {
        ctx.save();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(hpX - 14, hpY - 14);
        ctx.lineTo(hpX - 2, hpY - 3);
        ctx.lineTo(hpX + 13, hpY - 9);
        ctx.moveTo(hpX - 2, hpY - 3);
        ctx.lineTo(hpX + 8, hpY + 14);
        ctx.stroke();
        ctx.restore();
      }

      // 4. OPTIONAL HEARTHSTONE SILVER ARMOR SHIELD CREST (Top-Right of Health Gem)
      if (hasEffectiveArmor || isCriticalShatter3D) {
        const shX = 198;
        const shY = 23;
        ctx.fillStyle = isCriticalShatter3D ? '#7f1d1d' : '#334155';
        ctx.strokeStyle = isCriticalShatter3D ? '#f87171' : '#93c5fd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(shX - 18, shY - 11, 36, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isCriticalShatter3D ? '#fef08a' : '#e0f2fe';
        ctx.fillText(isCriticalShatter3D ? '💥<20%' : `🛡${effArmor}`, shX, shY + 1);
      }

      // 5. OPTIONAL CONSECRATED / CORRUPTED TILE CREST (Top-Left of Attack Orb)
      if (tileMod) {
        const tmX = 58;
        const tmY = 21;
        const isConsec = tileMod.id === 'CONSECRATED';
        ctx.fillStyle = isConsec ? 'rgba(113, 63, 18, 0.94)' : 'rgba(88, 28, 135, 0.94)';
        ctx.strokeStyle = isConsec ? '#fde047' : '#e879f9';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(tmX - 22, tmY - 10, 44, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isConsec ? '#fef08a' : '#f5d0fe';
        ctx.fillText(isConsec ? '☀️+1' : '☠-1', tmX, tmY + 1);
      }

      ctx.restore();
      pieceObj.badgeTex.needsUpdate = true;
    }

    function updateAllUnitBadges() {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (boardState[r][c]) {
            updateUnit3DBadge(boardState[r][c]);
          }
        }
      }
    }

    function spawnFloatingCombatText(worldPos, text, colorHex = '#f5d76e', scaleSize = 0.85) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.font = '900 46px "Cinzel", "Cinzel Decorative", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.lineWidth = 9;
      ctx.strokeText(text, 256, 76);
      ctx.fillStyle = colorHex;
      ctx.fillText(text, 256, 76);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(worldPos.x, worldPos.y + 0.58, worldPos.z);
      sprite.scale.set(scaleSize * 1.4, scaleSize * 0.35, 1);
      sprite.renderOrder = 30;
      scene.add(sprite);
      floatingTexts3D.push({
        sprite,
        tex,
        mat,
        velY: 0.42,
        life: 1.55,
        maxLife: 1.55
      });
    }

    function spawnDivineLightningBeam(worldPos, colorHex = 0xf5d76e, radius = 0.09) {
      const geo = new THREE.CylinderGeometry(radius * 0.5, radius * 1.35, 8.5, 16, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(worldPos.x, BOARD_SURFACE_Y + 4.2, worldPos.z);
      scene.add(mesh);

      const ringGeo = new THREE.RingGeometry(0.05, 0.36, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(worldPos.x, BOARD_SURFACE_Y + 0.02, worldPos.z);
      scene.add(ringMesh);

      lightningBeams3D.push({
        mesh,
        ringMesh,
        geo,
        ringGeo,
        mat,
        ringMat,
        life: 0.85,
        maxLife: 0.85
      });
    }

    // =========================================================================
    // Epic 3D Combat Visual Effects: Shockwaves, Weapon Slash Arcs & Sparks
    // (Shared Geometries pre-allocated once to guarantee 0 mid-combat VBO stalls)
    // =========================================================================
    const sharedShockwaveRingGeo = new THREE.RingGeometry(0.11, 0.25, 40);
    sharedShockwaveRingGeo.rotateX(-Math.PI / 2);

    const sharedInnerRuneRingGeo = new THREE.RingGeometry(0.05, 0.16, 6);
    sharedInnerRuneRingGeo.rotateX(-Math.PI / 2);

    const sharedSlashArcGeo = new THREE.RingGeometry(
      0.16,
      0.34,
      28,
      1,
      -Math.PI * 0.44,
      Math.PI * 0.88
    );

    const sharedSparkGeo = new THREE.OctahedronGeometry(0.022, 0);

    // =========================================================================
    // THEMED AMBIENT MICRO-AURA & STARDUST PARTICLE ENGINE (64 instanced motes)
    // =========================================================================
    const AMBIENT_MOTE_COUNT = 64;
    const ambientMoteGeo = new THREE.DodecahedronGeometry(0.014, 0);
    const ambientMoteMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ambientMoteInstanced = new THREE.InstancedMesh(ambientMoteGeo, ambientMoteMat, AMBIENT_MOTE_COUNT);
    ambientMoteInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(ambientMoteInstanced);

    const ambientMoteData = Array.from({ length: AMBIENT_MOTE_COUNT }, (_, idx) => ({
      x: (Math.random() - 0.5) * 3.2,
      y: BOARD_SURFACE_Y + 0.08 + Math.random() * 0.90,
      z: (Math.random() - 0.5) * 3.2,
      vx: (Math.random() - 0.5) * 0.08,
      vy: 0.035 + Math.random() * 0.065,
      vz: (Math.random() - 0.5) * 0.08,
      rotSpeed: (Math.random() - 0.5) * 2.5,
      scale: 0.6 + Math.random() * 0.7,
      phase: idx * 0.28
    }));
    const dummyMoteMat4 = new THREE.Matrix4();
    const dummyMotePos = new THREE.Vector3();
    const dummyMoteScale = new THREE.Vector3();
    const dummyMoteQuat = new THREE.Quaternion();

    function spawnCombatShockwave3D(worldPos, colorHex = 0xf5d76e, isKill = false, isEmpowered = false) {
      const primaryColor = isKill ? 0xef4444 : colorHex;
      const secondaryColor = isEmpowered ? 0x38bdf8 : 0xfde047;

      const outerMat = new THREE.MeshBasicMaterial({
        color: primaryColor,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const outerMesh = new THREE.Mesh(sharedShockwaveRingGeo, outerMat);
      outerMesh.position.set(worldPos.x, BOARD_SURFACE_Y + 0.018, worldPos.z);
      scene.add(outerMesh);

      const innerMat = new THREE.MeshBasicMaterial({
        color: secondaryColor,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const innerMesh = new THREE.Mesh(sharedInnerRuneRingGeo, innerMat);
      innerMesh.position.set(worldPos.x, BOARD_SURFACE_Y + 0.024, worldPos.z);
      scene.add(innerMesh);

      combatShockwaves3D.push({
        outerMesh,
        innerMesh,
        outerMat,
        innerMat,
        maxScale: isKill ? 3.45 : isEmpowered ? 2.85 : 2.25,
        life: isKill ? 0.72 : 0.54,
        maxLife: isKill ? 0.72 : 0.54
      });
    }

    function spawnWeaponSlashArc3D(
      worldPos,
      headingRad = 0,
      colorHex = 0xfde047,
      scaleSize = 1.0,
      tiltRad = 0.42
    ) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(sharedSlashArcGeo, mat);
      mesh.position.set(worldPos.x, BOARD_SURFACE_Y + 0.28, worldPos.z);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = headingRad;
      mesh.rotation.x = -Math.PI * 0.36;
      mesh.rotation.z = tiltRad;
      mesh.scale.setScalar(scaleSize * 0.65);
      scene.add(mesh);

      const forwardX = Math.sin(headingRad);
      const forwardZ = Math.cos(headingRad);

      slashArcs3D.push({
        mesh,
        mat,
        velX: forwardX * 0.85,
        velZ: forwardZ * 0.85,
        rotSpin: tiltRad >= 0 ? 5.4 : -5.4,
        baseScale: scaleSize,
        life: 0.34,
        maxLife: 0.34
      });
    }

    const sparkMatCache = new Map();
    function getCachedSparkMaterial(colorHex) {
      if (!sparkMatCache.has(colorHex)) {
        sparkMatCache.set(
          colorHex,
          new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
          })
        );
      }
      return sparkMatCache.get(colorHex);
    }

    function spawnCombatSparks3D(worldPos, colorHex = 0xfbbf24, count = 28, speedMul = 1.0) {
      const sparkPalette = [colorHex, 0xfde047, 0xffedd5, 0xef4444];
      for (let i = 0; i < count; i++) {
        const chosenHex = sparkPalette[i % sparkPalette.length];
        const mat = getCachedSparkMaterial(chosenHex);
        const spark = new THREE.Mesh(sharedSparkGeo, mat);
        const sz = (0.55 + Math.random() * 0.85) * (speedMul > 1.1 ? 1.15 : 1.0);
        spark.scale.setScalar(sz);
        spark.position.set(
          worldPos.x + (Math.random() - 0.5) * 0.14,
          BOARD_SURFACE_Y + 0.22 + Math.random() * 0.18,
          worldPos.z + (Math.random() - 0.5) * 0.14
        );
        scene.add(spark);

        const angle = Math.random() * Math.PI * 2;
        const horizSpeed = (0.85 + Math.random() * 2.15) * speedMul;
        combatSparks3D.push({
          mesh: spark,
          mat,
          baseScale: sz,
          vel: new THREE.Vector3(
            Math.cos(angle) * horizSpeed,
            1.15 + Math.random() * 2.1 * speedMul,
            Math.sin(angle) * horizSpeed
          ),
          life: 0.48 + Math.random() * 0.36,
          maxLife: 0.78
        });
      }
    }

    const sharedDefendDomeGeo = new THREE.SphereGeometry(
      0.23,
      24,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.58
    );
    const sharedDefendHexRingGeo = new THREE.RingGeometry(0.14, 0.24, 6);
    sharedDefendHexRingGeo.rotateX(-Math.PI / 2);

    function spawnMeleeDefendShield3D(worldPos, colorHex = 0x38bdf8) {
      const domeMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        wireframe: false
      });
      const domeMesh = new THREE.Mesh(sharedDefendDomeGeo, domeMat);
      domeMesh.position.set(worldPos.x, BOARD_SURFACE_Y + 0.02, worldPos.z);
      scene.add(domeMesh);

      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        wireframe: true
      });
      const wireMesh = new THREE.Mesh(sharedDefendDomeGeo, wireMat);
      wireMesh.scale.setScalar(1.02);
      domeMesh.add(wireMesh);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const ringMesh = new THREE.Mesh(sharedDefendHexRingGeo, ringMat);
      ringMesh.position.set(worldPos.x, BOARD_SURFACE_Y + 0.026, worldPos.z);
      scene.add(ringMesh);

      defendShields3D.push({
        domeMesh,
        domeMat,
        wireMat,
        ringMesh,
        ringMat,
        life: 0.78,
        maxLife: 0.78
      });
    }

    function resolveTargetUnitForCombatAnim(r, c) {
      if (typeof r === 'number' && typeof c === 'number' && boardState[r]?.[c]) {
        return boardState[r][c];
      }
      if (selectedSquare && boardState[selectedSquare.r]?.[selectedSquare.c]) {
        return boardState[selectedSquare.r][selectedSquare.c];
      }
      if (hoveredSquare && boardState[hoveredSquare.r]?.[hoveredSquare.c]) {
        return boardState[hoveredSquare.r][hoveredSquare.c];
      }
      for (let rr = 0; rr < 8; rr++) {
        for (let cc = 0; cc < 8; cc++) {
          const p = boardState[rr][cc];
          if (p && p.color === currentTurn && p.type === 'king') return p;
        }
      }
      return null;
    }

    function triggerUnitMeleeAttackAnimation(r, c, options = {}) {
      const piece = resolveTargetUnitForCombatAnim(r, c);
      if (!piece || !piece.mesh) return false;
      const homePos = boardToWorld(piece.r, piece.c);
      const activePos = options.inDuel ? piece.mesh.position.clone() : homePos.clone();
      const defaultHeading = piece.color === 'w' ? Math.PI : 0;
      const headingRad =
        typeof options.headingRad === 'number' ? options.headingRad : defaultHeading;

      piece.combatAnimState = 'MELEE_ATTACK';
      piece.combatAnimTimer = 0.45;

      playPieceClip(piece, 'Attack', false, 0.06);
      if (!options.inDuel) {
        soundFX.playWeaponSwing(piece.type);
        triggerCombatHapticFeedback({
          stage: 'melee_attack_trigger',
          isKill: false,
          attackerType: piece.type
        });
      }

      const slashColor = piece.activeCombo?.ringColor || 0xfde047;
      spawnWeaponSlashArc3D(activePos, headingRad, slashColor, 1.22, 0.44);
      spawnWeaponSlashArc3D(activePos, headingRad, 0xef4444, 1.02, -0.36);
      spawnCombatSparks3D(activePos, slashColor, 22, 1.1);
      spawnFloatingCombatText(
        new THREE.Vector3(activePos.x, activePos.y + 0.24, activePos.z),
        '⚔ MELEE ATTACK!',
        '#fde047',
        0.82
      );

      if (!options.inDuel && !isAnimatingMove) {
        // Remove any existing standalone anim on this piece
        for (let i = activeUnitCombatAnims3D.length - 1; i >= 0; i--) {
          if (activeUnitCombatAnims3D[i].piece === piece) {
            activeUnitCombatAnims3D.splice(i, 1);
          }
        }
        activeUnitCombatAnims3D.push({
          piece,
          mode: 'MELEE_ATTACK',
          homePos: homePos.clone(),
          headingRad,
          elapsed: 0,
          duration: 0.42
        });
      }

      if (!options.inDuel) {
        emitPokerChessSync();
      }
      return true;
    }

    function triggerUnitMeleeDefendAnimation(r, c, options = {}) {
      const piece = resolveTargetUnitForCombatAnim(r, c);
      if (!piece || !piece.mesh) return false;
      const homePos = boardToWorld(piece.r, piece.c);
      const activePos = options.inDuel ? piece.mesh.position.clone() : homePos.clone();
      const defaultHeading = piece.color === 'w' ? Math.PI : 0;
      const headingRad =
        typeof options.headingRad === 'number' ? options.headingRad : defaultHeading;

      piece.combatAnimState = 'MELEE_DEFEND';
      piece.combatAnimTimer = 0.45;

      if (!options.isLethal) {
        const hasDefClip =
          piece.actions &&
          Object.keys(piece.actions).some((k) => k.toLowerCase().includes('defend'));
        playPieceClip(piece, hasDefClip ? 'Defend' : 'Attack', false, 0.06);
        if (piece.currentAction && !hasDefClip) {
          piece.currentAction.timeScale = 1.25;
        }
      }

      if (!options.inDuel) {
        soundFX.playBladeClash(false);
        triggerCombatHapticFeedback({
          stage: 'melee_defend_trigger',
          isKill: false,
          defenderType: piece.type
        });
      }

      spawnMeleeDefendShield3D(activePos, piece.color === 'w' ? 0x38bdf8 : 0xc084fc);
      spawnCombatSparks3D(activePos, 0x38bdf8, 20, 0.92);
      spawnFloatingCombatText(
        new THREE.Vector3(activePos.x, activePos.y + 0.24, activePos.z),
        '🛡 MELEE DEFEND!',
        '#38bdf8',
        0.82
      );

      if (!options.inDuel && !isAnimatingMove) {
        for (let i = activeUnitCombatAnims3D.length - 1; i >= 0; i--) {
          if (activeUnitCombatAnims3D[i].piece === piece) {
            activeUnitCombatAnims3D.splice(i, 1);
          }
        }
        activeUnitCombatAnims3D.push({
          piece,
          mode: 'MELEE_DEFEND',
          homePos: homePos.clone(),
          headingRad,
          elapsed: 0,
          duration: 0.42
        });
      }

      if (!options.inDuel) {
        emitPokerChessSync();
      }
      return true;
    }

    function instantiatePiece(type, color, r, c, initialLevel = 1) {
      const tpl = pieceTemplates[`${type}_${color}`];
      let root;
      let mixer = null;
      const actions = {};

      if (tpl && tpl.scene) {
        root = SkeletonUtils.clone(tpl.scene);
        const primaryMat = color === 'w' ? whitePieceMat : blackPieceMat;
        root.traverse((child) => {
          const nm = child.name || '';
          if (nm.includes('Icosphere') || nm.includes('glTF_not_exported')) {
            child.visible = false;
            return;
          }
          if (child.isMesh) {
            const mName = child.material?.name || '';
            if (mName.includes('Gold') || mName.includes('Trim') || mName.includes('Bronze') || mName.includes('Glow')) {
              child.material = goldTrimMat;
            } else if (mName.includes('Steel')) {
              child.material = forgedSteelMat;
            } else {
              child.material = primaryMat;
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        mixer = new THREE.AnimationMixer(root);
        for (const clip of tpl.animations) {
          actions[clip.name] = mixer.clipAction(clip);
        }
        activeMixers.push(mixer);
      } else {
        root = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.14, 0.42, 16),
          color === 'w' ? whitePieceMat : blackPieceMat
        );
      }

      const worldPos = boardToWorld(r, c);
      root.position.copy(worldPos);
      const scale = BOARD_SQ_SIZE;
      root.scale.set(scale, scale, scale);
      root.rotation.y = color === 'w' ? Math.PI : 0;
      root.userData.isChessPieceRoot = true;
      scene.add(root);
      allInstantiatedPieceMeshes.add(root);

      const pieceObj = {
        type,
        color,
        r,
        c,
        mesh: root,
        mixer,
        actions,
        currentAction: null,
        hasMoved: false,
        pathHistory: [
          {
            r,
            c,
            algebraic: `${String.fromCharCode(97 + c)}${8 - r}`,
            turn: 0,
            kind: 'SPAWN'
          }
        ]
      };

      attachRPGStatsToPiece(pieceObj, initialLevel);
      pieceObj.displayHp = pieceObj.hp;
      pieceObj.trailHp = pieceObj.hp;
      createUnit3DBadgeAndRing(pieceObj);
      attachCustomSkin3DModelToPiece(pieceObj, activeRenderedSkinId);

      root.traverse((child) => {
        child.userData.piece = pieceObj;
      });

      playPieceClip(pieceObj, 'Idle', true, 0);
      return pieceObj;
    }

    const allInstantiatedPieceMeshes = new Set();
    const pendingBoardTimers = new Set();

    function scheduleBoardTimeout(fn, delayMs) {
      const tid = setTimeout(() => {
        pendingBoardTimers.delete(tid);
        fn();
      }, delayMs);
      pendingBoardTimers.add(tid);
      return tid;
    }

    function removePieceMeshSafely(pieceOrMesh) {
      if (!pieceOrMesh) return;
      const mesh = pieceOrMesh.isObject3D ? pieceOrMesh : pieceOrMesh.mesh;
      if (pieceOrMesh.mixer) {
        try {
          pieceOrMesh.mixer.stopAllAction();
        } catch (e) {}
        const mixIdx = activeMixers.indexOf(pieceOrMesh.mixer);
        if (mixIdx !== -1) activeMixers.splice(mixIdx, 1);
      }
      if (mesh) {
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        scene.remove(mesh);
        allInstantiatedPieceMeshes.delete(mesh);
      }
    }

    const ATTACK_SYNC_PROFILES = {
      pawn:   { timeScale: 1.15, swingStartClip: 0.36, contactClip: 0.60, blowClip: 0.78, maxLunge: 0.095 },
      king:   { timeScale: 1.10, swingStartClip: 0.34, contactClip: 0.56, blowClip: 0.75, maxLunge: 0.080 },
      queen:  { timeScale: 1.08, swingStartClip: 0.35, contactClip: 0.58, blowClip: 0.77, maxLunge: 0.065 },
      rook:   { timeScale: 1.06, swingStartClip: 0.35, contactClip: 0.58, blowClip: 0.77, maxLunge: 0.055 },
      knight: { timeScale: 1.08, swingStartClip: 0.35, contactClip: 0.58, blowClip: 0.77, maxLunge: 0.060 },
      bishop: { timeScale: 1.08, swingStartClip: 0.35, contactClip: 0.58, blowClip: 0.77, maxLunge: 0.065 }
    };

    function playPieceClip(piece, clipKeyword, loop = true, fadeSeconds = 0.18) {
      if (!piece || !piece.actions) return;
      const lowerKw = clipKeyword.toLowerCase();
      const key = Object.keys(piece.actions).find((k) =>
        k.toLowerCase().includes(lowerKw)
      );
      if (!key) return;
      const nextAction = piece.actions[key];
      const isIdle = lowerKw.includes('idle');
      const isAttack = lowerKw.includes('attack');
      if (piece.currentAction && piece.currentAction !== nextAction) {
        piece.currentAction.fadeOut(fadeSeconds);
      }
      nextAction.reset();
      nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      nextAction.clampWhenFinished = !loop;
      if (isAttack) {
        const prof = ATTACK_SYNC_PROFILES[piece.type] || ATTACK_SYNC_PROFILES.queen;
        nextAction.timeScale = prof.timeScale * 2.2;
      } else if (lowerKw.includes('move') || lowerKw.includes('walk') || lowerKw.includes('run')) {
        nextAction.timeScale = 1.85;
      } else {
        nextAction.timeScale = 1.25;
      }
      if (isIdle && (!fadeSeconds || fadeSeconds <= 0.01)) {
        nextAction.time = ((piece.r * 5 + piece.c * 3) % 16) * 0.11;
      }
      nextAction.fadeIn(fadeSeconds).play();
      piece.currentAction = nextAction;
      if (piece.mixer) {
        piece.mixer.update(0.016);
      }
      renderer.shadowMap.needsUpdate = true;
    }

    function clearAllPieces() {
      // 1. Cancel any pending delayed ultimate/combat timers so they cannot touch the new board
      for (const tid of pendingBoardTimers) {
        clearTimeout(tid);
      }
      pendingBoardTimers.clear();

      // 2. Remove all pieces referenced in boardState
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (boardState[r][c]) {
            removePieceMeshSafely(boardState[r][c]);
          }
          boardState[r][c] = null;
        }
      }

      // 3. Remove any toppled/fallen King piece or orphaned piece meshes tracked in allInstantiatedPieceMeshes
      if (checkmateState && checkmateState.fallenKingPiece) {
        removePieceMeshSafely(checkmateState.fallenKingPiece);
        checkmateState.fallenKingPiece = null;
      }
      for (const mesh of Array.from(allInstantiatedPieceMeshes)) {
        removePieceMeshSafely(mesh);
      }
      allInstantiatedPieceMeshes.clear();

      // 4. Sweep scene.children for any residual chess piece roots or transient combat FX
      for (let i = scene.children.length - 1; i >= 0; i--) {
        const child = scene.children[i];
        if (child && child.userData && child.userData.isChessPieceRoot) {
          scene.remove(child);
        }
      }

      // 5. Clear transient 3D combat effects & shatter debris
      for (const d of shatterDebris) {
        if (d.mesh) scene.remove(d.mesh);
      }
      shatterDebris.length = 0;
      for (const ft of floatingTexts3D) {
        if (ft.sprite) scene.remove(ft.sprite);
      }
      floatingTexts3D.length = 0;
      for (const lb of lightningBeams3D) {
        if (lb.mesh) scene.remove(lb.mesh);
      }
      lightningBeams3D.length = 0;
      for (const sw of combatShockwaves3D) {
        if (sw.mesh) scene.remove(sw.mesh);
      }
      combatShockwaves3D.length = 0;
      for (const sa of slashArcs3D) {
        if (sa.mesh) scene.remove(sa.mesh);
      }
      slashArcs3D.length = 0;
      for (const sp of combatSparks3D) {
        if (sp.mesh) scene.remove(sp.mesh);
      }
      combatSparks3D.length = 0;
      for (const sh of defendShields3D) {
        if (sh.domeMesh) scene.remove(sh.domeMesh);
        if (sh.ringMesh) scene.remove(sh.ringMesh);
      }
      defendShields3D.length = 0;
      activeUnitCombatAnims3D.length = 0;
      activeMixers.length = 0;
    }

    let scriptedGameActive = false;
    let scriptDeviated = false;
    let scriptMoves = [];
    let scriptCursor = 0;
    let moveHistory = [];
    let preMoveHighlightTask = null;
    let activeDuelSavedCam = null;
    let checkmateState = {
      active: false,
      bannerVisible: false,
      defeatedColor: null,
      winnerColor: null,
      kingFallAngleDeg: 0,
      phase: 'none',
      fallenKingPiece: null
    };

    function clearCheckmateSequence() {
      if (checkmateState.fallenKingPiece) {
        removePieceMeshSafely(checkmateState.fallenKingPiece);
        checkmateState.fallenKingPiece = null;
      }
      checkmateState.active = false;
      checkmateState.bannerVisible = false;
      checkmateState.defeatedColor = null;
      checkmateState.winnerColor = null;
      checkmateState.kingFallAngleDeg = 0;
      checkmateState.phase = 'none';
      checkmateState.rankedRewardGranted = false;
      stopCheckmateConfetti();
      const overlay = document.getElementById('checkmate-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
      }
    }

    function captureBoardSnapshot() {
      return {
        fps: currentFPS,
        performancePreset,
        currentTurn,
        turnNumber,
        turnPhase,
        gameOver,
        capturedByWhite,
        capturedByBlack,
        scriptCursor,
        scriptedGameActive,
        scriptDeviated,
        cells: boardState.map((row) =>
          row.map((p) =>
            p
              ? {
                  type: p.type,
                  color: p.color,
                  hasMoved: Boolean(p.hasMoved),
                  level: p.level,
                  xp: p.xp,
                  hp: p.hp,
                  maxHp: p.maxHp,
                  baseAtk: p.baseAtk,
                  armor: p.armor,
                  activeCombo: p.activeCombo ? { ...p.activeCombo } : null,
                  pathHistory: Array.isArray(p.pathHistory)
                    ? p.pathHistory.map((st) => ({ ...st }))
                    : []
                }
              : null
          )
        )
      };
    }

    function restoreBoardSnapshot(snap) {
      if (!snap) return false;
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      preMoveHighlightTask = null;
      activeMoveTweens.length = 0;
      clearCheckmateSequence();
      for (const d of shatterDebris) {
        if (d.mesh) scene.remove(d.mesh);
      }
      shatterDebris.length = 0;
      impactFlashLight.intensity = 0;
      impactFlashLight.visible = false;
      if (activeDuelSavedCam) {
        camera.position.copy(activeDuelSavedCam.pos);
        orbitControls.target.copy(activeDuelSavedCam.target);
        activeDuelSavedCam = null;
      }
      orbitControls.enabled = true;
      orbitControls.update();

      clearAllPieces();
      clearSquareHighlights();
      selectedSquare = null;
      validMoves = [];
      isAnimatingMove = false;
      currentTurn = snap.currentTurn;
      turnNumber = snap.turnNumber || 1;
      turnPhase = snap.turnPhase || 'SELECT_CARDS';
      lastTimeoutNotice = null;
      resetTurnTimer();
      gameOver = snap.gameOver;
      capturedByWhite = snap.capturedByWhite;
      capturedByBlack = snap.capturedByBlack;
      if (typeof snap.scriptCursor === 'number') {
        scriptCursor = snap.scriptCursor;
      }
      if (typeof snap.scriptedGameActive === 'boolean') {
        scriptedGameActive = snap.scriptedGameActive;
      }
      if (typeof snap.scriptDeviated === 'boolean') {
        scriptDeviated = snap.scriptDeviated;
      }

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const cell = snap.cells[r][c];
          if (cell) {
            const inst = instantiatePiece(cell.type, cell.color, r, c, cell.level || 1);
            inst.hasMoved = Boolean(cell.hasMoved);
            if (typeof cell.hp === 'number') inst.hp = cell.hp;
            if (typeof cell.maxHp === 'number') inst.maxHp = cell.maxHp;
            if (typeof cell.baseAtk === 'number') inst.baseAtk = cell.baseAtk;
            if (typeof cell.armor === 'number') inst.armor = cell.armor;
            if (typeof cell.xp === 'number') inst.xp = cell.xp;
            inst.activeCombo = cell.activeCombo ? { ...cell.activeCombo } : null;
            if (Array.isArray(cell.pathHistory) && cell.pathHistory.length > 0) {
              inst.pathHistory = cell.pathHistory.map((st) => ({ ...st }));
            }
            updateUnit3DBadge(inst);
            boardState[r][c] = inst;
          }
        }
      }

      renderer.shadowMap.needsUpdate = true;
      updateTurnUI();
      if (typeof updateScriptBarUI === 'function') updateScriptBarUI();
      return true;
    }

    // =========================================================================
    // Progressive Bot Difficulty Scaling by Player Elo Rating or Explicit Choice
    // =========================================================================
    let customBotLevel = null;

    function setBotDifficultyLevel(lvl) {
      customBotLevel = typeof lvl === 'number' && lvl >= 1 && lvl <= 5 ? lvl : null;
      emitPokerChessSync();
      return customBotLevel;
    }

    function getBotDifficultyProfile(eloRating = commercialProfile?.elo || 1000) {
      const explicitLevel = typeof customBotLevel === 'number' ? customBotLevel : null;
      const elo = explicitLevel === 1 ? 900 : explicitLevel === 2 ? 1200 : explicitLevel === 3 ? 1400 : explicitLevel === 4 ? 1650 : explicitLevel === 5 ? 1900 : (Number(eloRating) || 1000);
      if (elo < 1150) {
        return {
          level: 1,
          tierId: 'bronze_bot',
          nameVi: 'Bot Tân Binh Đồng',
          badgeVi: '🤖 Bot Lv.1 • Dễ',
          descVi: 'Đánh ngẫu nhiên, ít dùng bài mạnh, không cộng chỉ số',
          colorHex: '#cd7f32',
          noise: 42,
          comboSmartPct: 0.65,
          mulliganDraws: 0,
          lookaheadRiskWeight: 0,
          bonusHp: 0,
          bonusAtk: 0,
          bonusArmor: 0,
          thinkDelayMs: 620
        };
      }
      if (elo < 1300) {
        return {
          level: 2,
          tierId: 'silver_bot',
          nameVi: 'Bot Hiệp Sĩ Bạc',
          badgeVi: '🤖 Bot Lv.2 • Vừa',
          descVi: 'Biết ghép bộ 5 lá tối ưu, ưu tiên đổi máu lời (+2❤ HP)',
          colorHex: '#cbd5e1',
          noise: 18,
          comboSmartPct: 0.92,
          mulliganDraws: 0,
          lookaheadRiskWeight: 0.35,
          bonusHp: 2,
          bonusAtk: 0,
          bonusArmor: 0,
          thinkDelayMs: 560
        };
      }
      if (elo < 1500) {
        return {
          level: 3,
          tierId: 'gold_bot',
          nameVi: 'Bot Chiến Tướng Vàng',
          badgeVi: '🤖 Bot Lv.3 • Khá',
          descVi: 'Chiếm Ô Thánh Tích, đổi 1 lá bài xấu, tính sát thương chuẩn (+4❤ +1⚔)',
          colorHex: '#f5d76e',
          noise: 8,
          comboSmartPct: 1.0,
          mulliganDraws: 1,
          lookaheadRiskWeight: 0.65,
          bonusHp: 4,
          bonusAtk: 1,
          bonusArmor: 0,
          thinkDelayMs: 500
        };
      }
      if (elo < 1750) {
        return {
          level: 4,
          tierId: 'platinum_bot',
          nameVi: 'Bot Quý Tộc Bạch Kim',
          badgeVi: '🤖 Bot Lv.4 • Khó',
          descVi: 'Tính trước phản đòn, bảo vệ Vua/Hậu, săn quân yếu (+6❤ +1⚔ +1🛡)',
          colorHex: '#38bdf8',
          noise: 3,
          comboSmartPct: 1.0,
          mulliganDraws: 1,
          lookaheadRiskWeight: 0.95,
          bonusHp: 6,
          bonusAtk: 1,
          bonusArmor: 1,
          thinkDelayMs: 460
        };
      }
      if (elo < 2050) {
        return {
          level: 5,
          tierId: 'diamond_bot',
          nameVi: 'Bot Thánh Kỵ Sĩ Kim Cương',
          badgeVi: '🤖 Bot Lv.5 • Ác Mộng',
          descVi: 'Chiến thuật cao cấp, lọc 2 lá bài phép, dồn sát thương kết liễu (+9❤ +2⚔ +1🛡)',
          colorHex: '#a855f7',
          noise: 1,
          comboSmartPct: 1.0,
          mulliganDraws: 2,
          lookaheadRiskWeight: 1.25,
          bonusHp: 9,
          bonusAtk: 2,
          bonusArmor: 1,
          thinkDelayMs: 420
        };
      }
      return {
        level: 6,
        tierId: 'grandmaster_bot',
        nameVi: 'Bot Đại Kiện Tướng',
        badgeVi: '🤖 Bot Lv.6 • Thần Thoại',
        descVi: 'Trí tuệ tối thượng, lọc 3 lá bài phép, không mắc sai lầm (+12❤ +2⚔ +2🛡)',
        colorHex: '#ef4444',
        noise: 0.2,
        comboSmartPct: 1.0,
        mulliganDraws: 3,
        lookaheadRiskWeight: 1.5,
        bonusHp: 12,
        bonusAtk: 2,
        bonusArmor: 2,
        thinkDelayMs: 380
      };
    }

    function resetChessBoard(orientCamera = true, preserveScript = false) {
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      preMoveHighlightTask = null;
      activeMoveTweens.length = 0;
      clearCheckmateSequence();
      if (activeDuelSavedCam) {
        camera.position.copy(activeDuelSavedCam.pos);
        orbitControls.target.copy(activeDuelSavedCam.target);
        activeDuelSavedCam = null;
      }
      orbitControls.enabled = true;
      clearAllPieces();
      clearSquareHighlights();
      clearAllTacticalPings(false);
      tacticalPingMode = false;
      selectedSquare = null;
      hoveredSquare = null;
      validMoves = [];
      currentTurn = 'w';
      turnNumber = 1;
      turnPhase = 'DRAW_PHASE';
      autoMoveEnabled = false;
      const aiMoveBtn = document.getElementById('btn-ai-move');
      if (aiMoveBtn) aiMoveBtn.textContent = '🤖 Auto Move: TẮT';
      lastTimeoutNotice = null;
      resetTurnTimer();
      pendingComboEval = null;
      lastEmpoweredSquare = null;
      lastAggressorInfo = null;
      ultimateTargetSquares = [];
      pokerDecks = {
        w: createPlayerPokerState(),
        b: createPlayerPokerState()
      };
      const botProf = getBotDifficultyProfile();
      combatLogFeed = [
        {
          id: 'init_log',
          text: `🃏 Lượt 1 bắt đầu! Đối thủ: ${botProf.nameVi} (${botProf.badgeVi}) — ${botProf.descVi}.`,
          type: 'gold',
          turn: 1
        }
      ];
      isAnimatingMove = false;
      gameOver = false;
      capturedByWhite = 0;
      capturedByBlack = 0;
      moveHistory = [];
      scriptDeviated = false;
      if (!preserveScript) {
        scriptCursor = 0;
      }

      const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
      for (let c = 0; c < 8; c++) {
        boardState[7][c] = instantiatePiece(backRow[c], 'w', 7, c, 1);
        boardState[6][c] = instantiatePiece('pawn', 'w', 6, c, 1);
        boardState[1][c] = instantiatePiece('pawn', 'b', 1, c, 1);
        boardState[0][c] = instantiatePiece(backRow[c], 'b', 0, c, 1);
      }

      // Apply Elo-scaled Bot Difficulty bonuses to AI pieces in single-player mode
      if (gameMode === 'single' && (botProf.bonusHp > 0 || botProf.bonusAtk > 0 || botProf.bonusArmor > 0)) {
        const aiSide = playerColor === 'w' ? 'b' : 'w';
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.color === aiSide) {
              const hpScale = p.type === 'king' ? 1.5 : p.type === 'pawn' ? 0.65 : 1.0;
              const extraHp = Math.round(botProf.bonusHp * hpScale);
              p.maxHp = (p.maxHp || 15) + extraHp;
              p.hp = p.maxHp;
              p.displayHp = p.hp;
              p.trailHp = p.hp;
              p.baseAtk = (p.baseAtk || 4) + (p.type === 'pawn' ? Math.floor(botProf.bonusAtk * 0.6) : botProf.bonusAtk);
              p.armor = Math.min(getUnitArmorCap(p), (p.armor || 0) + (p.type === 'pawn' ? 0 : botProf.bonusArmor));
              updateUnit3DBadge(p);
            }
          }
        }
      }

      const currentSkinToRender = commercialProfile.equippedSkinId || activeRenderedSkinId || 'classic_sanctum';
      applyChessSkinMaterials3D(currentSkinToRender, false);
      syncAllBoardPieceSkinModels(currentSkinToRender);

      if (orientCamera) {
        const viewSide = playerColor === 'b' ? 'b' : 'w';
        playerCamSide = viewSide;
        setActiveCamButton('btn-cam-player');
        setCameraForSide(viewSide, false);
      }

      renderer.shadowMap.needsUpdate = true;
      updateTurnUI();
      if (typeof updateScriptBarUI === 'function') updateScriptBarUI();
      maybeScheduleAIMove();
    }

    // =========================================================================
    // Legal Chess Move Generation (No Check/Checkmate Rule + Straight Mobility)
    // =========================================================================
    function getPseudoMovesForPiece(r, c, board = boardState) {
      const piece = board[r][c];
      if (!piece) return [];
      const moves = [];
      const { type, color } = piece;
      const dir = color === 'w' ? -1 : 1;
      const hasStraightStride = piece.activeCombo?.id === 'STRAIGHT';

      const inBounds = (nr, nc) => nr >= 0 && nr < 8 && nc >= 0 && nc < 8;
      const addMove = (nr, nc) => {
        if (!inBounds(nr, nc)) return false;
        const target = board[nr][nc];
        if (!target) {
          moves.push({ r: nr, c: nc, capture: false });
          return true;
        } else if (target.color !== color) {
          moves.push({ r: nr, c: nc, capture: true });
          return false;
        }
        return false;
      };

      if (type === 'pawn') {
        if (inBounds(r + dir, c) && !board[r + dir][c]) {
          moves.push({ r: r + dir, c, capture: false });
          const startRow = color === 'w' ? 6 : 1;
          if ((r === startRow || hasStraightStride) && inBounds(r + dir * 2, c) && !board[r + dir * 2][c]) {
            moves.push({ r: r + dir * 2, c, capture: false });
            if (hasStraightStride && inBounds(r + dir * 3, c) && !board[r + dir * 3][c]) {
              moves.push({ r: r + dir * 3, c, capture: false });
            }
          }
        }
        for (const dc of [-1, 1]) {
          if (inBounds(r + dir, c + dc)) {
            const target = board[r + dir][c + dc];
            if (target && target.color !== color) {
              moves.push({ r: r + dir, c: c + dc, capture: true });
            }
          }
        }
      } else if (type === 'knight') {
        const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of jumps) addMove(r + dr, c + dc);
      } else if (type === 'king') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr !== 0 || dc !== 0) {
              const step1Open = addMove(r + dr, c + dc);
              if (hasStraightStride && step1Open) {
                addMove(r + dr * 2, c + dc * 2);
              }
            }
          }
        }
      } else {
        const dirs = [];
        if (type === 'rook' || type === 'queen') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
        if (type === 'bishop' || type === 'queen') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
        for (const [dr, dc] of dirs) {
          for (let step = 1; step < 8; step++) {
            const nr = r + dr * step;
            const nc = c + dc * step;
            if (!inBounds(nr, nc)) break;
            const target = board[nr][nc];
            if (!target) {
              moves.push({ r: nr, c: nc, capture: false });
            } else if (target.color !== color) {
              moves.push({ r: nr, c: nc, capture: true });
              break;
            } else if (hasStraightStride) {
              // Straight Combo "Bộ Pháp Thần Tốc": phase through friendly pieces!
              continue;
            } else {
              break;
            }
          }
        }
      }
      return moves;
    }

    function isKingInCheck(color, board = boardState) {
      let kingR = -1;
      let kingC = -1;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === color && p.type === 'king') {
            kingR = r;
            kingC = c;
            break;
          }
        }
      }
      if (kingR === -1) return true;
      const oppColor = color === 'w' ? 'b' : 'w';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === oppColor) {
            const oppMoves = getPseudoMovesForPiece(r, c, board);
            if (oppMoves.some((m) => m.r === kingR && m.c === kingC)) {
              return true;
            }
          }
        }
      }
      return false;
    }

    function getLegalMovesForPiece(r, c) {
      const piece = boardState[r][c];
      if (!piece) return [];
      // Approved Rule 4.1: No Check / Checkmate restriction! Victory is destroying the enemy King.
      const legal = [...getPseudoMovesForPiece(r, c, boardState)];

      // Castling (Kingside O-O to c=6, Queenside O-O-O to c=2)
      const homeRow = piece.color === 'w' ? 7 : 0;
      if (piece.type === 'king' && !piece.hasMoved && r === homeRow && c === 4) {
        const kRook = boardState[homeRow][7];
        if (
          kRook &&
          kRook.type === 'rook' &&
          kRook.color === piece.color &&
          !kRook.hasMoved &&
          !boardState[homeRow][5] &&
          !boardState[homeRow][6]
        ) {
          legal.push({ r: homeRow, c: 6, capture: false, castle: 'k', rookFromC: 7, rookToC: 5 });
        }
        const qRook = boardState[homeRow][0];
        if (
          qRook &&
          qRook.type === 'rook' &&
          qRook.color === piece.color &&
          !qRook.hasMoved &&
          !boardState[homeRow][1] &&
          !boardState[homeRow][2] &&
          !boardState[homeRow][3]
        ) {
          legal.push({ r: homeRow, c: 2, capture: false, castle: 'q', rookFromC: 0, rookToC: 3 });
        }
      }

      return legal;
    }

    function getAllLegalMoves(color) {
      const all = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (p && p.color === color) {
            const moves = getLegalMovesForPiece(r, c);
            for (const m of moves) {
              all.push({ fromR: r, fromC: c, toR: m.r, toC: m.c, capture: m.capture });
            }
          }
        }
      }
      return all;
    }

    // =========================================================================
    // Square Highlights (Semi-Transparent Floor Tile Glow + 3D Emissive Tiles)
    // =========================================================================
    const sharedTileGlowGeo = new THREE.PlaneGeometry(BOARD_SQ_SIZE * 0.95, BOARD_SQ_SIZE * 0.95);
    sharedTileGlowGeo.rotateX(-Math.PI / 2);
    const sharedSelRingGeo = new THREE.RingGeometry(0.112, 0.148, 36);
    sharedSelRingGeo.rotateX(-Math.PI / 2);
    const sharedCapRingGeo = new THREE.RingGeometry(0.116, 0.156, 36);
    sharedCapRingGeo.rotateX(-Math.PI / 2);
    const sharedMoveDotGeo = new THREE.CircleGeometry(0.056, 28);
    sharedMoveDotGeo.rotateX(-Math.PI / 2);
    const sharedMoveOuterRingGeo = new THREE.RingGeometry(0.072, 0.094, 32);
    sharedMoveOuterRingGeo.rotateX(-Math.PI / 2);

    function createFloorTileGlowTexture(cfg) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // 1. Soft radial floor glow wash across the tile
      const radGrad = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
      radGrad.addColorStop(0, cfg.centerRgba);
      radGrad.addColorStop(0.58, cfg.midRgba);
      radGrad.addColorStop(1, cfg.edgeRgba);
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 240, 18);
      ctx.fill();

      // 2. Luminous outer tile border frame
      ctx.strokeStyle = cfg.borderStroke;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(11, 11, 234, 234, 16);
      ctx.stroke();

      // 3. Subtle inner sanctum inset frame
      ctx.strokeStyle = cfg.innerStroke;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(22, 22, 212, 212, 10);
      ctx.stroke();

      // 4. Corner tactical brackets for high-visibility 3D tile read
      ctx.strokeStyle = cfg.cornerStroke;
      ctx.lineWidth = 5;
      const bLen = 28;
      const pad = 16;
      const corners = [
        [pad, pad + bLen, pad, pad, pad + bLen, pad],
        [256 - pad - bLen, pad, 256 - pad, pad, 256 - pad, pad + bLen],
        [pad, 256 - pad - bLen, pad, 256 - pad, pad + bLen, 256 - pad],
        [256 - pad - bLen, 256 - pad, 256 - pad, 256 - pad, 256 - pad, 256 - pad - bLen]
      ];
      for (const [x1, y1, x2, y2, x3, y3] of corners) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    const tileGlowTextures = {
      selected: createFloorTileGlowTexture({
        centerRgba: 'rgba(245, 215, 110, 0.56)',
        midRgba: 'rgba(212, 175, 55, 0.30)',
        edgeRgba: 'rgba(212, 175, 55, 0.08)',
        borderStroke: 'rgba(245, 215, 110, 0.92)',
        innerStroke: 'rgba(255, 240, 180, 0.42)',
        cornerStroke: '#fde047'
      }),
      move: createFloorTileGlowTexture({
        centerRgba: 'rgba(56, 189, 248, 0.54)',
        midRgba: 'rgba(14, 165, 233, 0.28)',
        edgeRgba: 'rgba(2, 132, 199, 0.08)',
        borderStroke: 'rgba(125, 211, 252, 0.88)',
        innerStroke: 'rgba(186, 230, 253, 0.36)',
        cornerStroke: '#38bdf8'
      }),
      capture: createFloorTileGlowTexture({
        centerRgba: 'rgba(239, 68, 68, 0.62)',
        midRgba: 'rgba(220, 38, 38, 0.34)',
        edgeRgba: 'rgba(153, 27, 27, 0.10)',
        borderStroke: 'rgba(252, 165, 165, 0.94)',
        innerStroke: 'rgba(248, 113, 113, 0.48)',
        cornerStroke: '#ef4444'
      }),
      castle: createFloorTileGlowTexture({
        centerRgba: 'rgba(251, 191, 36, 0.58)',
        midRgba: 'rgba(217, 119, 6, 0.32)',
        edgeRgba: 'rgba(180, 83, 9, 0.08)',
        borderStroke: 'rgba(253, 224, 71, 0.92)',
        innerStroke: 'rgba(254, 240, 138, 0.45)',
        cornerStroke: '#fbbf24'
      })
    };

    function setFloorTileEmissive() {
      // Floor tiles share 2 static PBR materials for high FPS; glow is rendered via sharedTileGlowGeo overlays
    }

    // =========================================================================
    // 3D VISUAL PATHING INDICATOR SYSTEM (Move History Breadcrumb Trail + Intended Trajectory)
    // =========================================================================
    const unitPathingGroup = new THREE.Group();
    unitPathingGroup.name = 'UnitPathingIndicators3D';
    scene.add(unitPathingGroup);

    // Modes: 'ALL' (History + Trajectory), 'TRAJECTORY' (Intended Trajectory only), 'HISTORY' (Move History only), 'OFF'
    let pathingDisplayMode = 'ALL';
    const activeTrajectoryChevrons = [];
    const activeHistoryNodes = [];
    const activeTrajectoryWaypoints = [];
    let activeTargetLockRing = null;

    const sharedWaypointDiamondGeo = new THREE.OctahedronGeometry(0.036, 0);
    const sharedHistoryRingGeo = new THREE.RingGeometry(0.055, 0.088, 16);
    sharedHistoryRingGeo.rotateX(-Math.PI / 2);
    const sharedOriginCompassGeo = new THREE.RingGeometry(0.095, 0.132, 6);
    sharedOriginCompassGeo.rotateX(-Math.PI / 2);
    const sharedTrajChevronGeo = new THREE.ConeGeometry(0.034, 0.078, 4);
    sharedTrajChevronGeo.rotateX(Math.PI / 2);
    const sharedTargetLockRingGeo = new THREE.RingGeometry(0.118, 0.152, 24);
    sharedTargetLockRingGeo.rotateX(-Math.PI / 2);

    function clearUnitPathing3D() {
      activeTrajectoryChevrons.length = 0;
      activeHistoryNodes.length = 0;
      activeTrajectoryWaypoints.length = 0;
      activeTargetLockRing = null;
      while (unitPathingGroup.children.length > 0) {
        const child = unitPathingGroup.children[0];
        child.traverse((node) => {
          if (node.userData?.ownGeo && node.geometry) {
            node.geometry.dispose();
          }
          if (node.material) {
            if (node.material.map) node.material.map.dispose();
            node.material.dispose();
          }
        });
        unitPathingGroup.remove(child);
      }
    }

    function computeMoveTrajectoryWaypoints(piece, fromR, fromC, toR, toC, moveInfo = null) {
      const dr = toR - fromR;
      const dc = toC - fromC;
      const waypoints = [];
      const isCapture = Boolean(
        moveInfo?.capture || (boardState[toR]?.[toC] && boardState[toR][toC].color !== piece?.color)
      );
      const isCastle = Boolean(moveInfo?.castle);
      const isKnightJump = piece?.type === 'knight' || Math.abs(dr) * Math.abs(dc) === 2;

      if (isKnightJump && (dr !== 0 || dc !== 0)) {
        // L-shape ground stepping stones (2 squares along primary axis, then 1 square perpendicular)
        if (Math.abs(dr) === 2) {
          const stepR = dr > 0 ? 1 : -1;
          waypoints.push({
            r: fromR + stepR,
            c: fromC,
            algebraic: toAlgebraic(fromR + stepR, fromC),
            isIntermediate: true,
            isCorner: false
          });
          waypoints.push({
            r: fromR + stepR * 2,
            c: fromC,
            algebraic: toAlgebraic(fromR + stepR * 2, fromC),
            isIntermediate: true,
            isCorner: true
          });
        } else if (Math.abs(dc) === 2) {
          const stepC = dc > 0 ? 1 : -1;
          waypoints.push({
            r: fromR,
            c: fromC + stepC,
            algebraic: toAlgebraic(fromR, fromC + stepC),
            isIntermediate: true,
            isCorner: false
          });
          waypoints.push({
            r: fromR,
            c: fromC + stepC * 2,
            algebraic: toAlgebraic(fromR, fromC + stepC * 2),
            isIntermediate: true,
            isCorner: true
          });
        }
      } else {
        const steps = Math.max(Math.abs(dr), Math.abs(dc));
        if (steps > 1) {
          const stepR = dr === 0 ? 0 : dr / steps;
          const stepC = dc === 0 ? 0 : dc / steps;
          if (Number.isInteger(stepR) && Number.isInteger(stepC)) {
            for (let s = 1; s < steps; s++) {
              const wr = fromR + stepR * s;
              const wc = fromC + stepC * s;
              waypoints.push({
                r: wr,
                c: wc,
                algebraic: toAlgebraic(wr, wc),
                isIntermediate: true,
                isCorner: false
              });
            }
          }
        }
      }

      waypoints.push({
        r: toR,
        c: toC,
        algebraic: toAlgebraic(toR, toC),
        isIntermediate: false,
        isDestination: true
      });

      const chebyshevDist = Math.max(Math.abs(dr), Math.abs(dc));
      const manhattanDist = Math.abs(dr) + Math.abs(dc);
      return {
        fromR,
        fromC,
        fromAlgebraic: toAlgebraic(fromR, fromC),
        toR,
        toC,
        toAlgebraic: toAlgebraic(toR, toC),
        isCapture,
        isCastle,
        castleSide: moveInfo?.castle || null,
        isKnightJump,
        distance: isKnightJump ? 3 : chebyshevDist,
        manhattanDist,
        waypoints
      };
    }

    function createPathingLabelSprite(text, borderHex = '#38bdf8', subText = '') {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = 'rgba(7, 11, 22, 0.92)';
      ctx.beginPath();
      ctx.roundRect(8, 10, 368, 76, 18);
      ctx.fill();

      ctx.lineWidth = 3.5;
      ctx.strokeStyle = borderHex;
      ctx.stroke();

      ctx.font = 'bold 25px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(text, 192, subText ? 36 : 48);

      if (subText) {
        ctx.font = '600 18px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = borderHex;
        ctx.fillText(subText, 192, 65);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.46, 0.115, 1);
      sprite.renderOrder = 26;
      return sprite;
    }

    function getActivePathingSubjectUnit() {
      if (selectedSquare && boardState[selectedSquare.r]?.[selectedSquare.c]) {
        return boardState[selectedSquare.r][selectedSquare.c];
      }
      if (hoveredSquare && boardState[hoveredSquare.r]?.[hoveredSquare.c]) {
        return boardState[hoveredSquare.r][hoveredSquare.c];
      }
      if (moveHistory.length > 0) {
        const lastMv = moveHistory[moveHistory.length - 1];
        if (lastMv && boardState[lastMv.toR]?.[lastMv.toC]) {
          return boardState[lastMv.toR][lastMv.toC];
        }
      }
      return null;
    }

    function getActiveIntendedTrajectoryInfo(subjectUnit) {
      if (!subjectUnit) return null;

      // Case 1: A unit is selected and has legal moves
      if (
        selectedSquare &&
        selectedSquare.r === subjectUnit.r &&
        selectedSquare.c === subjectUnit.c &&
        Array.isArray(validMoves) &&
        validMoves.length > 0
      ) {
        let targetMove = null;
        if (hoveredSquare) {
          targetMove =
            validMoves.find((m) => m.r === hoveredSquare.r && m.c === hoveredSquare.c) || null;
        }
        // If not hovering a specific legal destination, highlight the top tactical move (prioritizing captures, castling, or forward central advance)
        if (!targetMove) {
          const sorted = [...validMoves].sort((a, b) => {
            const scoreMove = (m) => {
              let sc = 0;
              if (m.capture) sc += 100;
              if (m.castle) sc += 60;
              const centerBias = 3.5 - (Math.abs(3.5 - m.r) + Math.abs(3.5 - m.c)) * 0.5;
              sc += centerBias * 4;
              sc += subjectUnit.color === 'w' ? (7 - m.r) * 2 : m.r * 2;
              return sc;
            };
            return scoreMove(b) - scoreMove(a);
          });
          targetMove = sorted[0] || null;
        }

        if (targetMove) {
          const traj = computeMoveTrajectoryWaypoints(
            subjectUnit,
            subjectUnit.r,
            subjectUnit.c,
            targetMove.r,
            targetMove.c,
            targetMove
          );
          traj.isHoveredTarget = Boolean(
            hoveredSquare && hoveredSquare.r === targetMove.r && hoveredSquare.c === targetMove.c
          );
          return traj;
        }
      }

      // Case 2: Hovering any unit on the board (when no unit is selected) -> preview its primary legal trajectory
      if (
        !selectedSquare &&
        hoveredSquare &&
        hoveredSquare.r === subjectUnit.r &&
        hoveredSquare.c === subjectUnit.c
      ) {
        const hoverMoves = getLegalMovesForPiece(subjectUnit.r, subjectUnit.c);
        if (hoverMoves.length > 0) {
          const bestHoverMove =
            hoverMoves.find((m) => m.capture) ||
            hoverMoves.find((m) => m.castle) ||
            hoverMoves[0];
          const traj = computeMoveTrajectoryWaypoints(
            subjectUnit,
            subjectUnit.r,
            subjectUnit.c,
            bestHoverMove.r,
            bestHoverMove.c,
            bestHoverMove
          );
          traj.isHoveredTarget = false;
          traj.candidateMoves = hoverMoves;
          return traj;
        }
      }

      return null;
    }

    function createFloorBeamBetween(p1, p2, yOffset, width, colorHex, opacity) {
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) return null;
      const geo = new THREE.PlaneGeometry(width, len);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.ownGeo = true;
      mesh.position.set((p1.x + p2.x) * 0.5, BOARD_SURFACE_Y + yOffset, (p1.z + p2.z) * 0.5);
      mesh.rotation.y = Math.atan2(dx, dz);
      mesh.renderOrder = 8;
      return mesh;
    }

    function rebuildUnitPathing3D() {
      clearUnitPathing3D();
      if (pathingDisplayMode === 'OFF' || gameOver) return;

      const subjectUnit = getActivePathingSubjectUnit();
      if (!subjectUnit) return;

      const showHistory = pathingDisplayMode === 'ALL' || pathingDisplayMode === 'HISTORY';
      const showTrajectory = pathingDisplayMode === 'ALL' || pathingDisplayMode === 'TRAJECTORY';

      // =======================================================================
      // 1. RENDER 3D MOVE HISTORY TRAIL (Breadcrumb Nodes + Ribbon + Footsteps)
      // =======================================================================
      const hist = Array.isArray(subjectUnit.pathHistory) ? subjectUnit.pathHistory : [];
      if (showHistory && hist.length >= 1) {
        const originStep = hist[0];
        const originWorld = boardToWorld(originStep.r, originStep.c);

        // Origin Spawn Seal Ring (Amber Gold)
        if (hist.length > 1 || selectedSquare) {
          const originMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            side: THREE.DoubleSide
          });
          const originRing = new THREE.Mesh(sharedOriginCompassGeo, originMat);
          originRing.position.set(originWorld.x, BOARD_SURFACE_Y + 0.006, originWorld.z);
          originRing.renderOrder = 7;
          unitPathingGroup.add(originRing);
          activeHistoryNodes.push({
            mesh: originRing,
            rotSpeed: 0.65,
            baseY: BOARD_SURFACE_Y + 0.006,
            bobAmp: 0
          });
        }

        // Connect consecutive historical steps with glowing amber/gold floor ribbons & directional footprints
        for (let i = 0; i < hist.length - 1; i++) {
          const a = hist[i];
          const b = hist[i + 1];
          const progress = (i + 1) / Math.max(1, hist.length - 1);
          const legColor = b.kind === 'CAPTURE' ? 0xf97316 : b.kind === 'CLASH_REPEL' ? 0xec4899 : 0xfbbf24;
          const legOpacity = 0.32 + progress * 0.45;

          const worldA = boardToWorld(a.r, a.c);
          const targetR = b.kind === 'CLASH_REPEL' && b.targetR !== undefined ? b.targetR : b.r;
          const targetC = b.kind === 'CLASH_REPEL' && b.targetC !== undefined ? b.targetC : b.c;
          const worldB = boardToWorld(targetR, targetC);

          const beam = createFloorBeamBetween(worldA, worldB, 0.0065, 0.036, legColor, legOpacity);
          if (beam) unitPathingGroup.add(beam);

          // Historical directional chevron at the midpoint of each leg
          const dx = worldB.x - worldA.x;
          const dz = worldB.z - worldA.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.05) {
            const chevMat = new THREE.MeshBasicMaterial({
              color: legColor,
              transparent: true,
              opacity: Math.min(0.92, legOpacity + 0.18),
              depthWrite: false
            });
            const chevMesh = new THREE.Mesh(sharedTrajChevronGeo, chevMat);
            chevMesh.position.set(
              worldA.x + dx * 0.55,
              BOARD_SURFACE_Y + 0.022,
              worldA.z + dz * 0.55
            );
            chevMesh.rotation.y = Math.atan2(dx, dz);
            chevMesh.scale.set(0.75, 0.45, 0.75);
            chevMesh.renderOrder = 9;
            unitPathingGroup.add(chevMesh);
          }

          // Breadcrumb node on historical square a (and clash target if CLASH_REPEL)
          const nodeRingMat = new THREE.MeshBasicMaterial({
            color: legColor,
            transparent: true,
            opacity: legOpacity,
            depthWrite: false,
            side: THREE.DoubleSide
          });
          const nodeRing = new THREE.Mesh(sharedHistoryRingGeo, nodeRingMat);
          nodeRing.position.set(worldA.x, BOARD_SURFACE_Y + 0.007, worldA.z);
          nodeRing.renderOrder = 8;
          unitPathingGroup.add(nodeRing);

          const gemMat = new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: legOpacity + 0.15
          });
          const gemMesh = new THREE.Mesh(sharedWaypointDiamondGeo, gemMat);
          gemMesh.position.set(worldA.x, BOARD_SURFACE_Y + 0.042, worldA.z);
          gemMesh.scale.setScalar(0.65 + progress * 0.25);
          gemMesh.renderOrder = 10;
          unitPathingGroup.add(gemMesh);
          activeHistoryNodes.push({
            mesh: gemMesh,
            rotSpeed: 1.8,
            baseY: BOARD_SURFACE_Y + 0.042,
            bobAmp: 0.008,
            phase: i * 1.1
          });
        }
      }

      // =======================================================================
      // 2. RENDER 3D INTENDED TRAJECTORY (Spokes + Parabolic Arc + Marching Chevrons + Stepping Stones)
      // =======================================================================
      if (showTrajectory) {
        const traj = getActiveIntendedTrajectoryInfo(subjectUnit);
        const allMoves =
          selectedSquare &&
          selectedSquare.r === subjectUnit.r &&
          selectedSquare.c === subjectUnit.c
            ? validMoves
            : traj?.candidateMoves || [];

        const startWorld = boardToWorld(subjectUnit.r, subjectUnit.c);

        // Render subtle tactical trajectory spokes to all other valid moves
        if (Array.isArray(allMoves) && allMoves.length > 0) {
          for (const mv of allMoves) {
            if (traj && mv.r === traj.toR && mv.c === traj.toC) continue;
            const mvWorld = boardToWorld(mv.r, mv.c);
            const spokeColor = mv.capture ? 0xef4444 : mv.castle ? 0xfbbf24 : 0x38bdf8;
            const spokeBeam = createFloorBeamBetween(
              startWorld,
              mvWorld,
              0.0055,
              0.014,
              spokeColor,
              0.24
            );
            if (spokeBeam) unitPathingGroup.add(spokeBeam);
          }
        }

        // Render primary Intended Trajectory with 3D Parabolic Energy Arc, Waypoints & Marching Chevrons
        if (traj) {
          const endWorld = boardToWorld(traj.toR, traj.toC);
          const primaryHex = traj.isCapture
            ? 0xef4444
            : traj.isCastle
              ? 0xfbbf24
              : 0x38bdf8;
          const primaryCss = traj.isCapture
            ? '#ef4444'
            : traj.isCastle
              ? '#fbbf24'
              : '#38bdf8';

          // Ground path segments through waypoints (shows exact L-path for Knights or ray for sliding units)
          let prevPt = startWorld;
          for (let wIdx = 0; wIdx < traj.waypoints.length; wIdx++) {
            const wp = traj.waypoints[wIdx];
            const wpWorld = boardToWorld(wp.r, wp.c);
            const segBeam = createFloorBeamBetween(
              prevPt,
              wpWorld,
              0.008,
              traj.isHoveredTarget ? 0.044 : 0.032,
              primaryHex,
              traj.isHoveredTarget ? 0.78 : 0.55
            );
            if (segBeam) unitPathingGroup.add(segBeam);
            prevPt = wpWorld;

            // Stepping stone diamond on intermediate squares
            if (wp.isIntermediate) {
              const stepRingMat = new THREE.MeshBasicMaterial({
                color: primaryHex,
                transparent: true,
                opacity: 0.75,
                depthWrite: false,
                side: THREE.DoubleSide
              });
              const stepRing = new THREE.Mesh(sharedHistoryRingGeo, stepRingMat);
              stepRing.position.set(wpWorld.x, BOARD_SURFACE_Y + 0.0085, wpWorld.z);
              stepRing.renderOrder = 9;
              unitPathingGroup.add(stepRing);

              const wpGemMat = new THREE.MeshBasicMaterial({
                color: 0xe0f2fe,
                transparent: true,
                opacity: 0.9
              });
              const wpGem = new THREE.Mesh(sharedWaypointDiamondGeo, wpGemMat);
              wpGem.position.set(wpWorld.x, BOARD_SURFACE_Y + 0.038, wpWorld.z);
              wpGem.scale.setScalar(wp.isCorner ? 0.95 : 0.78);
              wpGem.renderOrder = 11;
              unitPathingGroup.add(wpGem);
              activeTrajectoryWaypoints.push({
                mesh: wpGem,
                baseY: BOARD_SURFACE_Y + 0.038,
                phase: wIdx * 0.9
              });
            }
          }

          // Parabolic 3D Energy Arc from unit pedestal to target square
          const dx = endWorld.x - startWorld.x;
          const dz = endWorld.z - startWorld.z;
          const worldDist = Math.hypot(dx, dz);
          const arcPeakY =
            BOARD_SURFACE_Y +
            (traj.isKnightJump
              ? 0.34
              : traj.isCapture
                ? Math.min(0.32, 0.14 + worldDist * 0.12)
                : Math.min(0.24, 0.09 + worldDist * 0.08));

          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(startWorld.x, BOARD_SURFACE_Y + 0.05, startWorld.z),
            new THREE.Vector3(
              (startWorld.x + endWorld.x) * 0.5,
              arcPeakY,
              (startWorld.z + endWorld.z) * 0.5
            ),
            new THREE.Vector3(endWorld.x, BOARD_SURFACE_Y + 0.04, endWorld.z)
          );

          const tubeRadius = traj.isHoveredTarget ? 0.013 : 0.0095;
          const tubeGeo = new THREE.TubeGeometry(curve, 28, tubeRadius, 8, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: primaryHex,
            transparent: true,
            opacity: traj.isHoveredTarget ? 0.88 : 0.64,
            depthWrite: false
          });
          const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
          tubeMesh.userData.ownGeo = true;
          tubeMesh.renderOrder = 12;
          unitPathingGroup.add(tubeMesh);

          // Animated Marching Chevrons along the trajectory curve
          const chevronCount = Math.max(3, Math.min(6, Math.round(worldDist / 0.24) + 2));
          for (let cIdx = 0; cIdx < chevronCount; cIdx++) {
            const chevMat = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.92,
              depthWrite: false
            });
            chevMat.color.lerp(new THREE.Color(primaryHex), 0.35);
            const chevMesh = new THREE.Mesh(sharedTrajChevronGeo, chevMat);
            chevMesh.scale.set(0.85, 0.85, 0.85);
            chevMesh.renderOrder = 14;
            unitPathingGroup.add(chevMesh);
            activeTrajectoryChevrons.push({
              mesh: chevMesh,
              curve,
              offset: cIdx / chevronCount
            });
          }

          // Target Lock Ring at destination square
          const lockMat = new THREE.MeshBasicMaterial({
            color: primaryHex,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            side: THREE.DoubleSide
          });
          const lockRing = new THREE.Mesh(sharedTargetLockRingGeo, lockMat);
          lockRing.position.set(endWorld.x, BOARD_SURFACE_Y + 0.009, endWorld.z);
          lockRing.renderOrder = 12;
          unitPathingGroup.add(lockRing);
          activeTargetLockRing = lockRing;

          // Secondary Castling Rook Trajectory Arc (when King castles Kingside or Queenside)
          if (traj.isCastle) {
            const rookFromC = traj.castleSide === 'kingside' ? 7 : 0;
            const rookToC = traj.castleSide === 'kingside' ? 5 : 3;
            const rStart = boardToWorld(traj.fromR, rookFromC);
            const rEnd = boardToWorld(traj.fromR, rookToC);
            const rookCurve = new THREE.QuadraticBezierCurve3(
              new THREE.Vector3(rStart.x, BOARD_SURFACE_Y + 0.05, rStart.z),
              new THREE.Vector3((rStart.x + rEnd.x) * 0.5, BOARD_SURFACE_Y + 0.22, (rStart.z + rEnd.z) * 0.5),
              new THREE.Vector3(rEnd.x, BOARD_SURFACE_Y + 0.04, rEnd.z)
            );
            const rookTubeGeo = new THREE.TubeGeometry(rookCurve, 20, 0.008, 6, false);
            const rookTubeMat = new THREE.MeshBasicMaterial({
              color: 0xfbbf24,
              transparent: true,
              opacity: 0.72,
              depthWrite: false
            });
            const rookTube = new THREE.Mesh(rookTubeGeo, rookTubeMat);
            rookTube.userData.ownGeo = true;
            rookTube.renderOrder = 12;
            unitPathingGroup.add(rookTube);
          }

          // Floating 3D Trajectory Callout Label above the destination square
          const moveTitle = `${traj.fromAlgebraic.toUpperCase()} ➔ ${traj.toAlgebraic.toUpperCase()}`;
          const moveSub = traj.isCapture
            ? `⚔ TẤN CÔNG • ${traj.distance} Ô`
            : traj.isCastle
              ? `🏰 NHẬP THÀNH`
              : traj.isKnightJump
                ? `🐴 NHẢY MÃ CHỮ L • ${traj.distance} Ô`
                : `🧭 DI CHUYỂN • ${traj.distance} Ô`;
          const labelSprite = createPathingLabelSprite(moveTitle, primaryCss, moveSub);
          labelSprite.position.set(endWorld.x, BOARD_SURFACE_Y + 0.28, endWorld.z);
          unitPathingGroup.add(labelSprite);
        }
      }
    }

    function setPathingDisplayMode(mode) {
      const allowed = ['ALL', 'TRAJECTORY', 'HISTORY', 'OFF'];
      if (allowed.includes(mode)) {
        pathingDisplayMode = mode;
      }
      rebuildUnitPathing3D();
      emitPokerChessSync();
      return pathingDisplayMode;
    }

    function cyclePathingDisplayMode() {
      const order = ['ALL', 'TRAJECTORY', 'HISTORY', 'OFF'];
      const idx = order.indexOf(pathingDisplayMode);
      pathingDisplayMode = order[(idx + 1) % order.length];
      soundFX?.playUIClick?.();
      rebuildUnitPathing3D();
      emitPokerChessSync();
      return pathingDisplayMode;
    }

    function clearSquareHighlights() {
      while (squareHighlightsGroup.children.length > 0) {
        const child = squareHighlightsGroup.children[0];
        child.traverse((node) => {
          if (node.isMesh && node.material) {
            node.material.dispose();
          }
        });
        squareHighlightsGroup.remove(child);
      }
      rebuildUnitPathing3D();
    }

    function createFloorTileHighlightMesh(r, c, mode, customTintHex = null) {
      const pos = boardToWorld(r, c);
      const tex = tileGlowTextures[mode] || tileGlowTextures.move;
      const tileMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: mode === 'capture' ? 0.9 : 0.85,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      if (customTintHex !== null) {
        tileMat.color.setHex(customTintHex);
      }
      const tileGlowMesh = new THREE.Mesh(sharedTileGlowGeo, tileMat);
      tileGlowMesh.position.set(pos.x, BOARD_SURFACE_Y + 0.0045, pos.z);
      tileGlowMesh.renderOrder = 6;
      tileGlowMesh.userData = {
        r,
        c,
        highlightType: mode,
        baseOpacity: mode === 'capture' ? 0.9 : 0.85,
        phaseOffset: (r * 3 + c * 5) * 0.35
      };

      // Add crisp 3D inner ring / target beacon on top of the glowing floor tile
      if (mode === 'selected') {
        const ringMat = new THREE.MeshBasicMaterial({
          color: customTintHex ?? 0xf5d76e,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const ringMesh = new THREE.Mesh(sharedSelRingGeo, ringMat);
        ringMesh.position.set(0, 0.004, 0);
        tileGlowMesh.add(ringMesh);
        tileGlowMesh.userData.innerMarker = ringMesh;
        setFloorTileEmissive(r, c, customTintHex ?? 0xd4af37, 0.38);
      } else if (mode === 'capture') {
        const capMat = new THREE.MeshBasicMaterial({
          color: customTintHex ?? 0xef4444,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const capMesh = new THREE.Mesh(sharedCapRingGeo, capMat);
        capMesh.position.set(0, 0.005, 0);
        tileGlowMesh.add(capMesh);
        tileGlowMesh.userData.innerMarker = capMesh;
        setFloorTileEmissive(r, c, customTintHex ?? 0xdc2626, 0.45);
      } else {
        const dotColor = mode === 'castle' ? 0xfbbf24 : (customTintHex ?? 0x38bdf8);
        const dotMat = new THREE.MeshBasicMaterial({
          color: dotColor,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const dotMesh = new THREE.Mesh(sharedMoveDotGeo, dotMat);
        dotMesh.position.set(0, 0.004, 0);
        tileGlowMesh.add(dotMesh);

        const outerMat = new THREE.MeshBasicMaterial({
          color: dotColor,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const outerRing = new THREE.Mesh(sharedMoveOuterRingGeo, outerMat);
        outerRing.position.set(0, 0.0045, 0);
        tileGlowMesh.add(outerRing);

        tileGlowMesh.userData.innerMarker = outerRing;
        setFloorTileEmissive(r, c, dotColor, 0.34);
      }

      return tileGlowMesh;
    }

    function showEmpowerOrUltimateHighlights() {
      clearSquareHighlights();
      if (turnPhase === 'EMPOWER_UNIT') {
        const sealHex = pendingComboEval?.ringColor || 0xf5d76e;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.color === currentTurn) {
              const mesh = createFloorTileHighlightMesh(r, c, 'selected', sealHex);
              squareHighlightsGroup.add(mesh);
            }
          }
        }
      } else if (turnPhase === 'ULTIMATE_TARGETING') {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.color !== currentTurn && p.type !== 'king') {
              const isSelected = ultimateTargetSquares.some((t) => t.r === r && t.c === c);
              const mesh = createFloorTileHighlightMesh(
                r,
                c,
                isSelected ? 'selected' : 'capture',
                isSelected ? 0xf5d76e : 0xe63946
              );
              squareHighlightsGroup.add(mesh);
            }
          }
        }
      }
    }

    function showSquareHighlights(r, c, moves) {
      clearSquareHighlights();
      const selMesh = createFloorTileHighlightMesh(r, c, 'selected');
      squareHighlightsGroup.add(selMesh);

      for (const m of moves) {
        const mode = m.capture ? 'capture' : m.castle ? 'castle' : 'move';
        const moveTileMesh = createFloorTileHighlightMesh(m.r, m.c, mode);
        squareHighlightsGroup.add(moveTileMesh);
      }
      rebuildUnitPathing3D();
    }

    // =========================================================================
    // 3D TACTICAL TILE PING SYSTEM (Visual Beacon Marker + AI Intent Coordinator)
    // =========================================================================
    const TACTICAL_PING_DURATION = 16.0;
    const sharedPingOctRingGeo = new THREE.RingGeometry(0.112, 0.146, 8);
    sharedPingOctRingGeo.rotateX(-Math.PI / 2);
    const sharedPingInnerCompassGeo = new THREE.RingGeometry(0.056, 0.076, 16);
    sharedPingInnerCompassGeo.rotateX(-Math.PI / 2);
    const sharedPingSonarGeo = new THREE.RingGeometry(0.048, 0.072, 32);
    sharedPingSonarGeo.rotateX(-Math.PI / 2);
    const sharedPingPillarGeo = new THREE.CylinderGeometry(0.036, 0.088, 0.42, 16, 1, true);
    const sharedPingCrystalGeo = new THREE.OctahedronGeometry(0.038, 0);
    const sharedPingGyroGeo = new THREE.TorusGeometry(0.062, 0.006, 8, 24);
    const sharedPingBracketArmGeo = new THREE.BoxGeometry(0.048, 0.008, 0.012);

    function createTacticalPingLabelSprite(icon, labelText, algebraic, colorHex) {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
        ctx.strokeStyle = colorHex || '#f5d76e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(10, 12, canvas.width - 20, canvas.height - 24, 18);
        ctx.fill();
        ctx.stroke();

        ctx.font = '800 28px "Cinzel", "Inter", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = colorHex || '#f5d76e';
        ctx.fillText(`${icon} ${labelText.toUpperCase()} [${algebraic.toUpperCase()}]`, canvas.width / 2, canvas.height / 2 + 1);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.38, 0.095, 1);
      sprite.renderOrder = 26;
      return { sprite, tex, mat };
    }

    function disposePingEntry3D(entry) {
      if (!entry || !entry.group) return;
      tacticalPingsGroup.remove(entry.group);
      entry.group.traverse((node) => {
        if (node.material) {
          if (node.material.map) node.material.map.dispose();
          node.material.dispose();
        }
      });
    }

    function clearAllTacticalPings(emitSync = true) {
      while (activeTacticalPings.length > 0) {
        const entry = activeTacticalPings.pop();
        disposePingEntry3D(entry);
      }
      if (emitSync) {
        emitPokerChessSync();
      }
    }

    function removeTacticalPingAt(r, c, emitSync = true) {
      const idx = activeTacticalPings.findIndex((p) => p.r === r && p.c === c);
      if (idx === -1) return false;
      const [removed] = activeTacticalPings.splice(idx, 1);
      disposePingEntry3D(removed);
      if (emitSync) {
        emitPokerChessSync();
      }
      return true;
    }

    function resolveSmartPingIntent(r, c, requestedIntent = 'AUTO') {
      if (requestedIntent && requestedIntent !== 'AUTO' && TACTICAL_PING_INTENTS[requestedIntent]) {
        return requestedIntent;
      }
      const pieceOnSq = boardState[r]?.[c];
      if (pieceOnSq) {
        if (pieceOnSq.color !== playerColor) {
          return 'ATTACK';
        }
        if (turnPhase === 'EMPOWER_UNIT' || turnPhase === 'SELECT_CARDS' || turnPhase === 'DRAW_PHASE') {
          return 'BUFF';
        }
        return 'DEFEND';
      }
      return 'MOVE';
    }

    function createTacticalPingMarker3D(r, c, intentKey) {
      const def = TACTICAL_PING_INTENTS[intentKey] || TACTICAL_PING_INTENTS.MOVE;
      const worldPos = boardToWorld(r, c);
      const alg = toAlgebraic(r, c);
      const group = new THREE.Group();
      group.position.set(worldPos.x, BOARD_SURFACE_Y, worldPos.z);

      // 1. Base Octagonal Tactical Reticle Ring (with polygonOffset to prevent coplanar Z-fighting)
      const octRingMat = new THREE.MeshBasicMaterial({
        color: def.threeHex,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
      const octRingMesh = new THREE.Mesh(sharedPingOctRingGeo, octRingMat);
      octRingMesh.position.y = 0.008;
      octRingMesh.renderOrder = 14;
      group.add(octRingMesh);

      // 2. Inner Rotating Compass Ring
      const compassMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3
      });
      const compassMesh = new THREE.Mesh(sharedPingInnerCompassGeo, compassMat);
      compassMesh.position.y = 0.010;
      compassMesh.renderOrder = 15;
      group.add(compassMesh);

      // 3. Expanding Sonar Pulse Wave Ring
      const sonarMat = new THREE.MeshBasicMaterial({
        color: def.threeHex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const sonarMesh = new THREE.Mesh(sharedPingSonarGeo, sonarMat);
      sonarMesh.position.y = 0.011;
      sonarMesh.renderOrder = 15;
      group.add(sonarMesh);

      // 4. Four Tactical Corner Chevron Brackets framing the tile
      const bracketsGroup = new THREE.Group();
      bracketsGroup.position.y = 0.012;
      const bracketMat = new THREE.MeshStandardMaterial({
        color: def.threeHex,
        emissive: def.threeHex,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.75,
        transparent: true,
        opacity: 0.95
      });
      const cornerSigns = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ];
      const cornerNodes = [];
      for (const [sx, sz] of cornerSigns) {
        const cornerPivot = new THREE.Group();
        const baseCornerDist = 0.128;
        cornerPivot.position.set(sx * baseCornerDist, 0, sz * baseCornerDist);
        cornerPivot.userData = { sx, sz, baseDist: baseCornerDist };

        const armX = new THREE.Mesh(sharedPingBracketArmGeo, bracketMat);
        armX.position.set(-sx * 0.018, 0, 0);
        cornerPivot.add(armX);

        const armZ = new THREE.Mesh(sharedPingBracketArmGeo, bracketMat);
        armZ.rotation.y = Math.PI / 2;
        armZ.position.set(0, 0, -sz * 0.018);
        cornerPivot.add(armZ);

        bracketsGroup.add(cornerPivot);
        cornerNodes.push(cornerPivot);
      }
      group.add(bracketsGroup);

      // 5. Vertical Holographic Beacon Light Column
      const pillarMat = new THREE.MeshBasicMaterial({
        color: def.threeHex,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const pillarMesh = new THREE.Mesh(sharedPingPillarGeo, pillarMat);
      pillarMesh.position.y = 0.21;
      pillarMesh.renderOrder = 16;
      group.add(pillarMesh);

      // 6. Floating 3D Tactical Crystal Finial + Gyro Ring
      const finialAnchor = new THREE.Group();
      const pieceOnSq = boardState[r]?.[c];
      const baseHoverY = pieceOnSq ? (PIECE_HEIGHTS[pieceOnSq.type] || 0.48) + 0.26 : 0.34;
      finialAnchor.position.y = baseHoverY;

      const crystalMat = new THREE.MeshStandardMaterial({
        color: def.threeHex,
        emissive: def.threeHex,
        emissiveIntensity: 1.15,
        roughness: 0.12,
        metalness: 0.82,
        transparent: true,
        opacity: 0.96
      });
      const crystalMesh = new THREE.Mesh(sharedPingCrystalGeo, crystalMat);
      finialAnchor.add(crystalMesh);

      const gyroMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      const gyroMesh = new THREE.Mesh(sharedPingGyroGeo, gyroMat);
      gyroMesh.rotation.x = Math.PI / 3;
      finialAnchor.add(gyroMesh);

      // 7. Floating Tactical Label Sprite above the crystal
      const { sprite: labelSprite } = createTacticalPingLabelSprite(
        def.icon,
        def.label,
        alg,
        def.colorHex
      );
      labelSprite.position.set(0, 0.105, 0);
      finialAnchor.add(labelSprite);

      group.add(finialAnchor);
      tacticalPingsGroup.add(group);

      return {
        group,
        octRingMesh,
        octRingMat,
        compassMesh,
        compassMat,
        sonarMesh,
        sonarMat,
        pillarMesh,
        pillarMat,
        bracketMat,
        cornerNodes,
        finialAnchor,
        crystalMesh,
        crystalMat,
        gyroMesh,
        gyroMat,
        labelSprite,
        baseHoverY
      };
    }

    function pingBoardSquare(r, c, requestedIntent = selectedPingIntent) {
      if (r < 0 || r > 7 || c < 0 || c > 7 || gameOver) return null;

      const existing = activeTacticalPings.find((p) => p.r === r && p.c === c);
      let resolvedIntent = resolveSmartPingIntent(r, c, requestedIntent);

      // If clicking an already-pinged square in AUTO mode, cycle its intent or clear if cycled through
      if (existing) {
        if (requestedIntent === 'AUTO') {
          const cycleOrder = ['ATTACK', 'DEFEND', 'MOVE', 'BUFF'];
          const curIdx = cycleOrder.indexOf(existing.intent);
          if (existing.cycledOnce) {
            removeTacticalPingAt(r, c, true);
            soundFX.playUIClick();
            return null;
          }
          resolvedIntent = cycleOrder[(curIdx + 1) % cycleOrder.length];
          removeTacticalPingAt(r, c, false);
        } else if (existing.intent === resolvedIntent) {
          removeTacticalPingAt(r, c, true);
          soundFX.playUIClick();
          return null;
        } else {
          removeTacticalPingAt(r, c, false);
        }
      }

      // Cap maximum simultaneous tactical pings at 4 (remove oldest if exceeded)
      while (activeTacticalPings.length >= 4) {
        const oldest = activeTacticalPings.shift();
        disposePingEntry3D(oldest);
      }

      const def = TACTICAL_PING_INTENTS[resolvedIntent] || TACTICAL_PING_INTENTS.MOVE;
      const visual = createTacticalPingMarker3D(r, c, resolvedIntent);
      const alg = toAlgebraic(r, c);
      const pieceOnSq = boardState[r]?.[c];
      const unitDesc = pieceOnSq
        ? `${PIECE_NAMES_VI[pieceOnSq.type] || pieceOnSq.type} ${pieceOnSq.color === 'w' ? 'Trắng' : 'Đen'}`
        : `Ô trống ${alg.toUpperCase()}`;

      const entry = {
        id: `ping_${Date.now()}_${r}_${c}`,
        r,
        c,
        algebraic: alg,
        intent: resolvedIntent,
        label: def.label,
        shortLabel: def.shortLabel,
        icon: def.icon,
        colorHex: def.colorHex,
        threeHex: def.threeHex,
        unitDesc,
        cycledOnce: Boolean(existing),
        life: TACTICAL_PING_DURATION,
        maxLife: TACTICAL_PING_DURATION,
        createdAt: performance.now(),
        ...visual
      };

      activeTacticalPings.push(entry);
      soundFX.playTacticalPing?.(resolvedIntent);

      const wPos = boardToWorld(r, c);
      spawnCombatShockwave3D(wPos, def.threeHex, false, false);
      spawnFloatingCombatText(
        wPos,
        `${def.icon} PING ${def.label.toUpperCase()}: ${alg.toUpperCase()}`,
        def.colorHex,
        0.92
      );

      addCombatLog(
        `${def.icon} [Ping Chiến Thuật • ${alg.toUpperCase()}]: Chỉ điểm [${def.label}] tại ${unitDesc} — AI sẽ ưu tiên phối hợp!`,
        'combo'
      );

      emitPokerChessSync();
      return entry;
    }

    function consumeFulfilledTacticalPings(fromR, fromC, toR, toC) {
      if (activeTacticalPings.length === 0) return;
      let changed = false;
      for (let i = activeTacticalPings.length - 1; i >= 0; i--) {
        const p = activeTacticalPings[i];
        const isDestMatch = p.r === toR && p.c === toC;
        const isOriginBuffOrMove =
          p.r === fromR && p.c === fromC && (p.intent === 'MOVE' || p.intent === 'BUFF');
        if (isDestMatch || isOriginBuffOrMove) {
          const wPos = boardToWorld(toR, toC);
          spawnCombatSparks3D(wPos, p.threeHex || 0xf5d76e, 18, 0.9);
          spawnFloatingCombatText(
            wPos,
            `✓ ĐÃ PHỐI HỢP PING [${p.label.toUpperCase()}]!`,
            p.colorHex || '#10b981',
            0.88
          );
          disposePingEntry3D(p);
          activeTacticalPings.splice(i, 1);
          changed = true;
        }
      }
      if (changed) {
        emitPokerChessSync();
      }
    }

    function toggleTacticalPingMode(forceState = null) {
      tacticalPingMode = typeof forceState === 'boolean' ? forceState : !tacticalPingMode;
      soundFX.playUIClick();
      emitPokerChessSync();
      return tacticalPingMode;
    }

    function setTacticalPingIntent(intentId) {
      if (TACTICAL_PING_INTENTS[intentId]) {
        selectedPingIntent = intentId;
        tacticalPingMode = true;
        soundFX.playUIClick();
        emitPokerChessSync();
      }
      return selectedPingIntent;
    }

    // =========================================================================
    // ULTIMATE EXECUTIONS: TỨ QUÝ (THIÊN PHẠT) & THÙNG PHÁ SẢNH (DIỆT THẾ)
    // =========================================================================
    function executeFourKingsDivineJudgment(targetCoords = null) {
      if (isAnimatingMove || gameOver) return false;
      const oppColor = currentTurn === 'w' ? 'b' : 'w';
      let targets = [];
      if (Array.isArray(targetCoords) && targetCoords.length > 0) {
        targets = targetCoords
          .map(({ r, c }) => boardState[r]?.[c])
          .filter((p) => p && p.color === oppColor && p.type !== 'king');
      } else {
        // Auto-pick up to 8 highest-value enemy non-King pieces
        const allEnemies = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.color === oppColor && p.type !== 'king') {
              allEnemies.push(p);
            }
          }
        }
        allEnemies.sort((a, b) => (PIECE_VALUES[b.type] || 100) - (PIECE_VALUES[a.type] || 100));
        targets = allEnemies.slice(0, 8);
      }

      soundFX.playUltimateThunder(false);
      clearSquareHighlights();
      ultimateTargetSquares = [];

      // Golden sky flash & 8 Divine Lightning bolts
      const origFogColor = scene.fog.color.getHex();
      scene.fog.color.setHex(0x4a3810);
      setTimeout(() => {
        scene.fog.color.setHex(origFogColor);
      }, 1400);

      spawnFloatingCombatText(
        new THREE.Vector3(0, BOARD_SURFACE_Y + 0.65, 0),
        `⚡ THIÊN PHẠT — TIÊU DIỆT ${targets.length} QUÂN! ⚡`,
        '#fde047',
        1.25
      );

      targets.forEach((targetPiece, idx) => {
        scheduleBoardTimeout(() => {
          if (!targetPiece || boardState[targetPiece.r]?.[targetPiece.c] !== targetPiece) return;
          const pos = boardToWorld(targetPiece.r, targetPiece.c);
          spawnDivineLightningBeam(pos, 0xf5d76e, 0.11);
          spawnStoneShatter(pos, targetPiece.color);
          removePieceMeshSafely(targetPiece);
          boardState[targetPiece.r][targetPiece.c] = null;
          if (currentTurn === 'w') capturedByWhite += 1;
          else capturedByBlack += 1;
          renderer.shadowMap.needsUpdate = true;
          updateTurnUI();
        }, idx * 95);
      });

      addCombatLog(
        `⚡ TỨ QUÝ — THIÊN PHẠT! ${currentTurn === 'w' ? 'Trắng' : 'Đen'} triệu hồi Tứ Vương xóa sổ tức thời ${targets.length} quân địch!`,
        'ultimate'
      );

      turnPhase = 'MOVE_OR_COMBAT';
      pendingComboEval = null;
      scheduleBoardTimeout(() => {
        updateAllUnitBadges();
        updateTurnUI();
      }, targets.length * 95 + 120);
      return true;
    }

    function executeStraightFlushApocalypse(winnerColor = currentTurn, isRoyal = false) {
      if (gameOver) return false;
      const oppColor = winnerColor === 'w' ? 'b' : 'w';
      soundFX.playUltimateThunder(true);
      clearSquareHighlights();

      const titleCallout = isRoyal
        ? '👑 THÙNG PHÁ SẢNH HOÀNG GIA — DIỆT THẾ TUYỆT ĐỐI! 👑'
        : '🔥 THÙNG PHÁ SẢNH — DIỆT THẾ! 🔥';

      spawnFloatingCombatText(
        new THREE.Vector3(0, BOARD_SURFACE_Y + 0.78, 0),
        titleCallout,
        '#ef4444',
        1.35
      );

      const origFogColor = scene.fog.color.getHex();
      scene.fog.color.setHex(0x581414);
      scheduleBoardTimeout(() => {
        scene.fog.color.setHex(origFogColor);
      }, 2200);

      // Shatter every non-King enemy statue across the board in an apocalyptic wave, then topple the Enemy King!
      const enemyUnits = [];
      let enemyKing = null;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (p && p.color === oppColor) {
            if (p.type === 'king') enemyKing = p;
            else enemyUnits.push(p);
          }
        }
      }

      enemyUnits.forEach((p, idx) => {
        scheduleBoardTimeout(() => {
          if (boardState[p.r]?.[p.c] !== p) return;
          const pos = boardToWorld(p.r, p.c);
          spawnDivineLightningBeam(pos, 0xef4444, 0.12);
          spawnStoneShatter(pos, p.color);
          removePieceMeshSafely(p);
          boardState[p.r][p.c] = null;
          if (winnerColor === 'w') capturedByWhite += 1;
          else capturedByBlack += 1;
        }, idx * 65);
      });

      if (enemyKing) {
        enemyKing.hp = 0;
        const kPos = boardToWorld(enemyKing.r, enemyKing.c);
        spawnDivineLightningBeam(kPos, 0xf5d76e, 0.22);
        updateUnit3DBadge(enemyKing);
      }

      addCombatLog(
        `👑 DIỆT THẾ! ${winnerColor === 'w' ? 'Trắng' : 'Đen'} kích hoạt Thùng Phá Sảnh hủy diệt toàn bộ đội quân và Vua đối phương!`,
        'ultimate'
      );

      gameOver = true;
      turnPhase = 'MOVE_OR_COMBAT';
      pendingComboEval = null;
      triggerCheckmateSequence(oppColor, winnerColor);
      updateTurnUI();
      return true;
    }

    // =========================================================================
    // Stone Shatter Debris Physics (Shared VBO to avoid mid-attack GPU buffer allocation)
    // =========================================================================
    const sharedShardGeo = new THREE.DodecahedronGeometry(1, 0);

    function spawnStoneShatter(worldPos, color) {
      const mat = color === 'w' ? whitePieceMat : blackPieceMat;
      const fragCount = performancePreset === 'performance' ? 14 : 24;
      for (let i = 0; i < fragCount; i++) {
        const sz = 0.024 + Math.random() * 0.048;
        const frag = new THREE.Mesh(sharedShardGeo, mat);
        frag.scale.setScalar(sz);
        frag.position.set(
          worldPos.x + (Math.random() - 0.5) * 0.16,
          worldPos.y + 0.10 + Math.random() * 0.28,
          worldPos.z + (Math.random() - 0.5) * 0.16
        );
        frag.castShadow = false;
        scene.add(frag);
        shatterDebris.push({
          mesh: frag,
          baseScale: sz,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 2.2,
            1.2 + Math.random() * 2.0,
            (Math.random() - 0.5) * 2.2
          ),
          rotVel: new THREE.Vector3(
            Math.random() * 9,
            Math.random() * 9,
            Math.random() * 9
          ),
          life: 2.2
        });
      }
      impactFlashLight.position.set(worldPos.x, worldPos.y + 0.4, worldPos.z);
      impactFlashLight.intensity = 7.5;
    }

    // =========================================================================
    // Concrete 3D Piece Dimensions & Anti-Clipping Collision Constants
    // =========================================================================
    const PIECE_HEIGHTS = {
      pawn: 0.36,
      rook: 0.46,
      knight: 0.50,
      bishop: 0.51,
      queen: 0.55,
      king: 0.59
    };
    const MIN_PIECE_SEP = 0.318; // Stone pedestal diameter is ~0.29m; 0.318m enforces a solid concrete gap
    const MELEE_STANDOFF = 0.36; // Optimal melee standoff (1.06 squares) so sword blades visibly bridge the gap and cleave into defender before burst

    // =========================================================================
    // =========================================================================
    // Hearthstone 4-Step Turn Flow: 1. Draw Cards -> 2. Activate Spell -> 3. Attach Buff -> 4. Move/Combat
    // =========================================================================
    function drawTurnCards() {
      if (gameOver || isAnimatingMove) return false;
      const pState = pokerDecks[currentTurn];
      if (!pState) return false;
      const prevCount = pState.hand.length;
      drawUpToSevenCards(pState, true);
      const drawnCount = Math.max(0, pState.hand.length - prevCount);
      turnPhase = 'SELECT_CARDS';
      soundFX.playCardDraw();
      spawnFloatingCombatText(
        new THREE.Vector3(0, BOARD_SURFACE_Y + 0.62, 0),
        `🃏 BỐC +${drawnCount || 5} LÁ BÀI PHÉP • MANA ${pState.mana}/${pState.maxMana}💎`,
        '#38bdf8',
        0.95
      );
      addCombatLog(
        `🃏 Bước 1 [Bốc Bài]: Phe ${currentTurn === 'w' ? 'Trắng' : 'Đen'} bốc ${drawnCount || 5} lá bài mới (Đầy ${pState.mana}/${pState.maxMana}💎 Mana). Hãy chọn 5 lá để Kích Hoạt Phép!`,
        'info'
      );
      updateTurnUI();
      return true;
    }

    function useManaCoin() {
      if (gameOver || isAnimatingMove) return false;
      const pState = pokerDecks[currentTurn];
      if (!pState || !pState.coinAvailable) return false;
      pState.coinAvailable = false;
      pState.mana = Math.min(10, (pState.mana || 0) + 2);
      soundFX.playManaSpend();
      spawnFloatingCombatText(
        new THREE.Vector3(0, BOARD_SURFACE_Y + 0.58, 0),
        `🪙 ĐỒNG XU LINH LỰC: +2💎 MANA (${pState.mana}/${pState.maxMana})`,
        '#38bdf8',
        0.9
      );
      addCombatLog(
        `🪙 Kích hoạt [Đồng Xu Linh Lực]: Nhận thêm +2💎 Mana trong lượt này (${pState.mana}/${pState.maxMana}💎)!`,
        'info'
      );
      updateTurnUI();
      return true;
    }

    function toggleCardSelectionIndex(idx) {
      if (gameOver || isAnimatingMove) return false;
      const pState = pokerDecks[currentTurn];
      if (!pState) return false;
      if (turnPhase === 'DRAW_PHASE') {
        drawTurnCards();
        return true;
      }
      if (turnPhase !== 'SELECT_CARDS') return false;
      const pos = pState.selectedIndices.indexOf(idx);
      if (pos >= 0) {
        pState.selectedIndices.splice(pos, 1);
      } else {
        if (pState.selectedIndices.length >= 5) {
          pState.selectedIndices.shift();
        }
        pState.selectedIndices.push(idx);
        pState.selectedIndices.sort((a, b) => a - b);
      }
      soundFX.playCardSelect();
      updateTurnUI();
      return true;
    }

    function autoSelectBest5Cards() {
      const pState = pokerDecks[currentTurn];
      if (!pState) return null;
      if (turnPhase === 'DRAW_PHASE') {
        drawTurnCards();
      }
      const best = findBest5Of7(pState.hand);
      pState.selectedIndices = best.indices;
      soundFX.playCardSelect();
      updateTurnUI();
      return best.evaluation;
    }

    function commitSelected5CardCombo() {
      if (gameOver || isAnimatingMove) return null;
      const pState = pokerDecks[currentTurn];
      if (!pState) return null;
      if (turnPhase === 'DRAW_PHASE' || pState.hand.length < 5) {
        drawUpToSevenCards(pState, true);
        turnPhase = 'SELECT_CARDS';
      }
      if (pState.selectedIndices.length !== 5) {
        const best = findBest5Of7(pState.hand);
        pState.selectedIndices = best.indices;
      }
      const picked = pState.selectedIndices.map((i) => pState.hand[i]).filter(Boolean);
      const comboEval = evaluate5CardCombo(picked);
      if (!comboEval) return null;

      const manaCost = comboEval.manaCost || Math.min(5, Math.max(1, comboEval.rank || 2));
      pState.mana = Math.max(0, (pState.mana ?? 5) - manaCost);

      consumeSelected5CardsAndDraw(pState);
      pState.committedComboThisTurn = comboEval;
      pendingComboEval = comboEval;

      soundFX.playManaSpend();

      if (comboEval.isUltimate) {
        if (comboEval.ultimateType === 'APOCALYPSE') {
          executeStraightFlushApocalypse(currentTurn, comboEval.isRoyal);
          return comboEval;
        } else if (comboEval.ultimateType === 'FOUR_KINGS') {
          turnPhase = 'ULTIMATE_TARGETING';
          ultimateTargetSquares = [];
          // Pre-select up to 8 highest-value enemy non-King units so player can either customize or confirm immediately
          const oppColor = currentTurn === 'w' ? 'b' : 'w';
          const cand = [];
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const p = boardState[r][c];
              if (p && p.color === oppColor && p.type !== 'king') {
                cand.push({ r, c, val: PIECE_VALUES[p.type] || 100 });
              }
            }
          }
          cand.sort((a, b) => b.val - a.val);
          ultimateTargetSquares = cand.slice(0, 8).map(({ r, c }) => ({ r, c }));
          showEmpowerOrUltimateHighlights();
          soundFX.playComboEmpower(8);
          addCombatLog(
            `⚡ BƯỚC 2 [KÍCH HOẠT PHÉP HUYỀN THOẠI -${manaCost}💎]: TỨ QUÝ [THIÊN PHẠT]! Hãy chọn tối đa 8 quân địch rồi bấm [GIÁNG THIÊN PHẠT]!`,
            'ultimate'
          );
          updateTurnUI();
          return comboEval;
        }
      }

      turnPhase = 'EMPOWER_UNIT';
      soundFX.playComboEmpower(comboEval.rank);
      showEmpowerOrUltimateHighlights();
      spawnFloatingCombatText(
        new THREE.Vector3(0, BOARD_SURFACE_Y + 0.65, 0),
        `🔥 KÍCH HOẠT PHÉP: ${comboEval.name.toUpperCase()} (-${manaCost}💎) ➔ CHỌN QUÂN GẮN BUFF!`,
        comboEval.colorHex || '#f5d76e',
        0.95
      );
      addCombatLog(
        `🔥 Bước 2 [Kích Hoạt Phép -${manaCost}💎]: ${currentTurn === 'w' ? 'Trắng' : 'Đen'} kích hoạt [${comboEval.name}] (${comboEval.cardsSummary}) → Bước 3: Hãy chọn 1 quân đồng minh để Gắn Buff!`,
        'combo'
      );
      updateTurnUI();
      return comboEval;
    }

    function empowerFriendlyUnitAt(r, c, options = {}) {
      const piece = boardState[r]?.[c];
      if (!piece || piece.color !== currentTurn) return false;
      const appliedCombo =
        pendingComboEval ||
        pokerDecks[currentTurn]?.committedComboThisTurn || {
          id: 'HIGH_CARD',
          name: 'Mậu Thầu',
          rank: 1,
          atkBonus: 2,
          armorBonus: 0,
          healInstant: 0,
          colorHex: '#f5d76e',
          ringColor: 0xf5d76e
        };
      const res = applyComboEmpowermentToUnit(piece, appliedCombo, boardState, turnNumber);
      if (gameMode === 'multi' && !options?.fromRemote) {
        multiplayerClient.sendPokerBuff({
          targetRow: r,
          targetCol: c,
          targetPieceType: piece.type,
          comboId: appliedCombo.id,
          comboName: appliedCombo.name,
          atkBonus: res.atkBonus,
          armorBonus: res.armorBonus,
          healInstant: res.healInstant,
          colorHex: appliedCombo.colorHex
        });
      }
      soundFX.playComboEmpower(appliedCombo.rank || 1);
      const wPos = boardToWorld(r, c);
      spawnDivineLightningBeam(wPos, appliedCombo.ringColor || 0xf5d76e, 0.075);
      spawnFloatingCombatText(
        wPos,
        `✦ BUFF ${appliedCombo.name.toUpperCase()}: +${res.atkBonus}⚔${res.armorBonus > 0 ? ` +${res.armorBonus}🛡` : ''}${res.healInstant > 0 ? ` +${res.healInstant}❤` : ''}`,
        appliedCombo.colorHex || '#f5d76e',
        0.95
      );
      addCombatLog(
        `✦ Bước 3 [Gắn Buff]: ${res.unitName} (${String.fromCharCode(97 + c)}${8 - r}) nhận Buff [${res.comboName}] (+${res.atkBonus}⚔ Công${res.armorBonus ? `, +${res.armorBonus}🛡 Giáp` : ''}${res.healInstant ? `, Hồi +${res.healInstant}❤ HP` : ''}) → Bước 4: Đi Quân & Combat mở khóa!`,
        'empower'
      );
      lastEmpoweredSquare = { r, c };
      pendingComboEval = null;
      turnPhase = 'MOVE_OR_COMBAT';
      const buffPingIdx = activeTacticalPings.findIndex(
        (p) => p.r === r && p.c === c && p.intent === 'BUFF'
      );
      if (buffPingIdx !== -1) {
        const [fulfilledBuffPing] = activeTacticalPings.splice(buffPingIdx, 1);
        disposePingEntry3D(fulfilledBuffPing);
      }
      updateAllUnitBadges();
      // Immediately select the empowered unit (or a frontline movable unit if the empowered unit is blocked) so legal moves glow right away!
      let selR = r;
      let selC = c;
      let moves = getLegalMovesForPiece(selR, selC);
      if (!moves || moves.length === 0) {
        const fallback = findBestMovableFriendlyUnit(currentTurn);
        if (fallback) {
          selR = fallback.r;
          selC = fallback.c;
          moves = fallback.moves;
        }
      }
      selectedSquare = { r: selR, c: selC };
      validMoves = moves || [];
      showSquareHighlights(selR, selC, validMoves);
      updateTurnUI();
      return true;
    }

    function endPlayerTurnNow() {
      if (gameOver || isAnimatingMove) return false;
      return handleTurnTimeout();
    }

    // =========================================================================
    // Smooth Attack Camera, Simultaneous RPG Combat & Move Execution Choreography
    // =========================================================================
    function executeChessMove(fromR, fromC, toR, toC, options = {}) {
      const piece = boardState[fromR]?.[fromC];
      if (!piece || isAnimatingMove || gameOver) return false;
      if (piece.color !== currentTurn) return false;

      const targetOnDest = boardState[toR]?.[toC];
      if (targetOnDest && targetOnDest.color === piece.color) {
        return false;
      }

      // Seamless Auto-Draw, Auto-Commit & Auto-Empower if a programmatic call / script / AI moves a piece directly
      if (
        !options.skipAutoPoker &&
        (turnPhase === 'DRAW_PHASE' || turnPhase === 'SELECT_CARDS' || turnPhase === 'EMPOWER_UNIT')
      ) {
        if (turnPhase === 'DRAW_PHASE') {
          drawUpToSevenCards(pokerDecks[currentTurn], false);
          turnPhase = 'SELECT_CARDS';
        }
        if (turnPhase === 'SELECT_CARDS') {
          commitSelected5CardCombo();
          if (gameOver || turnPhase === 'ULTIMATE_TARGETING') {
            if (options.fromScript || options.fromAI) {
              if (turnPhase === 'ULTIMATE_TARGETING') {
                executeFourKingsDivineJudgment(ultimateTargetSquares);
              }
            }
            if (gameOver) return true;
          }
        }
        if (turnPhase === 'EMPOWER_UNIT' && pendingComboEval) {
          applyComboEmpowermentToUnit(piece, pendingComboEval, boardState, turnNumber);
          lastEmpoweredSquare = { r: fromR, c: fromC };
          pendingComboEval = null;
          turnPhase = 'MOVE_OR_COMBAT';
          updateUnit3DBadge(piece);
        }
      }

      if (!options.fromRemote) {
        const legalForPiece = getLegalMovesForPiece(fromR, fromC);
        if (!legalForPiece.some((m) => m.r === toR && m.c === toC)) {
          return false;
        }
      }

      if (preMoveHighlightTask) {
        preMoveHighlightTask = null;
      }

      moveHistory.push({
        snapshot: captureBoardSnapshot(),
        move: {
          color: piece.color,
          pieceType: piece.type,
          fromR,
          fromC,
          toR,
          toC,
          capture: Boolean(targetOnDest),
          promotion: options.promotion || 'queen'
        }
      });

      if (options.fromScript) {
        scriptCursor = Math.min(scriptMoves.length, scriptCursor + 1);
      } else if (!scriptDeviated && scriptCursor < scriptMoves.length) {
        const expected = scriptMoves[scriptCursor];
        if (
          expected &&
          expected.fromR === fromR &&
          expected.fromC === fromC &&
          expected.toR === toR &&
          expected.toC === toC
        ) {
          scriptCursor = Math.min(scriptMoves.length, scriptCursor + 1);
        } else {
          scriptDeviated = true;
          scriptedGameActive = false;
        }
      } else if (scriptMoves.length > 0) {
        scriptDeviated = true;
        scriptedGameActive = false;
      }
      if (typeof updateScriptBarUI === 'function') updateScriptBarUI();

      const captured = targetOnDest;
      const isCapture = Boolean(captured);

      // Evaluate Simultaneous RPG Combat if moving onto an enemy unit
      const combatSim = isCapture
        ? simulateRPGCombat(piece, captured, fromR, fromC, toR, toC, boardState)
        : null;

      isAnimatingMove = true;
      moveAnimationStartTime = performance.now();
      soundFX.stopLowTimeTickingLoop(true);
      activeCamTransition = null;
      clearSquareHighlights();
      consumeFulfilledTacticalPings(fromR, fromC, toR, toC);
      selectedSquare = null;
      validMoves = [];
      updateTurnUI();

      if (gameMode === 'multi' && !options.fromRemote) {
        multiplayerClient.sendChessMove({
          from: { r: fromR, c: fromC },
          to: { r: toR, c: toC },
          pieceType: piece.type
        });
        if (roomCode) {
          sendMultiplayerMove({
            playerToken,
            color: piece.color,
            from: { r: fromR, c: fromC },
            to: { r: toR, c: toC },
            promotion: 'queen'
          });
        }
      }

      const startPos = boardToWorld(fromR, fromC);
      const endPos = boardToWorld(toR, toC);
      const dx = endPos.x - startPos.x;
      const dz = endPos.z - startPos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const moveHeading = Math.atan2(dx, dz);
      piece.mesh.rotation.y = moveHeading;
      playPieceClip(piece, 'Move', true, 0.10);

      const isCastling = piece.type === 'king' && fromR === toR && Math.abs(toC - fromC) === 2;
      const castleRookFromC = isCastling ? (toC > fromC ? 7 : 0) : -1;
      const castleRookToC = isCastling ? (toC > fromC ? 5 : 3) : -1;
      const castleRook = isCastling ? boardState[fromR][castleRookFromC] : null;
      const castleRookStartPos = castleRook ? boardToWorld(fromR, castleRookFromC) : null;
      const castleRookEndPos = castleRook ? boardToWorld(fromR, castleRookToC) : null;
      if (castleRook && castleRook.mesh) {
        const rDx = castleRookEndPos.x - castleRookStartPos.x;
        const rDz = castleRookEndPos.z - castleRookStartPos.z;
        castleRook.mesh.rotation.y = Math.atan2(rDx, rDz);
        playPieceClip(castleRook, 'Move', true, 0.10);
      }

      if (isCapture && captured && captured.mesh) {
        captured.mesh.rotation.y = Math.atan2(-dx, -dz);
      }

      const stopOffset = isCapture ? Math.min(MELEE_STANDOFF, dist * 0.76) : 0;
      const strikePos = new THREE.Vector3(
        endPos.x - dirX * stopOffset,
        BOARD_SURFACE_Y,
        endPos.z - dirZ * stopOffset
      );

      const bystanders = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const other = boardState[r][c];
          if (other && other !== piece && other !== captured && other.mesh) {
            bystanders.push({
              piece: other,
              homePos: boardToWorld(r, c),
              height: PIECE_HEIGHTS[other.type] || 0.45
            });
          }
        }
      }

      const segDx = (isCapture ? strikePos.x : endPos.x) - startPos.x;
      const segDz = (isCapture ? strikePos.z : endPos.z) - startPos.z;
      const segLen = Math.hypot(segDx, segDz) || 0.001;
      const segUx = segDx / segLen;
      const segUz = segDz / segLen;
      const segPerpX = -segUz;
      const segPerpZ = segUx;

      let knightLateralSign = 0;
      let knightVaultPeak = 0;
      if (piece.type === 'knight') {
        let blockedPosSide = false;
        let blockedNegSide = false;
        let maxBlockerHeight = 0;
        for (const b of bystanders) {
          const relX = b.homePos.x - startPos.x;
          const relZ = b.homePos.z - startPos.z;
          const proj = relX * segUx + relZ * segUz;
          if (proj > 0.04 && proj < segLen - 0.04) {
            const signedPerp = relX * segPerpX + relZ * segPerpZ;
            if (Math.abs(signedPerp) < MIN_PIECE_SEP) {
              if (signedPerp >= 0) blockedPosSide = true;
              if (signedPerp <= 0) blockedNegSide = true;
              if (b.height > maxBlockerHeight) maxBlockerHeight = b.height;
            }
          }
        }
        if (blockedPosSide && !blockedNegSide) {
          knightLateralSign = -1;
        } else if (blockedNegSide && !blockedPosSide) {
          knightLateralSign = 1;
        } else if (blockedPosSide && blockedNegSide) {
          knightVaultPeak = maxBlockerHeight + 0.09;
        }
      }

      function resetBystandersToHome() {
        for (const b of bystanders) {
          b.piece.mesh.position.copy(b.homePos);
        }
      }

      const isDiagonalSlide =
        Math.abs(toR - fromR) === Math.abs(toC - fromC) &&
        Math.abs(toR - fromR) >= 1 &&
        piece.type !== 'knight';

      function applyConcreteTrajectory(u, fromVec, toVec) {
        const ease = isCapture ? (0.28 * u + 0.72 * easeInOutCubic(u)) : easeInOutCubic(u);
        let bx = fromVec.x + (toVec.x - fromVec.x) * ease;
        let bz = fromVec.z + (toVec.z - fromVec.z) * ease;
        let by = BOARD_SURFACE_Y;

        const archSin = Math.sin(u * Math.PI);

        if (piece.type === 'knight') {
          if (knightLateralSign !== 0) {
            bx += segPerpX * knightLateralSign * 0.165 * archSin;
            bz += segPerpZ * knightLateralSign * 0.165 * archSin;
            by = BOARD_SURFACE_Y + archSin * 0.06;
          } else if (knightVaultPeak > 0) {
            by = BOARD_SURFACE_Y + Math.pow(archSin, 0.65) * knightVaultPeak;
          } else {
            by = BOARD_SURFACE_Y + archSin * 0.06;
          }
        }

        const effectiveMinSep = isDiagonalSlide ? 0.262 : MIN_PIECE_SEP;
        for (const b of bystanders) {
          const hx = b.homePos.x;
          const hz = b.homePos.z;
          const dHomeX = bx - hx;
          const dHomeZ = bz - hz;
          const dHome = Math.hypot(dHomeX, dHomeZ);

          if (by >= BOARD_SURFACE_Y + b.height + 0.025) {
            b.piece.mesh.position.copy(b.homePos);
            continue;
          }

          if (dHome < 0.36 && dHome > 0.001 && knightVaultPeak === 0) {
            const yieldProx = Math.max(0, (0.36 - dHome) / 0.36) * archSin;
            const yieldDist = Math.min(0.068, yieldProx * 0.082);
            b.piece.mesh.position.set(
              hx - (dHomeX / dHome) * yieldDist,
              BOARD_SURFACE_Y,
              hz - (dHomeZ / dHome) * yieldDist
            );
          } else {
            b.piece.mesh.position.copy(b.homePos);
          }

          const curBx = b.piece.mesh.position.x;
          const curBz = b.piece.mesh.position.z;
          const sepX = bx - curBx;
          const sepZ = bz - curBz;
          const sepDist = Math.hypot(sepX, sepZ);

          if (sepDist < effectiveMinSep) {
            if (piece.type === 'knight' && knightVaultPeak > 0) {
              by = Math.max(by, BOARD_SURFACE_Y + b.height + 0.03);
            } else if (sepDist > 0.0001) {
              const push = effectiveMinSep - sepDist;
              bx += (sepX / sepDist) * push;
              bz += (sepZ / sepDist) * push;
            } else {
              bx += segPerpX * effectiveMinSep;
              bz += segPerpZ * effectiveMinSep;
            }
          }
        }

        piece.mesh.position.set(bx, by, bz);
      }

      const savedCamPos = camera.position.clone();
      const savedTarget = orbitControls.target.clone();

      const midPoint = new THREE.Vector3(
        (strikePos.x + endPos.x) * 0.5,
        BOARD_SURFACE_Y + 0.32,
        (strikePos.z + endPos.z) * 0.5
      );

      const perpA = new THREE.Vector3(-dirZ, 0, dirX);
      const perpB = new THREE.Vector3(dirZ, 0, -dirX);
      const camFromMid = new THREE.Vector3().subVectors(savedCamPos, midPoint);
      const prefPerp = camFromMid.dot(perpA) >= 0 ? perpA : perpB;
      const altPerp = prefPerp === perpA ? perpB : perpA;

      function scoreDuelPerpOcclusion(perpVec) {
        let penalty = 0;
        const probes = [
          { perpMul: 1.24, dirMul: -0.34 },
          { perpMul: 0.92, dirMul: 0.14 }
        ];
        for (const pr of probes) {
          const camX = midPoint.x + perpVec.x * pr.perpMul + dirX * pr.dirMul;
          const camZ = midPoint.z + perpVec.z * pr.perpMul + dirZ * pr.dirMul;
          const rayX = midPoint.x - camX;
          const rayZ = midPoint.z - camZ;
          const rayLenSq = Math.max(0.0001, rayX * rayX + rayZ * rayZ);
          for (const b of bystanders) {
            const bPos = b.piece && b.piece.mesh ? b.piece.mesh.position : b.homePos;
            if (!bPos) continue;
            const px = bPos.x - camX;
            const pz = bPos.z - camZ;
            const t = (px * rayX + pz * rayZ) / rayLenSq;
            if (t > 0.10 && t < 0.98) {
              const cx = camX + rayX * t;
              const cz = camZ + rayZ * t;
              const distB = Math.hypot(bPos.x - cx, bPos.z - cz);
              if (distB < 0.44) {
                penalty += (0.44 - distB) * 12.0;
              }
            }
          }
        }
        return penalty;
      }

      const chosenPerp =
        scoreDuelPerpOcclusion(prefPerp) > scoreDuelPerpOcclusion(altPerp) + 0.25 ? altPerp : prefPerp;

      const duelCamMid = new THREE.Vector3(
        midPoint.x + chosenPerp.x * 1.55 - dirX * 0.32,
        BOARD_SURFACE_Y + 1.20,
        midPoint.z + chosenPerp.z * 1.55 - dirZ * 0.32
      );
      const duelCamClose = new THREE.Vector3(
        midPoint.x + chosenPerp.x * 1.30 + dirX * 0.10,
        BOARD_SURFACE_Y + 1.02,
        midPoint.z + chosenPerp.z * 1.30 + dirZ * 0.10
      );
      const duelTargetStart = new THREE.Vector3(
        strikePos.x + dirX * 0.08,
        BOARD_SURFACE_Y + 0.38,
        strikePos.z + dirZ * 0.08
      );
      const duelTargetEnd = new THREE.Vector3(
        endPos.x - dirX * 0.04,
        BOARD_SURFACE_Y + 0.36,
        endPos.z - dirZ * 0.04
      );

      function evalQuadraticBezier(outVec, p0, p1, p2, t) {
        const inv = 1 - t;
        const c0 = inv * inv;
        const c1 = 2 * inv * t;
        const c2 = t * t;
        outVec.set(
          c0 * p0.x + c1 * p1.x + c2 * p2.x,
          c0 * p0.y + c1 * p1.y + c2 * p2.y,
          c0 * p0.z + c1 * p1.z + c2 * p2.z
        );
      }

      if (isCapture) {
        activeDuelSavedCam = {
          pos: savedCamPos.clone(),
          target: savedTarget.clone()
        };
        orbitControls.enabled = false;
        cameraTelemetry.lastAttackSamples = [];
        cameraTelemetry.attackCount += 1;
        cameraTelemetry.maxStepDelta = 0;
        cameraTelemetry.minCombatSeparation = Infinity;
        // Immediate tactile melee collision engagement pulse for mobile devices
        const isLethalOutcome = Boolean(
          combatSim &&
            (combatSim.outcome === 'BREAKTHROUGH' ||
              combatSim.outcome === 'COUNTER_KILL' ||
              combatSim.outcome === 'MUTUAL_DESTRUCTION')
        );
        triggerCombatHapticFeedback({
          stage: 'melee_collision',
          isKill: isLethalOutcome,
          attackerType: piece.type,
          defenderType: captured?.type
        });
      } else {
        cameraTelemetry.lastSpaceMoveSamples = [];
      }

      const squaresMoved = Math.max(1, Math.hypot(toR - fromR, toC - fromC));
      const stdMoveDuration = Number((0.28 + Math.max(0, squaresMoved - 1) * 0.04).toFixed(3));
      const atkProfile = ATTACK_SYNC_PROFILES[piece.type] || ATTACK_SYNC_PROFILES.queen;
      const defProfile = ATTACK_SYNC_PROFILES[captured?.type] || ATTACK_SYNC_PROFILES.queen;
      const atkSpeed = atkProfile.timeScale * 2.2;
      const defSpeed = defProfile.timeScale * 2.2;
      const SWING_START_CLIP_TIME = atkProfile.swingStartClip;
      const CONTACT_CLIP_TIME = atkProfile.contactClip;
      const BLOW_CLIP_TIME = atkProfile.blowClip;
      const DEF_CONTACT_CLIP_TIME = defProfile.contactClip;
      const DEF_BLOW_CLIP_TIME = defProfile.blowClip;

      const tApproach = isCapture
        ? Number((0.22 + Math.max(0, squaresMoved - 1) * 0.035).toFixed(3))
        : stdMoveDuration;
      const tContact = isCapture ? (tApproach + CONTACT_CLIP_TIME / atkSpeed) : stdMoveDuration;
      const tImpact = isCapture ? (tApproach + BLOW_CLIP_TIME / atkSpeed) : stdMoveDuration;
      const canCounterAttack = Boolean(
        isCapture && combatSim && !combatSim.firstStrikeTriggered && combatSim.defCounterDmg > 0
      );
      const tCounterStart = canCounterAttack ? Number((tImpact + 0.04).toFixed(3)) : tImpact;
      const tCounterContact = canCounterAttack
        ? Number((tCounterStart + DEF_CONTACT_CLIP_TIME / defSpeed).toFixed(3))
        : tImpact;
      const tCounterImpact = canCounterAttack
        ? Number((tCounterStart + DEF_BLOW_CLIP_TIME / defSpeed).toFixed(3))
        : tImpact;
      const tShatterResolve = isCapture
        ? Number(((canCounterAttack ? tCounterImpact : tImpact) + 0.06).toFixed(3))
        : stdMoveDuration;
      const tStrikeDone = isCapture ? Number((tShatterResolve + 0.08).toFixed(3)) : stdMoveDuration;
      const camReturnDist = savedCamPos.distanceTo(duelCamClose);
      const returnDuration = isCapture ? Number((0.22 + Math.min(0.08, camReturnDist * 0.02)).toFixed(3)) : 0;
      const totalDuration = isCapture ? (tStrikeDone + returnDuration) : stdMoveDuration;

      const atkHpStart = piece.hp;
      const defHpStart = captured ? captured.hp : 0;
      piece.displayHp = atkHpStart;
      piece.trailHp = atkHpStart;
      if (captured) {
        captured.displayHp = defHpStart;
        captured.trailHp = defHpStart;
      }

      if (!isCapture) {
        cameraTelemetry.lastSpaceMoveDuration = stdMoveDuration;
        cameraTelemetry.lastSquaresMoved = Number(squaresMoved.toFixed(3));
      } else {
        cameraTelemetry.lastCaptureTiming = {
          pieceType: piece.type,
          squaresMoved: Number(squaresMoved.toFixed(3)),
          tApproach: Number(tApproach.toFixed(3)),
          tContact: Number(tContact.toFixed(3)),
          tImpact: Number(tImpact.toFixed(3)),
          tCounterStart: Number(tCounterStart.toFixed(3)),
          tCounterImpact: Number(tCounterImpact.toFixed(3)),
          tStrikeDone: Number(tStrikeDone.toFixed(3)),
          returnDuration: Number(returnDuration.toFixed(3)),
          totalDuration: Number(totalDuration.toFixed(3))
        };
      }

      let elapsed = 0;
      let attackAnimStarted = false;
      let defenderFlinchTriggered = false;
      let shatterTriggered = false;
      let beat1ImpactTime = tImpact;
      let counterSwingStarted = false;
      let counterContactTriggered = false;
      let counterImpactTriggered = false;
      let lethalShatterTriggered = false;
      let impactActualTime = tCounterImpact;
      let nextFootstepElapsed = 0.08;
      const postShatterPiecePos = strikePos.clone();
      const postStrikePiecePos = strikePos.clone();
      let prevCamPos = camera.position.clone();
      let prevPiecePos = piece.mesh.position.clone();

      if (isCapture && captured && combatSim) {
        soundFX.setBattleMusicIntensity('combat');
        piece.combatAnimState = 'MELEE_ATTACK';
        piece.combatAnimTimer = 2.2;
        captured.combatAnimState = 'MELEE_DEFEND';
        captured.combatAnimTimer = 2.2;
        activeCombatBanner = null;
      } else {
        soundFX.playFootstepMarch(piece.type);
      }

      function finishMove() {
        try {
          resetBystandersToHome();
        if (isCapture) {
          activeCombatBanner = null;
          soundFX.setBattleMusicIntensity('normal');
        }

        const finishSide = currentTurn;
        const oppSide = finishSide === 'w' ? 'b' : 'w';

        if (!isCapture) {
          // Non-combat movement to open square
          lastAggressorInfo = null;
          boardState[fromR][fromC] = null;
          boardState[toR][toC] = piece;
          piece.r = toR;
          piece.c = toC;
          piece.hasMoved = true;

          // HIGH_CARD (Mậu Thầu) Mulligan Pulse: +4 HP if ending turn without combat
          if (piece.activeCombo?.id === 'HIGH_CARD' && piece.hp < piece.maxHp) {
            piece.hp = Math.min(piece.maxHp, piece.hp + 4);
            spawnFloatingCombatText(endPos, '+4 HP (Mậu Thầu)', '#22c55e', 0.72);
          }

          // Bishop Lv.3 Awakening: Heal lowest-HP adjacent ally by +3 HP when moving to open square
          if (piece.type === 'bishop' && piece.level >= 3) {
            let lowestAlly = null;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const ally = boardState[toR + dr]?.[toC + dc];
                if (ally && ally.color === piece.color && ally.hp < ally.maxHp) {
                  if (!lowestAlly || ally.hp < lowestAlly.hp) lowestAlly = ally;
                }
              }
            }
            if (lowestAlly) {
              lowestAlly.hp = Math.min(lowestAlly.maxHp, lowestAlly.hp + 3);
              updateUnit3DBadge(lowestAlly);
              spawnFloatingCombatText(boardToWorld(lowestAlly.r, lowestAlly.c), '+3 HP (Chúc Phúc)', '#4ade80', 0.7);
            }
          }

          if (!Array.isArray(piece.pathHistory)) {
            piece.pathHistory = [
              { r: fromR, c: fromC, algebraic: toAlgebraic(fromR, fromC), turn: 0, kind: 'SPAWN' }
            ];
          }
          piece.pathHistory.push({
            r: toR,
            c: toC,
            fromR,
            fromC,
            algebraic: toAlgebraic(toR, toC),
            turn: turnNumber,
            kind: isCastling ? 'CASTLE' : 'MOVE'
          });

          if (isCastling && castleRook) {
            boardState[fromR][castleRookFromC] = null;
            boardState[fromR][castleRookToC] = castleRook;
            castleRook.r = fromR;
            castleRook.c = castleRookToC;
            castleRook.hasMoved = true;
            if (!Array.isArray(castleRook.pathHistory)) {
              castleRook.pathHistory = [
                {
                  r: fromR,
                  c: castleRookFromC,
                  algebraic: toAlgebraic(fromR, castleRookFromC),
                  turn: 0,
                  kind: 'SPAWN'
                }
              ];
            }
            castleRook.pathHistory.push({
              r: fromR,
              c: castleRookToC,
              fromR,
              fromC: castleRookFromC,
              algebraic: toAlgebraic(fromR, castleRookToC),
              turn: turnNumber,
              kind: 'CASTLE'
            });
            if (castleRook.mesh) {
              castleRook.mesh.position.copy(castleRookEndPos);
              castleRook.mesh.rotation.y = castleRook.color === 'w' ? Math.PI : 0;
            }
            playPieceClip(castleRook, 'Idle', true, 0.18);
          }

          // Pawn Promotion to Queen on reaching back rank (Inherits Level, Active Combo & heals +10 HP)
          if (piece.type === 'pawn' && (toR === 0 || toR === 7)) {
            const inheritedLvl = piece.level || 1;
            const inheritedCombo = piece.activeCombo ? { ...piece.activeCombo } : null;
            const inheritedArmor = piece.armor || 0;
            const inheritedHistory = Array.isArray(piece.pathHistory)
              ? piece.pathHistory.map((st) => ({ ...st }))
              : [];
            scene.remove(piece.mesh);
            const promoted = instantiatePiece('queen', piece.color, toR, toC, inheritedLvl);
            promoted.hasMoved = true;
            promoted.activeCombo = inheritedCombo;
            promoted.armor = inheritedArmor;
            promoted.hp = Math.min(promoted.maxHp, piece.hp + 10);
            if (inheritedHistory.length > 0) {
              promoted.pathHistory = inheritedHistory;
            }
            updateUnit3DBadge(promoted);
            boardState[toR][toC] = promoted;
            soundFX.playLevelUp();
            spawnFloatingCombatText(endPos, '👑 PHONG HẬU! (+10 HP)', '#fde047', 1.0);
          } else {
            piece.mesh.position.copy(endPos);
            piece.mesh.rotation.y = piece.color === 'w' ? Math.PI : 0;
            playPieceClip(piece, 'Idle', true, 0.18);
            updateUnit3DBadge(piece);
          }

          // Announce Consecrated / Corrupted Tile Modifier when stepping onto a special square
          const landedTileMod = getBoardTileModifier(toR, toC);
          if (landedTileMod) {
            const isConsec = landedTileMod.id === 'CONSECRATED';
            spawnFloatingCombatText(
              new THREE.Vector3(endPos.x, endPos.y + 0.18, endPos.z),
              isConsec ? '☀️ Ô THÁNH HÓA (+1⚔ / +1🛡)' : '☠️ Ô THA HÓA (-1⚔ / -1🛡)',
              isConsec ? '#fde047' : '#e879f9',
              0.82
            );
            addCombatLog(
              `${landedTileMod.icon} ${UNIT_BASE_STATS[piece.type]?.name || piece.type} tiến vào ${landedTileMod.nameVi} tại ${toAlgebraic(toR, toC).toUpperCase()} (${isConsec ? '+1⚔ Công, +1🛡 Giáp' : '-1⚔ Công, -1🛡 Giáp'})!`,
              isConsec ? 'gold' : 'danger'
            );
          }
        } else if (combatSim) {
          // ===================================================================
          // Resolve Simultaneous RPG Combat Outcome on Board
          // ===================================================================
          piece.hp = combatSim.atkHpAfter;
          piece.displayHp = combatSim.atkHpAfter;
          piece.trailHp = combatSim.atkHpAfter;
          piece.armor = combatSim.atkArmorAfter;
          captured.hp = combatSim.defHpAfter;
          captured.displayHp = combatSim.defHpAfter;
          captured.trailHp = combatSim.defHpAfter;
          captured.armor = combatSim.defArmorAfter;
          if (captured.type === 'queen') {
            captured.attacksTakenThisRound = (captured.attacksTakenThisRound || 0) + 1;
          }

          // Consume active Poker Combo Seals after participating in combat (Rule 4.3)
          piece.activeCombo = null;
          captured.activeCombo = null;

          // Royal Guard Sacrifice Damage application
          if (combatSim.guardPiece && combatSim.guardInterceptDmg > 0) {
            combatSim.guardPiece.hp = Math.max(1, combatSim.guardPiece.hp - combatSim.guardInterceptDmg);
            updateUnit3DBadge(combatSim.guardPiece);
            spawnFloatingCombatText(
              boardToWorld(combatSim.guardPiece.r, combatSim.guardPiece.c),
              `🛡 ĐỠ ĐÒN -${combatSim.guardInterceptDmg} HP`,
              '#38bdf8',
              0.75
            );
          }

          // FLUSH (Thùng) Elemental Cleave Splash Damage
          if (Array.isArray(combatSim.flushSplashTargets) && combatSim.flushSplashTargets.length > 0) {
            for (const sp of combatSim.flushSplashTargets) {
              const spUnit = boardState[sp.r]?.[sp.c];
              if (!spUnit) continue;
              spUnit.hp = Math.max(0, spUnit.hp - sp.dmg);
              const spPos = boardToWorld(sp.r, sp.c);
              spawnFloatingCombatText(spPos, `🌊 -${sp.dmg} HP (Thùng)`, '#3b82f6', 0.8);
              if (spUnit.hp <= 0 && spUnit.type !== 'king') {
                spawnStoneShatter(spPos, spUnit.color);
                if (spUnit.mesh) scene.remove(spUnit.mesh);
                boardState[sp.r][sp.c] = null;
                if (piece.color === 'w') capturedByWhite += 1;
                else capturedByBlack += 1;
              } else {
                updateUnit3DBadge(spUnit);
              }
            }
          }

          // TWO_PAIR Phản Chấn Damage
          if (combatSim.twoPairReflectDmg > 0 && captured && captured.hp > 0) {
            captured.hp = Math.max(0, captured.hp - combatSim.twoPairReflectDmg);
            spawnFloatingCombatText(boardToWorld(toR, toC), `🛡 PHẢN CHẤN -${combatSim.twoPairReflectDmg} HP`, '#2dd4bf', 0.82);
            updateUnit3DBadge(captured);
          }

          // FULL_HOUSE Hoàng Gia Vampiric Leech
          if (combatSim.fullHouseLeechHp > 0 && piece && piece.hp > 0) {
            piece.hp = Math.min(piece.maxHp, piece.hp + combatSim.fullHouseLeechHp);
            spawnFloatingCombatText(boardToWorld(fromR, fromC), `🩸 HÚT MÁU +${combatSim.fullHouseLeechHp} HP`, '#f59e0b', 0.85);
            updateUnit3DBadge(piece);
          }

          const atkName = UNIT_BASE_STATS[piece.type]?.name || piece.type;
          const defName = UNIT_BASE_STATS[captured.type]?.name || captured.type;

          if (combatSim.outcome === 'BREAKTHROUGH') {
            // Defender died, Attacker survived -> Attacker occupies (toR, toC)
            // Guarantee dead Defender's 3D model is removed (or tracked as fallenKingPiece if King)
            if (captured) {
              if (captured.type === 'king') {
                checkmateState.fallenKingPiece = captured;
              } else {
                removePieceMeshSafely(captured);
              }
            }
            boardState[fromR][fromC] = null;
            boardState[toR][toC] = piece;
            piece.r = toR;
            piece.c = toC;
            piece.hasMoved = true;
            if (!Array.isArray(piece.pathHistory)) {
              piece.pathHistory = [
                { r: fromR, c: fromC, algebraic: toAlgebraic(fromR, fromC), turn: 0, kind: 'SPAWN' }
              ];
            }
            piece.pathHistory.push({
              r: toR,
              c: toC,
              fromR,
              fromC,
              algebraic: toAlgebraic(toR, toC),
              turn: turnNumber,
              kind: 'CAPTURE'
            });

            if (piece.color === 'w') capturedByWhite += 1;
            else capturedByBlack += 1;

            // Knight Lv.3 Awakening: +4 Armor on kill
            if (piece.type === 'knight' && piece.level >= 3) {
              piece.armor = Math.min(getUnitArmorCap(piece), (piece.armor || 0) + 4);
            }
            // Queen Lv.3 Awakening: Draw 1 extra card on kill
            if (piece.type === 'queen' && piece.level >= 3) {
              const pDeck = pokerDecks[piece.color];
              if (pDeck && pDeck.drawPile.length > 0 && pDeck.hand.length < 7) {
                pDeck.hand.push(pDeck.drawPile.shift());
              }
            }

            // Grant XP (+10 combat + kill bounty + Giant Slayer bonus)
            let xpEarned = 10 + (UNIT_BASE_STATS[captured.type]?.xpKill || 20);
            if ((captured.level || 1) > (piece.level || 1)) {
              const diff = captured.level - piece.level;
              xpEarned += diff * 20;
              piece.hp = Math.min(piece.maxHp, piece.hp + 6);
              spawnFloatingCombatText(endPos, `⚔ GIANT SLAYER! +6 HP`, '#fde047', 0.85);
            }
            const lvlRes = grantUnitXP(piece, xpEarned);
            if (lvlRes.leveledUp) {
              soundFX.playLevelUp();
              spawnFloatingCombatText(
                new THREE.Vector3(endPos.x, endPos.y + 0.25, endPos.z),
                `⬆ LEVEL UP! Lv.${lvlRes.newLevel}`,
                '#fde047',
                1.0
              );
            }

            // Pawn Promotion after breakthrough onto back rank
            if (piece.type === 'pawn' && (toR === 0 || toR === 7)) {
              const inheritedLvl = piece.level || 1;
              const inheritedHistory = Array.isArray(piece.pathHistory)
                ? piece.pathHistory.map((st) => ({ ...st }))
                : [];
              removePieceMeshSafely(piece);
              const promoted = instantiatePiece('queen', piece.color, toR, toC, inheritedLvl);
              promoted.hasMoved = true;
              promoted.hp = Math.min(promoted.maxHp, piece.hp + 10);
              if (inheritedHistory.length > 0) {
                promoted.pathHistory = inheritedHistory;
              }
              updateUnit3DBadge(promoted);
              boardState[toR][toC] = promoted;
            } else {
              piece.mesh.position.copy(endPos);
              piece.mesh.rotation.y = piece.color === 'w' ? Math.PI : 0;
              playPieceClip(piece, 'Idle', true, 0.18);
              updateUnit3DBadge(piece);
            }

            const bonusGold = awardKillGoldBounty(captured.type, piece.color, endPos);
            addCombatLog(
              `⚔ ĐỘT PHÁ: ${atkName} hạ gục ${defName} (-${combatSim.totalHpLossDef} HP) sau khi nhận đòn đánh trả (-${combatSim.totalHpLossAtk} HP), nhận +${xpEarned} XP${bonusGold > 0 ? ` & +${bonusGold} 🪙 Vàng` : ''}!`,
              'kill'
            );
            lastAggressorInfo = {
              attackerR: toR,
              attackerC: toC,
              defenderR: -1,
              defenderC: -1,
              attackerColor: finishSide
            };
          } else if (combatSim.outcome === 'CLASH_REPEL') {
            // Both survived! Attacker returns to (fromR, fromC), Defender stays at (toR, toC)
            piece.hasMoved = true;
            if (!Array.isArray(piece.pathHistory)) {
              piece.pathHistory = [
                { r: fromR, c: fromC, algebraic: toAlgebraic(fromR, fromC), turn: 0, kind: 'SPAWN' }
              ];
            }
            piece.pathHistory.push({
              r: fromR,
              c: fromC,
              fromR,
              fromC,
              targetR: toR,
              targetC: toC,
              targetAlgebraic: toAlgebraic(toR, toC),
              algebraic: toAlgebraic(fromR, fromC),
              turn: turnNumber,
              kind: 'CLASH_REPEL'
            });
            piece.mesh.position.copy(startPos);
            piece.mesh.rotation.y = piece.color === 'w' ? Math.PI : 0;
            playPieceClip(piece, 'Idle', true, 0.18);

            captured.mesh.position.copy(endPos);
            captured.mesh.rotation.y = captured.color === 'w' ? Math.PI : 0;
            playPieceClip(captured, 'Idle', true, 0.18);

            const atkLvl = grantUnitXP(piece, 10);
            const defLvl = grantUnitXP(captured, 10);
            if (atkLvl.leveledUp || defLvl.leveledUp) soundFX.playLevelUp();

            updateUnit3DBadge(piece);
            updateUnit3DBadge(captured);
            addCombatLog(
              `⚔ ĐÁNH TRẢ QUYẾT LIỆT: ${defName} (-${combatSim.totalHpLossDef} HP) tự động đánh trả ${atkName} (-${combatSim.totalHpLossAtk} HP), đẩy lùi đối phương về ô cũ!`,
              'clash'
            );
            lastAggressorInfo = {
              attackerR: fromR,
              attackerC: fromC,
              defenderR: toR,
              defenderC: toC,
              attackerColor: finishSide
            };
          } else if (combatSim.outcome === 'COUNTER_KILL') {
            // Attacker died to simultaneous counter-attack; Defender survived and holds (toR, toC)
            boardState[fromR][fromC] = null;
            if (piece.type === 'king') {
              checkmateState.fallenKingPiece = piece;
            } else {
              removePieceMeshSafely(piece);
            }
            if (captured.color === 'w') capturedByWhite += 1;
            else capturedByBlack += 1;

            captured.mesh.position.copy(endPos);
            captured.mesh.rotation.y = captured.color === 'w' ? Math.PI : 0;
            playPieceClip(captured, 'Idle', true, 0.18);

            const xpEarned = 10 + (UNIT_BASE_STATS[piece.type]?.xpKill || 20);
            const defLvl = grantUnitXP(captured, xpEarned);
            if (defLvl.leveledUp) soundFX.playLevelUp();
            updateUnit3DBadge(captured);

            const bonusGold = awardKillGoldBounty(piece.type, captured.color, endPos);
            addCombatLog(
              `💀 ĐÁNH TRẢ HẠ GỤC: ${defName} tự động đánh trả kết liễu ${atkName} (-${combatSim.totalHpLossAtk} HP)${bonusGold > 0 ? `, thưởng +${bonusGold} 🪙 Vàng` : ''}!`,
              'danger'
            );
            lastAggressorInfo = null;
          } else if (combatSim.outcome === 'MUTUAL_DESTRUCTION') {
            // Both Attacker and Defender died simultaneously! Both squares become empty.
            boardState[fromR][fromC] = null;
            boardState[toR][toC] = null;
            if (piece.type === 'king') checkmateState.fallenKingPiece = piece;
            else removePieceMeshSafely(piece);
            if (captured.type === 'king') checkmateState.fallenKingPiece = captured;
            else removePieceMeshSafely(captured);
            capturedByWhite += 1;
            capturedByBlack += 1;

            awardKillGoldBounty(captured.type, piece.color, endPos);
            addCombatLog(
              `💥 ĐỒNG QUY VU TẬN: ${defName} đánh trả đến hơi thở cuối cùng — cả ${atkName} và ${defName} cùng ngã xuống!`,
              'danger'
            );
            lastAggressorInfo = null;
          }

          activeDuelSavedCam = null;
          camera.position.copy(savedCamPos);
          orbitControls.target.copy(savedTarget);
          orbitControls.enabled = true;
          orbitControls.update();
        }

        // Rook Signature Passive ("Pháo Đài Cự Thạch"): Stationary Rooks of the active side gain +2 Armor (up to 6 natural)
        for (let rr = 0; rr < 8; rr++) {
          for (let cc = 0; cc < 8; cc++) {
            const p = boardState[rr][cc];
            if (p && p.color === finishSide && p.type === 'rook' && p !== piece) {
              const cap = Math.min(6, getUnitArmorCap(p));
              if ((p.armor || 0) < cap) {
                p.armor = Math.min(cap, (p.armor || 0) + 2);
                updateUnit3DBadge(p);
              }
            }
            if (p && p.color === oppSide && p.type === 'queen') {
              p.attacksTakenThisRound = 0;
            }
          }
        }

        // Check Victory Condition: Is either King dead (or HP <= 0)?
        let whiteKing = null;
        let blackKing = null;
        for (let rr = 0; rr < 8; rr++) {
          for (let cc = 0; cc < 8; cc++) {
            const p = boardState[rr][cc];
            if (p && p.type === 'king') {
              if (p.color === 'w') whiteKing = p;
              else blackKing = p;
            }
          }
        }

        if (!blackKing || blackKing.hp <= 0) {
          gameOver = true;
          isAnimatingMove = false;
          triggerCheckmateSequence('b', 'w');
          updateTurnUI();
          return;
        }
        if (!whiteKing || whiteKing.hp <= 0) {
          gameOver = true;
          isAnimatingMove = false;
          triggerCheckmateSequence('w', 'b');
          updateTurnUI();
          return;
        }

        // Prepare next turn in Hearthstone style: active player starts in DRAW_PHASE with refilled Mana Crystals!
        currentTurn = oppSide;
        if (currentTurn === 'w') turnNumber += 1;
        prepareNextTurnDrawState(pokerDecks[finishSide], turnNumber);
        prepareNextTurnDrawState(pokerDecks[currentTurn], turnNumber);
        turnPhase = 'DRAW_PHASE';
        resetTurnTimer();
        pendingComboEval = null;
        lastEmpoweredSquare = null;
        ultimateTargetSquares = [];
        isAnimatingMove = false;
        renderer.shadowMap.needsUpdate = true;
        soundFX.playTurnStartFanfare(currentTurn);
        updateAllUnitBadges();
        updateTurnUI();
        maybeScheduleAIMove();
      } catch (err) {
        console.error('[FinishMove Error] Exception during finishMove:', err);
      } finally {
        isAnimatingMove = false;
        updateTurnUI();
        emitPokerChessSync();
      }
    }

      function stepMove(dt) {
        elapsed += dt;

        if (!isCapture) {
          const u = Math.min(1, elapsed / totalDuration);
          if (elapsed >= nextFootstepElapsed && u < 0.92) {
            nextFootstepElapsed += 0.24;
            soundFX.playFootstepMarch(piece.type);
          }
          applyConcreteTrajectory(u, startPos, endPos);
          if (isCastling && castleRook && castleRook.mesh) {
            const rEase = easeInOutCubic(u);
            castleRook.mesh.position.set(
              castleRookStartPos.x + (castleRookEndPos.x - castleRookStartPos.x) * rEase,
              BOARD_SURFACE_Y + Math.sin(u * Math.PI) * 0.05,
              castleRookStartPos.z + (castleRookEndPos.z - castleRookStartPos.z) * rEase
            );
          }
          const pDelta = piece.mesh.position.distanceTo(prevPiecePos);
          prevPiecePos.copy(piece.mesh.position);
          cameraTelemetry.lastSpaceMoveSamples.push({
            t: Number(elapsed.toFixed(3)),
            u: Number(u.toFixed(3)),
            piecePos: [
              Number(piece.mesh.position.x.toFixed(3)),
              Number(piece.mesh.position.y.toFixed(3)),
              Number(piece.mesh.position.z.toFixed(3))
            ],
            pieceStep: Number(pDelta.toFixed(4))
          });
          if (u >= 1) {
            finishMove();
            return true;
          }
          return false;
        }

        // Capture / RPG Combat Sequence with Continuous C-infinity Quadratic Bezier Camera
        let phaseName = 'approach';
        const outcome = combatSim?.outcome || 'BREAKTHROUGH';
        const defDies = outcome === 'BREAKTHROUGH' || outcome === 'MUTUAL_DESTRUCTION';
        const atkDies = outcome === 'COUNTER_KILL' || outcome === 'MUTUAL_DESTRUCTION';

        if (elapsed <= tStrikeDone) {
          const uActive = Math.min(1, elapsed / tStrikeDone);
          const sActive = 0.38 * uActive + 0.62 * easeInOutCubic(uActive);
          evalQuadraticBezier(camera.position, savedCamPos, duelCamMid, duelCamClose, sActive);
          evalQuadraticBezier(orbitControls.target, savedTarget, duelTargetStart, duelTargetEnd, sActive);

          if (elapsed <= tApproach) {
            phaseName = 'approach';
            const u = Math.min(1, elapsed / tApproach);
            if (elapsed >= nextFootstepElapsed && u < 0.95) {
              nextFootstepElapsed += 0.2;
              soundFX.playFootstepMarch(piece.type);
            }
            applyConcreteTrajectory(u, startPos, strikePos);
          } else {
            phaseName = 'strike';
            if (!attackAnimStarted) {
              attackAnimStarted = true;
              triggerUnitMeleeAttackAnimation(fromR, fromC, {
                inDuel: true,
                headingRad: moveHeading
              });
              soundFX.playWeaponSwing(piece.type);
            }

            for (const b of bystanders) {
              const dxB = strikePos.x - b.homePos.x;
              const dzB = strikePos.z - b.homePos.z;
              const dB = Math.hypot(dxB, dzB);
              if (dB < 0.42 && dB > 0.001) {
                const yieldDist = ((0.42 - dB) / 0.42) * 0.068;
                b.piece.mesh.position.set(
                  b.homePos.x - (dxB / dB) * yieldDist,
                  BOARD_SURFACE_Y,
                  b.homePos.z - (dzB / dB) * yieldDist
                );
              } else {
                b.piece.mesh.position.copy(b.homePos);
              }
            }

            const atkClipTime = (elapsed - tApproach) * atkProfile.timeScale;

            if (!shatterTriggered && captured && captured.mesh) {
              const stalkLead = 0.028;
              let lungeOffset = 0;
              if (atkClipTime < SWING_START_CLIP_TIME) {
                const windupProgress = Math.min(1, atkClipTime / Math.max(0.05, SWING_START_CLIP_TIME));
                lungeOffset = windupProgress * stalkLead;
              } else {
                const slashPhase = Math.min(
                  1,
                  (atkClipTime - SWING_START_CLIP_TIME) / Math.max(0.05, BLOW_CLIP_TIME - SWING_START_CLIP_TIME)
                );
                lungeOffset =
                  stalkLead + Math.sin(slashPhase * Math.PI * 0.85) * Math.max(0.018, atkProfile.maxLunge - stalkLead);
              }
              piece.mesh.position.set(
                strikePos.x + dirX * lungeOffset,
                BOARD_SURFACE_Y,
                strikePos.z + dirZ * lungeOffset
              );
              if (atkClipTime < CONTACT_CLIP_TIME) {
                captured.mesh.position.copy(endPos);
              } else {
                const shoveProgress = Math.min(
                  1,
                  (atkClipTime - CONTACT_CLIP_TIME) / Math.max(0.04, BLOW_CLIP_TIME - CONTACT_CLIP_TIME)
                );
                const shoveDist = shoveProgress * 0.045;
                captured.mesh.position.set(
                  endPos.x + dirX * shoveDist,
                  BOARD_SURFACE_Y,
                  endPos.z + dirZ * shoveDist
                );
              }

              const curSep = piece.mesh.position.distanceTo(captured.mesh.position);
              if (curSep < (cameraTelemetry.minCombatSeparation ?? Infinity)) {
                cameraTelemetry.minCombatSeparation = Number(curSep.toFixed(3));
              }
            }

            // Weapon Physical Contact & Simultaneous Counter-Swing
            if (
              !defenderFlinchTriggered &&
              (atkClipTime >= CONTACT_CLIP_TIME || elapsed >= tContact + 0.06)
            ) {
              defenderFlinchTriggered = true;
              const isEmpoweredStrike = Boolean(piece.activeCombo);
              // Tactile mobile vibrate() feedback + razor-sharp steel blade clash SFX
              triggerCombatHapticFeedback({
                stage: 'contact',
                isKill: Boolean(defDies || atkDies),
                attackerType: piece.type,
                defenderType: captured?.type
              });
              soundFX.playBladeClash(isEmpoweredStrike);

              const clashCenter = new THREE.Vector3(
                endPos.x - dirX * 0.12,
                BOARD_SURFACE_Y,
                endPos.z - dirZ * 0.12
              );
              const slashHex = piece.activeCombo?.ringColor || activeSkinSlashHex || 0xfde047;
              spawnWeaponSlashArc3D(
                clashCenter,
                moveHeading,
                slashHex,
                isEmpoweredStrike ? 1.35 : 1.08,
                -0.42
              );
              spawnCombatSparks3D(
                clashCenter,
                slashHex,
                isEmpoweredStrike ? 32 : 22,
                isEmpoweredStrike ? 1.2 : 0.95
              );

              if (captured) {
                triggerUnitMeleeDefendAnimation(toR, toC, {
                  inDuel: true,
                  headingRad: moveHeading + Math.PI,
                  isLethal: Boolean(defDies && !canCounterAttack)
                });
                if (defDies && !canCounterAttack) {
                  playPieceClip(captured, 'Shatter', false, 0.04);
                }
                impactFlashLight.position.set(
                  endPos.x - dirX * 0.08,
                  BOARD_SURFACE_Y + 0.28,
                  endPos.z - dirZ * 0.08
                );
                impactFlashLight.intensity = 6.4;
              }
            }

            // Beat 1: Attacker's Weapon Blow Physically Lands on Defender
            if (!shatterTriggered && (atkClipTime >= BLOW_CLIP_TIME || elapsed >= tImpact + 0.05)) {
              shatterTriggered = true;
              beat1ImpactTime = elapsed;
              impactActualTime = elapsed;
              postShatterPiecePos.copy(piece.mesh.position);
              const isLethalBlow = Boolean(defDies && !canCounterAttack);
              const isEmpoweredBlow = Boolean(piece.activeCombo);

              triggerCombatHapticFeedback({
                stage: isLethalBlow ? 'lethal_impact' : 'clash_impact',
                isKill: isLethalBlow,
                attackerType: piece.type,
                defenderType: captured?.type
              });
              soundFX.playClashImpact(isLethalBlow, isEmpoweredBlow);

              const blowColorHex = piece.activeCombo?.ringColor || (defDies ? 0xef4444 : 0xf5d76e);
              spawnCombatShockwave3D(endPos, blowColorHex, defDies, isEmpoweredBlow);
              spawnCombatSparks3D(
                endPos,
                blowColorHex,
                defDies ? 38 : 26,
                defDies ? 1.32 : 1.05
              );
              if (defDies || isEmpoweredBlow) {
                spawnDivineLightningBeam(
                  endPos,
                  blowColorHex,
                  defDies ? 0.085 : 0.06
                );
              }

              if (combatSim) {
                spawnFloatingCombatText(
                  endPos,
                  `-${combatSim.totalHpLossDef} HP${combatSim.absorbedByDefArmor > 0 ? ` (-${combatSim.absorbedByDefArmor}🛡)` : ''}`,
                  defDies ? '#ef4444' : '#fbbf24',
                  defDies ? 1.06 : 0.88
                );
                if (!canCounterAttack && combatSim.firstStrikeTriggered) {
                  spawnFloatingCombatText(
                    strikePos,
                    '⚡ ĐÁNH TRƯỚC! (CHẶN ĐÁNH TRẢ)',
                    '#fde047',
                    0.86
                  );
                }
              }

              // Initialize Defender's HP bar smooth drain at Beat 1 (Attacker's HP remains 100% untouched!)
              if (captured && combatSim) {
                captured.armor = combatSim.defArmorAfter;
                captured.trailHp = defHpStart;
                captured.displayHp = defHpStart;
              }
              if (!canCounterAttack) {
                counterImpactTriggered = true;
              }
              // Mid-combat sync disabled
            }

            // Smoothly drain Defender's HP bar over 0.26s after Beat 1 weapon impact
            if (shatterTriggered && captured && combatSim) {
              const defTargetHp =
                defDies && canCounterAttack
                  ? Math.max(1, combatSim.defHpAfter)
                  : Math.max(0, combatSim.defHpAfter);
              const drainProgress = Math.min(1, Math.max(0, (elapsed - beat1ImpactTime) / 0.14));
              const trailProgress = Math.min(1, Math.max(0, (elapsed - beat1ImpactTime) / 0.22));
              const easeDrain = 1 - Math.pow(1 - drainProgress, 2.2);
              const easeTrail = Math.pow(trailProgress, 1.4);
              captured.displayHp = defHpStart + (defTargetHp - defHpStart) * easeDrain;
              captured.trailHp = defHpStart + (defTargetHp - defHpStart) * easeTrail;
              captured.hp = Math.max(
                defDies && canCounterAttack ? 1 : 0,
                Math.ceil(captured.displayHp - 0.04)
              );
              updateUnit3DBadge(captured);
            }

            // Beat 2A: Defender Recovers & Begins Counter-Attack Animation (Tự Động Đánh Trả!)
            // NOTE: Attacker's HP is STILL 100% untouched (atkHpStart) while Defender winds up and swings!
            if (canCounterAttack && !counterSwingStarted && elapsed >= tCounterStart) {
              counterSwingStarted = true;
              if (captured && captured.mesh) {
                playPieceClip(captured, 'Attack', false, 0.04);
                captured.combatAnimState = 'MELEE_ATTACK';
                captured.combatAnimTimer = 1.4;
                piece.combatAnimState = 'MELEE_DEFEND';
                piece.combatAnimTimer = 1.4;
                if (activeCombatBanner) {
                  activeCombatBanner.defenderAnimState = 'MELEE_ATTACK';
                  activeCombatBanner.attackerAnimState = 'MELEE_DEFEND';
                  activeCombatBanner.combatStage = 'COUNTER_WINDUP';
                  emitPokerChessSync();
                }
                soundFX.playWeaponSwing(captured.type);
                spawnFloatingCombatText(
                  new THREE.Vector3(endPos.x, endPos.y + 0.24, endPos.z),
                  '⚔ ĐÁNH TRẢ!',
                  '#38bdf8',
                  0.88
                );
              }
            }

            const defClipTime =
              canCounterAttack && counterSwingStarted && captured && captured.currentAction
                ? captured.currentAction.time
                : 0;

            // Beat 2A-Contact: Defender's weapon swings into Attacker's guard (sparks & brace, HP still untouched)
            if (
              canCounterAttack &&
              counterSwingStarted &&
              !counterContactTriggered &&
              (defClipTime >= DEF_CONTACT_CLIP_TIME || elapsed >= tCounterContact)
            ) {
              counterContactTriggered = true;
              soundFX.playBladeClash(false);
              const counterSlashHex = captured?.activeCombo?.ringColor || activeSkinSlashHex || 0x38bdf8;
              spawnWeaponSlashArc3D(
                endPos,
                moveHeading + Math.PI,
                counterSlashHex,
                captured?.activeCombo ? 1.32 : 1.12,
                0.38
              );
              spawnMeleeDefendShield3D(
                strikePos,
                piece.color === 'w' ? 0x38bdf8 : 0xc084fc
              );
            }

            // Animate Defender's physical lunge toward Attacker during Beat 2 windup & swing
            if (canCounterAttack && counterSwingStarted && !counterImpactTriggered && captured && captured.mesh) {
              const counterSpan = Math.max(0.12, tCounterImpact - tCounterStart);
              const uCounter = Math.min(1, Math.max(0, (elapsed - tCounterStart) / counterSpan));
              const lungeCurve = Math.sin(uCounter * Math.PI * 0.88);
              const defLungeDist = lungeCurve * 0.155;
              captured.mesh.position.set(
                endPos.x - dirX * defLungeDist,
                BOARD_SURFACE_Y,
                endPos.z - dirZ * defLungeDist
              );
              // Attacker braces as Defender lunges in
              const atkRecoilDist = Math.max(0, uCounter - 0.55) * 0.09;
              piece.mesh.position.set(
                strikePos.x - dirX * atkRecoilDist,
                BOARD_SURFACE_Y,
                strikePos.z - dirZ * atkRecoilDist
              );
            }

            // Beat 2B: Defender's Counter-Blow Physically Impacts Attacker!
            // ONLY NOW (when Defender's weapon blow reaches DEF_BLOW_CLIP_TIME) does Attacker's HP bar start deducting!
            const defBlowLanded =
              captured && captured.currentAction
                ? defClipTime >= DEF_BLOW_CLIP_TIME || elapsed >= tCounterImpact + 0.05
                : elapsed >= tCounterImpact;

            if (canCounterAttack && counterSwingStarted && !counterImpactTriggered && defBlowLanded) {
              counterImpactTriggered = true;
              impactActualTime = elapsed;
              postShatterPiecePos.copy(piece.mesh.position);
              const isCounterKill = Boolean(atkDies);
              const isDefEmpowered = Boolean(captured?.activeCombo);

              triggerCombatHapticFeedback({
                stage: isCounterKill ? 'lethal_impact' : 'clash_impact',
                isKill: Boolean(defDies || atkDies),
                attackerType: captured?.type || 'knight',
                defenderType: piece.type
              });
              soundFX.playBladeClash(true);
              soundFX.playClashImpact(Boolean(defDies || atkDies), isDefEmpowered);

              const counterColorHex = captured?.activeCombo?.ringColor || (atkDies ? 0xef4444 : 0x38bdf8);
              spawnCombatShockwave3D(strikePos, counterColorHex, atkDies, isDefEmpowered);
              spawnCombatSparks3D(
                strikePos,
                counterColorHex,
                atkDies ? 38 : 26,
                atkDies ? 1.35 : 1.08
              );
              if (atkDies || isDefEmpowered) {
                spawnDivineLightningBeam(
                  strikePos,
                  counterColorHex,
                  atkDies ? 0.085 : 0.055
                );
              }

              impactFlashLight.position.set(
                strikePos.x + dirX * 0.06,
                BOARD_SURFACE_Y + 0.28,
                strikePos.z + dirZ * 0.06
              );
              impactFlashLight.intensity = 6.8;

              if (combatSim) {
                spawnFloatingCombatText(
                  strikePos,
                  `⚔ ĐÁNH TRẢ: -${combatSim.totalHpLossAtk} HP${combatSim.absorbedByAtkArmor > 0 ? ` (-${combatSim.absorbedByAtkArmor}🛡)` : ''}`,
                  atkDies ? '#ef4444' : '#38bdf8',
                  atkDies ? 1.06 : 0.9
                );
                piece.armor = combatSim.atkArmorAfter;
                piece.trailHp = atkHpStart;
                piece.displayHp = atkHpStart;
              }
              // Mid-combat sync disabled
            }

            // Smoothly drain Attacker's HP bar over 0.26s ONLY AFTER Beat 2B counter-blow impact!
            if (canCounterAttack && counterImpactTriggered && piece && combatSim) {
              const atkTargetHp = Math.max(0, combatSim.atkHpAfter);
              const atkDrainProg = Math.min(1, Math.max(0, (elapsed - impactActualTime) / 0.14));
              const atkTrailProg = Math.min(1, Math.max(0, (elapsed - impactActualTime) / 0.22));
              const easeAtkDrain = 1 - Math.pow(1 - atkDrainProg, 2.2);
              const easeAtkTrail = Math.pow(atkTrailProg, 1.4);
              piece.displayHp = atkHpStart + (atkTargetHp - atkHpStart) * easeAtkDrain;
              piece.trailHp = atkHpStart + (atkTargetHp - atkHpStart) * easeAtkTrail;
              piece.hp = Math.max(0, Math.ceil(piece.displayHp - 0.04));
              updateUnit3DBadge(piece);

              // If Defender also died after delivering its final counter-blow, drain its remaining 1 HP to 0
              if (defDies && captured) {
                captured.displayHp = Math.max(0, 1 - easeAtkDrain);
                captured.trailHp = Math.max(0, 1 - easeAtkTrail);
                captured.hp = 0;
                updateUnit3DBadge(captured);
              }
            }

            // Beat 2C: Trigger Lethal Stone Shatters AFTER the HP bar has visibly drained to 0!
            if (
              !lethalShatterTriggered &&
              counterImpactTriggered &&
              elapsed >= impactActualTime + 0.08
            ) {
              lethalShatterTriggered = true;
              if (defDies && captured && captured.mesh) {
                const shatterOrigin = captured.mesh.position.clone();
                if (captured.type !== 'king') {
                  scene.remove(captured.mesh);
                }
                spawnStoneShatter(shatterOrigin, captured.color);
              }
              if (atkDies && piece && piece.mesh) {
                const atkOrigin = piece.mesh.position.clone();
                if (piece.type !== 'king') {
                  scene.remove(piece.mesh);
                }
                spawnStoneShatter(atkOrigin, piece.color);
              }
            }

            if (counterImpactTriggered) {
              const postStrikeSpan = Math.max(0.08, tStrikeDone - impactActualTime);
              const uFollow = Math.min(1, Math.max(0, (elapsed - impactActualTime) / postStrikeSpan));
              if (outcome === 'BREAKTHROUGH') {
                piece.mesh.position.lerpVectors(postShatterPiecePos, endPos, uFollow * 0.38);
              } else if (outcome === 'CLASH_REPEL') {
                piece.mesh.position.lerpVectors(postShatterPiecePos, startPos, uFollow * 0.28);
                if (captured && captured.mesh) {
                  captured.mesh.position.lerpVectors(captured.mesh.position, endPos, uFollow * 0.5);
                }
              } else if (outcome === 'COUNTER_KILL' && captured && captured.mesh) {
                captured.mesh.position.lerpVectors(captured.mesh.position, endPos, uFollow * 0.55);
              }
              postStrikePiecePos.copy(piece.mesh.position);
            }

            if (shatterTriggered && elapsed >= impactActualTime && elapsed <= impactActualTime + 0.12) {
              const shakeProgress = (elapsed - impactActualTime) / 0.12;
              const decay = 1 - shakeProgress;
              const amp = 0.012 * decay;
              camera.position.y += Math.sin(shakeProgress * Math.PI * 4) * amp;
            }
          }
        } else {
          // Phase 3: Advance (if Breakthrough) OR Recoil back to Start Square (if Clash & Repel)
          phaseName = 'return';
          const uReturn = Math.min(1, (elapsed - tStrikeDone) / Math.max(0.1, totalDuration - tStrikeDone));
          const easeRet = easeInOutCubic(uReturn);
          const pieceAdvanceBlend = 0.35 * uReturn + 0.65 * easeRet;

          if (outcome === 'BREAKTHROUGH') {
            piece.mesh.position.lerpVectors(postStrikePiecePos, endPos, pieceAdvanceBlend);
          } else if (outcome === 'CLASH_REPEL') {
            piece.mesh.position.lerpVectors(postStrikePiecePos, startPos, pieceAdvanceBlend);
            if (captured && captured.mesh) {
              captured.mesh.position.copy(endPos);
            }
          }
          camera.position.lerpVectors(duelCamClose, savedCamPos, easeRet);
          orbitControls.target.lerpVectors(duelTargetEnd, savedTarget, easeRet);
        }

        camera.lookAt(orbitControls.target);

        const stepDelta = camera.position.distanceTo(prevCamPos);
        const pieceStepDelta = piece.mesh.position.distanceTo(prevPiecePos);
        if (stepDelta > cameraTelemetry.maxStepDelta) {
          cameraTelemetry.maxStepDelta = stepDelta;
        }
        prevCamPos.copy(camera.position);
        prevPiecePos.copy(piece.mesh.position);

        cameraTelemetry.lastAttackSamples.push({
          t: Number(elapsed.toFixed(3)),
          phase: phaseName,
          camStep: Number(stepDelta.toFixed(4)),
          pieceStep: Number(pieceStepDelta.toFixed(4)),
          pos: [
            Number(camera.position.x.toFixed(3)),
            Number(camera.position.y.toFixed(3)),
            Number(camera.position.z.toFixed(3))
          ],
          target: [
            Number(orbitControls.target.x.toFixed(3)),
            Number(orbitControls.target.y.toFixed(3)),
            Number(orbitControls.target.z.toFixed(3))
          ],
          piecePos: [
            Number(piece.mesh.position.x.toFixed(3)),
            Number(piece.mesh.position.y.toFixed(3)),
            Number(piece.mesh.position.z.toFixed(3))
          ]
        });

        if (elapsed >= totalDuration) {
          finishMove();
          return true;
        }
        return false;
      }

      activeMoveTweens.push(stepMove);
      return true;
    }

    const activeMoveTweens = [];

    // =========================================================================
    // Single-Player Tactical AI (Elo-Scaled Poker Combo + RPG Combat Scoring)
    // =========================================================================
    function chooseSmartAIMove(color, candidateCombo = null) {
      const legalMoves = getAllLegalMoves(color);
      if (legalMoves.length === 0) return null;

      const botProf = getBotDifficultyProfile();
      const oppColor = color === 'w' ? 'b' : 'w';

      // Precompute enemy pseudo-attack map for higher-Elo danger avoidance
      let enemyDangerMap = null;
      if (botProf.lookaheadRiskWeight > 0) {
        enemyDangerMap = Array.from({ length: 8 }, () => Array(8).fill(0));
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const ep = boardState[r][c];
            if (ep && ep.color === oppColor) {
              const eMoves = getPseudoMovesForPiece(r, c, boardState);
              const eAtk = Math.max(1, (ep.baseAtk || 4) + (ep.activeCombo?.atkBonus || 0));
              for (const em of eMoves) {
                enemyDangerMap[em.r][em.c] = Math.max(enemyDangerMap[em.r][em.c], eAtk);
              }
            }
          }
        }
      }

      let bestScore = -Infinity;
      let bestCandidates = [];

      for (const m of legalMoves) {
        const piece = boardState[m.fromR][m.fromC];
        if (!piece) continue;
        const target = boardState[m.toR][m.toC];
        let score = 0;

        // Optionally simulate with pending Poker buff attached to this moving unit (for Lv.2+ Bots)
        const savedCombo = piece.activeCombo;
        const savedArmor = piece.armor;
        const savedHp = piece.hp;
        if (candidateCombo && !piece.activeCombo && botProf.level >= 2) {
          piece.activeCombo = {
            ...candidateCombo,
            atkBonus: candidateCombo.atkBonus || 2
          };
          piece.armor = Math.min(getUnitArmorCap(piece), (piece.armor || 0) + (candidateCombo.armorBonus || 0));
          piece.hp = Math.min(piece.maxHp || 20, (piece.hp || 10) + (candidateCombo.healInstant || 0));
        }

        if (target) {
          // Evaluate actual Simultaneous RPG Combat outcome!
          const sim = simulateRPGCombat(piece, target, m.fromR, m.fromC, m.toR, m.toC, boardState);
          if (sim) {
            if (target.type === 'king' && sim.defHpAfter <= 0) {
              score += 50000; // Winning blow on enemy King!
            } else if (sim.outcome === 'BREAKTHROUGH') {
              score += (PIECE_VALUES[target.type] || 150) * 1.4 + sim.totalHpLossDef * 14 - sim.totalHpLossAtk * 5;
              if (botProf.level >= 3 && target.hp < target.maxHp * 0.5) {
                score += 140; // Ruthlessly finish off wounded player units at Gold+ Elo
              }
            } else if (sim.outcome === 'CLASH_REPEL') {
              // Favor positive damage trades, especially chipping down the Enemy King or Queen
              const tradeDelta =
                sim.totalHpLossDef * (target.type === 'king' ? 32 : target.type === 'queen' ? 20 : 14) -
                sim.totalHpLossAtk * (piece.type === 'king' ? 24 : 11);
              score += tradeDelta + 25;
            } else if (sim.outcome === 'MUTUAL_DESTRUCTION') {
              score += ((PIECE_VALUES[target.type] || 100) - (PIECE_VALUES[piece.type] || 100)) * 1.2;
            } else if (sim.outcome === 'COUNTER_KILL') {
              score -= (PIECE_VALUES[piece.type] || 150) * (botProf.level >= 2 ? 2.2 : 1.1);
            }

            // Automatic Retaliation Priority (Phản Kích Tự Động):
            if (
              lastAggressorInfo &&
              lastAggressorInfo.attackerColor !== color &&
              m.toR === lastAggressorInfo.attackerR &&
              m.toC === lastAggressorInfo.attackerC &&
              sim.outcome !== 'COUNTER_KILL'
            ) {
              const isDirectVictimRetaliating =
                m.fromR === lastAggressorInfo.defenderR && m.fromC === lastAggressorInfo.defenderC;
              score += isDirectVictimRetaliating ? 650 : 420;
            }
          }
        } else {
          // Center control & advancement toward enemy King
          const centerDist = Math.abs(3.5 - m.toR) + Math.abs(3.5 - m.toC);
          score += (7 - centerDist) * 7;
          if (piece.type === 'pawn') {
            const advance = color === 'w' ? 6 - m.toR : m.toR - 1;
            score += advance * 11;
          }
          if (piece.activeCombo) {
            score += 24;
          }
          // Gold+ Elo Bots evaluate Sanctum Tile Modifiers (Consecrated +1⚔/+1🛡 vs Corrupted -1⚔/-1🛡)
          if (botProf.level >= 3) {
            const destTileMod = getBoardTileModifier(m.toR, m.toC);
            if (destTileMod?.id === 'CONSECRATED') score += 55;
            else if (destTileMod?.id === 'CORRUPTED') score -= 45;
          }
        }

        // Restore temporary simulation state
        piece.activeCombo = savedCombo;
        piece.armor = savedArmor;
        piece.hp = savedHp;

        // Higher-Elo Lookahead: avoid walking valuable units (King/Queen/Rook) into lethal enemy fire on empty squares
        if (enemyDangerMap && !target) {
          const incomingThreat = enemyDangerMap[m.toR][m.toC] || 0;
          if (incomingThreat > 0) {
            const unitValWeight = piece.type === 'king' ? 6.5 : piece.type === 'queen' ? 4.2 : piece.type === 'rook' ? 2.5 : 1.0;
            const currentThreat = enemyDangerMap[m.fromR][m.fromC] || 0;
            if (incomingThreat > currentThreat) {
              score -= incomingThreat * unitValWeight * 4.5 * botProf.lookaheadRiskWeight;
            }
          } else if (enemyDangerMap[m.fromR][m.fromC] > 0 && (piece.type === 'king' || piece.type === 'queen')) {
            // Bonus for evacuating a threatened King/Queen to safety!
            score += enemyDangerMap[m.fromR][m.fromC] * 18 * botProf.lookaheadRiskWeight;
          }
        }

        score += (Math.random() - 0.5) * botProf.noise;

        // =====================================================================
        // Tactical Tile Ping AI Coordination Weighting
        // =====================================================================
        if (activeTacticalPings.length > 0) {
          for (const ping of activeTacticalPings) {
            const distBefore = Math.abs(ping.r - m.fromR) + Math.abs(ping.c - m.fromC);
            const distAfter = Math.abs(ping.r - m.toR) + Math.abs(ping.c - m.toC);

            if (ping.intent === 'ATTACK') {
              if (m.toR === ping.r && m.toC === ping.c) {
                score += 1150;
              } else if (distAfter < distBefore) {
                score += (distBefore - distAfter) * 85;
              }
            } else if (ping.intent === 'MOVE') {
              if (m.toR === ping.r && m.toC === ping.c) {
                score += 980;
              } else if (distAfter < distBefore) {
                score += (distBefore - distAfter) * 70;
              }
            } else if (ping.intent === 'DEFEND') {
              const pingedUnit = boardState[ping.r]?.[ping.c];
              if (pingedUnit && pingedUnit.color === color) {
                if (m.fromR === ping.r && m.fromC === ping.c && !target) {
                  score -= 320;
                }
                if (target && Math.abs(m.toR - ping.r) <= 2 && Math.abs(m.toC - ping.c) <= 2) {
                  score += 640;
                }
              } else if (m.toR === ping.r && m.toC === ping.c) {
                score += 820;
              } else if (Math.abs(m.toR - ping.r) <= 1 && Math.abs(m.toC - ping.c) <= 1) {
                score += 240;
              }
            } else if (ping.intent === 'BUFF') {
              if (m.fromR === ping.r && m.fromC === ping.c) {
                score += 520;
              }
            }
          }
        }

        if (score > bestScore + 1) {
          bestScore = score;
          bestCandidates = [m];
        } else if (Math.abs(score - bestScore) <= 1) {
          bestCandidates.push(m);
        }
      }

      return bestCandidates[Math.floor(Math.random() * bestCandidates.length)] || legalMoves[0];
    }

    function triggerAIMoveNow() {
      try {
        if (isAnimatingMove || gameOver) return false;

      if (preMoveHighlightTask) {
        preMoveHighlightTask = null;
      }

      const botProf = getBotDifficultyProfile();

      // 1. AI executes Step 1 (Bốc Bài) -> Step 2 (Kích Hoạt Phép) -> Step 3 (Gắn Buff) -> Step 4 (Đi Quân & Combat)
      const aiDeck = pokerDecks[currentTurn];
      if (aiDeck && turnPhase === 'DRAW_PHASE') {
        drawUpToSevenCards(aiDeck, true);
        // Higher Elo Bots (Lv.3+) can mulligan 1-3 weakest singleton cards to craft stronger Poker combos!
        if (botProf.mulliganDraws > 0 && aiDeck.drawPile && aiDeck.drawPile.length >= botProf.mulliganDraws) {
          const rankCounts = {};
          for (const c of aiDeck.hand) {
            if (c) rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
          }
          const singletons = aiDeck.hand
            .map((c, idx) => ({ c, idx, count: c ? rankCounts[c.rank] || 1 : 99 }))
            .filter((item) => item.c && item.count === 1)
            .sort((a, b) => (a.c.rank || 2) - (b.c.rank || 2));
          const swaps = Math.min(botProf.mulliganDraws, singletons.length);
          for (let s = 0; s < swaps; s++) {
            const replaceIdx = singletons[s].idx;
            const replacement = aiDeck.drawPile.pop();
            if (replacement) {
              aiDeck.discardPile.push(aiDeck.hand[replaceIdx]);
              aiDeck.hand[replaceIdx] = replacement;
            }
          }
        }
        turnPhase = 'SELECT_CARDS';
      }
      if (aiDeck && turnPhase === 'SELECT_CARDS') {
        if (Math.random() <= botProf.comboSmartPct) {
          const best = findBest5Of7(aiDeck.hand);
          aiDeck.selectedIndices = best.indices;
        } else {
          // Bronze Bot occasionally picks the first 5 cards casually
          aiDeck.selectedIndices = [0, 1, 2, 3, 4].filter((i) => i < aiDeck.hand.length);
        }
        commitSelected5CardCombo();
        if (gameOver) return true;
      }
      if (turnPhase === 'ULTIMATE_TARGETING') {
        confirmFourKingsUltimate();
        if (gameOver) return true;
        scheduleBoardTimeout(() => {
          if (!gameOver && !isAnimatingMove) {
            const postUltMove = chooseSmartAIMove(currentTurn);
            if (postUltMove) {
              executeChessMove(postUltMove.fromR, postUltMove.fromC, postUltMove.toR, postUltMove.toC, {
                fromAI: true,
                skipAutoPoker: true
              });
            } else {
              handleTurnTimeout();
            }
          }
        }, 850);
        return true;
      }

      // 2. Pick best RPG move (evaluating the pending Poker Buff on candidate units) and attach the Buff visually
      const chosen = chooseSmartAIMove(currentTurn, pendingComboEval);
      if (!chosen) {
        return handleTurnTimeout();
      }
      if (turnPhase === 'EMPOWER_UNIT') {
        let buffCoords = { r: chosen.fromR, c: chosen.fromC };
        const buffPing = activeTacticalPings.find(
          (p) =>
            (p.intent === 'BUFF' || p.intent === 'DEFEND') &&
            boardState[p.r]?.[p.c]?.color === currentTurn
        );
        if (buffPing) {
          buffCoords = { r: buffPing.r, c: buffPing.c };
          if (buffPing.intent === 'BUFF') {
            removeTacticalPingAt(buffPing.r, buffPing.c, false);
          }
        }
        const unitToBuff = boardState[buffCoords.r]?.[buffCoords.c];
        if (unitToBuff && pendingComboEval) {
          const appliedCombo = pendingComboEval;
          const res = applyComboEmpowermentToUnit(unitToBuff, appliedCombo, boardState, turnNumber);
          const wPos = boardToWorld(buffCoords.r, buffCoords.c);
          spawnDivineLightningBeam(wPos, appliedCombo.ringColor || 0xf5d76e, 0.065);
          spawnFloatingCombatText(
            wPos,
            `🤖 ${appliedCombo.name.toUpperCase()}: +${res.atkBonus}⚔${res.armorBonus > 0 ? ` +${res.armorBonus}🛡` : ''}`,
            appliedCombo.colorHex || '#f5d76e',
            0.88
          );
          lastEmpoweredSquare = { r: buffCoords.r, c: buffCoords.c };
          pendingComboEval = null;
          turnPhase = 'MOVE_OR_COMBAT';
          updateUnit3DBadge(unitToBuff);
        } else {
          pendingComboEval = null;
          turnPhase = 'MOVE_OR_COMBAT';
        }
      }
      let moved = executeChessMove(chosen.fromR, chosen.fromC, chosen.toR, chosen.toC, {
        fromAI: true,
        skipAutoPoker: true
      });
      if (!moved) {
        const allLegal = getAllLegalMoves(currentTurn);
        for (const fb of allLegal) {
          if (fb.fromR === chosen.fromR && fb.fromC === chosen.fromC && fb.toR === chosen.toR && fb.toC === chosen.toC) continue;
          const ok = executeChessMove(fb.fromR, fb.fromC, fb.toR, fb.toC, {
            fromAI: true,
            skipAutoPoker: true
          });
          if (ok) {
            moved = true;
            break;
          }
        }
      }
      if (!moved) {
        return handleTurnTimeout();
      }
      return moved;
    } catch (err) {
      console.error('[AI Move Exception]', err);
      return handleTurnTimeout();
    }
  }

    function maybeScheduleAIMove() {
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      if (gameOver || isAnimatingMove) return;
      if (scriptedGameActive || preMoveHighlightTask) return;
      if (gameMode !== 'single' || !aiAutoPlay) return;

      const aiColor = playerColor === 'w' ? 'b' : 'w';
      if (currentTurn === aiColor) {
        const botProf = getBotDifficultyProfile();
        aiTimer = setTimeout(() => {
          aiTimer = null;
          if (
            !scriptedGameActive &&
            gameMode === 'single' &&
            currentTurn === aiColor &&
            !isAnimatingMove &&
            !gameOver
          ) {
            triggerAIMoveNow();
          }
        }, botProf.thinkDelayMs || 520);
      }
    }

    function toggleAutoMove() {
      // Production Fair-Play Lock: Player Auto-Move is disabled so players play their own turn to earn Elo & Gold
      autoMoveEnabled = false;
      emitPokerChessSync();
      return false;
    }

    // =========================================================================
    // Feature 3 (3a, 3b, 3c): Chess Notation Parser & Step-Through Choreography
    // =========================================================================
    function createInitialVirtualBoard() {
      const b = Array.from({ length: 8 }, () => Array(8).fill(null));
      const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
      for (let c = 0; c < 8; c++) {
        b[7][c] = { type: backRow[c], color: 'w', hasMoved: false };
        b[6][c] = { type: 'pawn', color: 'w', hasMoved: false };
        b[1][c] = { type: 'pawn', color: 'b', hasMoved: false };
        b[0][c] = { type: backRow[c], color: 'b', hasMoved: false };
      }
      return b;
    }

    function getVirtualLegalMovesForSquare(r, c, vBoard) {
      const piece = vBoard[r][c];
      if (!piece) return [];
      const pseudo = getPseudoMovesForPiece(r, c, vBoard);
      const legal = [];
      for (const m of pseudo) {
        const savedTarget = vBoard[m.r][m.c];
        vBoard[m.r][m.c] = piece;
        vBoard[r][c] = null;
        const inCheck = isKingInCheck(piece.color, vBoard);
        vBoard[r][c] = piece;
        vBoard[m.r][m.c] = savedTarget;
        if (!inCheck) legal.push(m);
      }
      return legal;
    }

    function parseNotationToMoves(notationText) {
      const cleaned = String(notationText || '')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\{[^}]*\}/g, ' ')
        .replace(/;[^\n]*/g, ' ')
        .replace(/\([^)]*\)/g, ' ');

      const rawTokens = cleaned
        .split(/\s+/)
        .map((t) => t.replace(/^\d+\.+/g, '').trim())
        .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*|\d+\.?)$/.test(t));

      const vBoard = createInitialVirtualBoard();
      let turn = 'w';
      const parsedMoves = [];
      const promoMap = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
      const sanPieceMap = { N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king', P: 'pawn' };

      for (const rawTok of rawTokens) {
        let tok = rawTok.replace(/[+#!?]+$/g, '');
        if (!tok) continue;

        let matched = null;

        // 1. Castling (O-O / 0-0 / O-O-O / 0-0-0)
        if (/^(O-O-O|0-0-0|O-O|0-0)$/i.test(tok)) {
          const isQueenside = tok.length >= 5;
          const kr = turn === 'w' ? 7 : 0;
          const fromC = 4;
          const toC = isQueenside ? 2 : 6;
          if (vBoard[kr][fromC] && vBoard[kr][fromC].type === 'king') {
            matched = {
              fromR: kr,
              fromC,
              toR: kr,
              toC,
              pieceType: 'king',
              capture: false,
              promotion: null,
              castling: isQueenside ? 'q' : 'k'
            };
          }
        }

        // 2. Coordinate / UCI notation (e.g. e2e4, e2-e4, e4xd5, g1f3, e7e8q)
        if (!matched) {
          const uciMatch = tok.match(/^([a-h])([1-8])[-x]?([a-h])([1-8])(?:=?([qrbnQRBN]))?$/);
          if (uciMatch) {
            const fromC = uciMatch[1].charCodeAt(0) - 97;
            const fromR = 8 - parseInt(uciMatch[2], 10);
            const toC = uciMatch[3].charCodeAt(0) - 97;
            const toR = 8 - parseInt(uciMatch[4], 10);
            const promoChar = uciMatch[5] ? uciMatch[5].toLowerCase() : null;
            const p = vBoard[fromR]?.[fromC];
            if (p && p.color === turn) {
              matched = {
                fromR,
                fromC,
                toR,
                toC,
                pieceType: p.type,
                capture: Boolean(vBoard[toR]?.[toC]),
                promotion: promoChar ? promoMap[promoChar] : null
              };
            }
          }
        }

        // 3. Standard Algebraic Notation (SAN: e4, exd5, Nf3, Nc6, Bc4, Qxd5, Nbd7, R1e2, e8=Q)
        if (!matched) {
          let promotion = null;
          const promoEq = tok.match(/=([QRBNqrbn])$/);
          if (promoEq) {
            promotion = promoMap[promoEq[1].toLowerCase()] || 'queen';
            tok = tok.slice(0, -2);
          }

          let pieceType = 'pawn';
          let rest = tok;
          if (/^[NBRQK]/.test(rest)) {
            pieceType = sanPieceMap[rest[0]];
            rest = rest.slice(1);
          } else if (/^P/.test(rest)) {
            pieceType = 'pawn';
            rest = rest.slice(1);
          }

          const destMatch = rest.match(/([a-h])([1-8])$/);
          if (destMatch) {
            const toC = destMatch[1].charCodeAt(0) - 97;
            const toR = 8 - parseInt(destMatch[2], 10);
            const prefix = rest.slice(0, rest.length - 2).replace(/x/g, '');

            let disambigC = null;
            let disambigR = null;
            for (const ch of prefix) {
              if (ch >= 'a' && ch <= 'h') disambigC = ch.charCodeAt(0) - 97;
              else if (ch >= '1' && ch <= '8') disambigR = 8 - parseInt(ch, 10);
            }

            const candidates = [];
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const p = vBoard[r][c];
                if (!p || p.color !== turn || p.type !== pieceType) continue;
                if (disambigC !== null && c !== disambigC) continue;
                if (disambigR !== null && r !== disambigR) continue;
                const legals = getVirtualLegalMovesForSquare(r, c, vBoard);
                const hit = legals.find((m) => m.r === toR && m.c === toC);
                if (hit) {
                  candidates.push({
                    fromR: r,
                    fromC: c,
                    toR,
                    toC,
                    pieceType,
                    capture: Boolean(hit.capture || vBoard[toR][toC]),
                    promotion
                  });
                }
              }
            }
            if (candidates.length > 0) {
              matched = candidates[0];
            }
          }
        }

        if (!matched) {
          console.warn('Could not parse notation token:', rawTok);
          break;
        }

        const movingPiece = vBoard[matched.fromR][matched.fromC];
        vBoard[matched.fromR][matched.fromC] = null;
        if (matched.castling) {
          const kr = matched.fromR;
          if (matched.castling === 'k') {
            vBoard[kr][5] = vBoard[kr][7];
            vBoard[kr][7] = null;
          } else {
            vBoard[kr][3] = vBoard[kr][0];
            vBoard[kr][0] = null;
          }
        }
        const finalType =
          matched.promotion ||
          (movingPiece.type === 'pawn' && (matched.toR === 0 || matched.toR === 7)
            ? 'queen'
            : movingPiece.type);
        vBoard[matched.toR][matched.toC] = {
          type: finalType,
          color: turn,
          hasMoved: true
        };

        parsedMoves.push({
          index: parsedMoves.length,
          ply: parsedMoves.length + 1,
          moveNumber: Math.floor(parsedMoves.length / 2) + 1,
          color: turn,
          san: rawTok,
          fromR: matched.fromR,
          fromC: matched.fromC,
          toR: matched.toR,
          toC: matched.toC,
          pieceType: matched.pieceType,
          capture: matched.capture,
          promotion: matched.promotion || 'queen'
        });

        turn = turn === 'w' ? 'b' : 'w';
      }

      return parsedMoves;
    }

    function updateScriptBarUI() {
      const label = document.getElementById('script-step-label');
      const statusMsg = document.getElementById('script-status-msg');
      const prevBtn = document.getElementById('btn-script-prev');
      const nextBtn = document.getElementById('btn-script-next');

      const total = scriptMoves.length;
      if (label) {
        if (total === 0) {
          label.textContent = `Move ${moveHistory.length}`;
        } else if (scriptDeviated) {
          label.textContent = `Move ${moveHistory.length} • Custom Takeover`;
        } else if (scriptCursor < total) {
          const nextSan = scriptMoves[scriptCursor].san;
          label.textContent = `Step ${scriptCursor}/${total} • Next: ${nextSan}`;
        } else {
          label.textContent = `Step ${total}/${total} (Done)`;
        }
      }
      if (prevBtn) {
        prevBtn.disabled = moveHistory.length === 0 && !preMoveHighlightTask && !isAnimatingMove;
      }
      if (nextBtn) {
        nextBtn.disabled = gameOver || (!scriptDeviated && total > 0 && scriptCursor >= total && !preMoveHighlightTask);
      }
      if (statusMsg && total > 0) {
        if (scriptDeviated) {
          statusMsg.textContent = `Custom takeover active at Move ${moveHistory.length} (Use [ to step back or ] for AI move).`;
        } else {
          statusMsg.textContent = `Loaded ${total} half-moves. Step ${scriptCursor}/${total} ready (Use [ and ] to step, Arrow keys to rotate cam).`;
        }
      }
    }

    const DEFAULT_DIRECTOR_NOTATION =
      '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd8 4. d4 c6 5. Bc4 h6 6. Nf3 Bg4 7. Bxf7+ Kxf7 8. Ne5+ Ke8 9. Qxg4 Nf6 10. Qg6#';

    function loadNotationScript(notationStr, options = {}) {
      const parsed = parseNotationToMoves(notationStr);
      scriptMoves = parsed;
      scriptCursor = 0;
      scriptDeviated = false;
      scriptedGameActive = parsed.length > 0;
      const inputEl = document.getElementById('input-notation');
      if (inputEl && notationStr) {
        inputEl.value = notationStr;
      }
      resetChessBoard(Boolean(options.orientCamera), true);
      updateScriptBarUI();
      return {
        ok: parsed.length > 0,
        count: parsed.length,
        moves: parsed
      };
    }

    function completeCurrentMoveImmediately() {
      if (preMoveHighlightTask) {
        const mv = preMoveHighlightTask.move;
        const fromScriptFlag = Boolean(preMoveHighlightTask.fromScript);
        preMoveHighlightTask = null;
        executeChessMove(mv.fromR, mv.fromC, mv.toR, mv.toC, { fromScript: fromScriptFlag });
      }
      let safety = 0;
      while (activeMoveTweens.length > 0 && safety < 200) {
        safety++;
        for (let i = activeMoveTweens.length - 1; i >= 0; i--) {
          const done = activeMoveTweens[i](0.05);
          if (done) activeMoveTweens.splice(i, 1);
        }
      }
    }

    function isScriptMoveLegalOnCurrentBoard(mv) {
      if (!mv) return false;
      const piece = boardState[mv.fromR]?.[mv.fromC];
      if (!piece || piece.color !== currentTurn) return false;
      const destPiece = boardState[mv.toR]?.[mv.toC];
      if (destPiece && destPiece.color === piece.color) return false;
      const legals = getLegalMovesForPiece(mv.fromR, mv.fromC);
      return legals.some((m) => m.r === mv.toR && m.c === mv.toC);
    }

    function stepScriptForward() {
      if (gameOver) return false;

      // If a move animation or pre-move highlight is currently running, finish it cleanly before advancing
      if (isAnimatingMove || preMoveHighlightTask) {
        completeCurrentMoveImmediately();
        if (gameOver) return false;
        if (!scriptDeviated && scriptMoves.length > 0 && scriptCursor >= scriptMoves.length) return false;
      }

      // If no notation script has been loaded yet and no moves have been played, parse the default script in #input-notation
      if (scriptMoves.length === 0 && moveHistory.length === 0) {
        const defaultPgn =
          document.getElementById('input-notation')?.value || DEFAULT_DIRECTOR_NOTATION;
        loadNotationScript(defaultPgn, { orientCamera: false });
      }

      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }

      // Determine whether the next scripted move is still valid on the current board
      let nextMove = null;
      let isFromScript = false;
      if (!scriptDeviated && scriptCursor < scriptMoves.length) {
        const candidate = scriptMoves[scriptCursor];
        if (isScriptMoveLegalOnCurrentBoard(candidate)) {
          nextMove = candidate;
          isFromScript = true;
          scriptedGameActive = true;
        } else {
          scriptDeviated = true;
          scriptedGameActive = false;
        }
      }

      // If the user took over and deviated from the script, Next ] cleanly executes a smart legal move for currentTurn
      if (!nextMove) {
        if (!scriptDeviated && scriptMoves.length > 0 && scriptCursor >= scriptMoves.length) {
          return false;
        }
        const aiFallback = chooseSmartAIMove(currentTurn);
        if (!aiFallback) return false;
        nextMove = {
          fromR: aiFallback.fromR,
          fromC: aiFallback.fromC,
          toR: aiFallback.toR,
          toC: aiFallback.toC,
          color: currentTurn
        };
        isFromScript = false;
      }

      const chkHighlight = document.getElementById('chk-premove-highlight');
      const chkBoth = document.getElementById('chk-premove-both');
      const showPreHighlight = chkHighlight ? chkHighlight.checked : true;
      const highlightBothSides = chkBoth ? chkBoth.checked : false;

      // Feature 3c: When triggering moves for the player's side (or both sides if toggled),
      // first show selecting the piece and its legal destination squares before executing the move!
      if (showPreHighlight && (nextMove.color === playerColor || highlightBothSides)) {
        selectedSquare = { r: nextMove.fromR, c: nextMove.fromC };
        validMoves = getLegalMovesForPiece(nextMove.fromR, nextMove.fromC);
        showSquareHighlights(nextMove.fromR, nextMove.fromC, validMoves);
        preMoveHighlightTask = {
          move: nextMove,
          fromScript: isFromScript,
          elapsedSim: 0,
          startWallMs: performance.now(),
          duration: 0.62
        };
        updateScriptBarUI();
        return true;
      }

      return executeChessMove(nextMove.fromR, nextMove.fromC, nextMove.toR, nextMove.toC, {
        fromScript: isFromScript
      });
    }

    function stepScriptBackward() {
      if (preMoveHighlightTask) {
        preMoveHighlightTask = null;
        clearSquareHighlights();
        selectedSquare = null;
        validMoves = [];
        updateScriptBarUI();
        return true;
      }

      if (moveHistory.length === 0) {
        return false;
      }

      const lastEntry = moveHistory.pop();
      restoreBoardSnapshot(lastEntry.snapshot);
      return true;
    }

    // =========================================================================
    // Feature 1: Toggle All On-Screen UI Off/On for Clean Cinematic Recording
    // =========================================================================
    function toggleUI(forceHidden) {
      const shouldHide =
        typeof forceHidden === 'boolean'
          ? forceHidden
          : !document.body.classList.contains('cinematic-ui-hidden');
      document.body.classList.toggle('cinematic-ui-hidden', shouldHide);
      const btnHide = document.getElementById('btn-hide-ui');
      if (btnHide) {
        btnHide.textContent = shouldHide ? 'Show UI [H]' : 'Hide UI [H]';
      }
      return shouldHide;
    }

    // =========================================================================
    // Feature 4: Video-Game Style WASD + R/F Translation & Arrow-Key Rotation
    // with Configurable Speed (Default 10%) & Smooth Ease-In / Ease-Out
    // =========================================================================
    const heldCameraKeys = new Set();
    const CAM_MOVE_KEY_CODES = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyR',
      'KeyF',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight'
    ]);
    let cameraKeySpeedPct = 35;
    let cameraRotSpeedPct = 35;
    const keyMoveVelocity = new THREE.Vector3(0, 0, 0);
    const keyRotVelocity = { yaw: 0, pitch: 0 };

    function setCameraKeySpeedPercent(pct) {
      const clamped = Math.max(1, Math.min(200, Math.round(Number(pct) || 10)));
      cameraKeySpeedPct = clamped;
      const sliderEl = document.getElementById('input-cam-speed');
      const valEl = document.getElementById('cam-speed-val');
      if (sliderEl && Number(sliderEl.value) !== clamped) {
        sliderEl.value = String(clamped);
      }
      if (valEl) {
        valEl.textContent = `${clamped}%`;
      }
      return cameraKeySpeedPct;
    }

    function setCameraRotSpeedPercent(pct) {
      const clamped = Math.max(1, Math.min(200, Math.round(Number(pct) || 10)));
      cameraRotSpeedPct = clamped;
      const sliderEl = document.getElementById('input-rot-speed');
      const valEl = document.getElementById('rot-speed-val');
      if (sliderEl && Number(sliderEl.value) !== clamped) {
        sliderEl.value = String(clamped);
      }
      if (valEl) {
        valEl.textContent = `${clamped}%`;
      }
      return cameraRotSpeedPct;
    }

    const camSpeedSliderEl = document.getElementById('input-cam-speed');
    if (camSpeedSliderEl) {
      camSpeedSliderEl.addEventListener('input', (e) => {
        setCameraKeySpeedPercent(e.target.value);
      });
      camSpeedSliderEl.addEventListener('change', (e) => {
        setCameraKeySpeedPercent(e.target.value);
      });
    }

    const rotSpeedSliderEl = document.getElementById('input-rot-speed');
    if (rotSpeedSliderEl) {
      rotSpeedSliderEl.addEventListener('input', (e) => {
        setCameraRotSpeedPercent(e.target.value);
      });
      rotSpeedSliderEl.addEventListener('change', (e) => {
        setCameraRotSpeedPercent(e.target.value);
      });
    }

    function isTypingInInput(el) {
      if (!el) return false;
      const tag = (el.tagName || '').toUpperCase();
      if (tag === 'TEXTAREA' || el.isContentEditable) return true;
      if (tag === 'INPUT') {
        const type = (el.type || '').toLowerCase();
        return type !== 'range' && type !== 'checkbox' && type !== 'button';
      }
      return false;
    }

    window.addEventListener('keydown', (e) => {
      if (isTypingInInput(document.activeElement)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (CAM_MOVE_KEY_CODES.has(e.code)) {
        e.preventDefault();
        heldCameraKeys.add(e.code);
        return;
      }

      if (e.code === 'KeyH' || e.code === 'KeyU') {
        e.preventDefault();
        toggleUI();
        return;
      }

      if (e.code === 'KeyG' || e.code === 'KeyV') {
        e.preventDefault();
        if (hoveredSquare) {
          pingBoardSquare(hoveredSquare.r, hoveredSquare.c, selectedPingIntent);
        } else {
          toggleTacticalPingMode();
        }
        return;
      }

      if (e.code === 'Escape' && tacticalPingMode) {
        e.preventDefault();
        toggleTacticalPingMode(false);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (CAM_MOVE_KEY_CODES.has(e.code)) {
        heldCameraKeys.delete(e.code);
      }
    });

    window.addEventListener('blur', () => {
      heldCameraKeys.clear();
    });

    // =========================================================================
    // Feature 7: Checkmate Rigged King Fall-Over Animation & Cathedral Overlay
    // =========================================================================
    function spawnKingFallImpact(worldPos, color) {
      const mat = color === 'w' ? whitePieceMat : blackPieceMat;
      for (let i = 0; i < 18; i++) {
        const sz = 0.015 + Math.random() * 0.028;
        const geo = new THREE.DodecahedronGeometry(sz, 0);
        const frag = new THREE.Mesh(geo, mat);
        frag.position.set(
          worldPos.x + (Math.random() - 0.5) * 0.14,
          BOARD_SURFACE_Y + 0.04 + Math.random() * 0.10,
          worldPos.z + (Math.random() - 0.5) * 0.14
        );
        frag.castShadow = false;
        scene.add(frag);
        shatterDebris.push({
          mesh: frag,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 1.45,
            0.65 + Math.random() * 1.25,
            (Math.random() - 0.5) * 1.45
          ),
          rotVel: new THREE.Vector3(
            Math.random() * 8,
            Math.random() * 8,
            Math.random() * 8
          ),
          life: 1.65
        });
      }
      impactFlashLight.position.set(worldPos.x, BOARD_SURFACE_Y + 0.35, worldPos.z);
      impactFlashLight.intensity = 6.2;
    }

    // =========================================================================
    // Checkmate Golden Crown & Cathedral Stained-Glass Confetti Particle Engine
    // =========================================================================
    let checkmateConfettiRaf = null;
    let checkmateConfettiParticles = [];
    let checkmateConfettiResizeHandler = null;

    function stopCheckmateConfetti() {
      if (checkmateConfettiRaf) {
        cancelAnimationFrame(checkmateConfettiRaf);
        checkmateConfettiRaf = null;
      }
      if (checkmateConfettiResizeHandler) {
        window.removeEventListener('resize', checkmateConfettiResizeHandler);
        checkmateConfettiResizeHandler = null;
      }
      checkmateConfettiParticles = [];
      const canvas = document.getElementById('checkmate-confetti-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    function startCheckmateConfetti(winnerColor = 'w') {
      stopCheckmateConfetti();
      const canvas = document.getElementById('checkmate-confetti-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const syncCanvasSize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      syncCanvasSize();
      checkmateConfettiResizeHandler = syncCanvasSize;
      window.addEventListener('resize', checkmateConfettiResizeHandler);

      // Cathedral Stained-Glass Rose Window & Royal Gold Palette
      const stainedGlassColors = [
        '#f5d76e', // Royal Sanctum Gold
        '#d4af37', // Burnished Gold
        '#fff3b0', // Celestial Ivory Gold
        '#e63946', // Cathedral Ruby Crimson
        '#38bdf8', // Rose Window Sapphire
        '#c084fc', // Imperial Amethyst
        '#f59e0b', // Sacred Amber
        '#10b981'  // Sanctum Emerald
      ];

      const types = ['crown', 'stained_diamond', 'cathedral_star', 'gold_ribbon'];
      const totalParticles = 96;
      const w = canvas.width;
      const h = canvas.height;
      const crownGlyph = winnerColor === 'b' ? '♚' : '♔';

      const createParticle = (fromBurst = true) => {
        const roll = Math.random();
        const kind =
          roll < 0.20
            ? 'crown'
            : roll < 0.52
              ? 'stained_diamond'
              : roll < 0.76
                ? 'cathedral_star'
                : 'gold_ribbon';

        // Initial burst erupts from the top-center proclamation banner & flanking cathedral arches
        const spawnFromCenter = fromBurst && Math.random() < 0.68;
        const startX = spawnFromCenter
          ? w * 0.5 + (Math.random() - 0.5) * Math.min(480, w * 0.55)
          : Math.random() * w;
        const startY = spawnFromCenter
          ? Math.min(165, h * 0.22) + (Math.random() - 0.5) * 60
          : -20 - Math.random() * h * 0.45;

        const burstAngle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.92;
        const burstSpeed = spawnFromCenter ? 140 + Math.random() * 280 : 30 + Math.random() * 90;

        return {
          kind: types.includes(kind) ? kind : 'gold_ribbon',
          x: startX,
          y: startY,
          vx: spawnFromCenter ? Math.cos(burstAngle) * burstSpeed : (Math.random() - 0.5) * 75,
          vy: spawnFromCenter
            ? Math.sin(burstAngle) * burstSpeed * 0.65 + 45
            : 65 + Math.random() * 125,
          gravity: 135 + Math.random() * 85,
          drag: 0.986,
          size:
            kind === 'crown'
              ? 18 + Math.random() * 11
              : kind === 'stained_diamond'
                ? 8 + Math.random() * 7
                : kind === 'cathedral_star'
                  ? 7 + Math.random() * 6
                  : 10 + Math.random() * 8,
          color: stainedGlassColors[Math.floor(Math.random() * stainedGlassColors.length)],
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 3.8,
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 2.2 + Math.random() * 3.2,
          flipPhase: Math.random() * Math.PI * 2,
          flipSpeed: 3.0 + Math.random() * 4.5,
          opacity: 0.78 + Math.random() * 0.22,
          crownGlyph
        };
      };

      checkmateConfettiParticles = Array.from({ length: totalParticles }, () =>
        createParticle(true)
      );

      let lastTime = performance.now();

      const renderFrame = (now) => {
        if (!checkmateState.bannerVisible) {
          stopCheckmateConfetti();
          return;
        }
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        const cw = canvas.width;
        const ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        for (let i = 0; i < checkmateConfettiParticles.length; i++) {
          const p = checkmateConfettiParticles[i];
          p.vx *= p.drag;
          p.vy = Math.min(240, p.vy + p.gravity * dt);
          p.wobblePhase += p.wobbleSpeed * dt;
          p.flipPhase += p.flipSpeed * dt;
          p.x += (p.vx + Math.sin(p.wobblePhase) * 28) * dt;
          p.y += p.vy * dt;
          p.rot += p.rotSpeed * dt;

          // Respawn particles gently at the top of the cathedral screen once they fall past the bottom
          if (p.y > ch + 36 || p.x < -60 || p.x > cw + 60) {
            const nextP = createParticle(false);
            nextP.y = -24 - Math.random() * 40;
            nextP.x = Math.random() * cw;
            checkmateConfettiParticles[i] = nextP;
            continue;
          }

          const flipScaleY = Math.max(0.22, Math.abs(Math.cos(p.flipPhase)));
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.opacity;

          if (p.kind === 'crown') {
            ctx.font = `700 ${Math.round(p.size)}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(15, 11, 5, 0.85)';
            ctx.strokeText(p.crownGlyph, 0, 0);
            ctx.fillStyle = '#f5d76e';
            ctx.fillText(p.crownGlyph, 0, 0);
          } else if (p.kind === 'stained_diamond') {
            ctx.scale(1, flipScaleY);
            const r = p.size;
            ctx.beginPath();
            ctx.moveTo(0, -r * 1.25);
            ctx.lineTo(r * 0.82, 0);
            ctx.lineTo(0, r * 1.25);
            ctx.lineTo(-r * 0.82, 0);
            ctx.closePath();
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = '#f5d76e';
            ctx.stroke();
          } else if (p.kind === 'cathedral_star') {
            const outerR = p.size;
            const innerR = p.size * 0.34;
            ctx.beginPath();
            for (let s = 0; s < 8; s++) {
              const rad = s % 2 === 0 ? outerR : innerR;
              const ang = (s * Math.PI) / 4;
              if (s === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
              else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
            }
            ctx.closePath();
            ctx.fillStyle = '#fff3b0';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#d4af37';
            ctx.stroke();
          } else {
            ctx.scale(1, flipScaleY);
            const rw = p.size * 1.35;
            const rh = p.size * 0.52;
            ctx.fillStyle = p.color;
            ctx.fillRect(-rw * 0.5, -rh * 0.5, rw, rh);
            ctx.strokeStyle = 'rgba(255, 243, 176, 0.7)';
            ctx.lineWidth = 0.9;
            ctx.strokeRect(-rw * 0.5, -rh * 0.5, rw, rh);
          }

          ctx.restore();
        }

        checkmateConfettiRaf = requestAnimationFrame(renderFrame);
      };

      checkmateConfettiRaf = requestAnimationFrame(renderFrame);
    }

    function showCheckmateBanner(winnerColor, defeatedColor) {
      const overlay = document.getElementById('checkmate-overlay');
      const crownEl = document.getElementById('checkmate-crown');
      const titleEl = document.getElementById('checkmate-title');
      const subEl = document.getElementById('checkmate-subtitle');

      const winnerName = winnerColor === 'w' ? 'White' : 'Black';
      const defeatedName = defeatedColor === 'w' ? 'White' : 'Black';

      // Record Ranked Elo & Gold Rewards once per finished match
      if (!checkmateState.rankedRewardGranted) {
        checkmateState.rankedRewardGranted = true;
        const matchRec = recordRankedMatchOutcome(winnerColor);
        const sign = matchRec.eloDelta >= 0 ? '+' : '';
        if (subEl) {
          subEl.textContent = `${winnerName} Triumphs • Elo ${sign}${matchRec.eloDelta} (${matchRec.eloAfter} Elo) • +${matchRec.goldReward} Vàng`;
        }
        emitPokerChessSync();
      } else if (subEl) {
        subEl.textContent = `${winnerName} Triumphs • The ${defeatedName} King Has Fallen`;
      }

      if (crownEl) crownEl.textContent = winnerColor === 'w' ? '♔' : '♚';
      if (titleEl) titleEl.textContent = 'Checkmate';
      if (overlay) {
        overlay.classList.add('visible');
      }
      checkmateState.bannerVisible = true;
      startCheckmateConfetti(winnerColor);
    }

    function triggerCheckmateSequence(defeatedColor = currentTurn, winnerColor = null) {
      soundFX.stopLowTimeTickingLoop(true);
      const actualWinner = winnerColor || (defeatedColor === 'w' ? 'b' : 'w');

      // Find the defeated King on the board (or use checkmateState.fallenKingPiece if overwritten by attacker)
      let kingPiece = checkmateState.fallenKingPiece || null;
      let kingR = kingPiece ? kingPiece.r : -1;
      let kingC = kingPiece ? kingPiece.c : -1;
      if (!kingPiece) {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.type === 'king' && p.color === defeatedColor) {
              kingPiece = p;
              kingR = r;
              kingC = c;
              break;
            }
          }
        }
      }
      checkmateState.fallenKingPiece = kingPiece;

      checkmateState.active = true;
      checkmateState.defeatedColor = defeatedColor;
      checkmateState.winnerColor = actualWinner;
      checkmateState.kingFallAngleDeg = 0;
      checkmateState.phase = 'stagger';

      if (!kingPiece || !kingPiece.mesh) {
        showCheckmateBanner(actualWinner, defeatedColor);
        return false;
      }

      // Find the checkmating attacker piece so the King falls away from the blow or into the clearest open square
      let attackerPos = null;
      if (moveHistory.length > 0) {
        const lastMv = moveHistory[moveHistory.length - 1].move;
        if (lastMv) {
          attackerPos = boardToWorld(lastMv.toR, lastMv.toC);
        }
      }
      if (!attackerPos) {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.color === actualWinner) {
              const moves = getPseudoMovesForPiece(r, c, boardState);
              if (moves.some((m) => m.r === kingR && m.c === kingC)) {
                attackerPos = boardToWorld(r, c);
                break;
              }
            }
          }
        }
      }

      const homePos = boardToWorld(kingR, kingC);
      const forwardDirZ = defeatedColor === 'b' ? 1 : -1;

      // Evaluate 16 candidate fall directions around the King to pick the clearest open path on the board
      let bestDirX = 0.24;
      let bestDirZ = forwardDirZ * 0.97;
      let bestScore = -Infinity;

      const awayFromAttacker = attackerPos
        ? new THREE.Vector2(homePos.x - attackerPos.x, homePos.z - attackerPos.z).normalize()
        : new THREE.Vector2(0.25, forwardDirZ).normalize();

      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dz = Math.sin(ang);

        // Check where the King's crown (0.50m from base) lands in board coordinates
        const tipWorldX = homePos.x + dx * 0.44;
        const tipWorldZ = homePos.z + dz * 0.44;
        const tipC = Math.round(tipWorldX / BOARD_SQ_SIZE + 3.5);
        const tipR = Math.round(tipWorldZ / BOARD_SQ_SIZE + 3.5);

        let score = 0;
        // Prefer staying inside the 8x8 board surface
        if (tipR >= 0 && tipR < 8 && tipC >= 0 && tipC < 8) {
          score += 40;
          const occ = boardState[tipR]?.[tipC];
          if (!occ) {
            score += 65; // Open square for the fallen King's body & crown!
          } else if (occ !== kingPiece) {
            score -= 50;
          }
        } else {
          score -= 35;
        }

        // Prefer falling away from the attacker's blow or forward-diagonally toward the center
        score += (dx * awayFromAttacker.x + dz * awayFromAttacker.y) * 18;
        score += dz * forwardDirZ * 14;

        if (score > bestScore) {
          bestScore = score;
          bestDirX = dx;
          bestDirZ = dz;
        }
      }

      const fallLen = Math.hypot(bestDirX, bestDirZ) || 1;
      const fallDirX = bestDirX / fallLen;
      const fallDirZ = bestDirZ / fallLen;

      // Highlight the defeated King's square with a crimson-and-gold Checkmate ring
      clearSquareHighlights();
      const outerRingGeo = new THREE.RingGeometry(0.135, 0.175, 36);
      outerRingGeo.rotateX(-Math.PI / 2);
      const outerRingMat = new THREE.MeshBasicMaterial({ color: 0xe63946, side: THREE.DoubleSide });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      outerRing.position.set(homePos.x, BOARD_SURFACE_Y + 0.012, homePos.z);
      squareHighlightsGroup.add(outerRing);

      const innerRingGeo = new THREE.RingGeometry(0.10, 0.125, 36);
      innerRingGeo.rotateX(-Math.PI / 2);
      const innerRingMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e, side: THREE.DoubleSide });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.position.set(homePos.x, BOARD_SURFACE_Y + 0.014, homePos.z);
      squareHighlightsGroup.add(innerRing);

      // Pause the King's idle mixer so its stone statue mesh pivots cleanly as a rigid monument
      if (kingPiece.currentAction) {
        kingPiece.currentAction.paused = true;
      }

      // Face the King toward the checkmating attacker (or forward) before toppling
      const baseYaw = attackerPos
        ? Math.atan2(attackerPos.x - homePos.x, attackerPos.z - homePos.z)
        : (defeatedColor === 'w' ? Math.PI : 0);
      const qBaseFacing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), baseYaw);
      // Right-handed horizontal axis perpendicular to fallDir so +angle pitches the King's crown toward (fallDirX, 0, fallDirZ)
      const tiltAxis = new THREE.Vector3(fallDirZ, 0, -fallDirX).normalize();
      const qTilt = new THREE.Quaternion();

      // Smoothly frame the checkmate on the board if the user isn't manually flying the camera with WASD
      if (heldCameraKeys.size === 0) {
        const camSideX = homePos.x >= 0 ? -1.35 : 1.35;
        const camSideZ = homePos.z + forwardDirZ * 1.45;
        smoothCameraTo(
          new THREE.Vector3(homePos.x + camSideX, BOARD_SURFACE_Y + 1.15, camSideZ),
          new THREE.Vector3(
            homePos.x + fallDirX * 0.22,
            BOARD_SURFACE_Y + 0.18,
            homePos.z + fallDirZ * 0.22
          ),
          0.95
        );
      }

      const RIM_RADIUS = 0.135;    // Pedestal bottom rim radius so the lower edge stays grounded on the board
      const MAX_FALL_RAD = 1.50;   // 86 degrees: King lies fallen on its side across the board tiles
      const tStagger = 0.36;
      const tImpact = 1.12;
      const tTotal = 1.82;

      let elapsed = 0;
      let impactTriggered = false;
      let bannerShown = false;

      function applyKingTopplePose(thetaRad, shudderRoll = 0) {
        const clampedTheta = Math.max(-0.15, Math.min(1.55, thetaRad));
        checkmateState.kingFallAngleDeg = Number(((clampedTheta * 180) / Math.PI).toFixed(1));

        const px = homePos.x + fallDirX * RIM_RADIUS * (1 - Math.cos(clampedTheta));
        const py = BOARD_SURFACE_Y + RIM_RADIUS * Math.sin(Math.max(0, clampedTheta));
        const pz = homePos.z + fallDirZ * RIM_RADIUS * (1 - Math.cos(clampedTheta));
        kingPiece.mesh.position.set(px, py, pz);

        qTilt.setFromAxisAngle(tiltAxis, clampedTheta);
        if (Math.abs(shudderRoll) > 1e-4) {
          const qShudder = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(fallDirX, 0, fallDirZ),
            shudderRoll
          );
          qTilt.multiply(qShudder);
        }
        kingPiece.mesh.quaternion.copy(qTilt).multiply(qBaseFacing);
      }

      function stepKingFall(dt) {
        if (!checkmateState.active || !kingPiece.mesh) return true;
        elapsed += dt;

        if (!bannerShown && elapsed >= 0.48) {
          bannerShown = true;
          soundFX.playVictoryFanfare();
          showCheckmateBanner(actualWinner, defeatedColor);
        }

        if (elapsed <= tStagger) {
          // Phase 1: Royal Stagger & Tremor as the checkmate blow echoes through the King statue
          checkmateState.phase = 'stagger';
          const u = elapsed / tStagger;
          const shudder = Math.sin(u * Math.PI * 6) * 0.065 * (1 - u * 0.3);
          const initialLean = u * u * 0.12;
          applyKingTopplePose(initialLean, shudder);
        } else if (elapsed <= tImpact) {
          // Phase 2: Accelerating Gravity Topple around the stone pedestal rim (0.12 rad -> 1.50 rad = 86 deg)
          checkmateState.phase = 'topple';
          const u = Math.min(1, (elapsed - tStagger) / (tImpact - tStagger));
          const gravCurve = Math.pow(u, 2.25);
          const theta = 0.12 + (MAX_FALL_RAD - 0.12) * gravCurve;
          applyKingTopplePose(theta, 0);
        } else {
          // Phase 3: Heavy Stone Impact, Crown Shard Burst & Damped Restitution Bounce
          checkmateState.phase = 'impact';
          if (!impactTriggered) {
            impactTriggered = true;
            const crownImpactPos = new THREE.Vector3(
              homePos.x + fallDirX * 0.45,
              BOARD_SURFACE_Y,
              homePos.z + fallDirZ * 0.45
            );
            spawnKingFallImpact(crownImpactPos, defeatedColor);
          }

          const uBounce = Math.min(1, (elapsed - tImpact) / (tTotal - tImpact));
          const bounceAmp = 0.13 * Math.pow(1 - uBounce, 1.85);
          const theta = MAX_FALL_RAD - Math.abs(Math.sin(uBounce * Math.PI * 2.0)) * bounceAmp;
          applyKingTopplePose(theta, 0);

          // Subtle damped camera tremor when the heavy stone King crashes onto the altar board
          if (elapsed <= tImpact + 0.28) {
            const sProg = (elapsed - tImpact) / 0.28;
            const decay = (1 - sProg) * (1 - sProg);
            camera.position.y += Math.cos(sProg * Math.PI * 8) * 0.022 * decay;
          }
        }

        if (elapsed >= tTotal) {
          applyKingTopplePose(MAX_FALL_RAD, 0);
          checkmateState.phase = 'fallen';
          if (!bannerShown) {
            showCheckmateBanner(actualWinner, defeatedColor);
          }
          return true;
        }
        return false;
      }

      activeMoveTweens.push(stepKingFall);
      return true;
    }

    // =========================================================================
    // UI & Turn Status Updates + Poker Chess Custom Event Sync
    // =========================================================================
    function toAlgebraic(r, c) {
      if (typeof r !== 'number' || typeof c !== 'number' || r < 0 || r > 7 || c < 0 || c > 7) {
        return '--';
      }
      return `${String.fromCharCode(97 + c)}${8 - r}`;
    }

    function normalizeComboForUI(combo) {
      if (!combo) return null;
      const rnk = combo.rank || 1;
      const defaultMana = combo.manaCost || (rnk >= 8 ? 5 : rnk === 7 ? 4 : rnk >= 4 ? 3 : rnk >= 2 ? 2 : 1);
      return {
        key: combo.id || combo.key || 'HIGH_CARD',
        rank: rnk,
        manaCost: defaultMana,
        hsKeyword: combo.hsKeyword || combo.role || 'Battlecry Buff',
        nameVi: combo.name || combo.nameVi || 'Mậu Thầu',
        nameEn: combo.enName || combo.nameEn || 'High Card',
        atkBonus: combo.totalAtkBonus ?? combo.atkBonus ?? 0,
        armorBonus: combo.totalArmorBonus ?? combo.armorBonus ?? 0,
        instantHeal: combo.healInstant ?? combo.instantHeal ?? 0,
        isUltimate: Boolean(combo.isUltimate),
        badgeColor: combo.colorHex || combo.badgeColor || '#f5d76e',
        shortTag: combo.role || combo.shortTag || '',
        descVi: combo.desc || combo.descVi || ''
      };
    }

    function serializeUnitForUI(p, r, c) {
      if (!p) return null;
      if (typeof p.hp !== 'number') {
        attachRPGStatsToPiece(p, p.level || 1);
      }
      let bonusDef = 0;
      let bonusAtk = 0;
      if (p.type === 'pawn') {
        for (const dc of [-1, 1]) {
          const ally = boardState[r]?.[c + dc];
          if (ally && ally.color === p.color && ally.type === 'pawn') {
            bonusAtk += 1;
            bonusDef += 2;
          }
        }
      }
      const lvl = p.level || 1;
      const baseAtk = p.baseAtk ?? (UNIT_BASE_STATS[p.type]?.atk || 3);
      const comboAtk = p.activeCombo?.atkBonus || 0;
      const tileMod = getBoardTileModifier(r, c);
      const tileAtkMod = tileMod ? tileMod.atkMod : 0;
      const tileArmorMod = tileMod ? tileMod.armorMod : 0;
      const rawArmor = p.armor || 0;
      const effectiveArmor = Math.max(0, rawArmor + bonusDef + tileArmorMod);
      const sk = UNIT_SKILLS[p.type];
      return {
        r,
        c,
        algebraic: toAlgebraic(r, c),
        type: p.type,
        nameVi: UNIT_BASE_STATS[p.type]?.name || UNIT_BASE_STATS[p.type]?.nameVi || p.type,
        icon: UNIT_BASE_STATS[p.type]?.icon || '♟',
        color: p.color,
        level: lvl,
        xp: p.xp || 0,
        nextXp: LEVEL_XP_THRESHOLDS[Math.min(4, lvl)] || 190,
        atk: Math.max(1, baseAtk + comboAtk + bonusAtk + tileAtkMod),
        baseAtk,
        hp: p.hp,
        maxHp: p.maxHp,
        armor: rawArmor,
        effectiveArmor,
        phalanxDef: bonusDef,
        tileAtkMod,
        tileArmorMod,
        tileModifier: tileMod
          ? {
              id: tileMod.id,
              nameVi: tileMod.nameVi,
              nameEn: tileMod.nameEn,
              shortLabel: tileMod.shortLabel,
              icon: tileMod.icon,
              atkMod: tileMod.atkMod,
              armorMod: tileMod.armorMod,
              colorHex: tileMod.colorHex,
              descVi: tileMod.descVi
            }
          : null,
        activeCombo: normalizeComboForUI(p.activeCombo),
        skill: sk
          ? {
              nameVi: sk.name || sk.nameVi || '',
              descVi: sk.desc || sk.descVi || ''
            }
          : null,
        killCount: p.killCount || 0,
        shieldwallReady: Boolean(p.shieldwallReady),
        combatAnimState: p.combatAnimState || null,
        hpPercent: Math.max(0, Math.min(100, Math.round((p.hp / Math.max(1, p.maxHp)) * 100))),
        portraitState:
          p.hp / Math.max(1, p.maxHp) < 0.2
            ? 'SHIELD_SHATTER'
            : p.hp / Math.max(1, p.maxHp) <= 0.5
              ? 'BATTLE_WORN'
              : 'PRISTINE',
        shieldShattered: Boolean(p.hp > 0 && p.hp / Math.max(1, p.maxHp) < 0.2),
        pathHistory: Array.isArray(p.pathHistory)
          ? p.pathHistory.map((st) => ({ ...st }))
          : [{ r, c, algebraic: toAlgebraic(r, c), turn: 0, kind: 'SPAWN' }]
      };
    }

    function getKingSummary(color) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (p && p.type === 'king' && p.color === color) {
            return { ...serializeUnitForUI(p, r, c), alive: p.hp > 0 };
          }
        }
      }
      return {
        r: color === 'w' ? 7 : 0,
        c: 4,
        algebraic: color === 'w' ? 'e1' : 'e8',
        type: 'king',
        nameVi: 'Vua',
        icon: color === 'w' ? '♔' : '♚',
        color,
        level: 1,
        xp: 0,
        nextXp: 20,
        atk: 0,
        baseAtk: 4,
        hp: 0,
        maxHp: 40,
        armor: 0,
        effectiveArmor: 0,
        phalanxDef: 0,
        tileAtkMod: 0,
        tileArmorMod: 0,
        tileModifier: null,
        activeCombo: null,
        skill: null,
        killCount: 0,
        shieldwallReady: false,
        alive: false
      };
    }

    function getPokerChessUIState() {
      const activeColor = gameMode === 'single' ? playerColor : currentTurn;
      const pState = pokerDecks?.[activeColor] || pokerDecks?.w || createPlayerPokerState();
      const selectedCards = (pState.selectedIndices || [])
        .map((idx) => pState.hand[idx])
        .filter(Boolean);
      const rawEval =
        selectedCards.length === 5
          ? evaluate5CardCombo(selectedCards)
          : findBest5Of7(pState.hand)?.evaluation || null;

      // Determine inspected unit (Hovered > Selected > Empowered > Player King) so Tactical Unit Inspector is always visible
      let inspectedUnit = null;
      if (hoveredSquare && boardState[hoveredSquare.r]?.[hoveredSquare.c]) {
        inspectedUnit = serializeUnitForUI(
          boardState[hoveredSquare.r][hoveredSquare.c],
          hoveredSquare.r,
          hoveredSquare.c
        );
      } else if (selectedSquare && boardState[selectedSquare.r]?.[selectedSquare.c]) {
        inspectedUnit = serializeUnitForUI(
          boardState[selectedSquare.r][selectedSquare.c],
          selectedSquare.r,
          selectedSquare.c
        );
      } else if (
        lastEmpoweredSquare &&
        boardState[lastEmpoweredSquare.r]?.[lastEmpoweredSquare.c]
      ) {
        inspectedUnit = serializeUnitForUI(
          boardState[lastEmpoweredSquare.r][lastEmpoweredSquare.c],
          lastEmpoweredSquare.r,
          lastEmpoweredSquare.c
        );
      } else {
        const fallbackKing = getKingSummary(activeColor);
        if (fallbackKing && fallbackKing.alive) {
          inspectedUnit = fallbackKing;
        }
      }

      const hoveredTileMod = hoveredSquare
        ? getBoardTileModifier(hoveredSquare.r, hoveredSquare.c)
        : null;
      const hoveredTileModifier = hoveredTileMod
        ? {
            ...hoveredTileMod,
            algebraic: toAlgebraic(hoveredSquare.r, hoveredSquare.c)
          }
        : null;

      // Compute Live Combat Forecast if a friendly unit is selected and hovering a legal enemy capture square
      let combatForecast = null;
      if (
        selectedSquare &&
        hoveredSquare &&
        boardState[selectedSquare.r]?.[selectedSquare.c] &&
        boardState[hoveredSquare.r]?.[hoveredSquare.c]
      ) {
        const att = boardState[selectedSquare.r][selectedSquare.c];
        const def = boardState[hoveredSquare.r][hoveredSquare.c];
        if (
          att &&
          def &&
          att.color !== def.color &&
          validMoves.some((m) => m.r === hoveredSquare.r && m.c === hoveredSquare.c)
        ) {
          const sim = simulateRPGCombat(
            att,
            def,
            selectedSquare.r,
            selectedSquare.c,
            hoveredSquare.r,
            hoveredSquare.c,
            boardState
          );
          if (sim) {
            combatForecast = {
              outcome: sim.outcome,
              attAfterHp: sim.atkHpAfter,
              attAfterArmor: sim.atkArmorAfter,
              defAfterHp: sim.defHpAfter,
              defAfterArmor: sim.defArmorAfter,
              attTotalAtk: sim.atkDmg,
              defTotalAtk: sim.defCounterDmg,
              firstStrikeTriggered: Boolean(sim.firstStrikeTriggered),
              notes: sim.combatNotes || [],
              attackerUnit: serializeUnitForUI(att, selectedSquare.r, selectedSquare.c),
              defenderUnit: serializeUnitForUI(def, hoveredSquare.r, hoveredSquare.c),
              fromAlgebraic: toAlgebraic(selectedSquare.r, selectedSquare.c),
              toAlgebraic: toAlgebraic(hoveredSquare.r, hoveredSquare.c)
            };
          }
        }
      }

      // Count total enemy non-King units for Tứ Quý targeting & collect friendly units for Hearthstone Buff Target Bar
      let enemyNonKingCount = 0;
      const friendlyUnits = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (!p) continue;
          if (p.color !== currentTurn && p.type !== 'king') {
            enemyNonKingCount++;
          } else if (p.color === currentTurn) {
            friendlyUnits.push(serializeUnitForUI(p, r, c));
          }
        }
      }
      friendlyUnits.sort((a, b) => (PIECE_VALUES[b.type] || 100) - (PIECE_VALUES[a.type] || 100));

      const uiTurnPhase =
        turnPhase === 'MOVE_OR_COMBAT' ? 'MOVE_UNIT' : turnPhase;

      const uiHand = (pState.hand || []).map((c) => ({
        id: c.uid || c.id,
        rank: c.rank,
        suit: c.suit,
        rankLabel: c.label || c.rankLabel || String(c.rank),
        suitSymbol: c.suitSymbol,
        color: c.suitColor || c.color || 'black',
        cardMana: c.cardMana || (c.rank >= 11 ? 2 : 1),
        justDrawn: Boolean(c.justDrawn),
        isHeldFromPrevTurn: Boolean(c.isHeldFromPrevTurn)
      }));

      const displaySeconds = Math.max(0, Math.ceil(turnTimeRemaining));

      return {
        isLoaded: isAssetsLoaded,
        currentTurn,
        playerColor,
        turnNumber,
        turnPhase: uiTurnPhase,
        turnTimeRemaining: displaySeconds,
        turnTimeLimit: TURN_TIME_LIMIT,
        isTimerLow: !gameOver && displaySeconds < 10,
        isLowTimeTicking: soundFX.isLowTimeTickingActive(),
        isAnimatingMove,
        isConsideringMove: !gameOver && !isAnimatingMove && !checkmateState.active,
        lastTimeoutNotice,
        gameOver,
        winnerColor: checkmateState.winnerColor,
        defeatedColor: checkmateState.defeatedColor,
        whiteKing: getKingSummary('w'),
        blackKing: getKingSummary('b'),
        poker: {
          ownerColor: activeColor,
          hand: uiHand,
          selectedIndices: pState.selectedIndices || [],
          isFiveSelected: (pState.selectedIndices || []).length === 5,
          hasDrawnThisTurn: Boolean(pState.hasDrawnThisTurn),
          mana: pState.mana ?? 5,
          maxMana: pState.maxMana ?? 5,
          coinAvailable: Boolean(pState.coinAvailable),
          evaluatedCombo: normalizeComboForUI(rawEval),
          committedCombo: normalizeComboForUI(pendingComboEval || pState.committedComboThisTurn),
          empoweredUnitPos: lastEmpoweredSquare,
          drawCount: (pState.drawPile || []).length,
          discardCount: (pState.discardPile || []).length
        },
        friendlyUnits,
        ultimateTargetSquares,
        maxUltimateTargets: Math.min(8, enemyNonKingCount),
        selectedSquare: selectedSquare
          ? {
              r: selectedSquare.r,
              c: selectedSquare.c,
              algebraic: toAlgebraic(selectedSquare.r, selectedSquare.c)
            }
          : null,
        validMoves: (validMoves || []).map((m) => ({
          r: m.r,
          c: m.c,
          algebraic: toAlgebraic(m.r, m.c),
          capture: Boolean(m.capture),
          castle: m.castle || null
        })),
        inspectedUnit,
        hoveredTileModifier,
        combatForecast,
        unitPathing: (() => {
          const subject = getActivePathingSubjectUnit();
          if (!subject) {
            return {
              displayMode: pathingDisplayMode,
              subjectUnit: null,
              originSquare: null,
              pathHistory: [],
              intendedTrajectory: null
            };
          }
          const hist = Array.isArray(subject.pathHistory)
            ? subject.pathHistory.map((st) => ({ ...st }))
            : [
                {
                  r: subject.r,
                  c: subject.c,
                  algebraic: toAlgebraic(subject.r, subject.c),
                  turn: 0,
                  kind: 'SPAWN'
                }
              ];
          const traj = getActiveIntendedTrajectoryInfo(subject);
          return {
            displayMode: pathingDisplayMode,
            subjectUnit: serializeUnitForUI(subject, subject.r, subject.c),
            originSquare: hist[0] || null,
            pathHistory: hist,
            intendedTrajectory: traj
              ? {
                  fromR: traj.fromR,
                  fromC: traj.fromC,
                  fromAlgebraic: traj.fromAlgebraic,
                  toR: traj.toR,
                  toC: traj.toC,
                  toAlgebraic: traj.toAlgebraic,
                  isCapture: traj.isCapture,
                  isCastle: traj.isCastle,
                  castleSide: traj.castleSide,
                  isKnightJump: traj.isKnightJump,
                  isHoveredTarget: Boolean(traj.isHoveredTarget),
                  distance: traj.distance,
                  waypoints: traj.waypoints
                }
              : null
          };
        })(),
        combatLogs: (combatLogFeed || [])
          .slice(0, 8)
          .map((item) => (typeof item === 'string' ? item : item.text)),
        capturedByWhite,
        capturedByBlack,
        bgmPlaying: soundFX.isBattleMusicPlaying(),
        bgmTrack: soundFX.getCurrentTrackInfo?.() || null,
        sfxMuted: soundFX.isMuted(),
        autoMoveEnabled,
        activeCombatBanner,
        tacticalPingMode,
        selectedPingIntent,
        activeTacticalPings: activeTacticalPings.map((p) => ({
          id: p.id,
          r: p.r,
          c: p.c,
          algebraic: p.algebraic,
          intent: p.intent,
          label: p.label,
          shortLabel: p.shortLabel,
          icon: p.icon,
          colorHex: p.colorHex,
          unitDesc: p.unitDesc,
          remainingSec: Math.max(1, Math.ceil(p.life))
        })),
        commercial: {
          publishMode: true,
          elo: commercialProfile.elo || 1000,
          peakElo: Math.max(commercialProfile.elo || 1000, commercialProfile.peakElo || 1000),
          gold: commercialProfile.gold ?? 0,
          wins: commercialProfile.wins || 0,
          losses: commercialProfile.losses || 0,
          winStreak: commercialProfile.winStreak || 0,
          totalKills: commercialProfile.totalKills || 0,
          ownedSkinIds: commercialProfile.ownedSkinIds || ['classic_sanctum'],
          equippedSkinId: commercialProfile.equippedSkinId || 'classic_sanctum',
          previewSkinId: commercialProfile.previewSkinId || null,
          lastMatchDelta: commercialProfile.lastMatchDelta || null,
          matchHistory: commercialProfile.matchHistory || [],
          rankInfo: getEloRankInfo(commercialProfile.elo || 1000),
          peakRankInfo: getEloRankInfo(
            Math.max(commercialProfile.elo || 1000, commercialProfile.peakElo || 1000)
          ),
          botDifficulty: getBotDifficultyProfile(commercialProfile.elo || 1000),
          skinsCatalog: CHESS_SKIN_CATALOG,
          rankTiers: ELO_RANK_TIERS
        },
        hapticTriggerCount: cameraTelemetry.hapticTriggerCount || 0,
        lastHapticVibration: cameraTelemetry.lastHapticVibration || null
      };
    }

    function emitPokerChessSync() {
      try {
        window.dispatchEvent(
          new CustomEvent('pokerchess-sync', { detail: getPokerChessUIState() })
        );
      } catch (e) {}
    }

    function handleTurnTimeout() {
      if (gameOver || isAnimatingMove) return false;
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      if (preMoveHighlightTask) {
        preMoveHighlightTask = null;
      }

      const expiredSide = currentTurn;
      const nextSide = expiredSide === 'w' ? 'b' : 'w';
      const pState = pokerDecks[expiredSide];

      // If the player hadn't committed 5 cards yet before time ran out, discard the 5 selected cards & replenish to 7
      if (pState) {
        if (!pState.committedComboThisTurn) {
          if ((pState.selectedIndices || []).length !== 5) {
            const best = findBest5Of7(pState.hand);
            pState.selectedIndices = best.indices;
          }
          consumeSelected5CardsAndDraw(pState);
        }
        drawUpToSevenCards(pState);
        pState.committedComboThisTurn = null;
      }

      // Apply stationary Rook passive (+2 Armor) for the side whose turn ended
      for (let rr = 0; rr < 8; rr++) {
        for (let cc = 0; cc < 8; cc++) {
          const p = boardState[rr][cc];
          if (p && p.color === expiredSide && p.type === 'rook') {
            const cap = Math.min(6, getUnitArmorCap(p));
            if ((p.armor || 0) < cap) {
              p.armor = Math.min(cap, (p.armor || 0) + 2);
              updateUnit3DBadge(p);
            }
          }
          if (p && p.color === nextSide && p.type === 'queen') {
            p.attacksTakenThisRound = 0;
          }
        }
      }

      clearSquareHighlights();
      selectedSquare = null;
      validMoves = [];
      pendingComboEval = null;
      ultimateTargetSquares = [];

      soundFX.playClashImpact(false);
      spawnFloatingCombatText(
        new THREE.Vector3(0, BOARD_SURFACE_Y + 0.68, 0),
        `⌛ HẾT GIỜ (60s) — ĐỔI LƯỢT SANG ${nextSide === 'w' ? 'TRẮNG' : 'ĐEN'}!`,
        '#ef4444',
        1.05
      );
      addCombatLog(
        `⌛ Hết 60 giây suy nghĩ! Lượt của phe ${expiredSide === 'w' ? 'Trắng' : 'Đen'} tự động kết thúc.`,
        'danger'
      );

      lastTimeoutNotice = {
        id: `timeout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        expiredSide,
        nextSide,
        turnNumber,
        timestamp: Date.now()
      };
      try {
        window.dispatchEvent(
          new CustomEvent('pokerchess-timeout', { detail: lastTimeoutNotice })
        );
      } catch (e) {}

      currentTurn = nextSide;
      if (currentTurn === 'w') turnNumber += 1;
      prepareNextTurnDrawState(pokerDecks[expiredSide], turnNumber);
      prepareNextTurnDrawState(pokerDecks[currentTurn], turnNumber);
      turnPhase = 'DRAW_PHASE';
      lastEmpoweredSquare = null;
      resetTurnTimer();
      updateAllUnitBadges();
      updateTurnUI();
      maybeScheduleAIMove();
      return true;
    }

    function confirmFourKingsUltimate() {
      if (gameOver || isAnimatingMove) return false;
      if (turnPhase !== 'ULTIMATE_TARGETING') return false;
      if (ultimateTargetSquares.length === 0) {
        const enemies = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.color !== currentTurn && p.type !== 'king') {
              enemies.push({ r, c, score: (PIECE_VALUES[p.type] || 100) + (p.hp || 10) * 5 });
            }
          }
        }
        enemies.sort((a, b) => b.score - a.score);
        ultimateTargetSquares = enemies.slice(0, 8).map((e) => ({ r: e.r, c: e.c }));
      }
      return executeFourKingsDivineJudgment([...ultimateTargetSquares]);
    }

    function findBestMovableFriendlyUnit(sideColor = currentTurn) {
      // Prefer empowered unit if it has legal moves
      if (lastEmpoweredSquare) {
        const empP = boardState[lastEmpoweredSquare.r]?.[lastEmpoweredSquare.c];
        if (empP && empP.color === sideColor) {
          const empMoves = getLegalMovesForPiece(lastEmpoweredSquare.r, lastEmpoweredSquare.c);
          if (empMoves && empMoves.length > 0) {
            return { r: lastEmpoweredSquare.r, c: lastEmpoweredSquare.c, piece: empP, moves: empMoves };
          }
        }
      }
      // Prefer units that have captures first, then Knights / Center Pawns / Queen with legal moves
      const candidates = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (!p || p.color !== sideColor) continue;
          const moves = getLegalMovesForPiece(r, c);
          if (!moves || moves.length === 0) continue;
          const hasCap = moves.some((m) => m.capture);
          const isCenterPawn = p.type === 'pawn' && (c === 4 || c === 3);
          const isKnight = p.type === 'knight';
          const score =
            (hasCap ? 1000 : 0) +
            (isCenterPawn ? 320 : 0) +
            (isKnight ? 300 : 0) +
            (PIECE_VALUES[p.type] || 100) * 0.25;
          candidates.push({ r, c, piece: p, moves, score });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0] || null;
    }

    function skipEmpowerPhase() {
      if (gameOver || isAnimatingMove) return false;
      if (turnPhase === 'EMPOWER_UNIT' && pendingComboEval) {
        const bestMovable = findBestMovableFriendlyUnit(currentTurn);
        if (bestMovable) {
          return empowerFriendlyUnitAt(bestMovable.r, bestMovable.c);
        }
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (p && p.color === currentTurn) {
              return empowerFriendlyUnitAt(r, c);
            }
          }
        }
      }
      clearSquareHighlights();
      pendingComboEval = null;
      turnPhase = 'MOVE_OR_COMBAT';
      updateTurnUI();
      return true;
    }

    function triggerPresetHand() {
      // Production Publish Lock: Preset Poker Hands (+ Bài mẫu) are disabled in Publish Mode
      return false;
    }

    function updateTurnUI() {
      const statusPill = document.getElementById('status-pill');
      const turnDot = document.getElementById('turn-dot');
      const turnText = document.getElementById('turn-text');
      const modeBadge = document.getElementById('mode-badge');
      const btnAiMove = document.getElementById('btn-ai-move');
      const btnSideToggle = document.getElementById('btn-side-toggle');
      const roomPill = document.getElementById('room-pill');
      const capturedTray = document.getElementById('captured-tray');

      const considering = !gameOver && !isAnimatingMove && !checkmateState.active;
      const isUserTurn = currentTurn === playerColor;
      const lowTime = considering && Math.ceil(turnTimeRemaining) < 10;

      if (statusPill) {
        statusPill.className = [
          'status-pill',
          considering ? 'turn-pulse' : isAnimatingMove ? 'move-executing' : 'game-ended',
          currentTurn === 'b' ? 'black-turn' : 'white-turn',
          isUserTurn ? 'player-considering' : 'opponent-considering',
          lowTime ? 'urgent-pulse' : ''
        ]
          .filter(Boolean)
          .join(' ');
      }

      if (turnDot) {
        turnDot.className =
          'turn-dot' +
          (currentTurn === 'b' ? ' black' : '') +
          (considering ? ' pulsing' : '');
      }

      const wKing = getKingSummary('w');
      const bKing = getKingSummary('b');

      if (!wKing.alive || !bKing.alive) {
        gameOver = true;
        turnPhase = 'GAME_OVER';
        const defeated = !wKing.alive ? 'w' : 'b';
        const winner = defeated === 'w' ? 'b' : 'w';
        const winnerLabel = winner === 'w' ? 'White' : 'Black';
        if (turnText) {
          turnText.textContent = `Checkmate — ${winnerLabel} Wins`;
        }
        if (!checkmateState.active) {
          triggerCheckmateSequence(defeated, winner);
        }
      } else {
        const turnLabel = currentTurn === 'w' ? 'White to Move' : 'Black to Move';
        const aiColor = playerColor === 'w' ? 'b' : 'w';
        const isAiTurn = !scriptedGameActive && gameMode === 'single' && currentTurn === aiColor;
        const phaseLabels = {
          DRAW_PHASE: '① Bốc Bài',
          SELECT_CARDS: '② Ghép Phép',
          EMPOWER_UNIT: '③ Gắn Buff',
          ULTIMATE_TARGETING: '③ Thiên Phạt',
          MOVE_OR_COMBAT: '④ Đi Quân',
          MOVE_UNIT: '④ Đi Quân'
        };
        const phaseSub = phaseLabels[turnPhase] || '';
        if (turnText) {
          if (isAiTurn) {
            turnText.textContent = `${turnLabel} (AI)`;
          } else {
            turnText.textContent = phaseSub ? `${turnLabel} · ${phaseSub}` : turnLabel;
          }
        }
      }

      if (modeBadge) {
        modeBadge.textContent = `Playing as ${playerColor === 'w' ? 'White' : 'Black'}`;
      }
      if (btnAiMove) {
        btnAiMove.style.display = 'none';
      }
      if (btnSideToggle) {
        btnSideToggle.style.display = 'inline-flex';
        btnSideToggle.textContent = playerColor === 'w' ? 'Play as Black' : 'Play as White';
      }
      if (roomPill) {
        roomPill.style.display = 'none';
      }

      if (capturedTray) {
        if (capturedByWhite > 0 || capturedByBlack > 0) {
          capturedTray.textContent = `Captured — White: ${capturedByWhite} | Black: ${capturedByBlack}`;
        } else {
          capturedTray.textContent = '';
        }
      }
      if (typeof updateScriptBarUI === 'function') updateScriptBarUI();
      emitPokerChessSync();
    }

    // =========================================================================
    // Raycasting & Board Interaction (Move, Empower, Ultimate Target & Hover Preview)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const raySegStart = new THREE.Vector3();
    const raySegEnd = new THREE.Vector3();
    const rayClosestPt = new THREE.Vector3();
    let lastPointerMoveHoverMs = 0;

    function raycastBoardSquare(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      // 1. Fast analytical cylinder intersection against standing chess pieces (generous radius so clicking piece body/head is effortless)
      let bestDist = Infinity;
      let bestSquare = null;
      const pieceRadiusSq = 0.172 * 0.172;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (!p || !p.mesh) continue;
          const pos = p.mesh.position;
          const h = (PIECE_HEIGHTS[p.type] || 0.48) + 0.06;
          raySegStart.set(pos.x, BOARD_SURFACE_Y + 0.02, pos.z);
          raySegEnd.set(pos.x, BOARD_SURFACE_Y + h, pos.z);
          const distSq = raycaster.ray.distanceSqToSegment(
            raySegStart,
            raySegEnd,
            rayClosestPt,
            null
          );
          if (distSq <= pieceRadiusSq) {
            // During EMPOWER_UNIT, prioritize friendly pieces if ray passes through multiple pieces
            const camDist =
              rayClosestPt.distanceTo(raycaster.ray.origin) -
              (turnPhase === 'EMPOWER_UNIT' && p.color === currentTurn ? 0.18 : 0);
            if (camDist < bestDist) {
              bestDist = camDist;
              bestSquare = { r, c };
            }
          }
        }
      }

      // 2. Intersect the 64 low-poly board tile boxes (12 triangles each)
      // CRITICAL: Never let an empty background floor tile behind a 3D piece overwrite a direct piece hit!
      const tileHits = raycaster.intersectObjects(boardSquareMeshes, false);
      if (tileHits.length > 0) {
        const hit = tileHits[0];
        if (hit.object?.userData?.isSquare) {
          const tileR = hit.object.userData.r;
          const tileC = hit.object.userData.c;
          const tilePiece = boardState[tileR]?.[tileC];
          if (!bestSquare) {
            bestSquare = { r: tileR, c: tileC };
          } else if (turnPhase === 'EMPOWER_UNIT') {
            const curBestPiece = boardState[bestSquare.r]?.[bestSquare.c];
            if (
              (!curBestPiece || curBestPiece.color !== currentTurn) &&
              tilePiece &&
              tilePiece.color === currentTurn
            ) {
              bestSquare = { r: tileR, c: tileC };
            }
          } else if (hit.distance < bestDist - 0.14 && tilePiece) {
            bestSquare = { r: tileR, c: tileC };
          }
        }
      }

      // 3. In EMPOWER_UNIT, if the click landed slightly off a piece onto an empty/enemy square, snap to the nearest friendly piece within 48px on screen
      if (turnPhase === 'EMPOWER_UNIT') {
        const pickedPiece = bestSquare ? boardState[bestSquare.r]?.[bestSquare.c] : null;
        if (!pickedPiece || pickedPiece.color !== currentTurn) {
          let closestScreenDist = 48;
          let snapSquare = null;
          const projVec = new THREE.Vector3();
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const p = boardState[r][c];
              if (!p || p.color !== currentTurn) continue;
              projVec.copy(boardToWorld(r, c));
              projVec.y += (PIECE_HEIGHTS[p.type] || 0.45) * 0.5;
              projVec.project(camera);
              const sx = rect.left + (projVec.x * 0.5 + 0.5) * rect.width;
              const sy = rect.top + (-projVec.y * 0.5 + 0.5) * rect.height;
              const dPx = Math.hypot(clientX - sx, clientY - sy);
              if (dPx < closestScreenDist) {
                closestScreenDist = dPx;
                snapSquare = { r, c };
              }
            }
          }
          if (snapSquare) {
            bestSquare = snapSquare;
          }
        }
      }

      return bestSquare;
    }

    renderer.domElement.addEventListener('pointermove', (e) => {
      if (isAnimatingMove || gameOver || e.buttons !== 0) return;
      const now = performance.now();
      if (now - lastPointerMoveHoverMs < 40) return;
      lastPointerMoveHoverMs = now;

      const sq = raycastBoardSquare(e.clientX, e.clientY);
      const prevR = hoveredSquare ? hoveredSquare.r : -1;
      const prevC = hoveredSquare ? hoveredSquare.c : -1;
      const nextR = sq ? sq.r : -1;
      const nextC = sq ? sq.c : -1;
      if (prevR !== nextR || prevC !== nextC) {
        const prevPiece = prevR >= 0 && prevC >= 0 ? boardState[prevR]?.[prevC] : null;
        hoveredSquare = sq;
        const nextPiece = nextR >= 0 && nextC >= 0 ? boardState[nextR]?.[nextC] : null;
        if (prevPiece) updateUnit3DBadge(prevPiece);
        if (nextPiece) updateUnit3DBadge(nextPiece);
        if (sq && selectedSquare) {
          const hoveredLegal = validMoves.find((m) => m.r === nextR && m.c === nextC);
          if (hoveredLegal) {
            soundFX.playSquareTarget(Boolean(hoveredLegal.capture));
          }
        }
        rebuildUnitPathing3D();
        if (prevPiece || nextPiece || selectedSquare) {
          emitPokerChessSync();
        }
      }
    });

    renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;
      if (isAnimatingMove || gameOver) return;

      // Enforce turn ownership in Multiplayer, and in Single Player only block while AI auto-move timer is actively pending
      if (gameMode === 'multi' && currentTurn !== playerColor) return;
      if (!scriptedGameActive && gameMode === 'single' && currentTurn !== playerColor && aiTimer !== null) return;

      // If player clicks on board on their turn, cancel any pending auto-move timer so player's manual input takes immediate priority
      if (currentTurn === playerColor && aiTimer !== null) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }

      const sq = raycastBoardSquare(e.clientX, e.clientY);
      if (!sq) {
        if (preMoveHighlightTask) preMoveHighlightTask = null;
        if (turnPhase !== 'ULTIMATE_TARGETING' && turnPhase !== 'EMPOWER_UNIT') {
          clearSquareHighlights();
          selectedSquare = null;
          validMoves = [];
          emitPokerChessSync();
        }
        return;
      }

      const { r: clickedR, c: clickedC } = sq;

      // 0. Tactical Tile Ping Trigger: Alt+Click, Shift+Click, Middle-Click, or when Ping Mode is active
      if (e.altKey || e.shiftKey || e.button === 1 || tacticalPingMode) {
        pingBoardSquare(clickedR, clickedC, selectedPingIntent);
        return;
      }

      // Cancel any pending scripted pre-move highlight timer when the user manually interacts with the board
      if (preMoveHighlightTask) {
        preMoveHighlightTask = null;
      }

      const clickedPiece = boardState[clickedR][clickedC];

      // 1. Handle Tứ Quý (Four of a Kind) Ultimate Target Selection (up to 8 enemy non-King units)
      if (turnPhase === 'ULTIMATE_TARGETING') {
        if (clickedPiece && clickedPiece.color !== currentTurn && clickedPiece.type !== 'king') {
          const existingIdx = ultimateTargetSquares.findIndex(
            (t) => t.r === clickedR && t.c === clickedC
          );
          if (existingIdx >= 0) {
            ultimateTargetSquares.splice(existingIdx, 1);
          } else if (ultimateTargetSquares.length < 8) {
            ultimateTargetSquares.push({ r: clickedR, c: clickedC });
          }
          soundFX.playCardSelect();
          showEmpowerOrUltimateHighlights();
          updateTurnUI();
        }
        return;
      }

      // 2. Seamless Auto-Draw & Combo Selection if clicking friendly unit in DRAW_PHASE or SELECT_CARDS
      if (turnPhase === 'DRAW_PHASE' || turnPhase === 'SELECT_CARDS') {
        const pDeck = pokerDecks[currentTurn];
        if (pDeck) {
          if (turnPhase === 'DRAW_PHASE' || pDeck.hand.length < 5) {
            drawUpToSevenCards(pDeck, true);
            turnPhase = 'SELECT_CARDS';
          }
          if (turnPhase === 'SELECT_CARDS') {
            const best = findBest5Of7(pDeck.hand);
            pDeck.selectedIndices = best.indices;
            commitSelected5CardCombo();
          }
        }
        if (turnPhase === 'EMPOWER_UNIT' && clickedPiece && clickedPiece.color === currentTurn) {
          empowerFriendlyUnitAt(clickedR, clickedC);
          return;
        }
        if (turnPhase === 'ULTIMATE_TARGETING') {
          return;
        }
      }

      // 3. Handle Step 3 (EMPOWER_UNIT): clicking any friendly unit attaches the active Hearthstone Buff
      if (turnPhase === 'EMPOWER_UNIT') {
        if (clickedPiece && clickedPiece.color === currentTurn) {
          empowerFriendlyUnitAt(clickedR, clickedC);
          return;
        } else {
          // If clicked empty square, enemy, or destination: auto-empower best friendly unit so turn is NEVER locked!
          const bestUnit = findBestMovableFriendlyUnit(currentTurn);
          if (bestUnit) {
            empowerFriendlyUnitAt(bestUnit.r, bestUnit.c);
            // If the square clicked is a legal move for this unit, execute the move immediately!
            const moves = getLegalMovesForPiece(bestUnit.r, bestUnit.c);
            const matchingMove = moves && moves.find((m) => m.r === clickedR && m.c === clickedC);
            if (matchingMove) {
              executeChessMove(bestUnit.r, bestUnit.c, clickedR, clickedC);
            }
          } else {
            skipEmpowerPhase();
          }
          return;
        }
      }

      // 4. Step 4 (MOVE_OR_COMBAT): Execute a legal move / RPG combat if a friendly unit is already selected
      if (selectedSquare) {
        const move = validMoves.find(
          (m) =>
            (m.r === clickedR && m.c === clickedC) ||
            (m.castle && m.r === clickedR && m.rookFromC === clickedC)
        );
        if (move) {
          executeChessMove(selectedSquare.r, selectedSquare.c, move.r, move.c);
          return;
        }
      }

      // 5. Select friendly unit & display legal moves on 3D floor tiles (click again to toggle off)
      const prevSelPiece =
        selectedSquare ? boardState[selectedSquare.r]?.[selectedSquare.c] : null;
      if (clickedPiece && clickedPiece.color === currentTurn) {
        if (selectedSquare && selectedSquare.r === clickedR && selectedSquare.c === clickedC) {
          clearSquareHighlights();
          selectedSquare = null;
          validMoves = [];
          if (prevSelPiece) updateUnit3DBadge(prevSelPiece);
          soundFX.playUIClick();
          emitPokerChessSync();
        } else {
          selectedSquare = { r: clickedR, c: clickedC };
          validMoves = getLegalMovesForPiece(clickedR, clickedC);
          showSquareHighlights(clickedR, clickedC, validMoves);
          if (prevSelPiece) updateUnit3DBadge(prevSelPiece);
          updateUnit3DBadge(clickedPiece);
          soundFX.playPieceSelect(clickedPiece.type);
          emitPokerChessSync();
        }
      } else {
        clearSquareHighlights();
        selectedSquare = null;
        validMoves = [];
        if (prevSelPiece) updateUnit3DBadge(prevSelPiece);
        emitPokerChessSync();
      }
    });

    // =========================================================================
    // Multiplayer Room Synchronization (Same-Origin API + Static Site Fallback)
    // =========================================================================
    const CLOUD_MP_API_BASE = '';
    const isStaticHost =
      window.location.hostname.includes('zipline') ||
      window.location.hostname.includes('github.io') ||
      window.location.protocol === 'file:';

    let staticBroadcastChannel = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        staticBroadcastChannel = new BroadcastChannel('wizard_chess_mp_channel');
        staticBroadcastChannel.onmessage = (ev) => {
          const msg = ev.data;
          if (msg && msg.type === 'room_state' && msg.room && msg.room.code === roomCode) {
            applyRemoteRoomState(msg.room);
          }
        };
      }
    } catch (e) {}

    window.addEventListener('storage', (ev) => {
      if (ev.key === `wizard_chess_room_${roomCode}` && ev.newValue) {
        try {
          applyRemoteRoomState(JSON.parse(ev.newValue));
        } catch (e) {}
      }
    });

    function getStaticRoom(code) {
      try {
        const raw = localStorage.getItem(`wizard_chess_room_${code}`);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function saveAndBroadcastStaticRoom(room) {
      try {
        localStorage.setItem(`wizard_chess_room_${room.code}`, JSON.stringify(room));
      } catch (e) {}
      try {
        if (staticBroadcastChannel) {
          staticBroadcastChannel.postMessage({ type: 'room_state', room });
        }
      } catch (e) {}
    }

    function ensurePlayerToken() {
      if (!playerToken) {
        playerToken = 'tok_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        try {
          localStorage.setItem('wizard_chess_token', playerToken);
        } catch (e) {}
      }
      return playerToken;
    }

    async function mpApiRequest(apiPath, options = {}) {
      const bases = isStaticHost
        ? (CLOUD_MP_API_BASE ? [CLOUD_MP_API_BASE] : [])
        : (CLOUD_MP_API_BASE ? ['', CLOUD_MP_API_BASE] : ['']);
      for (const base of bases) {
        try {
          const res = await fetch(`${base}${apiPath}`, options);
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              return await res.json();
            }
          }
        } catch (e) {}
      }
      return null;
    }

    async function sendMultiplayerMove(movePayload) {
      if (!roomCode) return;
      // 1. Update static local/BroadcastChannel room store immediately
      const stRoom = getStaticRoom(roomCode);
      if (stRoom) {
        stRoom.moves = stRoom.moves || [];
        stRoom.moves.push({
          seq: stRoom.moves.length + 1,
          color: movePayload.color,
          from: movePayload.from,
          to: movePayload.to,
          promotion: movePayload.promotion || 'queen',
          ts: Date.now()
        });
        stRoom.turn = movePayload.color === 'w' ? 'b' : 'w';
        stRoom.updatedAt = Date.now();
        saveAndBroadcastStaticRoom(stRoom);
      }
      // 2. Also broadcast to cloud/local room API if reachable
      await mpApiRequest(`/api/rooms/${roomCode}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movePayload)
      });
    }

    function stopMultiplayerSync() {
      if (roomEventSource) {
        roomEventSource.close();
        roomEventSource = null;
      }
      if (roomPollTimer) {
        clearInterval(roomPollTimer);
        roomPollTimer = null;
      }
    }

    function applyRemoteRoomState(room) {
      if (!room) return;
      const statusEl = document.getElementById('hud-room-status');
      const bothReady = room.whiteJoined && room.blackJoined;
      if (statusEl) {
        statusEl.textContent = bothReady ? '2/2 Connected' : 'Waiting for Opponent';
      }
      const mpMsg = document.getElementById('mp-status-msg');
      if (mpMsg && roomCode) {
        mpMsg.textContent = bothReady
          ? `Both players connected to Room ${room.code}!`
          : `Room ${room.code} ready — waiting for second player to join...`;
      }

      if (room.resetCount > appliedResetCount) {
        appliedResetCount = room.resetCount;
        appliedMoveSeq = 0;
        resetChessBoard(false);
      }

      if (Array.isArray(room.moves) && room.moves.length > appliedMoveSeq) {
        const tryApplyNext = () => {
          if (isAnimatingMove) {
            setTimeout(tryApplyNext, 120);
            return;
          }
          if (appliedMoveSeq >= room.moves.length) return;
          const nextMove = room.moves[appliedMoveSeq];
          appliedMoveSeq = nextMove.seq || (appliedMoveSeq + 1);
          const pieceAtFrom = boardState[nextMove.from.r]?.[nextMove.from.c];
          if (pieceAtFrom) {
            executeChessMove(
              nextMove.from.r,
              nextMove.from.c,
              nextMove.to.r,
              nextMove.to.c,
              { fromRemote: true }
            );
          }
          if (appliedMoveSeq < room.moves.length) {
            setTimeout(tryApplyNext, 250);
          }
        };
        tryApplyNext();
      }
    }

    function startMultiplayerSync(code) {
      stopMultiplayerSync();
      roomCode = code;

      if (!isStaticHost) {
        try {
          roomEventSource = new EventSource(`/api/rooms/${code}/events`);
          roomEventSource.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data);
              if (data.room) applyRemoteRoomState(data.room);
            } catch (e) {}
          };
        } catch (e) {}
      }

      roomPollTimer = setInterval(async () => {
        if (gameMode !== 'multi' || !roomCode) return;
        const data = await mpApiRequest(
          `/api/rooms/${roomCode}/state?playerToken=${encodeURIComponent(playerToken)}`
        );
        if (data && data.ok && data.room) {
          saveAndBroadcastStaticRoom(data.room);
          applyRemoteRoomState(data.room);
          return;
        }
        const stRoom = getStaticRoom(roomCode);
        if (stRoom) {
          applyRemoteRoomState(stRoom);
        }
      }, 1500);
    }

    async function createMultiplayerRoom(preferredColor) {
      const mpMsg = document.getElementById('mp-status-msg');
      mpMsg.textContent = 'Creating room...';
      ensurePlayerToken();

      let data = await mpApiRequest('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredColor, playerToken })
      });

      // Pure static fallback if neither local nor remote server is reachable
      if (!data || !data.ok) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let genCode = '';
        for (let i = 0; i < 4; i++) {
          genCode += chars[Math.floor(Math.random() * chars.length)];
        }
        const side = preferredColor === 'b' ? 'b' : 'w';
        const staticRoom = {
          code: genCode,
          status: 'waiting',
          whiteJoined: side === 'w',
          blackJoined: side === 'b',
          turn: 'w',
          moves: [],
          resetCount: 0,
          updatedAt: Date.now()
        };
        saveAndBroadcastStaticRoom(staticRoom);
        data = {
          ok: true,
          code: genCode,
          color: side,
          playerToken,
          room: staticRoom
        };
      } else if (data.room) {
        saveAndBroadcastStaticRoom(data.room);
      }

      playerToken = data.playerToken;
      try {
        localStorage.setItem('wizard_chess_token', playerToken);
      } catch (e) {}
      scriptedGameActive = false;
      gameMode = 'multi';
      playerColor = data.color;
      roomCode = data.code;
      appliedMoveSeq = 0;
      appliedResetCount = data.room.resetCount || 0;

      document.getElementById('modal-room-code').textContent = roomCode;
      document.getElementById('room-created-panel').style.display = 'block';

      resetChessBoard(true);
      startMultiplayerSync(roomCode);
      applyRemoteRoomState(data.room);
      window.history.replaceState({}, '', `?room=${roomCode}`);
    }

    async function joinMultiplayerRoom(codeInput) {
      const code = String(codeInput || '').trim().toUpperCase();
      const mpMsg = document.getElementById('mp-status-msg');
      if (!code) {
        mpMsg.textContent = 'Please enter a 4-character Room Code.';
        return false;
      }
      mpMsg.textContent = `Joining room ${code}...`;
      ensurePlayerToken();

      let data = await mpApiRequest('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, playerToken })
      });

      if (!data || !data.ok) {
        let stRoom = getStaticRoom(code);
        if (!stRoom) {
          stRoom = {
            code,
            status: 'playing',
            whiteJoined: true,
            blackJoined: true,
            turn: 'w',
            moves: [],
            resetCount: 0,
            updatedAt: Date.now()
          };
        } else {
          if (!stRoom.whiteJoined) stRoom.whiteJoined = true;
          else if (!stRoom.blackJoined) stRoom.blackJoined = true;
          stRoom.status = stRoom.whiteJoined && stRoom.blackJoined ? 'playing' : 'waiting';
          stRoom.updatedAt = Date.now();
        }
        const assignedColor = !stRoom.blackJoined ? 'w' : 'b';
        saveAndBroadcastStaticRoom(stRoom);
        data = {
          ok: true,
          code,
          color: assignedColor,
          playerToken,
          room: stRoom
        };
      } else if (data.room) {
        saveAndBroadcastStaticRoom(data.room);
      }

      playerToken = data.playerToken;
      try {
        localStorage.setItem('wizard_chess_token', playerToken);
      } catch (e) {}
      scriptedGameActive = false;
      gameMode = 'multi';
      playerColor = data.color;
      roomCode = data.code;
      appliedMoveSeq = 0;
      appliedResetCount = data.room.resetCount || 0;

      resetChessBoard(true);
      startMultiplayerSync(roomCode);
      applyRemoteRoomState(data.room);
      window.history.replaceState({}, '', `?room=${roomCode}`);
      closeLobbyModal();
      return true;
    }

    // =========================================================================
    // Camera Presets & HUD Controls
    // =========================================================================
    const camButtons = [
      'btn-cam-player',
      'btn-cam-top',
      'btn-cam-side',
      'btn-cam-wide'
    ];

    function setActiveCamButton(activeId) {
      for (const id of camButtons) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === activeId);
      }
    }

    let playerCamSide = 'w';     // toggles 'w' (White) <-> 'b' (Black) on repeat click of Player Cam
    let overheadCamSide = 'w';   // toggles 'w' (White) <-> 'b' (Black) on repeat click of Overhead
    let sideCamSide = 'east';    // toggles 'east' (+X) <-> 'west' (-X) on repeat click of Side
    let cathedralWideSide = 'north'; // toggles 'north' (Rose Window) <-> 'south' (Narthex Triptych) on repeat click of Cathedral

    function setCameraPose(posArr, targetArr) {
      activeCamTransition = null;
      if (Array.isArray(posArr) && posArr.length === 3) {
        camera.position.set(posArr[0], posArr[1], posArr[2]);
      }
      if (Array.isArray(targetArr) && targetArr.length === 3) {
        orbitControls.target.set(targetArr[0], targetArr[1], targetArr[2]);
      }
      enforceCathedralBoundsAndSolidColumns(null, camera.position, orbitControls.target);
      flushOrbitControlsDamping();
    }

    function setCameraPreset(preset) {
      if (preset === 'player') {
        const wasPlayerActive = document.getElementById('btn-cam-player')?.classList.contains('active');
        if (wasPlayerActive) {
          playerCamSide = playerCamSide === 'w' ? 'b' : 'w';
        } else {
          playerCamSide = playerColor === 'b' ? 'b' : 'w';
        }
        setActiveCamButton('btn-cam-player');
        setCameraForSide(playerCamSide, false);
      } else if (preset === 'top') {
        const wasTopActive = document.getElementById('btn-cam-top')?.classList.contains('active');
        if (wasTopActive) {
          overheadCamSide = overheadCamSide === 'w' ? 'b' : 'w';
        } else {
          overheadCamSide = playerColor === 'b' ? 'b' : 'w';
        }
        setActiveCamButton('btn-cam-top');
        const zSign = overheadCamSide === 'b' ? -1 : 1;
        smoothCameraTo(new THREE.Vector3(0, 6.85, zSign * 3.65), new THREE.Vector3(0, 0.78, 0), 0.75);
      } else if (preset === 'side') {
        const wasSideActive = document.getElementById('btn-cam-side')?.classList.contains('active');
        if (wasSideActive) {
          sideCamSide = sideCamSide === 'east' ? 'west' : 'east';
        } else {
          sideCamSide = 'east';
        }
        setActiveCamButton('btn-cam-side');
        const xSign = sideCamSide === 'west' ? -1 : 1;
        smoothCameraTo(new THREE.Vector3(xSign * 2.85, 1.85, 0), new THREE.Vector3(0, 0.84, 0), 0.75);
      } else if (preset === 'wide') {
        const wasWideActive = document.getElementById('btn-cam-wide')?.classList.contains('active');
        if (wasWideActive) {
          cathedralWideSide = cathedralWideSide === 'north' ? 'south' : 'north';
        } else {
          cathedralWideSide = playerColor === 'b' ? 'south' : 'north';
        }
        setActiveCamButton('btn-cam-wide');
        if (cathedralWideSide === 'south') {
          // Black's wide Cathedral perspective looking South toward the Narthex Triptych (chessboard centered in frame)
          smoothCameraTo(new THREE.Vector3(0, 2.55, -6.65), new THREE.Vector3(0, 1.95, 2.50), 0.85);
        } else {
          // White's wide Cathedral perspective looking North toward the Rose Window (chessboard centered in frame)
          smoothCameraTo(new THREE.Vector3(0, 2.55, 6.65), new THREE.Vector3(0, 1.95, -2.50), 0.85);
        }
      } else if (preset === 'white_backdrop') {
        smoothCameraTo(new THREE.Vector3(0, 2.35, -3.10), new THREE.Vector3(0, 2.20, 8.50), 0.85);
      } else if (preset === 'vaults') {
        smoothCameraTo(new THREE.Vector3(-1.60, 2.65, 3.20), new THREE.Vector3(2.20, 7.60, -9.50), 0.85);
      } else if (preset === 'side_windows') {
        smoothCameraTo(new THREE.Vector3(-1.40, 2.30, 0.60), new THREE.Vector3(5.20, 4.10, -5.80), 0.85);
      } else if (preset === 'back_windows') {
        smoothCameraTo(new THREE.Vector3(0, 3.40, -7.80), new THREE.Vector3(0, 4.60, -18.10), 0.85);
      } else if (preset === 'rear_windows') {
        smoothCameraTo(new THREE.Vector3(0, 3.40, 7.80), new THREE.Vector3(0, 4.60, 18.10), 0.85);
      }
    }

    document.getElementById('btn-cam-player')?.addEventListener('click', () => setCameraPreset('player'));
    document.getElementById('btn-cam-top')?.addEventListener('click', () => setCameraPreset('top'));
    document.getElementById('btn-cam-side')?.addEventListener('click', () => setCameraPreset('side'));
    document.getElementById('btn-cam-wide')?.addEventListener('click', () => setCameraPreset('wide'));
    document.getElementById('btn-hide-ui')?.addEventListener('click', () => toggleUI());

    document.getElementById('btn-script-modal')?.addEventListener('click', () => openLobbyModal('script'));
    document.getElementById('btn-script-prev')?.addEventListener('click', () => stepScriptBackward());
    document.getElementById('btn-script-next')?.addEventListener('click', () => stepScriptForward());

    document.getElementById('btn-ai-move')?.addEventListener('click', () => {
      toggleAutoMove();
    });

    document.getElementById('btn-side-toggle')?.addEventListener('click', () => {
      if (gameMode !== 'single') return;
      playerColor = playerColor === 'w' ? 'b' : 'w';
      resetChessBoard(true, scriptedGameActive);
    });

    async function restartGameMatch() {
      soundFX.playUIClick();
      if (gameMode === 'multi' && roomCode) {
        const stRoom = getStaticRoom(roomCode);
        if (stRoom) {
          stRoom.moves = [];
          stRoom.turn = 'w';
          stRoom.resetCount = (stRoom.resetCount || 0) + 1;
          stRoom.updatedAt = Date.now();
          saveAndBroadcastStaticRoom(stRoom);
          applyRemoteRoomState(stRoom);
        }
        await mpApiRequest(`/api/rooms/${roomCode}/reset`, { method: 'POST' });
      } else {
        resetChessBoard(true, false);
      }
    }

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      restartGameMatch();
    });

    // =========================================================================
    // Lobby & Director Script Modal Interactions
    // =========================================================================
    const lobbyModal = document.getElementById('lobby-modal');
    let selectedSpColor = 'w';
    let selectedMpColor = 'w';

    function openLobbyModal(tab = null) {
      lobbyModal?.classList.add('open');
      if (tab === 'multi') switchLobbyTab('multi');
      else if (tab === 'script') switchLobbyTab('script');
      else if (tab === 'single') switchLobbyTab('single');
    }

    function closeLobbyModal() {
      lobbyModal?.classList.remove('open');
    }

    function switchLobbyTab(tab) {
      const isSingle = tab === 'single';
      const isMulti = tab === 'multi';
      const isScript = tab === 'script';
      document.getElementById('tab-single').classList.toggle('active', isSingle);
      document.getElementById('tab-multi').classList.toggle('active', isMulti);
      document.getElementById('tab-script').classList.toggle('active', isScript);
      document.getElementById('panel-single').style.display = isSingle ? 'block' : 'none';
      document.getElementById('panel-multi').style.display = isMulti ? 'block' : 'none';
      document.getElementById('panel-script').style.display = isScript ? 'block' : 'none';
    }

    document.getElementById('btn-lobby')?.addEventListener('click', () => openLobbyModal());
    document.getElementById('btn-close-lobby')?.addEventListener('click', closeLobbyModal);
    document.getElementById('tab-single')?.addEventListener('click', () => switchLobbyTab('single'));
    document.getElementById('tab-multi')?.addEventListener('click', () => switchLobbyTab('multi'));
    document.getElementById('tab-script')?.addEventListener('click', () => switchLobbyTab('script'));

    document.getElementById('btn-preset-scandi')?.addEventListener('click', () => {
      document.getElementById('input-notation').value = DEFAULT_DIRECTOR_NOTATION;
    });
    document.getElementById('btn-preset-italian')?.addEventListener('click', () => {
      document.getElementById('input-notation').value =
        '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+';
    });
    document.getElementById('btn-preset-scholar')?.addEventListener('click', () => {
      document.getElementById('input-notation').value =
        '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#';
    });

    document.getElementById('btn-load-notation')?.addEventListener('click', () => {
      const val = document.getElementById('input-notation').value;
      const res = loadNotationScript(val, { orientCamera: false });
      if (res.ok) {
        closeLobbyModal();
      } else {
        document.getElementById('script-status-msg').textContent =
          'Could not parse notation. Please enter valid PGN/SAN (e.g. 1. e4 e5 2. Nf3 Nc6) or UCI.';
      }
    });

    document.getElementById('pick-sp-white')?.addEventListener('click', () => {
      selectedSpColor = 'w';
      document.getElementById('pick-sp-white').classList.add('selected');
      document.getElementById('pick-sp-black').classList.remove('selected');
    });
    document.getElementById('pick-sp-black')?.addEventListener('click', () => {
      selectedSpColor = 'b';
      document.getElementById('pick-sp-black').classList.add('selected');
      document.getElementById('pick-sp-white').classList.remove('selected');
    });

    document.getElementById('btn-start-single')?.addEventListener('click', () => {
      stopMultiplayerSync();
      scriptedGameActive = false;
      gameMode = 'single';
      roomCode = null;
      playerColor = selectedSpColor;
      window.history.replaceState({}, '', window.location.pathname);
      closeLobbyModal();
      resetChessBoard(true);
    });

    document.getElementById('pick-mp-white')?.addEventListener('click', () => {
      selectedMpColor = 'w';
      document.getElementById('pick-mp-white').classList.add('selected');
      document.getElementById('pick-mp-black').classList.remove('selected');
    });
    document.getElementById('pick-mp-black')?.addEventListener('click', () => {
      selectedMpColor = 'b';
      document.getElementById('pick-mp-black').classList.add('selected');
      document.getElementById('pick-mp-white').classList.remove('selected');
    });

    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      createMultiplayerRoom(selectedMpColor);
    });

    document.getElementById('btn-enter-created-room')?.addEventListener('click', () => {
      closeLobbyModal();
    });

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      if (!roomCode) return;
      navigator.clipboard?.writeText(roomCode);
      document.getElementById('mp-status-msg').textContent = `Copied room code ${roomCode}!`;
    });

    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
      if (!roomCode) return;
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      navigator.clipboard?.writeText(inviteUrl);
      document.getElementById('mp-status-msg').textContent = 'Copied invite link to clipboard!';
    });

    document.getElementById('room-pill')?.addEventListener('click', () => {
      openLobbyModal('multi');
    });

    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      const val = document.getElementById('input-room-code').value;
      joinMultiplayerRoom(val);
    });

    document.getElementById('input-room-code')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        joinMultiplayerRoom(e.target.value);
      }
    });

    document.getElementById('btn-checkmate-stepback')?.addEventListener('click', () => {
      stepScriptBackward();
    });
    document.getElementById('btn-checkmate-replay')?.addEventListener('click', () => {
      const defCol = checkmateState.defeatedColor || currentTurn;
      const winCol = checkmateState.winnerColor || (defCol === 'w' ? 'b' : 'w');
      triggerCheckmateSequence(defCol, winCol);
    });
    document.getElementById('btn-checkmate-newgame')?.addEventListener('click', () => {
      resetChessBoard(true, false);
    });
    document.getElementById('btn-checkmate-dismiss')?.addEventListener('click', () => {
      stopCheckmateConfetti();
      const overlay = document.getElementById('checkmate-overlay');
      if (overlay) overlay.classList.remove('visible');
      checkmateState.bannerVisible = false;
    });

    function startSinglePlayerMatch(side = 'w', botLevel = 1) {
      soundFX.playUIClick();
      gameMode = 'single';
      roomCode = null;
      playerColor = side === 'b' ? 'b' : 'w';
      if (typeof botLevel === 'number') {
        customBotLevel = botLevel;
      }
      resetChessBoard(true, false);
      setCameraForSide(playerColor, false);
      updateTurnUI();
      emitPokerChessSync();
      return true;
    }

    function startMultiplayerMatch(matchInfo) {
      soundFX.playUIClick();
      gameMode = 'multi';
      roomCode = matchInfo.matchId || matchInfo.roomCode || 'ROOM_1V1';
      playerColor = matchInfo.myColor === 'b' ? 'b' : 'w';
      resetChessBoard(true, false);
      setCameraForSide(playerColor, false);
      addCombatLog(
        `⚔️ TRẬN ĐẤU ONLINE 1VS1 BẮT ĐẦU! Đối thủ: ${matchInfo.opponent?.name || 'Kỳ Thủ'} (${matchInfo.opponent?.elo || 1050} Elo) - Bạn cầm quân ${playerColor === 'w' ? 'TRẮNG (Đi trước)' : 'ĐEN (Đi sau)'}!`,
        'gold'
      );
      updateTurnUI();
      emitPokerChessSync();
      return true;
    }

    // Realtime Multiplayer WebSocket synchronization listeners
    multiplayerClient.on('opponent_move', (msg) => {
      if (gameMode === 'multi' && msg.from && msg.to) {
        executeChessMove(msg.from.r, msg.from.c, msg.to.r, msg.to.c, { fromRemote: true });
      }
    });

    multiplayerClient.on('opponent_buff', (msg) => {
      if (gameMode === 'multi' && typeof msg.targetRow === 'number' && typeof msg.targetCol === 'number') {
        empowerFriendlyUnitAt(msg.targetRow, msg.targetCol, { fromRemote: true });
      }
    });

    multiplayerClient.on('match_ended', (msg) => {
      if (gameMode === 'multi') {
        triggerCheckmateSequence(msg.defeatedColor, msg.winnerColor);
      }
    });

    // =========================================================================
    // Programmatic API for Automated Verification & Camera Inspection
    // =========================================================================
    window.wizardChess = {
      setCameraPreset,
      setCameraPose,
      setCameraLook: setCameraPose,
      setCameraKeySpeedPercent,
      setCameraRotSpeedPercent,
      setWallStoneLook,
      nextWallStoneLook,
      prevWallStoneLook,
      setFloorStoneLook,
      nextFloorStoneLook,
      prevFloorStoneLook,
      WALL_STONE_LOOKS,
      FLOOR_STONE_LOOKS,
      holdCameraKey: (code, down = true) => {
        if (down) heldCameraKeys.add(code);
        else heldCameraKeys.delete(code);
      },
      executeChessMove,
      triggerAIMoveNow,
      toggleAutoMove,
      restartGame: restartGameMatch,
      resetChessBoard,
      startSinglePlayerMatch,
      startMultiplayerMatch,
      setBotDifficultyLevel,
      setPlayerColor: (color) => {
        playerColor = color === 'b' ? 'b' : 'w';
        resetChessBoard(true, false);
        setCameraForSide(playerColor, false);
        updateTurnUI();
        emitPokerChessSync();
      },
      openLobbyModal,
      closeLobbyModal,
      toggleUI,
      loadNotation: (pgn, opts) => loadNotationScript(pgn, opts),
      stepScriptForward,
      stepScriptBackward,
      triggerCheckmateSequence,
      // Hearthstone & Poker Chess API
      drawTurnCards,
      useManaCoin,
      endPlayerTurnNow,
      toggleCardSelectionIndex,
      autoSelectBest5Cards,
      commitSelected5CardCombo,
      empowerFriendlyUnitAt,
      confirmFourKingsUltimate,
      skipEmpowerPhase,
      triggerPresetHand,
      handleTurnTimeout,
      triggerCombatHapticFeedback,
      triggerUnitMeleeAttack: (r, c, opts) => triggerUnitMeleeAttackAnimation(r, c, opts),
      triggerUnitMeleeDefend: (r, c, opts) => triggerUnitMeleeDefendAnimation(r, c, opts),
      buyAndEquipChessSkin,
      equipChessSkin,
      previewChessSkin3D,
      claimRankedBountyOrSimulateMatch,
      setInspectedUnitHpPercent: (targetPct = 15, rOpt, cOpt) => {
        let targetR = typeof rOpt === 'number' ? rOpt : null;
        let targetC = typeof cOpt === 'number' ? cOpt : null;
        if (targetR === null || targetC === null) {
          const uiState = getPokerChessUIState();
          if (uiState?.inspectedUnit) {
            targetR = uiState.inspectedUnit.r;
            targetC = uiState.inspectedUnit.c;
          }
        }
        const unit =
          targetR !== null && targetC !== null ? boardState[targetR]?.[targetC] : null;
        if (!unit) return false;
        const maxHp = Math.max(1, unit.maxHp || 20);
        const pct = Math.max(1, Math.min(100, Number(targetPct) || 15));
        let nextHp = Math.round((maxHp * pct) / 100);
        if (pct < 20) {
          nextHp = Math.max(1, Math.min(nextHp, Math.ceil(maxHp * 0.19) - (maxHp >= 10 ? 1 : 0)));
          if (nextHp / maxHp >= 0.2 && maxHp > 5) {
            nextHp = Math.max(1, Math.floor(maxHp * 0.15));
          }
          unit.armor = 0;
        }
        unit.hp = Math.max(1, Math.min(maxHp, nextHp));
        updateUnit3DBadge(unit);
        const worldPos = boardToWorld(targetR, targetC);
        if (pct < 20) {
          soundFX.playClashImpact(true, true);
          spawnCombatSparks3D(worldPos, 0xef4444, 24, 1.15);
          spawnFloatingCombatText(worldPos, '💥 VỠ KHIÊN (<20% HP)!', '#f87171', 0.95);
        } else if (pct <= 50) {
          soundFX.playClashImpact(false, false);
          spawnFloatingCombatText(worldPos, `⚠ HƯ HAO (${unit.hp}/${maxHp}❤)`, '#fbbf24', 0.85);
        } else {
          soundFX.playComboEmpower(false);
          spawnFloatingCombatText(worldPos, `🛡 HỒI PHỤC (${unit.hp}/${maxHp}❤)`, '#4ade80', 0.85);
        }
        emitPokerChessSync();
        return true;
      },
      toggleBattleMusic: () => {
        const playing = soundFX.toggleBattleMusic();
        emitPokerChessSync();
        return playing;
      },
      nextBattleTrack: () => {
        const track = soundFX.nextBattleTrack?.();
        emitPokerChessSync();
        return track;
      },
      getCurrentTrackInfo: () => soundFX.getCurrentTrackInfo?.() || null,
      toggleSoundMute: () => {
        const muted = soundFX.toggleMute();
        emitPokerChessSync();
        return muted;
      },
      playUIHover: () => soundFX.playUIHover(),
      playUIClick: () => soundFX.playUIClick(),
      triggerEpicCombatShowcase: () => {
        if (gameOver || isAnimatingMove) return false;
        soundFX.ensureCtx();
        if (!soundFX.isBattleMusicPlaying() && !soundFX.isMuted()) {
          soundFX.startBattleMusic();
        }
        // 1. Check if current side already has a legal capture move; if so, auto-draw/empower and execute it!
        const allMoves = getAllLegalMoves(currentTurn);
        const capMoves = allMoves.filter((m) => m.capture);
        if (capMoves.length > 0) {
          const chosen = capMoves[0];
          return executeChessMove(chosen.fromR, chosen.fromC, chosen.toR, chosen.toC);
        }
        // 2. If no immediate capture exists on turn 1, stage a dramatic center-board clash between opposing vanguard Knights/Pawns or trigger an empowered vanguard duel!
        const attR = currentTurn === 'w' ? 6 : 1;
        const defR = currentTurn === 'w' ? 1 : 6;
        const col = 4; // e-file center clash
        const attPiece = boardState[attR]?.[col];
        const defPiece = boardState[defR]?.[col];
        if (attPiece && defPiece) {
          // Teleport enemy vanguard pawn to mid-board (r = currentTurn === 'w' ? 5 : 2, c = 3) so attacker can legally cleave it!
          const targetR = currentTurn === 'w' ? 5 : 2;
          const targetC = 3;
          if (!boardState[targetR][targetC]) {
            boardState[defR][col] = null;
            boardState[targetR][targetC] = defPiece;
            defPiece.r = targetR;
            defPiece.c = targetC;
            defPiece.mesh.position.copy(boardToWorld(targetR, targetC));
            updateUnit3DBadge(defPiece);
            return executeChessMove(attR, col, targetR, targetC);
          }
        }
        // Fallback: trigger a full 3D visual & audio clash spectacle at the center of the altar
        const centerPos = new THREE.Vector3(0, BOARD_SURFACE_Y, 0);
        soundFX.playWeaponSwing('queen');
        soundFX.playBladeClash(true);
        soundFX.playClashImpact(true, true);
        spawnWeaponSlashArc3D(centerPos, 0, 0xfde047, 1.35, 0.42);
        spawnWeaponSlashArc3D(centerPos, Math.PI, 0xef4444, 1.25, -0.38);
        spawnCombatShockwave3D(centerPos, 0xf5d76e, true, true);
        spawnCombatSparks3D(centerPos, 0xfbbf24, 42, 1.35);
        spawnDivineLightningBeam(centerPos, 0xf5d76e, 0.09);
        return true;
      },
      selectSquareForMovePreview: (r, c) => {
        if (gameOver || isAnimatingMove) return false;
        const p = boardState[r]?.[c];
        if (!p || p.color !== currentTurn) {
          clearSquareHighlights();
          selectedSquare = null;
          validMoves = [];
          emitPokerChessSync();
          return false;
        }
        selectedSquare = { r, c };
        validMoves = getLegalMovesForPiece(r, c);
        showSquareHighlights(r, c, validMoves);
        soundFX.playPieceSelect(p.type);
        emitPokerChessSync();
        return validMoves;
      },
      executeSelectedMoveTo: (toR, toC) => {
        if (!selectedSquare || gameOver || isAnimatingMove) return false;
        const move = validMoves.find((m) => m.r === toR && m.c === toC);
        if (!move) return false;
        return executeChessMove(selectedSquare.r, selectedSquare.c, move.r, move.c);
      },
      pingSquare: (r, c, intent = selectedPingIntent) => pingBoardSquare(r, c, intent),
      removeTacticalPingAt: (r, c) => removeTacticalPingAt(r, c, true),
      clearTacticalPings: () => clearAllTacticalPings(true),
      toggleTacticalPingMode: (forceState = null) => toggleTacticalPingMode(forceState),
      setTacticalPingIntent: (intentId) => setTacticalPingIntent(intentId),
      getTacticalPings: () =>
        activeTacticalPings.map((p) => ({
          id: p.id,
          r: p.r,
          c: p.c,
          algebraic: p.algebraic,
          intent: p.intent,
          label: p.label,
          icon: p.icon,
          colorHex: p.colorHex,
          remainingSec: Math.max(0, Number(p.life.toFixed(1)))
        })),
      setTurnTimeRemaining: (sec) => {
        turnTimeRemaining = Math.max(0, Math.min(TURN_TIME_LIMIT, Number(sec) || 0));
        lastSyncedTurnSecond = Math.ceil(turnTimeRemaining);
        if (!gameOver && !isAnimatingMove && turnTimeRemaining > 0 && turnTimeRemaining < 10) {
          soundFX.startLowTimeTickingLoop(turnTimeRemaining);
          soundFX.updateLowTimeTickingUrgency(turnTimeRemaining);
        } else {
          soundFX.stopLowTimeTickingLoop(true);
        }
        emitPokerChessSync();
        if (turnTimeRemaining <= 0) {
          handleTurnTimeout();
        }
        return turnTimeRemaining;
      },
      getPokerChessUIState,
      getTutorial3DTargetScreenPos: () => {
        if (gameOver || isAnimatingMove || !renderer?.domElement || !camera) return null;
        const projectSq = (r, c, yLift = 0.28) => {
          const wPos = boardToWorld(r, c).clone();
          wPos.y += yLift;
          wPos.project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          const x = Math.round(rect.left + (wPos.x * 0.5 + 0.5) * rect.width);
          const y = Math.round(rect.top + (-wPos.y * 0.5 + 0.5) * rect.height);
          return { x, y };
        };

        const bestUnit = findBestMovableFriendlyUnit(currentTurn);
        if (turnPhase === 'EMPOWER_UNIT' && bestUnit) {
          const pt = projectSq(bestUnit.r, bestUnit.c, 0.36);
          return {
            stepType: 'EMPOWER_3D_UNIT',
            x: pt.x,
            y: pt.y,
            r: bestUnit.r,
            c: bestUnit.c,
            algebraic: toAlgebraic(bestUnit.r, bestUnit.c),
            unitNameVi: PIECE_NAMES_VI[bestUnit.piece.type] || bestUnit.piece.type,
            unitIcon: UNIT_BASE_STATS[bestUnit.piece.type]?.icon || '♟'
          };
        }

        if (turnPhase === 'MOVE_OR_COMBAT') {
          if (!selectedSquare || !validMoves || validMoves.length === 0) {
            if (!bestUnit) return null;
            const pt = projectSq(bestUnit.r, bestUnit.c, 0.36);
            return {
              stepType: 'SELECT_3D_UNIT',
              x: pt.x,
              y: pt.y,
              r: bestUnit.r,
              c: bestUnit.c,
              algebraic: toAlgebraic(bestUnit.r, bestUnit.c),
              unitNameVi: PIECE_NAMES_VI[bestUnit.piece.type] || bestUnit.piece.type,
              unitIcon: UNIT_BASE_STATS[bestUnit.piece.type]?.icon || '♟'
            };
          }

          // A friendly unit is already selected and has validMoves: pick the best destination square!
          const sortedMoves = [...validMoves].sort((a, b) => {
            const capDiff = (b.capture ? 100 : 0) - (a.capture ? 100 : 0);
            if (capDiff !== 0) return capDiff;
            const aCenter = a.r >= 2 && a.r <= 5 && a.c >= 2 && a.c <= 5 ? 25 : 0;
            const bCenter = b.r >= 2 && b.r <= 5 && b.c >= 2 && b.c <= 5 ? 25 : 0;
            const aAdv = currentTurn === 'w' ? 7 - a.r : a.r;
            const bAdv = currentTurn === 'w' ? 7 - b.r : b.r;
            return bCenter + bAdv * 4 - (aCenter + aAdv * 4);
          });
          const bestMove = sortedMoves[0];
          if (!bestMove) return null;
          const pt = projectSq(bestMove.r, bestMove.c, bestMove.capture ? 0.3 : 0.08);
          const selP = boardState[selectedSquare.r]?.[selectedSquare.c];
          return {
            stepType: 'CLICK_3D_DEST',
            x: pt.x,
            y: pt.y,
            r: bestMove.r,
            c: bestMove.c,
            fromR: selectedSquare.r,
            fromC: selectedSquare.c,
            algebraic: toAlgebraic(bestMove.r, bestMove.c),
            fromAlgebraic: toAlgebraic(selectedSquare.r, selectedSquare.c),
            unitNameVi: selP ? PIECE_NAMES_VI[selP.type] || selP.type : 'Quân cờ',
            unitIcon: selP ? UNIT_BASE_STATS[selP.type]?.icon || '♟' : '♟',
            isCapture: Boolean(bestMove.capture)
          };
        }

        return null;
      },
      triggerTutorialStepAction: () => {
        if (gameOver || isAnimatingMove || currentTurn !== playerColor) return false;
        if (turnPhase === 'DRAW_PHASE') {
          return drawTurnCards();
        }
        if (turnPhase === 'SELECT_CARDS') {
          const pState = pokerDecks[currentTurn];
          if (!pState || (pState.selectedIndices || []).length < 5) {
            autoSelectBest5Cards();
            return true;
          }
          return Boolean(commitSelected5CardCombo());
        }
        if (turnPhase === 'EMPOWER_UNIT') {
          const bestUnit = findBestMovableFriendlyUnit(currentTurn);
          if (bestUnit) {
            return empowerFriendlyUnitAt(bestUnit.r, bestUnit.c);
          }
          return skipEmpowerPhase();
        }
        if (turnPhase === 'ULTIMATE_TARGETING') {
          return confirmFourKingsUltimate();
        }
        if (turnPhase === 'MOVE_OR_COMBAT') {
          if (!selectedSquare || !validMoves || validMoves.length === 0) {
            const bestUnit = findBestMovableFriendlyUnit(currentTurn);
            if (!bestUnit) return false;
            selectedSquare = { r: bestUnit.r, c: bestUnit.c };
            validMoves = bestUnit.moves;
            showSquareHighlights(bestUnit.r, bestUnit.c, validMoves);
            soundFX.playPieceSelect(bestUnit.piece.type);
            emitPokerChessSync();
            return true;
          }
          const sortedMoves = [...validMoves].sort((a, b) => {
            const capDiff = (b.capture ? 100 : 0) - (a.capture ? 100 : 0);
            if (capDiff !== 0) return capDiff;
            const aCenter = a.r >= 2 && a.r <= 5 && a.c >= 2 && a.c <= 5 ? 25 : 0;
            const bCenter = b.r >= 2 && b.r <= 5 && b.c >= 2 && b.c <= 5 ? 25 : 0;
            const aAdv = currentTurn === 'w' ? 7 - a.r : a.r;
            const bAdv = currentTurn === 'w' ? 7 - b.r : b.r;
            return bCenter + bAdv * 4 - (aCenter + aAdv * 4);
          });
          const bestMove = sortedMoves[0];
          if (bestMove) {
            return executeChessMove(selectedSquare.r, selectedSquare.c, bestMove.r, bestMove.c);
          }
        }
        return false;
      },
      testColumnCollisionSlide: (startArr, endArr, steps = 20) => {
        activeCamTransition = null;
        camera.position.set(startArr[0], startArr[1], startArr[2]);
        const path = [];
        for (let i = 1; i <= steps; i++) {
          const u = i / steps;
          const prev = camera.position.clone();
          camera.position.set(
            startArr[0] + (endArr[0] - startArr[0]) * u,
            startArr[1] + (endArr[1] - startArr[1]) * u,
            startArr[2] + (endArr[2] - startArr[2]) * u
          );
          enforceCathedralBoundsAndSolidColumns(prev, camera.position, orbitControls.target);
          path.push(camera.position.toArray().map((v) => Number(v.toFixed(3))));
        }
        renderer.render(scene, camera);
        return path;
      },
      setSinglePlayerSide: (color) => {
        stopMultiplayerSync();
        scriptedGameActive = false;
        gameMode = 'single';
        playerColor = color === 'b' ? 'b' : 'w';
        resetChessBoard(true);
      },
      setupCustomScenario: (pieces, turn = 'w') => {
        stopMultiplayerSync();
        if (aiTimer) {
          clearTimeout(aiTimer);
          aiTimer = null;
        }
        activeMoveTweens.length = 0;
        isAnimatingMove = false;
        gameOver = false;
        scriptedGameActive = false;
        scriptDeviated = false;
        preMoveHighlightTask = null;
        clearCheckmateSequence();
        clearSquareHighlights();
        clearAllPieces();
        for (const p of pieces) {
          const inst = instantiatePiece(p.type, p.color, p.r, p.c);
          inst.hasMoved = Boolean(p.hasMoved);
          boardState[p.r][p.c] = inst;
        }
        currentTurn = turn;
        updateTurnUI();
        renderer.render(scene, camera);
      },
      triggerDemoCapture: () => {
        // Set up an immediate pawn capture (e4 x d5) and execute it
        resetChessBoard(true);
        // Move White e2->e4 and Black d7->d5 immediately on boardState, then animate White e4xd5
        const wp = boardState[6][4];
        boardState[6][4] = null;
        boardState[4][4] = wp;
        wp.r = 4; wp.c = 4;
        wp.mesh.position.copy(boardToWorld(4, 4));

        const bp = boardState[1][3];
        boardState[1][3] = null;
        boardState[3][3] = bp;
        bp.r = 3; bp.c = 3;
        bp.mesh.position.copy(boardToWorld(3, 3));

        currentTurn = 'w';
        return executeChessMove(4, 4, 3, 3);
      },
      getState: () => ({
        gameMode,
        scriptedGameActive,
        scriptDeviated,
        scriptMovesCount: scriptMoves.length,
        scriptCursor,
        moveHistoryCount: moveHistory.length,
        preMoveHighlightActive: Boolean(preMoveHighlightTask),
        selectedSquare,
        validMovesCount: validMoves.length,
        highlightMeshCount: squareHighlightsGroup.children.length,
        uiHidden: document.body.classList.contains('cinematic-ui-hidden'),
        playerColor,
        currentTurn,
        turnPhase,
        roomCode,
        isAnimatingMove,
        gameOver,
        checkmateState: { ...checkmateState },
        capturedByWhite,
        capturedByBlack,
        cameraPos: camera.position.toArray(),
        cameraTarget: orbitControls.target.toArray(),
        playerCamSide,
        overheadCamSide,
        sideCamSide,
        cathedralWideSide,
        cameraKeySpeedPct,
        cameraRotSpeedPct,
        wallStoneLookIndex: currentWallStoneLookIdx,
        wallStoneLookName: WALL_STONE_LOOKS[currentWallStoneLookIdx]?.name || '',
        floorStoneLookIndex: currentFloorStoneLookIdx,
        floorStoneLookName: FLOOR_STONE_LOOKS[currentFloorStoneLookIdx]?.name || '',
        floorMaterialRoughness: cathedralFloorMats[0]?.roughness ?? null,
        floorMaterialMetalness: cathedralFloorMats[0]?.metalness ?? null,
        keyMoveVelocity: keyMoveVelocity.toArray().map((v) => Number(v.toFixed(4))),
        keyRotVelocity: {
          yaw: Number(keyRotVelocity.yaw.toFixed(4)),
          pitch: Number(keyRotVelocity.pitch.toFixed(4))
        },
        cathedralBounds: CATHEDRAL_BOUNDS,
        solidColumnsCount: CATHEDRAL_SOLID_PILLARS.filter((p) => p.isColumn).length,
        brazierPillars: CATHEDRAL_SOLID_PILLARS.filter((p) => !p.isColumn),
        telemetry: cameraTelemetry
      }),
      captureScreenshot: async (filename) => {
        renderer.render(scene, camera);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = renderer.domElement.width;
        outCanvas.height = renderer.domElement.height;
        const ctx = outCanvas.getContext('2d');
        ctx.drawImage(renderer.domElement, 0, 0);

        const scale = outCanvas.width / window.innerWidth;

        // Draw Gothic Cathedral Checkmate Banner if active
        if (checkmateState.bannerVisible) {
          ctx.save();
          ctx.scale(scale, scale);
          const bw = 560;
          const bh = 168;
          const bx = (window.innerWidth - bw) / 2;
          const by = 84;

          ctx.fillStyle = 'rgba(10, 12, 20, 0.94)';
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.88)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 6);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = 'rgba(212, 175, 55, 0.38)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx + 6, by + 6, bw - 12, bh - 12, 4);
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(212, 175, 55, 0.88)';
          ctx.font = '600 12px Georgia, serif';
          ctx.fillText('✦   SANCTUM JUDGMENT   ✦', window.innerWidth / 2, by + 28);

          ctx.fillStyle = '#f5d76e';
          ctx.font = '26px serif';
          const crownChar = checkmateState.winnerColor === 'b' ? '♚' : '♔';
          ctx.fillText(crownChar, window.innerWidth / 2, by + 56);

          ctx.fillStyle = '#f7e299';
          ctx.font = 'bold 40px Georgia, serif';
          ctx.fillText('C H E C K M A T E', window.innerWidth / 2, by + 102);

          ctx.strokeStyle = 'rgba(212, 175, 55, 0.65)';
          ctx.beginPath();
          ctx.moveTo(bx + 90, by + 116);
          ctx.lineTo(bx + bw - 90, by + 116);
          ctx.stroke();

          const subTxt =
            document.getElementById('checkmate-subtitle')?.textContent ||
            'WHITE TRIUMPHS • THE BLACK KING HAS FALLEN';
          ctx.fillStyle = '#f0ece1';
          ctx.font = 'bold 14px Georgia, serif';
          ctx.fillText(subTxt.toUpperCase(), window.innerWidth / 2, by + 142);
          ctx.restore();
        }

        // Only draw HUD summary bar if UI is NOT hidden by cinematic mode
        if (!document.body.classList.contains('cinematic-ui-hidden')) {
          ctx.save();
          ctx.scale(scale, scale);
          ctx.fillStyle = 'rgba(12, 15, 22, 0.82)';
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(16, 16, 520, 42, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#d4af37';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.fillText('VƯƠNG QUYỀN • POKER CHESS', 30, 42);

          const turnStr = document.getElementById('turn-text')?.textContent || '';
          const modeStr = document.getElementById('mode-badge')?.textContent || '';
          ctx.fillStyle = '#f0ece1';
          ctx.font = '600 13px Inter, sans-serif';
          ctx.fillText(`${turnStr}   |   ${modeStr}`, 225, 42);

          if (lobbyModal?.classList.contains('open')) {
            ctx.fillStyle = 'rgba(6, 8, 14, 0.72)';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
            const cw = 440;
            const ch = 290;
            const cx = (window.innerWidth - cw) / 2;
            const cy = (window.innerHeight - ch) / 2;
            ctx.fillStyle = 'rgba(14, 17, 26, 0.96)';
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(cx, cy, cw, ch, 16);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#d4af37';
            ctx.font = 'bold 18px Inter, sans-serif';
            ctx.fillText('MULTIPLAYER LOBBY • ROOM CODE', cx + 28, cy + 42);

            ctx.fillStyle = '#9aa0a6';
            ctx.font = '13px Inter, sans-serif';
            ctx.fillText('Share this 4-character Room Code with Player 2:', cx + 28, cy + 82);

            ctx.fillStyle = '#f5d76e';
            ctx.font = 'bold 38px monospace';
            ctx.fillText(roomCode || '----', cx + 150, cy + 138);

            ctx.fillStyle = '#4ea8de';
            ctx.font = '600 14px Inter, sans-serif';
            ctx.fillText('Create Room  •  Join Room by Code  •  Live Move Sync', cx + 42, cy + 195);

            ctx.fillStyle = '#f0ece1';
            ctx.font = '13px Inter, sans-serif';
            ctx.fillText(`Host Assigned: ${playerColor === 'w' ? 'White' : 'Black'}  |  Status: Waiting for Opponent`, cx + 48, cy + 240);
          }
          ctx.restore();
        }

        const dataUrl = outCanvas.toDataURL('image/png');
        const res = await fetch('/api/upload-screenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, filename })
        });
        return res.json();
      }
    };

    window.wizardChess.stepBy = (seconds, steps = 24) => {
      const subDt = seconds / steps;
      for (let i = 0; i < steps; i++) {
        stepScene(subDt, false);
      }
      renderer.render(scene, camera);
    };

    // =========================================================================
    // Main Animation Loop
    // =========================================================================
    let elapsedTotal = 0;
    let mixerBatchParity = 0;
    function stepScene(dt, doRender = true) {
      elapsedTotal += dt;
      const prevCamPos = camera.position.clone();

      for (let i = 0; i < activeMixers.length; i++) {
        activeMixers[i].update(dt);
      }

      // Feature 3c: Advance pre-move piece selection & valid-squares highlight beat before executing scripted move
      if (preMoveHighlightTask && !isAnimatingMove) {
        preMoveHighlightTask.elapsedSim += dt;
        const wallElapsed = (performance.now() - preMoveHighlightTask.startWallMs) / 1000;
        if (
          preMoveHighlightTask.elapsedSim >= preMoveHighlightTask.duration ||
          wallElapsed >= preMoveHighlightTask.duration
        ) {
          const mv = preMoveHighlightTask.move;
          const fromScriptFlag = Boolean(preMoveHighlightTask.fromScript);
          preMoveHighlightTask = null;
          executeChessMove(mv.fromR, mv.fromC, mv.toR, mv.toC, { fromScript: fromScriptFlag });
        }
      }

      // 1. Move Animation Watchdog: prevent isAnimatingMove from locking the engine indefinitely
      if (isAnimatingMove) {
        const animElapsedMs = performance.now() - moveAnimationStartTime;
        if (animElapsedMs > 2500) {
          console.warn('[Failsafe] Move animation exceeded 2.5s timeout! Force-finishing move animation lock.');
          isAnimatingMove = false;
          activeMoveTweens.length = 0;
          if (activeDuelSavedCam) {
            camera.position.copy(activeDuelSavedCam.pos);
            orbitControls.target.copy(activeDuelSavedCam.target);
            activeDuelSavedCam = null;
          }
          orbitControls.enabled = true;
          orbitControls.update();
          updateAllUnitBadges();
          updateTurnUI();
          emitPokerChessSync();
        }
      } else if (activeMoveTweens.length > 0 && !isAnimatingMove) {
        isAnimatingMove = true;
        moveAnimationStartTime = performance.now();
      } else if (activeMoveTweens.length === 0 && isAnimatingMove) {
        isAnimatingMove = false;
      }

      for (let i = activeMoveTweens.length - 1; i >= 0; i--) {
        try {
          const done = activeMoveTweens[i](dt);
          if (done) activeMoveTweens.splice(i, 1);
        } catch (tweenErr) {
          console.error('[Tween Error] Animation step threw error, clearing tween:', tweenErr);
          activeMoveTweens.splice(i, 1);
          if (activeMoveTweens.length === 0) {
            isAnimatingMove = false;
            updateTurnUI();
          }
        }
      }

      // 60-Second Deliberation Turn Timer Countdown, Low-Time Tension Audio Loop (<10s) & Automatic End-of-Turn on Expiry
      if (!gameOver && !isAnimatingMove && !checkmateState.active) {
        turnTimeRemaining = Math.max(0, turnTimeRemaining - dt);
        const curWholeSec = Math.ceil(turnTimeRemaining);
        if (turnTimeRemaining > 0 && turnTimeRemaining < 10) {
          soundFX.startLowTimeTickingLoop(turnTimeRemaining);
          soundFX.updateLowTimeTickingUrgency(turnTimeRemaining);
        } else if (soundFX.isLowTimeTickingActive()) {
          soundFX.stopLowTimeTickingLoop(true);
        }
        if (curWholeSec !== lastSyncedTurnSecond) {
          lastSyncedTurnSecond = curWholeSec;
          emitPokerChessSync();
        }
        if (turnTimeRemaining <= 0) {
          handleTurnTimeout();
        }
        // Self-healing Single-Player Bot & Auto Move watchdog: guarantee Bot plays its turn whenever idle
        const aiSideColor = playerColor === 'w' ? 'b' : 'w';
        const isBotTurnWaiting =
          !scriptedGameActive &&
          gameMode === 'single' &&
          aiAutoPlay &&
          currentTurn === aiSideColor;
        if ((autoMoveEnabled || isBotTurnWaiting) && !aiTimer && activeMoveTweens.length === 0) {
          maybeScheduleAIMove();
        }
      } else if (soundFX.isLowTimeTickingActive()) {
        soundFX.stopLowTimeTickingLoop(true);
      }

      // Animate Themed Ambient Micro-Aura & Stardust motes (paused during active combat duel to ensure solid 60 FPS)
      if (!isAnimatingMove) {
        const currentSkinTrailHex = activeSkinSlashHex || 0xfde047;
      if (ambientMoteMat.color.getHex() !== currentSkinTrailHex) {
        ambientMoteMat.color.setHex(currentSkinTrailHex);
      }
      for (let i = 0; i < AMBIENT_MOTE_COUNT; i++) {
        const m = ambientMoteData[i];
        m.y += m.vy * dt;
        m.x += Math.sin(elapsedTotal * 1.4 + m.phase) * dt * 0.10;
        m.z += Math.cos(elapsedTotal * 1.3 + m.phase) * dt * 0.10;
        if (m.y > BOARD_SURFACE_Y + 1.25) {
          m.y = BOARD_SURFACE_Y + 0.05;
          m.x = (Math.random() - 0.5) * 3.0;
          m.z = (Math.random() - 0.5) * 3.0;
        }
        dummyMotePos.set(m.x, m.y, m.z);
        const oscScale = m.scale * (0.8 + Math.sin(elapsedTotal * 2.8 + m.phase) * 0.22);
        dummyMoteScale.set(oscScale, oscScale, oscScale);
        dummyMoteQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), elapsedTotal * m.rotSpeed);
        dummyMoteMat4.compose(dummyMotePos, dummyMoteQuat, dummyMoteScale);
        ambientMoteInstanced.setMatrixAt(i, dummyMoteMat4);
      }
      ambientMoteInstanced.instanceMatrix.needsUpdate = true;
      }

      // Animate 3D Floating Combat Texts (Damage, Armor Block, Heal, Level Up, Combo Seal)
      for (let i = floatingTexts3D.length - 1; i >= 0; i--) {
        const ft = floatingTexts3D[i];
        ft.life -= dt;
        if (ft.life <= 0) {
          scene.remove(ft.sprite);
          if (ft.sprite.material?.map) ft.sprite.material.map.dispose();
          if (ft.sprite.material) ft.sprite.material.dispose();
          floatingTexts3D.splice(i, 1);
          continue;
        }
        ft.sprite.position.y += ft.velY * dt;
        const alpha = Math.min(1, ft.life / (ft.maxLife * 0.45));
        ft.sprite.material.opacity = alpha;
      }

      // Animate 3D Divine Lightning Beams (Tứ Quý & Thùng Phá Sảnh Ultimates)
      for (let i = lightningBeams3D.length - 1; i >= 0; i--) {
        const lb = lightningBeams3D[i];
        lb.life -= dt;
        if (lb.life <= 0) {
          if (lb.mesh) scene.remove(lb.mesh);
          if (lb.ringMesh) scene.remove(lb.ringMesh);
          if (lb.geo) lb.geo.dispose();
          if (lb.ringGeo) lb.ringGeo.dispose();
          if (lb.mat) lb.mat.dispose();
          if (lb.ringMat) lb.ringMat.dispose();
          lightningBeams3D.splice(i, 1);
          continue;
        }
        const ratio = Math.max(0, lb.life / lb.maxLife);
        if (lb.mat) lb.mat.opacity = ratio * 0.92;
        if (lb.ringMat) lb.ringMat.opacity = ratio * 0.88;
        const pulseScale = 1 + (1 - ratio) * 1.45;
        if (lb.ringMesh) lb.ringMesh.scale.set(pulseScale, pulseScale, 1);
      }

      // Animate 3D Concentric Combat Shockwave Rings
      for (let i = combatShockwaves3D.length - 1; i >= 0; i--) {
        const sw = combatShockwaves3D[i];
        sw.life -= dt;
        if (sw.life <= 0) {
          if (sw.outerMesh) scene.remove(sw.outerMesh);
          if (sw.innerMesh) scene.remove(sw.innerMesh);
          if (sw.outerMat) sw.outerMat.dispose();
          if (sw.innerMat) sw.innerMat.dispose();
          combatShockwaves3D.splice(i, 1);
          continue;
        }
        const progress = 1 - Math.max(0, sw.life / sw.maxLife);
        const easeOut = 1 - Math.pow(1 - progress, 2.4);
        const outerScale = 0.45 + easeOut * sw.maxScale;
        const innerScale = 0.35 + Math.pow(progress, 0.75) * (sw.maxScale * 1.15);
        if (sw.outerMesh) {
          sw.outerMesh.scale.set(outerScale, 1, outerScale);
        }
        if (sw.innerMesh) {
          sw.innerMesh.scale.set(innerScale, 1, innerScale);
          sw.innerMesh.rotation.y += dt * 4.2;
        }
        if (sw.outerMat) sw.outerMat.opacity = Math.max(0, (1 - progress) * 0.95);
        if (sw.innerMat) sw.innerMat.opacity = Math.max(0, (1 - progress * progress) * 0.88);
      }

      // Animate 3D Crescent Weapon Slash Arcs
      for (let i = slashArcs3D.length - 1; i >= 0; i--) {
        const sa = slashArcs3D[i];
        sa.life -= dt;
        if (sa.life <= 0) {
          if (sa.mesh) scene.remove(sa.mesh);
          if (sa.mat) sa.mat.dispose();
          slashArcs3D.splice(i, 1);
          continue;
        }
        const progress = 1 - Math.max(0, sa.life / sa.maxLife);
        sa.mesh.position.x += sa.velX * dt;
        sa.mesh.position.z += sa.velZ * dt;
        sa.mesh.rotation.z += sa.rotSpin * dt;
        const s = sa.baseScale * (0.72 + progress * 0.88);
        sa.mesh.scale.setScalar(s);
        sa.mat.opacity = Math.max(0, (1 - progress * progress) * 0.96);
      }

      // Animate 3D Molten Combat Sparks & Embers
      for (let i = combatSparks3D.length - 1; i >= 0; i--) {
        const sp = combatSparks3D[i];
        sp.life -= dt;
        if (sp.life <= 0) {
          if (sp.mesh) scene.remove(sp.mesh);
          combatSparks3D.splice(i, 1);
          continue;
        }
        sp.vel.y -= 7.6 * dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        if (sp.mesh.position.y < BOARD_SURFACE_Y + 0.02) {
          sp.mesh.position.y = BOARD_SURFACE_Y + 0.02;
          sp.vel.y *= -0.46;
          sp.vel.x *= 0.78;
          sp.vel.z *= 0.78;
        }
        sp.mesh.rotation.x += 11 * dt;
        sp.mesh.rotation.y += 14 * dt;
        const lifeRatio = Math.max(0, sp.life / sp.maxLife);
        sp.mat.opacity = Math.min(1, lifeRatio * 1.4);
        sp.mesh.scale.setScalar(sp.baseScale * (0.35 + lifeRatio * 0.75));
      }

      // Animate 3D Melee Defend Aegis Shield Domes & Hexagonal Guard Rings
      for (let i = defendShields3D.length - 1; i >= 0; i--) {
        const sh = defendShields3D[i];
        sh.life -= dt;
        if (sh.life <= 0) {
          if (sh.domeMesh) scene.remove(sh.domeMesh);
          if (sh.ringMesh) scene.remove(sh.ringMesh);
          if (sh.domeMat) sh.domeMat.dispose();
          if (sh.wireMat) sh.wireMat.dispose();
          if (sh.ringMat) sh.ringMat.dispose();
          defendShields3D.splice(i, 1);
          continue;
        }
        const progress = 1 - Math.max(0, sh.life / sh.maxLife);
        const pulseScale = 0.86 + Math.sin(progress * Math.PI) * 0.34;
        if (sh.domeMesh) {
          sh.domeMesh.scale.setScalar(pulseScale);
          sh.domeMesh.rotation.y += dt * 2.8;
        }
        if (sh.ringMesh) {
          sh.ringMesh.scale.setScalar(0.92 + progress * 0.45);
          sh.ringMesh.rotation.z -= dt * 3.6;
        }
        const fade = Math.max(0, 1 - progress * progress);
        if (sh.domeMat) sh.domeMat.opacity = fade * 0.52;
        if (sh.wireMat) sh.wireMat.opacity = fade * 0.84;
        if (sh.ringMat) sh.ringMat.opacity = fade * 0.92;
      }

      // Animate Standalone 3D Unit Melee Attack Lunge & Melee Defend Brace/Recoil
      for (let i = activeUnitCombatAnims3D.length - 1; i >= 0; i--) {
        const anim = activeUnitCombatAnims3D[i];
        anim.elapsed += dt;
        const p = anim.piece;
        if (!p || !p.mesh || isAnimatingMove) {
          activeUnitCombatAnims3D.splice(i, 1);
          continue;
        }
        const u = Math.min(1, anim.elapsed / anim.duration);
        const dirX = Math.sin(anim.headingRad);
        const dirZ = Math.cos(anim.headingRad);
        if (anim.mode === 'MELEE_ATTACK') {
          const strikeWave = Math.sin(u * Math.PI);
          const lungeDist = strikeWave * 0.115;
          const hopY = Math.sin(u * Math.PI) * 0.048;
          p.mesh.position.set(
            anim.homePos.x + dirX * lungeDist,
            BOARD_SURFACE_Y + hopY,
            anim.homePos.z + dirZ * lungeDist
          );
          p.mesh.rotation.x = Math.sin(u * Math.PI * 2) * 0.16;
        } else {
          // MELEE_DEFEND: Braced guard recoil & shield crouch
          const recoilWave = Math.sin(u * Math.PI);
          const recoilDist = -recoilWave * 0.062;
          p.mesh.position.set(
            anim.homePos.x + dirX * recoilDist,
            BOARD_SURFACE_Y,
            anim.homePos.z + dirZ * recoilDist
          );
          p.mesh.rotation.x = -recoilWave * 0.14;
        }
        if (u >= 1) {
          p.mesh.position.copy(anim.homePos);
          p.mesh.rotation.x = 0;
          p.mesh.rotation.z = 0;
          playPieceClip(p, 'Idle', true, 0.15);
          activeUnitCombatAnims3D.splice(i, 1);
        }
      }

      // Pulse empowered unit pedestal rings, decay combatAnimState timers & animate 10 custom 3D skin models
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (!p) continue;
          if (p.sealRingMesh && p.activeCombo) {
            p.sealRingMesh.material.opacity = 0.68 + Math.sin(elapsedTotal * 4.5) * 0.22;
          }
          if (p.combatAnimTimer && p.combatAnimTimer > 0) {
            p.combatAnimTimer -= dt;
            if (p.combatAnimTimer <= 0) {
              p.combatAnimTimer = 0;
              p.combatAnimState = null;
              emitPokerChessSync();
            }
          }
          // Animate custom 3D Skin Model Attachments (Wings, Gyroscopic Astrolabes, Floating Swords, Pearls, Scythes)
          const sa = p.skinAnimParts;
          if (sa) {
            const ph = sa.phaseOffset || 0;
            const isFighting = Boolean(p.combatAnimState);
            const speedMul = isFighting ? 2.4 : 1.0;
            const wingFlap = Math.sin(elapsedTotal * 2.8 * speedMul + ph) * (isFighting ? 0.26 : 0.12);

            if (sa.leftWing) {
              sa.leftWing.rotation.y = 0.30 + wingFlap;
            }
            if (sa.rightWing) {
              sa.rightWing.rotation.y = -0.30 - wingFlap;
            }
            if (sa.orbitGroup) {
              sa.orbitGroup.rotation.y += dt * 1.35 * speedMul;
            }
            if (sa.gyroOuter) {
              sa.gyroOuter.rotation.y += dt * 1.4 * speedMul;
              sa.gyroOuter.rotation.x += dt * 0.65 * speedMul;
            }
            if (sa.gyroMid) {
              sa.gyroMid.rotation.z -= dt * 1.8 * speedMul;
              sa.gyroMid.rotation.y -= dt * 0.85 * speedMul;
            }
            if (sa.gyroInner) {
              sa.gyroInner.rotation.x += dt * 2.2 * speedMul;
              sa.gyroInner.rotation.z += dt * 1.1 * speedMul;
            }
            if (sa.haloRing) {
              sa.haloRing.rotation.z += dt * 0.95 * speedMul;
            }
            if (sa.floatingWeapons && sa.floatingWeapons.length > 0) {
              for (let wIdx = 0; wIdx < sa.floatingWeapons.length; wIdx++) {
                const fw = sa.floatingWeapons[wIdx];
                if (typeof fw.userData.baseY === 'number') {
                  fw.position.y =
                    fw.userData.baseY +
                    Math.sin(elapsedTotal * 3.1 * speedMul + ph + wIdx * 1.2) * 0.035;
                }
              }
            }
            if (sa.levitatingCrystals && sa.levitatingCrystals.length > 0) {
              for (let cIdx = 0; cIdx < sa.levitatingCrystals.length; cIdx++) {
                const cry = sa.levitatingCrystals[cIdx];
                cry.rotation.y += dt * 2.1;
                if (typeof cry.userData.baseY === 'number') {
                  cry.position.y =
                    cry.userData.baseY +
                    Math.sin(elapsedTotal * 2.6 + ph + cIdx * 2.09) * 0.04;
                }
              }
            }
          }
        }
      }

      // Animate 3D Consecrated ('Holy Aura') & Corrupted ('Ground Crack') board tile overlays
      if (specialTileOverlaysGroup.children.length > 0) {
        for (const tileMesh of specialTileOverlaysGroup.children) {
          const ud = tileMesh.userData;
          if (!ud) continue;
          const isHov = Boolean(
            hoveredSquare && hoveredSquare.r === ud.r && hoveredSquare.c === ud.c
          );
          const hasUnit = Boolean(boardState[ud.r]?.[ud.c]);
          const pulse = Math.sin(elapsedTotal * 3.2 + (ud.phaseOffset || 0));
          if (tileMesh.material) {
            tileMesh.material.opacity = isHov
              ? 1.0
              : hasUnit
                ? 0.94 + pulse * 0.06
                : 0.82 + pulse * 0.12;
          }
          if (ud.borderShaderMat && ud.borderShaderMat.uniforms) {
            ud.borderShaderMat.uniforms.uTime.value = elapsedTotal;
            ud.borderShaderMat.uniforms.uHover.value = isHov ? 1.0 : 0.0;
            ud.borderShaderMat.uniforms.uOccupied.value = hasUnit ? 1.0 : 0.0;
          }
          if (ud.edgeWireMat) {
            ud.edgeWireMat.opacity = isHov ? 1.0 : hasUnit ? 0.95 : 0.68 + pulse * 0.22;
          }
          if (ud.crownMesh && ud.crownMat) {
            const crownPulse = 0.5 + 0.5 * Math.sin(elapsedTotal * 4.1 + (ud.phaseOffset || 0));
            ud.crownMat.opacity = isHov
              ? 0.34
              : hasUnit
                ? 0.24 + crownPulse * 0.10
                : 0.11 + crownPulse * 0.08;
            ud.crownMesh.scale.y = isHov ? 1.45 : hasUnit ? 1.2 + crownPulse * 0.2 : 0.85 + crownPulse * 0.25;
          }
          if (ud.ringMesh) {
            ud.ringMesh.rotation.z +=
              (ud.tileType === 'CONSECRATED' ? 0.65 : -0.85) * dt;
            const ringScale = isHov ? 1.15 : hasUnit ? 1.08 + pulse * 0.05 : 1.0 + pulse * 0.05;
            ud.ringMesh.scale.set(ringScale, ringScale, 1);
          }
        }
      }

      // Animate semi-transparent 3D floor tile glow overlays & underlying floor tile emissive intensity
      if (squareHighlightsGroup.children.length > 0) {
        for (const hlMesh of squareHighlightsGroup.children) {
          const ud = hlMesh.userData;
          if (!ud) continue;
          const isHovered =
            hoveredSquare && hoveredSquare.r === ud.r && hoveredSquare.c === ud.c;
          const wave = Math.sin(elapsedTotal * 4.2 + (ud.phaseOffset || 0));
          const baseOp = ud.baseOpacity || 0.85;
          if (hlMesh.material) {
            hlMesh.material.opacity = isHovered
              ? 1.0
              : Math.max(0.45, Math.min(1.0, baseOp + wave * 0.14));
          }
          if (ud.innerMarker) {
            const s = isHovered ? 1.14 : 1.0 + wave * 0.06;
            ud.innerMarker.scale.set(s, s, 1);
          }
        }
      }

      // Animate 3D Tactical Tile Ping Beacon Markers (Sonar Ripple, Rotating Compass, Corner Chevrons & Floating Crystal)
      if (activeTacticalPings.length > 0) {
        let pingExpired = false;
        for (let i = activeTacticalPings.length - 1; i >= 0; i--) {
          const tp = activeTacticalPings[i];
          tp.life -= dt;
          if (tp.life <= 0) {
            disposePingEntry3D(tp);
            activeTacticalPings.splice(i, 1);
            pingExpired = true;
            continue;
          }
          const age = tp.maxLife - tp.life;
          const fadeOut = tp.life < 1.5 ? Math.max(0.05, tp.life / 1.5) : 1.0;

          // Sonar pulse cycle (every 1.25s expands from 0.55x to 2.05x and fades)
          const sonarPhase = (age * 0.85) % 1.0;
          if (tp.sonarMesh && tp.sonarMat) {
            const sonarScale = 0.55 + sonarPhase * 1.55;
            tp.sonarMesh.scale.set(sonarScale, sonarScale, 1);
            tp.sonarMat.opacity = (1.0 - sonarPhase) * 0.82 * fadeOut;
          }

          // Rotate octagonal reticle & inner compass ring in opposite directions
          if (tp.octRingMesh && tp.octRingMat) {
            tp.octRingMesh.rotation.z += dt * 0.55;
            tp.octRingMat.opacity = (0.78 + Math.sin(elapsedTotal * 4.5) * 0.16) * fadeOut;
          }
          if (tp.compassMesh && tp.compassMat) {
            tp.compassMesh.rotation.z -= dt * 1.45;
            tp.compassMat.opacity = 0.86 * fadeOut;
          }

          // Pulse corner chevron brackets inward/outward
          if (tp.cornerNodes) {
            const bracketOffset = Math.sin(elapsedTotal * 5.2 + i) * 0.012;
            for (const cn of tp.cornerNodes) {
              const d = (cn.userData.baseDist || 0.128) + bracketOffset;
              cn.position.x = cn.userData.sx * d;
              cn.position.z = cn.userData.sz * d;
            }
          }
          if (tp.bracketMat) {
            tp.bracketMat.opacity = 0.94 * fadeOut;
          }

          // Holographic light pillar pulse
          if (tp.pillarMesh && tp.pillarMat) {
            tp.pillarMat.opacity = (0.18 + Math.sin(elapsedTotal * 3.8 + i) * 0.07) * fadeOut;
            const pScale = 0.92 + Math.sin(elapsedTotal * 4.2 + i) * 0.08;
            tp.pillarMesh.scale.set(pScale, 1, pScale);
          }

          // Dynamic elevation so the floating crystal & callout badge always stay above any piece on that tile
          const pieceOnTile = boardState[tp.r]?.[tp.c];
          const targetHoverY = pieceOnTile
            ? (PIECE_HEIGHTS[pieceOnTile.type] || 0.48) + 0.26
            : 0.34;
          tp.baseHoverY += (targetHoverY - tp.baseHoverY) * Math.min(1, dt * 8);

          if (tp.finialAnchor) {
            tp.finialAnchor.position.y = tp.baseHoverY + Math.sin(elapsedTotal * 3.6 + i) * 0.028;
          }
          if (tp.crystalMesh && tp.crystalMat) {
            tp.crystalMesh.rotation.y += dt * 2.2;
            tp.crystalMat.opacity = 0.96 * fadeOut;
          }
          if (tp.gyroMesh && tp.gyroMat) {
            tp.gyroMesh.rotation.z += dt * 2.8;
            tp.gyroMesh.rotation.y -= dt * 1.6;
            tp.gyroMat.opacity = 0.85 * fadeOut;
          }
          if (tp.labelSprite && tp.labelSprite.material) {
            tp.labelSprite.material.opacity = fadeOut;
          }
        }
        if (pingExpired) {
          emitPokerChessSync();
        }
      }

      // Animate 3D Visual Pathing Indicators (Marching Trajectory Chevrons, Historical Breadcrumb Crystals & Target Lock Ring)
      if (activeTrajectoryChevrons.length > 0) {
        for (let i = 0; i < activeTrajectoryChevrons.length; i++) {
          const item = activeTrajectoryChevrons[i];
          if (!item.mesh || !item.curve) continue;
          const u = (item.offset + elapsedTotal * 0.72) % 1.0;
          const pt = item.curve.getPoint(u);
          const tan = item.curve.getTangent(u);
          item.mesh.position.copy(pt);
          item.mesh.lookAt(pt.x + tan.x, pt.y + tan.y, pt.z + tan.z);
          if (item.mesh.material) {
            const edgeFade = u < 0.14 ? u / 0.14 : u > 0.86 ? (1 - u) / 0.14 : 1.0;
            item.mesh.material.opacity = Math.max(0.08, 0.92 * edgeFade);
          }
        }
      }
      if (activeHistoryNodes.length > 0) {
        for (let i = 0; i < activeHistoryNodes.length; i++) {
          const hn = activeHistoryNodes[i];
          if (!hn.mesh) continue;
          if (hn.bobAmp > 0) {
            hn.mesh.rotation.y += dt * (hn.rotSpeed || 1.5);
            hn.mesh.position.y =
              hn.baseY + Math.sin(elapsedTotal * 3.4 + (hn.phase || 0)) * hn.bobAmp;
          } else {
            hn.mesh.rotation.z += dt * (hn.rotSpeed || 0.6);
          }
        }
      }
      if (activeTrajectoryWaypoints.length > 0) {
        for (let i = 0; i < activeTrajectoryWaypoints.length; i++) {
          const wp = activeTrajectoryWaypoints[i];
          if (!wp.mesh) continue;
          wp.mesh.rotation.y += dt * 2.4;
          wp.mesh.position.y = wp.baseY + Math.sin(elapsedTotal * 4.2 + (wp.phase || 0)) * 0.009;
        }
      }
      if (activeTargetLockRing) {
        activeTargetLockRing.rotation.z -= dt * 1.65;
        const lockScale = 0.94 + Math.sin(elapsedTotal * 5.0) * 0.07;
        activeTargetLockRing.scale.set(lockScale, lockScale, 1);
      }

      // Feature 4: Video-game style WASD + R/F camera translation AND Arrow-key camera rotation
      // with separate UI-configurable Move Speed & Rot Speed (both default 10%) and smooth ease-in / ease-out velocity damping
      if (!isAnimatingMove) {
        const moveSpeedScale = cameraKeySpeedPct / 100;
        const rotSpeedScale = cameraRotSpeedPct / 100;
        const maxMoveSpeed = 3.2 * moveSpeedScale; // 0.32 m/s at default 10%
        const maxVertSpeed = 2.6 * moveSpeedScale; // 0.26 m/s at default 10%
        const maxRotSpeed = 1.2 * rotSpeedScale;   // 0.12 rad/s at default 10%

        const forward = new THREE.Vector3().subVectors(orbitControls.target, camera.position);
        forward.y = 0;
        if (forward.lengthSq() < 1e-6) {
          camera.getWorldDirection(forward);
          forward.y = 0;
        }
        forward.normalize();
        const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();

        const horizDir = new THREE.Vector3(0, 0, 0);
        if (heldCameraKeys.has('KeyW')) horizDir.add(forward);
        if (heldCameraKeys.has('KeyS')) horizDir.sub(forward);
        if (heldCameraKeys.has('KeyD')) horizDir.add(right);
        if (heldCameraKeys.has('KeyA')) horizDir.sub(right);
        if (horizDir.lengthSq() > 1e-6) horizDir.normalize();

        const desiredMoveVel = horizDir.multiplyScalar(maxMoveSpeed);
        if (heldCameraKeys.has('KeyR')) desiredMoveVel.y += maxVertSpeed;
        if (heldCameraKeys.has('KeyF')) desiredMoveVel.y -= maxVertSpeed;

        let desiredYawVel = 0;
        let desiredPitchVel = 0;
        if (heldCameraKeys.has('ArrowLeft')) desiredYawVel += maxRotSpeed;
        if (heldCameraKeys.has('ArrowRight')) desiredYawVel -= maxRotSpeed;
        if (heldCameraKeys.has('ArrowUp')) desiredPitchVel += maxRotSpeed;
        if (heldCameraKeys.has('ArrowDown')) desiredPitchVel -= maxRotSpeed;

        // Smooth ease-in when keys are pressed and smooth ease-out when keys are released
        const easeAlpha = 1 - Math.exp(-Math.max(0.001, dt) * 7.5);
        keyMoveVelocity.lerp(desiredMoveVel, easeAlpha);
        keyRotVelocity.yaw += (desiredYawVel - keyRotVelocity.yaw) * easeAlpha;
        keyRotVelocity.pitch += (desiredPitchVel - keyRotVelocity.pitch) * easeAlpha;

        if (keyMoveVelocity.lengthSq() < 1e-8 && desiredMoveVel.lengthSq() === 0) {
          keyMoveVelocity.set(0, 0, 0);
        }
        if (Math.abs(keyRotVelocity.yaw) < 1e-5 && desiredYawVel === 0) keyRotVelocity.yaw = 0;
        if (Math.abs(keyRotVelocity.pitch) < 1e-5 && desiredPitchVel === 0) keyRotVelocity.pitch = 0;

        const hasActiveMove = keyMoveVelocity.lengthSq() > 0;
        const hasActiveRot = keyRotVelocity.yaw !== 0 || keyRotVelocity.pitch !== 0;

        if (hasActiveMove || hasActiveRot) {
          activeCamTransition = null;

          if (hasActiveMove) {
            const moveDelta = keyMoveVelocity.clone().multiplyScalar(dt);
            const beforeMovePos = camera.position.clone();
            camera.position.add(moveDelta);
            enforceCathedralBoundsAndSolidColumns(beforeMovePos, camera.position, orbitControls.target);
            const actualMoveDelta = camera.position.clone().sub(beforeMovePos);
            orbitControls.target.add(actualMoveDelta);
          }

          if (hasActiveRot) {
            const lookOffset = new THREE.Vector3().subVectors(orbitControls.target, camera.position);
            const dist = Math.max(0.5, lookOffset.length());
            const dir = lookOffset.normalize();
            let yaw = Math.atan2(dir.x, dir.z);
            let pitch = Math.asin(Math.max(-0.98, Math.min(0.98, dir.y)));

            yaw += keyRotVelocity.yaw * dt;
            pitch = Math.max(-1.35, Math.min(1.35, pitch + keyRotVelocity.pitch * dt));

            const cosP = Math.cos(pitch);
            const newOffset = new THREE.Vector3(
              Math.sin(yaw) * cosP * dist,
              Math.sin(pitch) * dist,
              Math.cos(yaw) * cosP * dist
            );
            orbitControls.target.copy(camera.position).add(newOffset);
          }

          if (heldCameraKeys.size > 0) {
            document
              .querySelectorAll('#btn-cam-player, #btn-cam-wide, #btn-cam-top, #btn-cam-side')
              .forEach((b) => b.classList.remove('active'));
          }
        }
      }

      if (activeCamTransition && !isAnimatingMove) {
        activeCamTransition.elapsed += dt;
        const u = Math.min(1, activeCamTransition.elapsed / activeCamTransition.duration);
        const ease = easeInOutCubic(u);
        camera.position.lerpVectors(activeCamTransition.startPos, activeCamTransition.endPos, ease);
        orbitControls.target.lerpVectors(activeCamTransition.startTarget, activeCamTransition.endTarget, ease);
        enforceCathedralBoundsAndSolidColumns(prevCamPos, camera.position, orbitControls.target);
        camera.lookAt(orbitControls.target);
        if (u >= 1) {
          activeCamTransition = null;
          flushOrbitControlsDamping();
        }
      } else if (orbitControls.enabled && !isAnimatingMove) {
        orbitControls.update();
        enforceCathedralBoundsAndSolidColumns(prevCamPos, camera.position, orbitControls.target);
        camera.lookAt(orbitControls.target);
      } else if (isAnimatingMove) {
        enforceCathedralBoundsAndSolidColumns(prevCamPos, camera.position, orbitControls.target);
        camera.lookAt(orbitControls.target);
      }

      if (impactFlashLight.intensity > 0) {
        impactFlashLight.intensity = Math.max(0, impactFlashLight.intensity - dt * 28);
      }

      for (let i = shatterDebris.length - 1; i >= 0; i--) {
        const d = shatterDebris[i];
        d.life -= dt;
        if (d.life <= 0) {
          scene.remove(d.mesh);
          shatterDebris.splice(i, 1);
          continue;
        }
        d.vel.y -= 9.8 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        if (d.mesh.position.y < BOARD_SURFACE_Y + 0.03) {
          d.mesh.position.y = BOARD_SURFACE_Y + 0.03;
          d.vel.y *= -0.35;
          d.vel.x *= 0.72;
          d.vel.z *= 0.72;
        }
        // Fast & natural stone debris shard scattering
        if (d.mesh.position.y < BOARD_SURFACE_Y + 0.03) {
          d.mesh.position.y = BOARD_SURFACE_Y + 0.03;
          d.vel.y *= -0.32;
          d.vel.x *= 0.68;
          d.vel.z *= 0.68;
        }
        d.mesh.rotation.x += d.rotVel.x * dt;
        d.mesh.rotation.y += d.rotVel.y * dt;
        d.mesh.rotation.z += d.rotVel.z * dt;
        if (d.life < 0.5) {
          const s = Math.max(0.01, d.life * 2);
          d.mesh.scale.setScalar((d.baseScale || 0.036) * s);
        }
      }

      // Advance volumetric GLSL brazier flames & active warm firelight flicker (throttled)
      brazierThrottleCounter = (brazierThrottleCounter + 1) % 2;
      if (brazierThrottleCounter === 0) {
        for (let i = 0; i < brazierFireUniforms.length; i++) {
          brazierFireUniforms[i].uTime.value = elapsedTotal;
        }
        for (let i = 0; i < brazierGlowSprites.length; i++) {
          const sp = brazierGlowSprites[i];
          const baseOp = sp.userData.baseOpacity || 0.4;
          const seed = sp.userData.seed || 0;
          sp.material.opacity =
            baseOp +
            Math.sin(elapsedTotal * 5.2 + seed) * 0.045 +
            Math.cos(elapsedTotal * 8.4 + seed * 1.3) * 0.025;
        }
        for (let i = 0; i < brazierLights.length; i++) {
          const baseInt = brazierLights[i].userData.baseIntensity || 3.2;
          brazierLights[i].intensity =
            baseInt +
            Math.sin(elapsedTotal * 5.6 + i * 1.7) * 0.28 +
            Math.cos(elapsedTotal * 9.1 + i) * 0.16;
        }
      }

      if (
        (isAnimatingMove || activeMoveTweens.length > 0 || checkmateState.active) &&
        renderer.shadowMap.enabled
      ) {
        shadowUpdateFrameCounter++;
        if (shadowUpdateFrameCounter % 6 === 0) {
          renderer.shadowMap.needsUpdate = true;
        }
      }

      if (doRender) {
        renderer.render(scene, camera);
      }
    }

    let manualStepMode = false;
    window.wizardChess.cyclePerformancePreset = cyclePerformancePreset;
    window.wizardChess.setPerformancePreset = applyPerformanceSettings;
    window.wizardChess.getPerformancePreset = () => performancePreset;
    window.wizardChess.cyclePathingDisplayMode = cyclePathingDisplayMode;
    window.wizardChess.setPathingDisplayMode = setPathingDisplayMode;
    window.wizardChess.getPathingDisplayMode = () => pathingDisplayMode;
    window.wizardChess.getFPS = () => currentFPS;
    window.wizardChess.setManualStepMode = (v) => {
      manualStepMode = Boolean(v);
    };

    function animate() {
      if (!navigator.webdriver && !manualStepMode) {
        requestAnimationFrame(animate);
      }
      if (manualStepMode) return;
      const now = performance.now();
      frameCount++;
      if (now - lastFpsTime >= 500) {
        currentFPS = Math.round((frameCount * 1000) / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;
      }
      const dt = Math.min(clock.getDelta(), 0.1);
      stepScene(dt || 0.016, true);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });


    // Startup sequence (Standalone Single-Player AI Studio Applet)
    (async () => {
      await loadAllAssets();
      const params = new URLSearchParams(window.location.search);
      const urlSide = params.get('side');
      if (urlSide === 'b' || urlSide === 'black') {
        playerColor = 'b';
      }
      resetChessBoard(true, true);
      if (navigator.webdriver) {
        window.wizardChess.stepBy(0.9, 15);
      } else {
        animate();
      }
    })();
}
