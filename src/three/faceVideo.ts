import * as THREE from 'three'
import { clamp, clamp01, motionPrefs, smoothstep } from '../lib/motionPrefs'
import { createSpring, SPRING } from '../lib/spring'

/** One portrait. Gaze is a bounded 2D texture warp, not a 3D reconstruction.
 * Source coordinates are calibrated for this clip; replacing it needs recalibration. */
const Z = -2
const SOURCE_ASPECT = 16 / 9
// time, left eye x/y, right eye x/y, openness; source has top-left origin.
const EYES: readonly (readonly number[])[] = [
  [0, .389, .222, .631, .147, 1],
  [.98, .391, .250, .648, .167, .08],
  [1.96, .398, .219, .641, .144, 1],
  [2.94, .398, .211, .652, .139, 1],
  [3.92, .401, .236, .658, .172, .55],
  [5, .406, .219, .662, .161, 1],
]
const VERTEX = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const FRAGMENT = `
uniform sampler2D uMap;
uniform float uOpacity;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;
uniform vec2 uPressUv;
uniform vec2 uDrag;
uniform float uPressStrength;
uniform float uAspect;
uniform vec2 uGaze;
uniform vec2 uEyeLeft;
uniform vec2 uEyeRight;
uniform float uEyeOpen;
uniform float uEdgeFade;
varying vec2 vUv;
float eyeWeight(vec2 uv, vec2 center) {
  vec2 rel = (uv - center) / vec2(.035, .029);
  return pow(1.0 - smoothstep(0.0, 1.0, length(rel)), 2.0);
}
void main() {
  vec2 uv = vUv;
  vec2 rel = uv - uPressUv;
  rel.x *= uAspect;
  float w = pow(1.0 - smoothstep(0.0, .20, length(rel)), 1.5);
  uv -= uDrag * w * uPressStrength * 1.55;
  uv -= (uv - uPressUv) * w * uPressStrength * .42;
  vec2 source = uv * uUvScale + uUvOffset;
  float eye = max(eyeWeight(source, uEyeLeft), eyeWeight(source, uEyeRight));
  source -= uGaze * eye * uEyeOpen;
  vec4 color = texture2D(uMap, clamp(source, vec2(0.0), vec2(1.0)));
  gl_FragColor = vec4(color.rgb, uOpacity * mix(1.0, smoothstep(0.0, .16, vUv.y), uEdgeFade));
}
`
interface Options {
  camera: THREE.PerspectiveCamera
  video: HTMLVideoElement
  fallbackImg?: HTMLImageElement | null
}
export class FaceVideoLayer {
  readonly object3d: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private readonly camera: THREE.PerspectiveCamera
  private readonly video: HTMLVideoElement
  private readonly poster: THREE.Texture
  private readonly videoTexture: THREE.VideoTexture
  private readonly press = createSpring(SPRING.pinch)
  private readonly gazeX = createSpring({ stiffness: 46, damping: 15, mass: 1 })
  private readonly gazeY = createSpring({ stiffness: 46, damping: 15, mass: 1 })
  private readonly pointer = new THREE.Vector2()
  private readonly drag = new THREE.Vector2()
  private readonly uniforms = {
    uMap: { value: null as THREE.Texture | null }, uOpacity: { value: 1 },
    uUvScale: { value: new THREE.Vector2(1, 1) }, uUvOffset: { value: new THREE.Vector2() },
    uPressUv: { value: new THREE.Vector2(.5, .5) }, uDrag: { value: new THREE.Vector2() },
    uPressStrength: { value: 0 }, uAspect: { value: 1 },
    uGaze: { value: new THREE.Vector2() },
    uEyeLeft: { value: new THREE.Vector2(.389, .778) },
    uEyeRight: { value: new THREE.Vector2(.631, .853) }, uEyeOpen: { value: 1 },
    uEdgeFade: { value: 0 },
  }
  private opacity = 1
  private regionHeight = 1
  private aspect = 0
  private disposed = false
  private failed = false
  private playPending = false
  private strength = 0
  private currentFrame: 'pending' | 'poster' | 'video' = 'pending'
  private readonly onError = (): void => { this.failed = true }
  private readonly onVisibility = (): void => { if (document.hidden) this.video.pause() }
  private readonly onContextLost = (): void => {
    this.video.pause()
    document.documentElement.dataset.faceRendered = '0'
  }
  constructor(opts: Options) {
    this.camera = opts.camera
    this.video = opts.video
    this.failed = Boolean(opts.video.error)
    this.poster = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}video/doubao_face_v3_still.webp`)
    this.poster.colorSpace = THREE.NoColorSpace
    this.videoTexture = new THREE.VideoTexture(opts.video)
    this.videoTexture.colorSpace = THREE.NoColorSpace
    this.videoTexture.generateMipmaps = false
    this.uniforms.uMap.value = this.poster
    this.object3d = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    }))
    this.object3d.name = 'FaceVideoLayer'
    this.object3d.position.z = Z
    this.object3d.renderOrder = 10
    this.object3d.frustumCulled = false
    this.camera.add(this.object3d)
    this.video.addEventListener('error', this.onError)
    document.addEventListener('visibilitychange', this.onVisibility)
    document.getElementById('stage')?.addEventListener('webglcontextlost', this.onContextLost)
    this.resize()
  }
  private localUv(x: number, y: number): THREE.Vector2 {
    return new THREE.Vector2(x, (y - (1 - this.regionHeight)) / this.regionHeight)
  }
  isOnFace(x: number, y: number): boolean {
    if (this.opacity < .7 || motionPrefs.reduced) return false
    const local = this.localUv(x / window.innerWidth, 1 - y / window.innerHeight)
    if (local.y < 0 || local.y > 1) return false
    const src = local.multiply(this.uniforms.uUvScale.value).add(this.uniforms.uUvOffset.value)
    const sy = 1 - src.y
    return sy > .32 && sy < .69 && ((src.x > .29 && src.x < .46) || (src.x > .59 && src.x < .75))
  }
  setFraming(_t: number): void {
    const hero = document.getElementById('hero')
    if (!hero) return
    const height = hero.offsetHeight
    this.opacity = 1 - smoothstep(clamp01((window.scrollY - height * .08) / (height * .78)))
  }
  setPointer(ndc: THREE.Vector2): void { this.pointer.copy(ndc) }
  setPress(point: { x: number; y: number } | null, strength: number): void {
    if (point) this.uniforms.uPressUv.value.copy(this.localUv(point.x, point.y))
    this.press.to(point ? clamp(strength, 0, 1) : 0)
    if (!point) this.drag.set(0, 0)
  }
  setDrag(x: number, y: number): void {
    this.drag.set(clamp(x, -.075, .075), clamp(y / this.regionHeight, -.075, .075))
  }
  get pinchStrength(): number { return this.strength }
  get visible(): boolean { return this.object3d.visible }
  get frameMode(): 'pending' | 'poster' | 'video' { return this.currentFrame }
  get staticMode(): boolean { return this.failed || motionPrefs.reduced || document.documentElement.dataset.motion === 'paused' }
  getScreenPoint(sourceX: number, sourceY: number): { x: number; y: number } {
    const uv = this.uniforms.uUvScale.value
    const offset = this.uniforms.uUvOffset.value
    const x = (sourceX - offset.x) / uv.x
    const localY = (1 - sourceY - offset.y) / uv.y
    return { x: x * window.innerWidth, y: (1 - (localY * this.regionHeight + 1 - this.regionHeight)) * window.innerHeight }
  }
  resize(): void {
    this.aspect = this.camera.aspect
    this.regionHeight = window.innerWidth <= 767 ? .60 : 1
    this.uniforms.uEdgeFade.value = Number(window.innerWidth <= 767)
    const viewH = 2 * Math.abs(Z) * Math.tan(this.camera.fov * Math.PI / 360)
    this.object3d.scale.set(viewH * this.aspect, viewH * this.regionHeight, 1)
    this.object3d.position.y = viewH * (1 - this.regionHeight) / 2
    const regionAspect = this.aspect / this.regionHeight
    const scale = new THREE.Vector2(Math.min(1, regionAspect / SOURCE_ASPECT), Math.min(1, SOURCE_ASPECT / regionAspect))
    scale.divideScalar(window.innerWidth <= 767 ? 1.02 : 1.06)
    this.uniforms.uUvScale.value.copy(scale)
    const targetX = window.innerWidth <= 767 ? .5 : .54
    this.uniforms.uUvOffset.value.set(.52 - scale.x * targetX, .5 - scale.y * .5)
    this.uniforms.uAspect.value = regionAspect
  }
  update(dt: number): void {
    if (this.disposed) return
    if (Math.abs(this.camera.aspect - this.aspect) > .001) this.resize()
    const frozen = motionPrefs.reduced
    const videoPaused = frozen || document.documentElement.dataset.motion === 'paused'
    const visible = this.opacity > .003 && !document.hidden
    this.object3d.visible = visible
    this.uniforms.uOpacity.value = this.opacity
    if (!visible || videoPaused) {
      if (!this.video.paused) this.video.pause()
    } else if (!this.failed && this.video.paused && !this.playPending) {
      this.playPending = true
      void this.video.play().catch((error: unknown) => {
        // An intentional pause during buffering cancels play; it is retryable.
        if (!(error instanceof DOMException && error.name === 'AbortError')) this.failed = true
      }).finally(() => { this.playPending = false })
    }
    if (!visible) return
    const hasVideo = !this.failed && this.video.readyState >= 2
    this.uniforms.uMap.value = hasVideo ? this.videoTexture : this.poster
    this.currentFrame = hasVideo ? 'video' : ((this.poster.image as HTMLImageElement | undefined)?.naturalWidth ?? 0) > 0 ? 'poster' : 'pending'
    this.strength = this.press.update(dt)
    this.uniforms.uPressStrength.value = frozen ? 0 : this.strength
    this.uniforms.uDrag.value.lerp(this.drag, 1 - Math.exp(-18 * dt))
    this.gazeX.to(frozen ? 0 : clamp(this.pointer.x, -1, 1) * .0028)
    this.gazeY.to(frozen ? 0 : clamp(this.pointer.y, -1, 1) * .003)
    this.uniforms.uGaze.value.set(this.gazeX.update(dt), this.gazeY.update(dt))
    const time = hasVideo ? this.video.currentTime : .98
    const index = EYES.findIndex((frame, i) => i < EYES.length - 1 && time >= frame[0]! && time < EYES[i + 1]![0]!)
    const a = EYES[Math.max(0, index)]!
    const b = EYES[Math.min(EYES.length - 1, Math.max(0, index) + 1)]!
    const mix = clamp01((time - a[0]!) / Math.max(.001, b[0]! - a[0]!))
    const lerp = (n: number): number => a[n]! + (b[n]! - a[n]!) * mix
    this.uniforms.uEyeLeft.value.set(lerp(1), 1 - lerp(2))
    this.uniforms.uEyeRight.value.set(lerp(3), 1 - lerp(4))
    this.uniforms.uEyeOpen.value = hasVideo ? lerp(5) : 0
  }
  dispose(): void {
    this.disposed = true
    this.video.pause()
    this.video.removeEventListener('error', this.onError)
    document.removeEventListener('visibilitychange', this.onVisibility)
    document.getElementById('stage')?.removeEventListener('webglcontextlost', this.onContextLost)
    this.camera.remove(this.object3d)
    this.object3d.geometry.dispose()
    this.object3d.material.dispose()
    this.videoTexture.dispose()
    this.poster.dispose()
  }
}
