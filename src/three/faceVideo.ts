import * as THREE from 'three'
import { clamp, clamp01, motionPrefs } from '../lib/motionPrefs'
import { createSpring, SPRING } from '../lib/spring'

/**
 * faceVideo.ts — 首屏「视频脸」交互层（v3）。
 *
 * 用户新拍的循环微动视频（doubao_face_v3.mp4 / .gif）挂进 three 舞台：
 * 一块相机下的全屏 quad，shader 里做三件事：
 *   1. 捏脸：屏幕 UV 空间的按压缩放 + 坑沿压暗（与 plateShader 同一套手感）
 *   2. 眼神跟随：源视频 UV 空间里，把可见左眼区域按视线方向做软形变
 *      （眼睛/脸部标定来自离线逐帧分析，见文件底部常量）
 *   3. cover 取景 + punch-in：复刻旧 DOM 视频的裁剪窗（把烧录字推出取景框）
 *
 * 滚动时随取景进度 0.02→0.05 交叉淡出（在对话舞台之前完全消失，杜绝重影），
 * 淡出即暂停解码省资源。
 */

const SUBJECT_Z = -2.0

/* ---- 源视频（1280×720）标定，来自离线帧分析（tools 之外的临时脚本） ---- */
/** 唯一可见的左眼中心（归一化源坐标） */
const EYE_CENTER = new THREE.Vector2(682 / 1280, 324 / 720)
/** 眼区椭圆半径（源坐标） */
const EYE_RADII = new THREE.Vector2(36 / 1280, 48 / 720)
/** 视线最大位移（源坐标 px → UV） */
const GAZE_MAX = new THREE.Vector2(7.5 / 1280, 4 / 720)
/** 脸部椭圆（捏脸命中测试用，源坐标） */
export const FACE_CENTER = new THREE.Vector2(0.52, 0.45)
export const FACE_RADII = new THREE.Vector2(0.155, 0.215)

/** 取景淡出窗口 */
const FADE_START = 0.02
const FADE_END = 0.05

/** punch-in：复刻旧 face-video 的裁剪（scale 1.12 / origin 50% 42%） */
const PUNCH = 1.12
const PUNCH_ANCHOR = new THREE.Vector2(0.5, 0.42)

const PLATE_ASPECT = 16 / 9

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  uniform vec2 uPressUv;
  uniform float uPressRadius;
  uniform float uPressStrength;
  uniform float uPressSquash;
  uniform float uAspect;
  uniform vec2 uGaze;
  uniform vec2 uEyeCenter;
  uniform vec2 uEyeRadii;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // ---- 1. 捏脸：屏幕 UV 空间位移（与立绘 plateShader 同一套手感）----
    float dent = 0.0;
    if (uPressStrength > 0.0005) {
      vec2 rel = uv - uPressUv;
      rel.x *= uAspect;
      float d = length(rel);
      float f = 1.0 - smoothstep(0.0, uPressRadius, d);
      f = f * f;
      uv -= (uv - uPressUv) * f * uPressStrength * 0.78;
      vec2 spread = uv - uPressUv;
      spread.x *= 1.0 + f * uPressSquash;
      spread.y *= 1.0 - f * uPressSquash * 0.6;
      uv = uPressUv + spread;
      dent = f * (1.0 - f) * 4.0;
    }

    // ---- 2. cover + punch-in：映射到源视频 UV ----
    vec2 texUv = clamp(uv, vec2(0.0), vec2(1.0)) * uUvScale + uUvOffset;

    // ---- 3. 眼神跟随：把可见眼睛区域朝视线方向软移 ----
    if (length(uGaze) > 0.00001) {
      vec2 d = (texUv - uEyeCenter) / uEyeRadii;
      float r = length(d);
      if (r < 1.0) {
        float w = 1.0 - r;
        w = w * w;                    // 软衰减到眼区边缘
        texUv += uGaze * w;
      }
    }

    vec4 color = texture2D(uMap, texUv);
    color.rgb *= 1.0 - 0.18 * dent * uPressStrength;

    gl_FragColor = vec4(color.rgb, uOpacity);
  }
`

interface FaceVideoOptions {
  camera: THREE.PerspectiveCamera
  /** 主源：压缩后的 mp4（约 250KB，硬件解码，最顺） */
  video: HTMLVideoElement
  /** 备源：GIF（视频不可用时兜底） */
  fallbackImg?: HTMLImageElement | null
}

export class FaceVideoLayer {
  readonly object3d = new THREE.Mesh()
  private readonly camera: THREE.PerspectiveCamera
  private readonly video: HTMLVideoElement
  private readonly fallbackImg: HTMLImageElement | null

  private readonly uniforms = {
    uMap: { value: null as THREE.Texture | null },
    uOpacity: { value: 0 },
    uUvScale: { value: new THREE.Vector2(1, 1) },
    uUvOffset: { value: new THREE.Vector2(0, 0) },
    uPressUv: { value: new THREE.Vector2(0.5, 0.5) },
    uPressRadius: { value: 0.22 },
    uPressStrength: { value: 0 },
    uPressSquash: { value: 0.08 },
    uAspect: { value: 16 / 9 },
    uGaze: { value: new THREE.Vector2() },
    uEyeCenter: { value: EYE_CENTER.clone() },
    uEyeRadii: { value: EYE_RADII.clone() },
  }

  private readonly press = createSpring(SPRING.pinch)
  private readonly gazeX = createSpring({ stiffness: 46, damping: 15, mass: 1 })
  private readonly gazeY = createSpring({ stiffness: 46, damping: 15, mass: 1 })
  private readonly pointer = new THREE.Vector2(0, 0)
  private framing = 0
  private aspect = 16 / 9
  private usingFallback = false
  private fallbackCanvas: HTMLCanvasElement | null = null
  private disposed = false
  private smoothStrength = 0
  private lastOpacity = -1

  constructor(opts: FaceVideoOptions) {
    this.camera = opts.camera
    this.video = opts.video
    this.fallbackImg = opts.fallbackImg ?? null

    const texture = new THREE.VideoTexture(opts.video)
    texture.colorSpace = THREE.NoColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    this.uniforms.uMap.value = texture

    this.object3d.name = 'FaceVideoLayer'
    const geometry = new THREE.PlaneGeometry(1, 1)
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    this.object3d.geometry = geometry
    this.object3d.material = material
    this.object3d.position.set(0, 0, SUBJECT_Z)
    this.object3d.renderOrder = 10
    this.object3d.frustumCulled = false
    this.camera.add(this.object3d)

    // 视频源挂了 → 切 GIF 兜底
    const onError = (): void => this.switchToFallback()
    opts.video.addEventListener('error', onError, { once: true })
    this.resize()
  }

  private switchToFallback(): void {
    if (this.disposed || this.usingFallback || !this.fallbackImg) return
    this.usingFallback = true
    const canvas = document.createElement('canvas')
    canvas.width = this.fallbackImg.naturalWidth || 400
    canvas.height = this.fallbackImg.naturalHeight || 225
    const ctx = canvas.getContext('2d')
    this.fallbackCanvas = canvas
    if (ctx && this.fallbackImg.complete) ctx.drawImage(this.fallbackImg, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.NoColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    const old = this.uniforms.uMap.value
    this.uniforms.uMap.value = tex
    old?.dispose()
  }

  /** 屏幕像素 → 源视频 UV（逆推 cover + punch 映射），捏脸命中用 */
  private screenToSource(clientX: number, clientY: number): THREE.Vector2 {
    const sx = clientX / window.innerWidth
    const sy = clientY / window.innerHeight
    return new THREE.Vector2(sx, sy)
      .multiply(this.uniforms.uUvScale.value)
      .add(this.uniforms.uUvOffset.value)
  }

  /** 指针是否落在脸上（源坐标椭圆命中） */
  isOnFace(clientX: number, clientY: number): boolean {
    const s = this.screenToSource(clientX, clientY)
    const d = new THREE.Vector2(
      (s.x - FACE_CENTER.x) / FACE_RADII.x,
      (s.y - FACE_CENTER.y) / FACE_RADII.y,
    )
    return d.lengthSq() <= 1
  }

  setFraming(t: number): void {
    this.framing = t
  }

  setPointer(ndc: THREE.Vector2): void {
    this.pointer.copy(ndc)
  }

  /** 捏脸：point 为屏幕 UV，null 松开 */
  setPress(point: { x: number; y: number } | null, strength: number): void {
    if (point) this.uniforms.uPressUv.value.set(point.x, point.y)
    this.press.to(point ? clamp01(strength) : 0)
  }

  get pinchStrength(): number {
    return this.smoothStrength
  }

  resize(): void {
    const cam = this.camera
    this.aspect = cam.aspect
    const tan = Math.tan((cam.fov * Math.PI) / 360)
    const h = 2 * Math.abs(SUBJECT_Z) * tan
    this.object3d.scale.set(h * cam.aspect, h, 1)

    // cover：16:9 源铺满任意视口 + punch-in 裁剪窗
    const B = cam.aspect
    let S: THREE.Vector2
    if (B >= PLATE_ASPECT) S = new THREE.Vector2(B / PLATE_ASPECT, 1)
    else S = new THREE.Vector2(1, PLATE_ASPECT / B)
    const baseO = new THREE.Vector2((1 - S.x) / 2, (1 - S.y) / 2)
    // punch：uv' = (uv - a)/s + a → S' = S/s, O' = O + S*a*(1-1/s)
    const s = PUNCH
    this.uniforms.uUvScale.value.copy(S).divideScalar(s)
    this.uniforms.uUvOffset.value
      .copy(baseO)
      .add(S.clone().multiply(PUNCH_ANCHOR).multiplyScalar(1 - 1 / s))
    this.uniforms.uAspect.value = cam.aspect
  }

  update(dt: number): void {
    if (this.disposed) return
    if (Math.abs(this.camera.aspect - this.aspect) > 0.001) this.resize()

    // 取景淡出：0.02→0.05 之内完全消失（对话舞台中心 = 0.06，绝不重叠出重影）
    const t = clamp01((this.framing - FADE_START) / (FADE_END - FADE_START))
    const opacity = 1 - t
    this.uniforms.uOpacity.value = opacity
    const visible = opacity > 0.004

    if (visible !== (this.lastOpacity > 0.004)) {
      this.lastOpacity = opacity
      if (visible) {
        if (!this.usingFallback && this.video.paused) {
          void this.video.play().catch(() => undefined)
        }
      } else {
        if (!this.usingFallback && !this.video.paused) this.video.pause()
      }
    }
    this.lastOpacity = opacity
    this.object3d.visible = visible

    if (!visible) {
      this.smoothStrength += (0 - this.smoothStrength) * Math.min(1, dt * 20)
      return
    }

    // 视频帧推给 GPU
    const tex = this.uniforms.uMap.value
    if (tex instanceof THREE.VideoTexture) {
      tex.needsUpdate = true
    } else if (this.usingFallback && tex instanceof THREE.CanvasTexture && this.fallbackCanvas) {
      const ctx = this.fallbackCanvas.getContext('2d')
      if (ctx && this.fallbackImg?.complete) ctx.drawImage(this.fallbackImg, 0, 0)
      tex.needsUpdate = true
    }

    // 捏脸强度（弹簧）
    const strength = this.press.update(dt)
    this.smoothStrength = strength
    this.uniforms.uPressStrength.value = strength
    this.uniforms.uPressSquash.value = 0.08 + strength * 0.12

    // 视线：指针驱动 + 死区 + 弹簧低通（帧率无关）
    if (!motionPrefs.reduced) {
      const dx = this.pointer.x * 1.6
      const dy = this.pointer.y * 1.5
      const dz = 0.14
      const dead = (v: number): number => {
        const a = Math.abs(v)
        if (a <= dz) return 0
        const k = (a - dz) / (1 - dz)
        return Math.sign(v) * k * k * (3 - 2 * k)
      }
      this.gazeX.to(clamp(dead(dx), -1, 1) * GAZE_MAX.x)
      this.gazeY.to(clamp(dead(dy), -1, 1) * GAZE_MAX.y)
    }
    const gx = this.gazeX.update(dt)
    const gy = this.gazeY.update(dt)
    this.uniforms.uGaze.value.set(gx, gy)
  }

  dispose(): void {
    this.disposed = true
    this.camera.remove(this.object3d)
    this.object3d.geometry.dispose()
    ;(this.object3d.material as THREE.Material).dispose()
    this.uniforms.uMap.value?.dispose()
  }
}
